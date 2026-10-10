'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useSearchParams } from 'next/navigation';
import { Building2, ChevronDown, FileText, FileUser, FolderOpen, Landmark, QrCode, X } from 'lucide-react';
import { KYC_DOC_TYPES, KYC_GROUPS, WS_EVENTS, type KycDocumentDto, type KycGroup, type KycStatusMap, type WsKycStatus } from '@spova/shared';
import { useAuth } from '@/lib/auth-context';
import { fileUrl, get } from '@/lib/api';
import { useUserEvent } from '@/lib/ws';
import { cn, fmtDate } from '@/lib/utils';
import { Skeleton } from '@/components/ui';
import { UploadZone, type UploadZoneHandle } from './upload-zone';
import { MobileUploadQr } from './mobile-upload-qr';

type GroupStatus = KycStatusMap['poi'];

const SECTIONS: { group: KycGroup; title: string; icon: ReactNode }[] = [
  { group: 'poi', title: 'Proof of identity', icon: <FileUser /> },
  { group: 'por', title: 'Proof of residence', icon: <Building2 /> },
  { group: 'payment', title: 'Payment documents', icon: <Landmark /> },
  { group: 'other', title: 'Other documents', icon: <FolderOpen /> },
];

const PILL: Record<GroupStatus, { label: string; cls: string }> = {
  incomplete: { label: 'Incomplete', cls: 'bg-[#fff1cc] text-[#b35c00]' },
  pending: { label: 'Pending', cls: 'bg-[#dbeafe] text-[#1d4ed8]' },
  approved: { label: 'Approved', cls: 'bg-[#dcfce7] text-[#15803d]' },
  rejected: { label: 'Rejected', cls: 'bg-[#fee2e2] text-[#b91c1c]' },
};

/** Status pill of a KYC group / document: Incomplete (amber), Pending (blue), Approved, Rejected. */
export function DocPill({ status, className }: { status: GroupStatus; className?: string }) {
  const p = PILL[status] ?? PILL.incomplete;
  return <span className={cn('inline-flex shrink-0 items-center rounded-md px-2 py-0.5 text-[13px] font-medium', p.cls, className)}>{p.label}</span>;
}

const isGroup = (v: string | null): v is KycGroup => !!v && (KYC_GROUPS as readonly string[]).includes(v);

/**
 * The client-area "Documents" module as in the reference: centered title, one collapsible section per
 * document group with a status pill and file count, a document-type picker, Upload and Mobile Device
 * (QR) buttons, and the uploaded files as cards. Used as a page (/app/documents) and as the terminal overlay.
 */
