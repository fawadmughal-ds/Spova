'use client';

import { useRef, useState, type ReactNode } from 'react';
import { ExternalLink, FileText, Plus, RotateCcw, ShieldCheck } from 'lucide-react';
import { KYC_DOC_TYPES, type KycDocumentDto, type KycGroup, type KycStatusMap } from '@spova/shared';
import { fileUrl } from '@/lib/api';
import { cn, fmtDate } from '@/lib/utils';
import { Select } from '@/components/ui';
import { KycChip } from './status-chip';
import { UploadZone, fmtBytes, type UploadZoneHandle } from './upload-zone';

/** One KYC group: status chip, document-type picker, upload zone and the documents already sent. */
export function KycGroupCard({
  group,
  title,
  hint,
  icon,
  status,
  docs,
  onUploaded,
  optional,
  className,
  style,
}: {
  group: KycGroup;
  title: string;
  hint: string;
  icon: ReactNode;
  status: KycStatusMap['poi'];
  docs: KycDocumentDto[];
  onUploaded: (doc: KycDocumentDto) => void;
  optional?: boolean;
  className?: string;
  style?: React.CSSProperties;
}) {
  const types = KYC_DOC_TYPES[group];
  const [docType, setDocType] = useState(types[0].value);
  const [more, setMore] = useState(false);
  const zone = useRef<UploadZoneHandle>(null);
  const approved = status === 'approved';
  const showZone = !approved || more;

  const pickAgain = (doc: KycDocumentDto) => {
    if (types.some((t) => t.value === doc.docType)) setDocType(doc.docType);
    setMore(true);
    // the zone may be mounting this very render; let it settle, then open the picker
    requestAnimationFrame(() => zone.current?.open());
  };

  return (
    <section
      className={cn(
        'card corners flex min-w-0 flex-col p-5 transition-[border-color] duration-500 sm:p-6',
        status === 'rejected' && 'border-down/30',
        status === 'pending' && 'border-sky-400/30',
        approved && 'border-up/30',
        className,
      )}
      style={style}
    >
      <header className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3.5">
          <span
            className={cn(
              'flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border transition-colors duration-500',
              approved ? 'border-up/30 bg-up/10 text-up' : status === 'rejected' ? 'border-down/30 bg-down/10 text-down' : 'border-white/[0.08] bg-white/[0.04] text-brand-300',
            )}
          >
            {icon}
          </span>
          <div className="min-w-0">
            <h2 className="flex flex-wrap items-center gap-x-2 text-lg font-bold leading-tight">
              {title}
              {optional && <span className="label !text-ink-500">optional</span>}
            </h2>
            <p className="mt-0.5 text-xs text-ink-400">{hint}</p>
          </div>
        </div>
        <KycChip status={status} className="shrink-0" />
      </header>

      <div className="mt-5 flex-1 space-y-4">
        {approved && !more && (
          <div className="animate-pop-in flex items-center gap-3 rounded-2xl border border-up/25 bg-up/[0.06] px-4 py-3 text-sm">
            <ShieldCheck className="h-4 w-4 shrink-0 text-up" />
            <span className="flex-1 text-ink-200">Verified. No further action needed.</span>
            <button type="button" onClick={() => setMore(true)} className="group inline-flex shrink-0 items-center gap-1 text-xs font-medium text-brand-300">
              <Plus className="h-3.5 w-3.5 transition-transform duration-500 group-hover:rotate-90" />
              <span className="link-underline">Add another</span>
            </button>
          </div>
        )}

        {showZone && (
          <div className="animate-page-in space-y-3">
            <Select label="Document type" name={`${group}-type`} value={docType} onChange={(e) => setDocType(e.target.value)}>
              {types.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </Select>
            <UploadZone ref={zone} group={group} docType={docType} onUploaded={onUploaded} />
          </div>
        )}

        {docs.length > 0 && (
          <ul className="space-y-2">
            {docs.map((d, i) => (
              <DocumentRow key={d.id} doc={d} index={i} onReplace={() => pickAgain(d)} />
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

const labelOf = (group: KycGroup, value: string) => KYC_DOC_TYPES[group].find((t) => t.value === value)?.label ?? value;

function DocumentRow({ doc, index, onReplace }: { doc: KycDocumentDto; index: number; onReplace: () => void }) {
  const href = fileUrl(`/me/kyc/documents/${doc.id}/file`);
  const image = doc.mime.startsWith('image/');
  const [broken, setBroken] = useState(false);
  return (
    <li
      className={cn(
        'animate-page-in rounded-2xl border p-3 transition-colors duration-500',
        doc.status === 'rejected' ? 'border-down/25 bg-down/[0.04]' : doc.status === 'approved' ? 'border-up/20 bg-up/[0.04]' : 'border-white/[0.07] bg-white/[0.02]',
      )}
      style={{ animationDelay: `${index * 60}ms` }}
    >
      <div className="flex items-center gap-3">
        <a href={href} target="_blank" rel="noreferrer" className="group/thumb relative block h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-ink-900 ring-1 ring-inset ring-white/10" title="Open file">
          {image && !broken ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={href} alt="" className="h-full w-full object-cover transition-transform duration-500 group-hover/thumb:scale-110" onError={() => setBroken(true)} />
          ) : (
            <span className="flex h-full w-full flex-col items-center justify-center gap-0.5 text-ink-400">
              <FileText className="h-5 w-5" />
              <span className="font-mono text-[9px] uppercase">{doc.mime === 'application/pdf' ? 'pdf' : 'file'}</span>
            </span>
          )}
        </a>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="truncate text-sm font-medium text-white">{labelOf(doc.group, doc.docType)}</span>
            <KycChip status={doc.status} />
          </div>
          <div className="mt-1 truncate font-mono text-[11px] text-ink-500">
            {doc.originalName} · {fmtBytes(doc.size)} · {fmtDate(doc.createdAt)}
          </div>
        </div>
        <a href={href} target="_blank" rel="noreferrer" aria-label="Open file" className="hidden h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/10 text-ink-400 transition-colors hover:border-brand-400/50 hover:text-brand-300 sm:flex">
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>
      {doc.status === 'rejected' && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-down/15 pt-3">
          <p className="text-xs text-down">
            <span className="font-semibold">Reason:</span> {doc.rejectReason ?? 'Not specified'}
            {doc.reviewedAt && <span className="text-ink-500"> · {fmtDate(doc.reviewedAt)}</span>}
          </p>
          <button type="button" onClick={onReplace} className="group inline-flex items-center gap-1.5 rounded-full border border-down/30 px-3 py-1 text-xs font-medium text-down transition-colors hover:bg-down/10">
            <RotateCcw className="h-3 w-3 transition-transform duration-500 group-hover:-rotate-180" /> Upload a new one
          </button>
        </div>
      )}
      {doc.status === 'approved' && doc.reviewedAt && <div className="mt-2 text-[11px] text-ink-500">Approved {fmtDate(doc.reviewedAt)}</div>}
    </li>
  );
}
