'use client';

import { useEffect, useState } from 'react';
import { ArrowDownToLine, ArrowUpFromLine, Landmark, Paperclip } from 'lucide-react';
import { PAYMENT_METHODS, WS_EVENTS, paymentDecisionSchema, type AdminPaymentRowDto, type Paginated, type PaymentKind, type PaymentRequestDto, type PaymentStatus, type PaymentsSummaryDto } from '@spova/shared';
import { fileUrl, get, patch, post, ApiError } from '@/lib/api';
import { useUserEvent } from '@/lib/ws';
import { cn, fmtMoney } from '@/lib/utils';
import { AnimatedNumber } from '@/components/motion';
import { useToast } from '@/components/toast';
import { Alert, Badge, Button, Card, Empty, Select, Skeleton, Stat } from '@/components/ui';
import { ClientCell, Pager, StatusTabs, TableSkeleton, Textarea, TimeAgo, useQueue } from './queue-bits';
import { DatePresets } from './date-presets';

type Tab = PaymentStatus | 'all';
const TABS: { value: Tab; label: string }[] = [
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'declined', label: 'Declined' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'all', label: 'All' },
];
const kindTone: Record<PaymentKind, 'success' | 'warning'> = { deposit: 'success', withdraw: 'warning' };
const statusTone: Record<PaymentStatus, 'warning' | 'success' | 'danger' | 'neutral'> = { pending: 'warning', approved: 'success', declined: 'danger', cancelled: 'neutral' };
export const methodLabel = (id: string) => PAYMENT_METHODS.find((m) => m.id === id)?.label ?? id;

interface WsPaymentNew {
  id: string;
  userId: string;
  kind: PaymentKind;
  amount: string;
  method: string;
  email: string;
  createdAt: string;
}

type Decision = 'approved' | 'declined';