export function DocumentsPanel({ onClose, className }: { onClose?: () => void; className?: string }) {
  const { refresh } = useAuth();
  const params = useSearchParams();
  const [status, setStatus] = useState<KycStatusMap | null>(null);
  const [docs, setDocs] = useState<KycDocumentDto[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<KycGroup | null>(null);

  const load = useCallback(async () => {
    try {
      const [s, d] = await Promise.all([get<KycStatusMap>('/me/kyc/status'), get<KycDocumentDto[]>('/me/kyc/documents')]);
      setStatus(s);
      setDocs(d);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // a reviewer decided: refresh the lists and the account flags
  useUserEvent<WsKycStatus>(WS_EVENTS.KYC_STATUS, () => {
    void load();
    void refresh();
  });

  const groupStatus = useCallback(
    (g: KycGroup): GroupStatus => {
      if (g === 'other') {
        const mine = docs?.filter((d) => d.group === 'other') ?? [];
        return mine.some((d) => d.status === 'approved') ? 'approved' : (mine[0]?.status ?? 'incomplete');
      }
      return status?.[g] ?? 'incomplete';
    },
    [docs, status],
  );

  // first visit: open the section named in the URL (phone hand-off) or the first one still to do
  useEffect(() => {
    if (open !== null || !status || !docs) return;
    const fromUrl = params.get('group');
    if (isGroup(fromUrl)) {
      setOpen(fromUrl);
      return;
    }
    setOpen(SECTIONS.find((s) => groupStatus(s.group) !== 'approved')?.group ?? 'poi');
  }, [open, status, docs, params, groupStatus]);

  const onUploaded = (doc: KycDocumentDto) => {
    setDocs((d) => [doc, ...(d ?? [])]);
    setStatus((s) => (s && s[doc.group as keyof KycStatusMap] !== 'approved' ? { ...s, [doc.group]: 'pending' } : s));
  };

  return (
    <div className={cn('relative', className)}>
      {onClose && (
        <button type="button" onClick={onClose} aria-label="Close" className="absolute right-0 top-0 flex h-9 w-9 items-center justify-center rounded-full text-ink-400 transition-colors hover:bg-ink-900 hover:text-white">
          <X className="h-5 w-5" />
        </button>
      )}
      <h1 className="text-center font-display text-[1.65rem] font-bold tracking-tight text-white">Documents</h1>
      <p className="mt-2 text-center text-[15px] text-ink-300">Please, add the document that proves your identity and physical address.</p>

      <div className="mt-6 space-y-3">
        {status === null || docs === null ? (
          <>
            {SECTIONS.map((s) => (
              <Skeleton key={s.group} className="h-[68px] rounded-xl" />
            ))}
            {error && <p className="text-sm text-down">{error}</p>}
          </>
        ) : (
          SECTIONS.map((s) => (
            <Section
              key={s.group}
              group={s.group}
              title={s.title}
              icon={s.icon}
              status={groupStatus(s.group)}
              docs={docs.filter((d) => d.group === s.group)}
              open={open === s.group}
              onToggle={() => setOpen((o) => (o === s.group ? null : s.group))}
              onUploaded={onUploaded}
              initialType={params.get('group') === s.group ? params.get('type') : null}
            />
          ))
        )}
      </div>
    </div>
  );
}

function Section({ group, title, icon, status, docs, open, onToggle, onUploaded, initialType }: { group: KycGroup; title: string; icon: ReactNode; status: GroupStatus; docs: KycDocumentDto[]; open: boolean; onToggle: () => void; onUploaded: (d: KycDocumentDto) => void; initialType: string | null }) {
  const types = KYC_DOC_TYPES[group];
  const [docType, setDocType] = useState(() => (initialType && types.some((t) => t.value === initialType) ? initialType : types[0].value));
  const [qr, setQr] = useState(false);
  const zone = useRef<UploadZoneHandle>(null);
  const bodyId = `docs-${group}`;

  return (
    <section className="animate-page-in">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={bodyId}
        className={cn('flex w-full items-center gap-2.5 rounded-xl bg-[#eef0f7] px-3 py-3.5 text-left sm:gap-3.5 sm:px-4 transition-colors hover:bg-[#e7eaf3]', open && 'rounded-b-xl')}
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center text-[#5b4fcf] [&>svg]:h-7 [&>svg]:w-7">{icon}</span>
        <span className="min-w-0 flex-1 text-[15px] font-semibold leading-tight text-white sm:truncate sm:text-lg">{title}</span>
        <DocPill status={status} />
        <span className="inline-flex items-center gap-1 text-[15px] text-white">
          {docs.length}
          <FileText className="h-4 w-4 text-ink-300" />
        </span>
        <ChevronDown className={cn('h-5 w-5 text-ink-300 transition-transform duration-300', open && 'rotate-180')} />
      </button>

      {open && (
        <div id={bodyId} className="animate-page-in px-0 pb-2 pt-4">
          <div className="flex flex-wrap items-center gap-3 sm:flex-nowrap">
            <label className="relative block w-full min-w-0 sm:w-56">
              <span className="pointer-events-none absolute -top-2 left-3 bg-paper px-1 text-[12px] text-ink-400">Choose document ...</span>
              <select
                value={docType}
                onChange={(e) => setDocType(e.target.value)}
                aria-label={`${title}: document type`}
                className="h-12 w-full appearance-none rounded-md border border-ink-700 bg-paper pl-4 pr-10 text-[15px] text-white outline-none transition-colors focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
              >
                {types.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
            </label>
            <UploadZone ref={zone} variant="button" group={group} docType={docType} onUploaded={onUploaded} className="flex-1 sm:max-w-[190px]" />
            <button
              type="button"
              onClick={() => setQr(true)}
              className="inline-flex h-12 flex-1 items-center justify-center gap-2.5 rounded-full border border-ink-700 bg-paper px-5 text-[15px] font-medium text-white transition-colors hover:border-ink-500 hover:bg-ink-950 sm:max-w-[240px]"
            >
              <QrCode className="h-5 w-5" /> Mobile Device
            </button>
          </div>

          {docs.length > 0 && (
            <ul className="mt-5 flex flex-wrap gap-3">
              {docs.map((d, i) => (
                <DocCard key={d.id} doc={d} index={i} />
              ))}
            </ul>
          )}

          {qr && <MobileUploadQr group={group} docType={docType} title={title} onClose={() => setQr(false)} />}
        </div>
      )}
    </section>
  );
}

const labelOf = (group: KycGroup, value: string) => KYC_DOC_TYPES[group].find((t) => t.value === value)?.label ?? value;

function DocCard({ doc, index }: { doc: KycDocumentDto; index: number }) {
  const href = fileUrl(`/me/kyc/documents/${doc.id}/file`);
  const image = doc.mime.startsWith('image/');
  const [broken, setBroken] = useState(false);
  const when = useMemo(() => fmtDate(doc.createdAt), [doc.createdAt]);
  return (
    <li className="animate-pop-in w-[162px] rounded-xl bg-[#f3f4f9] p-2.5" style={{ animationDelay: `${index * 60}ms` }} title={`${doc.originalName} · ${when}`}>
      <div className="truncate text-[14px] font-semibold text-white">{labelOf(doc.group, doc.docType)}</div>
      <a href={href} target="_blank" rel="noreferrer" className="mt-2 block h-[108px] overflow-hidden rounded-lg bg-paper ring-1 ring-inset ring-ink-800" title="Open file">
        {image && !broken ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={href} alt="" className="h-full w-full object-cover object-top" onError={() => setBroken(true)} />
        ) : (
          <span className="flex h-full w-full flex-col items-center justify-center gap-1 text-ink-400">
            <FileText className="h-7 w-7" />
            <span className="font-mono text-[10px] uppercase">{doc.mime === 'application/pdf' ? 'pdf' : 'file'}</span>
          </span>
        )}
      </a>
      <div className="mt-2 truncate text-[13px] text-ink-400">{doc.originalName}</div>
      <DocPill status={doc.status} className="mt-2" />
      {doc.status === 'rejected' && doc.rejectReason && <p className="mt-1.5 text-[12px] leading-snug text-down">{doc.rejectReason}</p>}
    </li>
  );
}
