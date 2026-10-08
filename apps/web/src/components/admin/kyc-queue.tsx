'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight, CheckCircle2, ExternalLink, FileText, ImageOff, ShieldCheck, XCircle } from 'lucide-react';
import { KYC_DOC_TYPES, WS_EVENTS, kycReviewSchema, type AdminKycRowDto, type KycDocumentDto, type KycGroup, type KycStatus, type Paginated } from '@spova/shared';
import { fileUrl, get, patch, ApiError } from '@/lib/api';
import { useUserEvent } from '@/lib/ws';
import { cn, fmtDate } from '@/lib/utils';
import { useToast } from '@/components/toast';
import { Alert, Badge, Button, Card, Empty, Spinner } from '@/components/ui';
import { ClientCell, fmtBytes, Pager, PanelHeader, SidePanel, StatusTabs, TableSkeleton, Textarea, TimeAgo, useQueue } from './queue-bits';

type Tab = KycStatus | 'all';
const TABS: { value: Tab; label: string }[] = [
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'all', label: 'All' },
];

export const KYC_GROUP_LABEL: Record<KycGroup, string> = { poi: 'Proof of identity', por: 'Proof of address', payment: 'Payment method', other: 'Other' };
const GROUP_SHORT: Record<KycGroup, string> = { poi: 'POI', por: 'POR', payment: 'PAY', other: 'OTHER' };
export const docTypeLabel = (group: KycGroup, docType: string) => KYC_DOC_TYPES[group]?.find((t) => t.value === docType)?.label ?? docType;
const statusTone: Record<KycStatus, 'warning' | 'success' | 'danger'> = { pending: 'warning', approved: 'success', rejected: 'danger' };
const fileKind = (mime: string) => (mime === 'application/pdf' ? 'PDF' : mime.replace('image/', '').toUpperCase());

interface WsKycNew {
  id: string;
  userId: string;
  group: KycGroup;
  docType: string;
  email: string;
  createdAt: string;
}

