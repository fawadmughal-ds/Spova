import { Injectable, Logger } from '@nestjs/common';
import { KycDocument, KycGroup, KycStatus, Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { KYC_MAX_BYTES, KYC_MIME_TYPES, WS_EVENTS, type AdminKycRowDto, type KycDocumentDto, type KycReviewInput, type KycStatusMap, type Paginated, type WsKycStatus } from '@spova/shared';
import { PrismaService } from '../../infra/prisma.service';
import { StorageService } from '../../infra/storage.service';
import { MailService } from '../../infra/mail.service';
import { RedisService } from '../../infra/redis.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { ApiError } from '../../common/errors';

interface Actor {
  id: string;
  ip?: string;
}

const EXT: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'application/pdf': 'pdf' };

/** Magic-byte check so a renamed executable cannot be stored as "image/png". */
function sniff(buf: Buffer): string | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (buf.subarray(0, 4).toString('ascii') === 'RIFF' && buf.subarray(8, 12).toString('ascii') === 'WEBP') return 'image/webp';
  if (buf.subarray(0, 5).toString('ascii') === '%PDF-') return 'application/pdf';
  return null;
}

export const kycToDto = (d: KycDocument): KycDocumentDto => ({
  id: d.id,
  group: d.group,
  docType: d.docType,
  originalName: d.originalName,
  mime: d.mime,
  size: d.size,
  status: d.status,
  rejectReason: d.rejectReason,
  createdAt: d.createdAt.toISOString(),
  reviewedAt: d.reviewedAt?.toISOString() ?? null,
});

