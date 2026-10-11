import { Body, Controller, Get, Param, Patch, Post, Query, Res, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { memoryStorage } from 'multer';
import { z } from 'zod';
import { KYC_MAX_BYTES, kycReviewSchema, kycUploadMetaSchema, paginationSchema, type KycReviewInput, type KycUploadMeta } from '@spova/shared';
import { KycService } from './kyc.service';
import { KycDeadlineService } from './kyc-deadline.service';
import { ClientIp, CurrentUser, Roles } from '../../common/auth/decorators';
import { ADMIN_ROLES, type AuthUser } from '../../common/auth/auth.types';
import { ZodPipe } from '../../common/pipes/zod.pipe';
import { ApiError } from '../../common/errors';

const queueQuery = paginationSchema.extend({
  status: z.enum(['pending', 'approved', 'rejected']).optional(),
  userId: z.string().uuid().optional(),
});

/** Streams a stored document with headers that stop the browser from executing it. */
async function stream(res: Response, svc: KycService, docId: string, requester: { id: string; isAdmin: boolean }) {
  const { doc, stored } = await svc.file(docId, requester);
  res.setHeader('Content-Type', doc.mime);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('Content-Disposition', `inline; filename="${doc.originalName.replace(/[^\w.\- ]/g, '_')}"`);
  if (stored.size) res.setHeader('Content-Length', String(stored.size));
  stored.body.pipe(res);
}

@Controller('me/kyc')
export class KycController {
  constructor(private readonly kyc: KycService) {}

  @Get('status')
  status(@CurrentUser() user: AuthUser) {
    return this.kyc.status(user.id);
  }

  @Get('documents')
  list(@CurrentUser() user: AuthUser) {
    return this.kyc.list(user.id);
  }

  /** multipart/form-data: fields group, docType + one `file` (jpg/png/webp/pdf, max 10 MB). */
  @Post('documents')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: KYC_MAX_BYTES, files: 1 } }))
  upload(@CurrentUser() user: AuthUser, @Body(new ZodPipe(kycUploadMetaSchema)) meta: KycUploadMeta, @UploadedFile() file?: Express.Multer.File) {
    if (!file) throw ApiError.badRequest('file_missing', 'Attach a file');
    return this.kyc.upload(user.id, meta, file);
  }

  @Get('documents/:id/file')
  file(@CurrentUser() user: AuthUser, @Param('id') id: string, @Res() res: Response) {
    return stream(res, this.kyc, id, { id: user.id, isAdmin: ADMIN_ROLES.includes(user.role) });
  }
}

@Controller('admin/kyc')
@Roles('admin', 'superadmin')
export class KycAdminController {
  constructor(
    private readonly kyc: KycService,
    private readonly deadline: KycDeadlineService,
  ) {}

  /** Clients still missing documents: frozen first, then by deadline. */
  @Get('deadlines')
  deadlines() {
    return this.deadline.deadlines();
  }

  /** Run the reminder / freeze sweep now instead of waiting for the hourly tick. */
  @Post('sweep')
  sweep() {
    return this.deadline.sweep();
  }

  @Post('users/:id/unfreeze')
  unfreeze(@CurrentUser() actor: AuthUser, @ClientIp() ip: string, @Param('id') id: string) {
    return this.deadline.unfreeze({ id: actor.id, ip }, id);
  }

  @Get()
  queue(@Query(new ZodPipe(queueQuery)) q: z.infer<typeof queueQuery>) {
    return this.kyc.queue(q);
  }

  @Get(':id/file')
  file(@CurrentUser() user: AuthUser, @Param('id') id: string, @Res() res: Response) {
    return stream(res, this.kyc, id, { id: user.id, isAdmin: true });
  }

  @Patch(':id')
  review(@CurrentUser() actor: AuthUser, @ClientIp() ip: string, @Param('id') id: string, @Body(new ZodPipe(kycReviewSchema)) body: KycReviewInput) {
    return this.kyc.review({ id: actor.id, ip }, id, body);
  }
}