/** KYC review queue. `userId` narrows it to one client (client detail page); `compact` drops the client column and uses a drawer. */
export function KycQueue({ userId, compact }: { userId?: string; compact?: boolean }) {
  const toast = useToast();
  // the global queue opens on what needs work; a single client's view opens on their whole history
  const [tab, setTab] = useState<Tab>(userId ? 'all' : 'pending');
  const [selected, setSelected] = useState<AdminKycRowDto | null>(null);
  const limit = compact ? 10 : 20;
  const q = useQueue<AdminKycRowDto>('/admin/kyc', { status: tab === 'all' ? undefined : tab, userId }, limit);
  const items = q.data?.items ?? [];

  useUserEvent<WsKycNew>(WS_EVENTS.ADMIN_KYC_NEW, (p) => {
    if (userId && p.userId !== userId) return;
    q.refresh();
    toast({ title: 'New KYC upload', body: `${p.email} · ${KYC_GROUP_LABEL[p.group] ?? p.group} · ${docTypeLabel(p.group, p.docType)}`, level: 'info' });
  });

  const changeTab = (t: Tab) => {
    setTab(t);
    q.setPage(1);
  };

  /** Row leaves the list when the tab no longer matches; the panel moves on to the next pending document. */
  const onDecided = (updated: KycDocumentDto) => {
    const keep = tab === 'all' || tab === updated.status;
    const merged = selected && selected.id === updated.id ? { ...selected, ...updated } : selected;
    q.setData((prev) =>
      prev
        ? {
            ...prev,
            items: keep ? prev.items.map((x) => (x.id === updated.id ? { ...x, ...updated } : x)) : prev.items.filter((x) => x.id !== updated.id),
            total: keep ? prev.total : Math.max(0, prev.total - 1),
          }
        : prev,
    );
    const idx = items.findIndex((x) => x.id === updated.id);
    const next = [...items.slice(idx + 1), ...items.slice(0, Math.max(0, idx))].find((x) => x.status === 'pending' && x.id !== updated.id);
    if (tab === 'pending' && next) setSelected(next);
    else setSelected(merged);
    if (!keep && items.length <= 1 && (q.data?.total ?? 0) > 1) {
      q.setPage(1);
      q.refresh();
    }
  };

  const showClient = !userId;
  const cols = (showClient ? 1 : 0) + 5;

  return (
    <div className={cn(!compact && 'grid grid-cols-[minmax(0,1fr)] items-start gap-6 xl:grid-cols-[minmax(0,1fr)_440px]')}>
      <Card className={cn(compact && 'p-4')}>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <StatusTabs items={TABS} value={tab} onChange={changeTab} />
          <span className="font-mono text-[11px] text-ink-400">
            {q.data ? (
              <>
                <span className="text-ink-100">{q.data.total}</span> document{q.data.total === 1 ? '' : 's'}
              </>
            ) : (
              '…'
            )}
          </span>
        </div>

        {q.error ? (
          <Alert tone="danger">{q.error}</Alert>
        ) : !q.data ? (
          <TableSkeleton cols={cols} />
        ) : items.length === 0 ? (
          <Empty icon={<ShieldCheck className="h-6 w-6" />}>{tab === 'pending' ? 'Queue is clear. No documents waiting for review.' : 'No documents here.'}</Empty>
        ) : (
          <div className="-mx-2 overflow-x-auto">
            <table className={cn('w-full text-sm', showClient ? 'min-w-[820px]' : 'min-w-[600px]')}>
              <thead className="text-left">
                <tr>
                  {showClient && <th className="label py-2 pl-2 pr-4 font-medium">Client</th>}
                  <th className={cn('label py-2 pr-4 font-medium', !showClient && 'pl-2')}>Document</th>
                  <th className="label py-2 pr-4 font-medium">Uploaded</th>
                  <th className="label py-2 pr-4 font-medium">File</th>
                  <th className="label py-2 pr-4 font-medium">Status</th>
                  <th className="w-[1%] py-2 pr-2" />
                </tr>
              </thead>
              <tbody key={`${tab}-${q.page}-${userId ?? ''}`} className={cn('transition-opacity duration-300', q.loading && 'opacity-60')}>
                {items.map((d, i) => {
                  const on = selected?.id === d.id;
                  return (
                    <tr
                      key={d.id}
                      onClick={() => setSelected(d)}
                      className={cn('animate-page-in group cursor-pointer border-t border-white/[0.05] transition-colors duration-300', on ? 'bg-brand-500/10' : 'hover:bg-white/[0.03]')}
                      style={{ animationDelay: `${i * 35}ms` }}
                    >
                      {showClient && (
                        <td className="py-2.5 pl-2 pr-4">
                          <ClientCell user={d.user} country={d.user.countryCode} />
                        </td>
                      )}
                      <td className={cn('py-2.5 pr-4', !showClient && 'pl-2')}>
                        <div className="flex items-center gap-2">
                          <Badge tone="brand">{GROUP_SHORT[d.group]}</Badge>
                          <span className="font-medium text-white">{docTypeLabel(d.group, d.docType)}</span>
                        </div>
                        <div className="mt-0.5 max-w-[260px] truncate text-xs text-ink-400" title={d.originalName}>
                          {d.originalName}
                        </div>
                      </td>
                      <td className="py-2.5 pr-4 text-xs text-ink-400">
                        <TimeAgo iso={d.createdAt} />
                      </td>
                      <td className="whitespace-nowrap py-2.5 pr-4 font-mono text-[11px] text-ink-400">
                        <span className="text-ink-200">{fileKind(d.mime)}</span> · {fmtBytes(d.size)}
                      </td>
                      <td className="py-2.5 pr-4">
                        <Badge tone={statusTone[d.status]} dot={d.status === 'pending'} className={cn(d.status === 'pending' && 'text-gold')}>
                          {d.status}
                        </Badge>
                      </td>
                      <td className="py-2.5 pr-2 text-right">
                        <ArrowUpRight className={cn('h-4 w-4 transition-all duration-300', on ? 'text-brand-400' : 'text-ink-500 opacity-0 group-hover:opacity-100')} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {q.data && <Pager page={q.page} pages={q.pages} total={q.data.total} noun="documents" onPage={q.setPage} />}
      </Card>

      <SidePanel
        open={!!selected}
        onClose={() => setSelected(null)}
        split={!compact}
        placeholder={
          <div className="bg-dots flex flex-1 flex-col items-center justify-center gap-3 rounded-2xl p-8 text-center text-sm text-ink-400">
            <FileText className="h-7 w-7 text-ink-500" />
            <div>Select a document to review it here.</div>
            <div className="text-xs text-ink-500">Approve, or reject with a reason the client sees.</div>
          </div>
        }
      >
        {selected && <KycReviewPanel doc={selected} onClose={() => setSelected(null)} onDecided={onDecided} onSelect={setSelected} showClientLink={!userId} />}
      </SidePanel>
    </div>
  );
}

// ---------------------------------------------------------------- review panel
function KycReviewPanel({
  doc,
  onClose,
  onDecided,
  onSelect,
  showClientLink,
}: {
  doc: AdminKycRowDto;
  onClose: () => void;
  onDecided: (d: KycDocumentDto) => void;
  onSelect: (d: AdminKycRowDto) => void;
  showClientLink: boolean;
}) {
  const toast = useToast();
  const [others, setOthers] = useState<AdminKycRowDto[] | null>(null);
  const [mode, setMode] = useState<'idle' | 'reject'>('idle');
  const [reason, setReason] = useState('');
  const [reasonErr, setReasonErr] = useState<string | undefined>();
  const [busy, setBusy] = useState<'approved' | 'rejected' | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [imgFailed, setImgFailed] = useState(false);

  // fresh form per document
  useEffect(() => {
    setMode('idle');
    setReason('');
    setReasonErr(undefined);
    setErr(null);
    setImgFailed(false);
  }, [doc.id]);

  // the client's other documents (re-read after each decision so the group chips stay true)
  useEffect(() => {
    let stale = false;
    get<Paginated<AdminKycRowDto>>(`/admin/kyc?userId=${doc.user.id}&limit=50`)
      .then((d) => !stale && setOthers(d.items))
      .catch(() => !stale && setOthers([]));
    return () => {
      stale = true;
    };
  }, [doc.user.id, doc.status]);

  const src = fileUrl(`/admin/kyc/${doc.id}/file`);
  const isImage = doc.mime.startsWith('image/');
  const name = doc.user.firstName || doc.user.lastName ? `${doc.user.firstName ?? ''} ${doc.user.lastName ?? ''}`.trim() : doc.user.email;

  const decide = async (status: 'approved' | 'rejected') => {
    const body = status === 'approved' ? { status } : { status, reason: reason.trim() };
    const parsed = kycReviewSchema.safeParse(body);
    if (!parsed.success) {
      setReasonErr(parsed.error.issues[0]?.message ?? 'Invalid');
      return;
    }
    setBusy(status);
    setErr(null);
    try {
      const updated = await patch<KycDocumentDto>(`/admin/kyc/${doc.id}`, parsed.data);
      toast({
        title: status === 'approved' ? 'Document approved' : 'Document rejected',
        body: `${docTypeLabel(doc.group, doc.docType)} · ${doc.user.email}`,
        level: status === 'approved' ? 'success' : 'warning',
      });
      setMode('idle');
      setReason('');
      onDecided(updated);
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : 'Something went wrong. Please try again.';
      setErr(msg);
      toast({ title: 'Review failed', body: msg, level: 'danger' });
    } finally {
      setBusy(null);
    }
  };

  const groupState = (g: KycGroup): KycStatus | null => {
    const docs = others?.filter((o) => o.group === g) ?? [];
    if (docs.some((o) => o.status === 'approved')) return 'approved';
    if (docs.some((o) => o.status === 'pending')) return 'pending';
    if (docs.some((o) => o.status === 'rejected')) return 'rejected';
    return null;
  };

  return (
    <>
      <PanelHeader
        title={name}
        sub={
          <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <span className="truncate">{doc.user.email}</span>
            {doc.user.countryCode && <span className="font-mono text-[10px] text-ink-500">{doc.user.countryCode}</span>}
            {showClientLink && (
              <Link href={`/admin/clients/${doc.user.id}`} className="inline-flex items-center gap-0.5 text-brand-300 hover:text-brand-200">
                Client profile <ArrowUpRight className="h-3 w-3" />
              </Link>
            )}
          </span>
        }
        onClose={onClose}
      >
        <div className="mt-2 flex flex-wrap gap-1.5">
          {(['poi', 'por'] as KycGroup[]).map((g) => {
            const s = groupState(g);
            return (
              <Badge key={g} tone={s ? statusTone[s] : 'neutral'} className={cn(s === 'pending' && 'text-gold')}>
                {GROUP_SHORT[g]} · {s ?? 'none'}
              </Badge>
            );
          })}
        </div>
      </PanelHeader>

      <div className="flex-1 space-y-5 p-5">
        {/* document */}
        <section>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Badge tone="brand">{GROUP_SHORT[doc.group]}</Badge>
              <span className="text-sm font-semibold text-white">{docTypeLabel(doc.group, doc.docType)}</span>
            </div>
            <Badge tone={statusTone[doc.status]} dot={doc.status === 'pending'} className={cn(doc.status === 'pending' && 'text-gold')}>
              {doc.status}
            </Badge>
          </div>
          <div className="admin-preview relative flex min-h-[220px] items-center justify-center overflow-hidden rounded-xl border border-white/[0.08]">
            {isImage ? (
              imgFailed ? (
                <div className="flex flex-col items-center gap-2 p-8 text-center text-xs text-ink-400">
                  <ImageOff className="h-6 w-6 text-ink-500" />
                  The image could not be loaded. Try opening it in a new tab.
                </div>
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={doc.id} src={src} alt={doc.originalName} onError={() => setImgFailed(true)} className="max-h-[460px] max-w-full object-contain" />
              )
            ) : (
              <iframe key={doc.id} src={src} title={doc.originalName} className="h-[460px] w-full bg-paper" />
            )}
          </div>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-ink-400">
            <span className="min-w-0 truncate font-mono" title={doc.originalName}>
              {doc.originalName}
            </span>
            <a href={src} target="_blank" rel="noreferrer" className="inline-flex shrink-0 items-center gap-1 text-brand-300 hover:text-brand-200">
              Open in new tab <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </section>

        <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-sm">
          {(
            [
              ['Group', KYC_GROUP_LABEL[doc.group]],
              ['Format', `${fileKind(doc.mime)} · ${fmtBytes(doc.size)}`],
              ['Uploaded', fmtDate(doc.createdAt)],
              ['Reviewed', doc.reviewedAt ? fmtDate(doc.reviewedAt) : '—'],
            ] as [string, string][]
          ).map(([k, v]) => (
            <div key={k}>
              <dt className="label">{k}</dt>
              <dd className="mt-0.5 text-ink-200">{v}</dd>
            </div>
          ))}
          {doc.rejectReason && (
            <div className="col-span-2">
              <dt className="label">Rejection reason</dt>
              <dd className="mt-0.5 text-down">{doc.rejectReason}</dd>
            </div>
          )}
        </dl>

        {/* other documents */}
        <section>
          <div className="label mb-2">Other documents from this client</div>
          {!others ? (
            <div className="flex justify-center py-3">
              <Spinner className="h-4" />
            </div>
          ) : others.filter((o) => o.id !== doc.id).length === 0 ? (
            <p className="text-xs text-ink-500">None yet.</p>
          ) : (
            <ul className="divide-y divide-white/[0.05] overflow-hidden rounded-xl border border-white/[0.08]">
              {others
                .filter((o) => o.id !== doc.id)
                .map((o) => (
                  <li key={o.id}>
                    <button type="button" onClick={() => onSelect(o)} className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors hover:bg-white/[0.04]">
                      <Badge tone="brand">{GROUP_SHORT[o.group]}</Badge>
                      <span className="min-w-0 flex-1 truncate text-ink-100">{docTypeLabel(o.group, o.docType)}</span>
                      <TimeAgo iso={o.createdAt} className="hidden text-[11px] text-ink-500 sm:inline" />
                      <Badge tone={statusTone[o.status]} className={cn(o.status === 'pending' && 'text-gold')}>
                        {o.status}
                      </Badge>
                    </button>
                  </li>
                ))}
            </ul>
          )}
        </section>
      </div>

      {/* decision */}
      <div className="sticky bottom-0 space-y-3 border-t border-white/[0.06] bg-paper/90 p-4 backdrop-blur-xl">
        {err && <Alert tone="danger">{err}</Alert>}
        {doc.status !== 'pending' ? (
          <Alert tone={doc.status === 'approved' ? 'success' : 'danger'}>
            {doc.status === 'approved' ? 'Approved' : 'Rejected'} {doc.reviewedAt ? fmtDate(doc.reviewedAt) : ''}
            {doc.rejectReason ? ` — ${doc.rejectReason}` : ''}
          </Alert>
        ) : mode === 'idle' ? (
          <div className="flex gap-2">
            <Button className="flex-1" loading={busy === 'approved'} disabled={!!busy} onClick={() => void decide('approved')}>
              <CheckCircle2 className="h-4 w-4" /> Approve
            </Button>
            <Button variant="danger" className="flex-1" disabled={!!busy} onClick={() => setMode('reject')}>
              <XCircle className="h-4 w-4" /> Reject
            </Button>
          </div>
        ) : (
          <>
            <Textarea
              label="Reason (sent to the client)"
              name="reason"
              autoFocus
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
                setReasonErr(undefined);
              }}
              error={reasonErr}
              placeholder="e.g. Photo is blurred; all four corners of the document must be visible"
              maxLength={300}
            />
            <div className="flex gap-2">
              <Button variant="danger" className="flex-1" loading={busy === 'rejected'} onClick={() => void decide('rejected')}>
                Confirm rejection
              </Button>
              <Button
                variant="ghost"
                disabled={!!busy}
                onClick={() => {
                  setMode('idle');
                  setReasonErr(undefined);
                }}
              >
                Cancel
              </Button>
            </div>
          </>
        )}
      </div>
    </>
  );
}