@Injectable()
export class KycService {
  private readonly log = new Logger('Kyc');

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly mail: MailService,
    private readonly redis: RedisService,
    private readonly ws: RealtimeGateway,
  ) {}

  // ---------------------------------------------------------------- client

  /** Per-group status: the newest document decides; no document = incomplete. */
  async status(userId: string): Promise<KycStatusMap> {
    const docs = await this.prisma.kycDocument.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } });
    const pick = (g: KycGroup): KycStatusMap['poi'] => {
      const inGroup = docs.filter((d) => d.group === g);
      if (inGroup.some((d) => d.status === 'approved')) return 'approved';
      return inGroup[0]?.status ?? 'incomplete';
    };
    return { poi: pick('poi'), por: pick('por'), payment: pick('payment') };
  }

  async list(userId: string): Promise<KycDocumentDto[]> {
    const docs = await this.prisma.kycDocument.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } });
    return docs.map(kycToDto);
  }

  async upload(userId: string, meta: { group: KycGroup; docType: string }, file: { buffer: Buffer; originalname: string; mimetype: string; size: number }) {
    if (!(await this.redis.allow(`kyc:upload:${userId}`, 20, 3600))) throw ApiError.tooMany('Too many uploads. Try again later.');
    if (file.size > KYC_MAX_BYTES) throw ApiError.badRequest('file_too_large', 'File is larger than 10 MB');
    const sniffed = sniff(file.buffer);
    if (!sniffed || !(KYC_MIME_TYPES as readonly string[]).includes(sniffed)) {
      throw ApiError.badRequest('file_type', 'Only JPG, PNG, WEBP or PDF files are accepted');
    }
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { status: true, email: true, profile: { select: { firstName: true, lastName: true } } } });
    if (user.status !== 'active') throw ApiError.forbidden('account_frozen', 'Your account is restricted. Contact support.');

    const key = `kyc/${userId}/${randomUUID()}.${EXT[sniffed]}`;
    await this.storage.put(key, file.buffer, sniffed);
    const doc = await this.prisma.kycDocument.create({
      data: {
        userId,
        group: meta.group,
        docType: meta.docType,
        fileKey: key,
        originalName: file.originalname.slice(0, 200) || `document.${EXT[sniffed]}`,
        mime: sniffed,
        size: file.size,
      },
    });
    this.ws.admin(WS_EVENTS.ADMIN_KYC_NEW, { id: doc.id, userId, group: doc.group, docType: doc.docType, email: user.email, createdAt: doc.createdAt.toISOString() });
    void this.mail.adminAlert('New KYC document', `${user.email} uploaded ${doc.group}/${doc.docType}. Review it in the back office.`).catch((e) => this.log.warn(e.message));
    return kycToDto(doc);
  }

  /** Owner or admin may read the file; it streams through the API so storage stays private. */
  async file(docId: string, requester: { id: string; isAdmin: boolean }) {
    const doc = await this.prisma.kycDocument.findUnique({ where: { id: docId } });
    if (!doc || (!requester.isAdmin && doc.userId !== requester.id)) throw ApiError.notFound('document_not_found', 'Document not found');
    const stored = await this.storage.get(doc.fileKey);
    return { doc, stored };
  }

  // ---------------------------------------------------------------- admin

  async queue(q: { status?: KycStatus; userId?: string; page: number; limit: number }): Promise<Paginated<AdminKycRowDto>> {
    const where: Prisma.KycDocumentWhereInput = { ...(q.status && { status: q.status }), ...(q.userId && { userId: q.userId }) };
    const [total, rows] = await Promise.all([
      this.prisma.kycDocument.count({ where }),
      this.prisma.kycDocument.findMany({
        where,
        orderBy: [{ status: 'asc' }, { createdAt: 'asc' }],
        skip: (q.page - 1) * q.limit,
        take: q.limit,
        include: { user: { select: { id: true, email: true, profile: { select: { firstName: true, lastName: true, countryCode: true } } } } },
      }),
    ]);
    return {
      items: rows.map((d) => ({
        ...kycToDto(d),
        user: { id: d.user.id, email: d.user.email, firstName: d.user.profile?.firstName ?? null, lastName: d.user.profile?.lastName ?? null, countryCode: d.user.profile?.countryCode ?? null },
      })),
      total,
      page: q.page,
      limit: q.limit,
    };
  }

  /** Approve / reject, then recompute the user's kyc flags from the approved documents (never from a single click). */
  async review(actor: Actor, docId: string, input: KycReviewInput) {
    const doc = await this.prisma.kycDocument.findUnique({ where: { id: docId } });
    if (!doc) throw ApiError.notFound('document_not_found', 'Document not found');
    if (doc.status !== 'pending') throw ApiError.conflict('already_reviewed', `Document is already ${doc.status}`);

    const updated = await this.prisma.$transaction(async (tx) => {
      const u = await tx.kycDocument.update({
        where: { id: docId },
        data: { status: input.status, rejectReason: input.status === 'rejected' ? (input.reason ?? null) : null, reviewedBy: actor.id, reviewedAt: new Date() },
      });
      const approved = await tx.kycDocument.findMany({ where: { userId: doc.userId, status: 'approved' }, select: { group: true } });
      const has = (g: KycGroup) => approved.some((a) => a.group === g);
      const before = await tx.user.findUniqueOrThrow({ where: { id: doc.userId }, select: { kycPoi: true, kycPor: true, kycPayment: true } });
      const after = { kycPoi: has('poi'), kycPor: has('por'), kycPayment: has('payment') };
      await tx.user.update({ where: { id: doc.userId }, data: after });
      await tx.adminAudit.create({
        data: {
          actorId: actor.id,
          action: `kyc.${input.status === 'approved' ? 'approve' : 'reject'}`,
          targetType: 'kyc_document',
          targetId: docId,
          before: { status: 'pending', ...before },
          after: { status: input.status, reason: input.reason ?? null, ...after },
          ip: actor.ip,
        },
      });
      await tx.notification.create({
        data: {
          userId: doc.userId,
          type: 'kyc',
          title: `Document ${input.status}`,
          body: input.status === 'approved' ? `Your ${doc.group.toUpperCase()} document was approved.` : `Your ${doc.group.toUpperCase()} document was rejected: ${input.reason}`,
        },
      });
      return u;
    });

    const payload: WsKycStatus = { documentId: docId, group: doc.group, status: updated.status, ...(input.reason && { reason: input.reason }) };
    this.ws.user(doc.userId, WS_EVENTS.KYC_STATUS, payload);
    this.ws.notice(doc.userId, {
      type: 'kyc',
      title: input.status === 'approved' ? 'Document approved' : 'Document rejected',
      body: input.status === 'approved' ? `Your ${labelOf(doc.group)} was approved.` : `${labelOf(doc.group)}: ${input.reason}`,
      level: input.status === 'approved' ? 'success' : 'warning',
    });
    const user = await this.prisma.user.findUnique({ where: { id: doc.userId }, select: { email: true, profile: { select: { notifEmail: true } } } });
    if (user?.profile?.notifEmail) void this.mail.kycResult(user.email, doc.group, input.status, input.reason).catch((e) => this.log.warn(e.message));
    return kycToDto(updated);
  }
}

const labelOf = (g: KycGroup) => ({ poi: 'proof of identity', por: 'proof of residence', payment: 'payment method proof', other: 'document' })[g];