/** Deposit / withdrawal request queue. Decisions confirm inline in the table; approvals post to the ledger server-side. */
export function PaymentsQueue({ userId, compact, onChanged }: { userId?: string; compact?: boolean; onChanged?: () => void }) {
  const toast = useToast();
  const [tab, setTab] = useState<Tab>(userId ? 'all' : 'pending');
  const [kind, setKind] = useState<'' | PaymentKind>('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const limit = compact ? 10 : 20;
  const q = useQueue<AdminPaymentRowDto>('/admin/payments', { status: tab === 'all' ? undefined : tab, kind: kind || undefined, userId, from: from || undefined, to: to || undefined }, limit);
  const items = q.data?.items ?? [];

  // summary totals for the strip (respects the date range + client); refreshed on filter change and after a decision
  const [summary, setSummary] = useState<PaymentsSummaryDto | null>(null);
  const [sv, setSv] = useState(0);
  useEffect(() => {
    const p = new URLSearchParams();
    if (userId) p.set('userId', userId);
    if (from) p.set('from', from);
    if (to) p.set('to', to);
    get<PaymentsSummaryDto>(`/admin/payments/summary?${p}`).then(setSummary).catch(() => {});
  }, [userId, from, to, sv]);

  const [confirm, setConfirm] = useState<{ id: string; status: Decision } | null>(null);
  const [sendFor, setSendFor] = useState<AdminPaymentRowDto | null>(null);
  const [note, setNote] = useState('');
  const [noteErr, setNoteErr] = useState<string | undefined>();
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useUserEvent<WsPaymentNew>(WS_EVENTS.ADMIN_PAYMENT_NEW, (p) => {
    if (userId && p.userId !== userId) return;
    q.refresh();
    setSv((v) => v + 1);
    onChanged?.();
    toast({ title: `New ${p.kind === 'deposit' ? 'deposit' : 'withdrawal'} request`, body: `${p.email} · ${fmtMoney(p.amount)} via ${methodLabel(p.method)}`, level: 'info' });
  });

  const openConfirm = (id: string, status: Decision) => {
    setConfirm({ id, status });
    setNote('');
    setNoteErr(undefined);
    setErr(null);
  };

  const decide = async (row: AdminPaymentRowDto) => {
    if (!confirm) return;
    const body = confirm.status === 'approved' ? { status: 'approved' as const } : { status: 'declined' as const, note: note.trim() };
    const parsed = paymentDecisionSchema.safeParse(body);
    if (!parsed.success) {
      setNoteErr(parsed.error.issues[0]?.message ?? 'Invalid');
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const updated = await patch<PaymentRequestDto>(`/admin/payments/${row.id}`, parsed.data);
      const keep = tab === 'all' || tab === updated.status;
      q.setData((prev) =>
        prev
          ? {
              ...prev,
              items: keep ? prev.items.map((x) => (x.id === updated.id ? { ...x, ...updated } : x)) : prev.items.filter((x) => x.id !== updated.id),
              total: keep ? prev.total : Math.max(0, prev.total - 1),
            }
          : prev,
      );
      toast({
        title: `${updated.kind === 'deposit' ? 'Deposit' : 'Withdrawal'} ${updated.status}`,
        body: `${fmtMoney(updated.amount)} ${updated.currency} · account ${updated.accountLogin} · ${row.user.email}`,
        level: updated.status === 'approved' ? 'success' : 'warning',
      });
      setConfirm(null);
      onChanged?.();
      // balances on sibling rows change after an approval; re-read quietly
      q.refresh();
      setSv((v) => v + 1);
    } catch (e) {
      // 422 insufficient_balance, 409 not pending, …: the row stays as it is and the message shows inline
      setErr(e instanceof ApiError ? e.message : 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const showClient = !userId;
  const showStatus = tab !== 'pending';
  const showDecision = tab === 'pending' || tab === 'all';
  const activeRow = confirm ? items.find((x) => x.id === confirm.id) : undefined;
  const cols = (showClient ? 1 : 0) + 5 + (showStatus ? 1 : 0) + (showDecision ? 1 : 0);

  /** Inline confirmation for the row under decision. Rendered inside the table from `lg` up and below it on small screens, where the table scrolls sideways. */
  const renderConfirm = (p: AdminPaymentRowDto) => {
    if (!confirm) return null;
    const deposit = p.kind === 'deposit';
    const amount = Number(p.amount);
    const balance = Number(p.account.balance);
    return (
        <div className={cn('animate-pop-in rounded-xl border p-4', confirm.status === 'approved' ? 'border-up/30 bg-up/[0.04]' : 'border-down/30 bg-down/[0.04]')}>
          <div className="flex flex-wrap items-start gap-4">
            <div className="min-w-[240px] flex-1 text-sm">
              <div className="font-semibold text-white">
                {confirm.status === 'approved' ? `Approve this ${deposit ? 'deposit' : 'withdrawal'} of ${fmtMoney(p.amount)} ${p.currency}?` : `Decline this ${deposit ? 'deposit' : 'withdrawal'} of ${fmtMoney(p.amount)} ${p.currency}?`}
              </div>
              <div className="mt-1 text-xs leading-relaxed text-ink-400">
                {confirm.status === 'approved' ? (
                  <>
                    Posts a <span className="text-ink-200">{deposit ? 'deposit' : 'withdrawal'}</span> ledger entry on account <span className="tabular font-mono text-ink-200">{p.accountLogin}</span>: balance{' '}
                    <span className="tabular font-mono text-ink-200">{fmtMoney(p.account.balance)}</span> → <span className="tabular font-mono text-ink-200">{fmtMoney(deposit ? balance + amount : balance - amount)}</span>.
                    {!deposit && (
                      <>
                        {' '}
                        Free margin now <span className="tabular font-mono text-ink-200">{fmtMoney(p.account.freeMargin)}</span>.
                      </>
                    )}
                  </>
                ) : (
                  <>No money moves. The note below is sent to the client with the decision.</>
                )}
              </div>
              {confirm.status === 'approved' && !deposit && Number(p.account.freeMargin) < amount && (
                <Alert tone="warning" className="mt-2 text-xs">
                  Free margin is below the requested amount; the server will refuse this approval.
                </Alert>
              )}
              {err && (
                <Alert tone="danger" className="mt-2 text-xs">
                  {err}
                </Alert>
              )}
            </div>
            {confirm.status === 'declined' && (
              <div className="min-w-[240px] flex-1">
                <Textarea
                  label="Note to client"
                  name="note"
                  autoFocus
                  value={note}
                  onChange={(e) => {
                    setNote(e.target.value);
                    setNoteErr(undefined);
                  }}
                  error={noteErr}
                  placeholder="e.g. Bank details incomplete — please add the IBAN"
                  maxLength={300}
                  className="min-h-[72px]"
                />
              </div>
            )}
            <div className="flex gap-2 self-end">
              <Button size="sm" variant={confirm.status === 'approved' ? 'primary' : 'danger'} loading={busy} onClick={() => void decide(p)}>
                {confirm.status === 'approved' ? 'Confirm approval' : 'Confirm decline'}
              </Button>
              <Button size="sm" variant="ghost" disabled={busy} onClick={() => setConfirm(null)}>
                Cancel
              </Button>
            </div>
          </div>
        </div>
    );
  };

  return (
    <>
    <Card className={cn(compact && 'p-4')}>
      {summary && !compact && (
        <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Deposits" value={fmtMoney(summary.deposits.approved)} sub={`${summary.deposits.count} request${summary.deposits.count === 1 ? '' : 's'} · ${fmtMoney(summary.deposits.requested)} requested`} tone="up" />
          <Stat label="Withdrawals" value={fmtMoney(summary.withdrawals.approved)} sub={`${summary.withdrawals.count} request${summary.withdrawals.count === 1 ? '' : 's'} · ${fmtMoney(summary.withdrawals.requested)} requested`} tone="down" />
          <Stat label="Net flow" value={fmtMoney((Number(summary.deposits.approved) - Number(summary.withdrawals.approved)).toFixed(2))} sub="approved in / out" />
          <Stat label="Pending" value={summary.pending} sub="awaiting review" tone={summary.pending > 0 ? 'down' : undefined} />
        </div>
      )}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 max-w-full flex-wrap items-center gap-3">
          <StatusTabs
            items={TABS}
            value={tab}
            onChange={(t) => {
              setTab(t);
              setConfirm(null);
              q.setPage(1);
            }}
          />
          <div className="w-36">
            <Select
              aria-label="Kind"
              value={kind}
              onChange={(e) => {
                setKind(e.target.value as '' | PaymentKind);
                q.setPage(1);
              }}
              className="h-9"
            >
              <option value="">All kinds</option>
              <option value="deposit">Deposits</option>
              <option value="withdraw">Withdrawals</option>
            </Select>
          </div>
          <input type="date" aria-label="From date" value={from} onChange={(e) => { setFrom(e.target.value); q.setPage(1); }} className="h-9 rounded-lg border border-white/10 bg-white/[0.03] px-2.5 text-sm text-white outline-none focus:border-brand-500" />
          <span className="text-xs text-ink-500">to</span>
          <input type="date" aria-label="To date" value={to} onChange={(e) => { setTo(e.target.value); q.setPage(1); }} className="h-9 rounded-lg border border-white/10 bg-white/[0.03] px-2.5 text-sm text-white outline-none focus:border-brand-500" />
          {(from || to) && (
            <button type="button" onClick={() => { setFrom(''); setTo(''); q.setPage(1); }} className="h-9 rounded-lg border border-white/10 px-2.5 text-xs text-ink-300 hover:text-white">Clear</button>
          )}
          <DatePresets onPick={(f, t) => { setFrom(f); setTo(t); q.setPage(1); }} />
        </div>
        <span className="font-mono text-[11px] text-ink-400">
          {q.data ? (
            <>
              <span className="text-ink-100">{q.data.total}</span> request{q.data.total === 1 ? '' : 's'}
            </>
          ) : (
            '…'
          )}
        </span>
      </div>

      {q.error ? (
        <Alert tone="danger">{q.error}</Alert>
      ) : !q.data ? (
        <TableSkeleton cols={6} />
      ) : items.length === 0 ? (
        <Empty icon={<Landmark className="h-6 w-6" />}>{tab === 'pending' ? 'Nothing waiting. All requests have been decided.' : 'No requests match.'}</Empty>
      ) : (
        <div className="-mx-2 overflow-x-auto">
          <table className={cn('w-full text-sm', showClient ? 'min-w-[940px]' : 'min-w-[740px]')}>
            <thead className="text-left">
              <tr>
                {showClient && <th className="label py-2 pl-2 pr-4 font-medium">Client</th>}
                <th className={cn('label py-2 pr-4 font-medium', !showClient && 'pl-2')}>Account</th>
                <th className="label py-2 pr-4 font-medium">Request</th>
                <th className="label py-2 pr-4 font-medium">Reference / destination</th>
                <th className="label py-2 pr-4 font-medium">Requested</th>
                <th className="label py-2 pr-4 text-right font-medium">
                  Balance
                  <span className="block font-normal normal-case tracking-normal text-ink-500">free margin</span>
                </th>
                {showStatus && <th className="label py-2 pr-4 font-medium">Status</th>}
                {showDecision && <th className="label w-[1%] py-2 pr-2 text-right font-medium">Decision</th>}
              </tr>
            </thead>
            <tbody key={`${tab}-${kind}-${q.page}-${userId ?? ''}`} className={cn('transition-opacity duration-300', q.loading && 'opacity-60')}>
              {items.map((p, i) => {
                const deposit = p.kind === 'deposit';
                const active = confirm?.id === p.id;
                const amount = Number(p.amount);
                return [
                  <tr
                    key={p.id}
                    className={cn('animate-page-in group border-t border-white/[0.05] transition-colors duration-300', active ? 'bg-brand-500/[0.06]' : 'hover:bg-white/[0.03]')}
                    style={{ animationDelay: `${i * 35}ms` }}
                  >
                    {showClient && (
                      <td className="py-2.5 pl-2 pr-4">
                        <ClientCell user={p.user} />
                      </td>
                    )}
                    <td className={cn('whitespace-nowrap py-2.5 pr-4', !showClient && 'pl-2')}>
                      <div className="flex items-center gap-2">
                        <span className="tabular font-mono font-semibold text-white">{p.accountLogin}</span>
                        <Badge tone={p.account.type === 'live' ? 'success' : 'info'}>{p.account.type}</Badge>
                      </div>
                    </td>
                    <td className="whitespace-nowrap py-2.5 pr-4">
                      <div className="flex items-center gap-2">
                        <Badge tone={kindTone[p.kind]}>
                          {deposit ? <ArrowDownToLine className="h-3 w-3" /> : <ArrowUpFromLine className="h-3 w-3" />}
                          {deposit ? 'deposit' : 'withdraw'}
                        </Badge>
                        <span className={cn('tabular font-mono font-semibold', deposit ? 'text-up' : 'text-down')}>
                          {deposit ? '+' : '−'}
                          {fmtMoney(p.amount)} <span className="text-[10px] font-normal text-ink-500">{p.currency}</span>
                        </span>
                      </div>
                      <div className="mt-0.5 text-xs text-ink-400">{methodLabel(p.method)}</div>
                    </td>
                    <td className="max-w-[190px] py-2.5 pr-4">
                      {p.destination && (
                        <div className="min-w-0">
                          <div className="truncate text-xs font-medium text-ink-200">{p.destination.label}</div>
                          <div className="truncate font-mono text-[11px] text-ink-400" title={p.destination.details}>
                            {p.destination.details}
                          </div>
                        </div>
                      )}
                      {p.reference && (
                        <div className="truncate font-mono text-[11px] text-ink-400" title={p.reference}>
                          {p.destination ? 'ref ' : ''}
                          {p.reference}
                        </div>
                      )}
                      {p.card && (p.card.brand || p.card.last4) && (
                        <div className="truncate text-[11px] text-ink-300" title={p.card.name ?? undefined}>
                          <span className="font-medium">{p.card.brand ?? 'card'}</span> ···· {p.card.last4 ?? '????'}
                          {p.card.code && <span className="ml-1 font-mono text-ink-500">[{p.card.code}]</span>}
                        </div>
                      )}
                      {p.proof ? (
                        <a href={fileUrl(`/admin/payments/${p.id}/proof`)} target="_blank" rel="noreferrer" title={p.proof.name} className="mt-0.5 inline-flex max-w-full items-center gap-1 rounded-full border border-up/30 bg-up/[0.06] px-2 py-0.5 text-[11px] text-up hover:bg-up/10">
                          <Paperclip className="h-3 w-3 shrink-0" /> <span className="truncate">proof slip</span>
                        </a>
                      ) : deposit && p.status === 'pending' ? (
                        <div className="mt-0.5 text-[11px] text-gold">no proof attached</div>
                      ) : null}
                      {!p.destination && !p.reference && !p.proof && !p.card && !(deposit && p.status === 'pending') && <span className="text-ink-500">—</span>}
                    </td>
                    <td className="py-2.5 pr-4 text-xs text-ink-400">
                      <TimeAgo iso={p.createdAt} />
                    </td>
                    <td className="tabular whitespace-nowrap py-2.5 pr-4 text-right font-mono">
                      <div className="text-ink-100">{fmtMoney(p.account.balance)}</div>
                      <div className={cn('text-[11px]', !deposit && Number(p.account.freeMargin) < amount ? 'text-down' : 'text-ink-400')}>{fmtMoney(p.account.freeMargin)}</div>
                    </td>
                    {showStatus && (
                      <td className="py-2.5 pr-4">
                        <Badge tone={statusTone[p.status]} dot={p.status === 'pending'} className={cn(p.status === 'pending' && 'text-gold')}>
                          {p.status}
                        </Badge>
                        {p.adminNote && (
                          <div className="mt-0.5 max-w-[180px] truncate text-[11px] text-ink-500" title={p.adminNote}>
                            {p.adminNote}
                          </div>
                        )}
                      </td>
                    )}
                    {showDecision && (
                      <td className="whitespace-nowrap py-2.5 pr-2 text-right">
                        {p.status === 'pending' && (
                          <div className="flex justify-end gap-1.5">
                            {p.kind === 'deposit' && (p.method === 'rtgs' || p.method === 'bank') && (
                              <Button size="sm" variant="ghost" disabled={busy} onClick={() => setSendFor(p)} className="text-brand-300 hover:bg-brand-400/10">
                                Send details
                              </Button>
                            )}
                            <Button size="sm" variant="secondary" disabled={busy} onClick={() => openConfirm(p.id, 'approved')} className={cn(active && confirm?.status === 'approved' && 'ring-brand-400/60')}>
                              Approve
                            </Button>
                            <Button size="sm" variant="ghost" disabled={busy} onClick={() => openConfirm(p.id, 'declined')} className="text-down hover:bg-down/10 hover:text-down">
                              Decline
                            </Button>
                          </div>
                        )}
                      </td>
                    )}
                  </tr>,
                  active && (
                    <tr key={`${p.id}-confirm`} className="hidden lg:table-row">
                      <td colSpan={cols} className="px-2 pb-3 pt-0">
                        {renderConfirm(p)}
                      </td>
                    </tr>
                  ),
                ];
              })}
            </tbody>
          </table>
        </div>
      )}
      {activeRow && <div className="mt-3 lg:hidden">{renderConfirm(activeRow)}</div>}
      {q.data && <Pager page={q.page} pages={q.pages} total={q.data.total} noun="requests" onPage={q.setPage} />}
    </Card>
    {sendFor && <SendDetailsModal row={sendFor} onClose={() => setSendFor(null)} onSent={() => { setSendFor(null); toast({ title: 'Bank details sent', body: 'The client has been emailed the pay-to details.', level: 'success' }); }} />}
    </>
  );
}

/** Admin form to email RTGS/bank pay-to details for a specific pending deposit request. */
function SendDetailsModal({ row, onClose, onSent }: { row: AdminPaymentRowDto; onClose: () => void; onSent: () => void }) {
  const toast = useToast();
  const [f, setF] = useState({ bankName: '', accountName: '', accountNumber: '', ifsc: '', note: '' });
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF((p) => ({ ...p, [k]: e.target.value }));
  const valid = f.bankName.trim() && f.accountName.trim() && f.accountNumber.trim();
  const send = async () => {
    if (!valid) return;
    setBusy(true);
    try {
      await post(`/admin/payments/${row.id}/send-details`, { bankName: f.bankName.trim(), accountName: f.accountName.trim(), accountNumber: f.accountNumber.trim(), ifsc: f.ifsc.trim() || undefined, note: f.note.trim() || undefined });
      onSent();
    } catch {
      toast({ title: 'Could not send the details', level: 'danger' });
    } finally {
      setBusy(false);
    }
  };
  const fld = 'w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white placeholder:text-ink-500 focus:border-brand-400 focus:outline-none';
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-ink-950 p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-1 text-[11px] uppercase tracking-wider text-ink-500">Send bank details · {fmtMoney(row.amount)} {row.currency}</div>
        <h3 className="mb-4 text-base font-semibold text-white">{row.user.email}</h3>
        <div className="grid gap-3">
          <input className={fld} placeholder="Bank name" value={f.bankName} onChange={set('bankName')} />
          <input className={fld} placeholder="Account holder name" value={f.accountName} onChange={set('accountName')} />
          <input className={fld} placeholder="Account number" value={f.accountNumber} onChange={set('accountNumber')} />
          <input className={fld} placeholder="IFSC / SWIFT (optional)" value={f.ifsc} onChange={set('ifsc')} />
          <textarea className={fld} rows={2} placeholder="Note (optional)" value={f.note} onChange={set('note')} />
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button size="sm" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button size="sm" loading={busy} disabled={!valid} onClick={() => void send()}>Send email</Button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- header totals
interface Totals {
  count: number;
  sum: string;
  truncated: boolean;
}
const summarise = (p: Paginated<AdminPaymentRowDto>): Totals => ({
  count: p.total,
  sum: p.items.reduce((a, x) => a + Number(x.amount), 0).toFixed(2),
  truncated: p.total > p.items.length,
});

/** Pending deposit / withdrawal totals. Sums the first 100 of each (the API has no aggregate yet) and says so when truncated. */
export function PendingTotals({ version }: { version: number }) {
  const [t, setT] = useState<{ deposit: Totals; withdraw: Totals } | null>(null);
  useEffect(() => {
    let stale = false;
    Promise.all([
      get<Paginated<AdminPaymentRowDto>>('/admin/payments?status=pending&kind=deposit&limit=100'),
      get<Paginated<AdminPaymentRowDto>>('/admin/payments?status=pending&kind=withdraw&limit=100'),
    ])
      .then(([d, w]) => !stale && setT({ deposit: summarise(d), withdraw: summarise(w) }))
      .catch(() => !stale && setT(null));
    return () => {
      stale = true;
    };
  }, [version]);

  const tile = (label: string, x: Totals | undefined, icon: React.ReactNode, tone?: 'up' | 'down') => (
    <Stat
      label={label}
      icon={icon}
      tone={x && x.count > 0 ? tone : undefined}
      value={x ? <AnimatedNumber value={x.sum} /> : <Skeleton className="h-7 w-28" />}
      sub={x ? `${x.count} request${x.count === 1 ? '' : 's'} waiting${x.truncated ? ' · first 100 summed' : ''} · USD` : '…'}
    />
  );

  return (
    <div className="mb-6 grid gap-4 sm:grid-cols-2">
      <div className="animate-page-in" style={{ animationDelay: '0ms' }}>
        {tile('Pending deposits', t?.deposit, <ArrowDownToLine className="h-4 w-4" />, 'up')}
      </div>
      <div className="animate-page-in" style={{ animationDelay: '60ms' }}>
        {tile('Pending withdrawals', t?.withdraw, <ArrowUpFromLine className="h-4 w-4" />, 'down')}
      </div>
    </div>
  );
}
