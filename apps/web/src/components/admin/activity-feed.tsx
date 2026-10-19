'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  LogIn, LogOut, UserPlus, ArrowDownToLine, ArrowUpFromLine, TrendingUp, TrendingDown,
  LifeBuoy, Link2, Activity as ActivityIcon, PlusCircle, Trash2, CircleDollarSign, MinusCircle, Search,
} from 'lucide-react';
import type { ActivityFeedDto, ActivityEventDto } from '@spova/shared';
import { get } from '@/lib/api';
import { fmtDate } from '@/lib/utils';
import { Select, Spinner, Button } from '@/components/ui';
import { DatePresets } from './date-presets';

export const ACTIVITY_KINDS: { value: string; label: string }[] = [
  { value: '', label: 'All activity' },
  { value: 'login', label: 'Logins' },
  { value: 'logout', label: 'Logouts' },
  { value: 'register', label: 'Sign-ups' },
  { value: 'trade_open', label: 'Trades opened' },
  { value: 'trade_close', label: 'Trades closed' },
  { value: 'deposit', label: 'Deposits (credited)' },
  { value: 'deposit_request', label: 'Deposit requests' },
  { value: 'withdraw', label: 'Withdrawals (paid)' },
  { value: 'withdraw_request', label: 'Withdrawal requests' },
  { value: 'credit', label: 'Manual credits' },
  { value: 'credit_removed', label: 'Credit removals' },
  { value: 'debit', label: 'Debits' },
  { value: 'account_open', label: 'Account opened' },
  { value: 'account_delete', label: 'Account deleted' },
  { value: 'ticket_open', label: 'Support tickets' },
  { value: 'deposit_link', label: 'Deposit links' },
];

const META: Record<string, { icon: typeof LogIn; color: string }> = {
  login: { icon: LogIn, color: '#38bdf8' },
  logout: { icon: LogOut, color: '#94a3b8' },
  register: { icon: UserPlus, color: '#2563eb' },
  deposit: { icon: ArrowDownToLine, color: '#22c55e' },
  deposit_request: { icon: ArrowDownToLine, color: '#16a34a' },
  withdraw: { icon: ArrowUpFromLine, color: '#f59e0b' },
  withdraw_request: { icon: ArrowUpFromLine, color: '#d97706' },
  trade_open: { icon: TrendingUp, color: '#2563eb' },
  trade_close: { icon: TrendingDown, color: '#64748b' },
  credit: { icon: CircleDollarSign, color: '#22c55e' },
  credit_removed: { icon: MinusCircle, color: '#ef4444' },
  debit: { icon: MinusCircle, color: '#ef4444' },
  account_open: { icon: PlusCircle, color: '#2563eb' },
  account_delete: { icon: Trash2, color: '#ef4444' },
  ticket_open: { icon: LifeBuoy, color: '#a855f7' },
  deposit_link: { icon: Link2, color: '#22c55e' },
};

/** The full activity timeline. Pass `userId` to scope it to one client. Filters by kind, free-text search and date range.
 *  `focus` lets a parent drive the kind filter after mount (e.g. clicking a KPI card) — bump `n` to re-apply. */
export function ActivityFeed({ userId, initialKind = '', focus }: { userId?: string; initialKind?: string; focus?: { kind: string; n: number } }) {
  const [kind, setKind] = useState(initialKind);
  const [q, setQ] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<ActivityFeedDto | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => {
      setLoading(true);
      const p = new URLSearchParams({ page: String(page), limit: '50' });
      if (kind) p.set('kind', kind);
      if (userId) p.set('userId', userId);
      if (q.trim()) p.set('q', q.trim());
      if (from) p.set('from', from);
      if (to) p.set('to', to);
      get<ActivityFeedDto>(`/admin/activity?${p}`)
        .then(setData)
        .catch(() => {})
        .finally(() => setLoading(false));
    }, 300);
    return () => clearTimeout(t);
  }, [kind, q, from, to, page, userId]);

  // reset to page 1 whenever a filter changes
  useEffect(() => setPage(1), [kind, q, from, to]);

  // a parent (e.g. a clicked KPI) drives the kind filter; clearing other filters so the focused set shows alone
  useEffect(() => {
    if (!focus) return;
    setKind(focus.kind);
    setQ('');
    setFrom('');
    setTo('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus?.n]);

  const pages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <label className="relative block min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-500" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by action, detail or client…"
            className="h-10 w-full rounded-lg border border-white/10 bg-white/[0.03] pl-9 pr-3 text-sm text-white outline-none focus:border-brand-500"
          />
        </label>
        <Select value={kind} onChange={(e) => setKind(e.target.value)} className="w-52">
          {ACTIVITY_KINDS.map((k) => (
            <option key={k.value} value={k.value}>{k.label}</option>
          ))}
        </Select>
        <label className="text-xs text-ink-400">
          <span className="mb-1 block uppercase tracking-wider text-ink-500">From</span>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-10 rounded-lg border border-white/10 bg-white/[0.03] px-3 text-sm text-white outline-none focus:border-brand-500" />
        </label>
        <label className="text-xs text-ink-400">
          <span className="mb-1 block uppercase tracking-wider text-ink-500">To</span>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-10 rounded-lg border border-white/10 bg-white/[0.03] px-3 text-sm text-white outline-none focus:border-brand-500" />
        </label>
        {(q || from || to || kind) && (
          <button type="button" onClick={() => { setQ(''); setFrom(''); setTo(''); setKind(''); }} className="h-10 rounded-lg border border-white/10 px-3 text-xs text-ink-300 hover:text-white">
            Clear
          </button>
        )}
      </div>
      <div className="mb-4">
        <DatePresets onPick={(f, t) => { setFrom(f); setTo(t); }} />
      </div>

      {data && <div className="mb-2 text-xs text-ink-500">{data.total} event{data.total === 1 ? '' : 's'}</div>}

      {loading && !data ? (
        <div className="flex justify-center py-16"><Spinner /></div>
      ) : !data || data.items.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-16 text-ink-400">
          <ActivityIcon className="h-7 w-7 opacity-40" />
          <span className="text-sm">No activity matches these filters.</span>
        </div>
      ) : (
        <ul className="divide-y divide-white/5">
          {data.items.map((e) => (
            <Row key={e.id} e={e} hideUser={!!userId} />
          ))}
        </ul>
      )}

      {pages > 1 && (
        <div className="mt-3 flex items-center justify-between text-xs text-ink-400">
          <span>Page {page} / {pages}</span>
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
            <Button size="sm" variant="secondary" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>Next</Button>
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ e, hideUser }: { e: ActivityEventDto; hideUser?: boolean }) {
  const m = META[e.kind] ?? { icon: ActivityIcon, color: '#64748b' };
  const Icon = m.icon;
  return (
    <li className="flex items-center gap-3 py-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg" style={{ background: `${m.color}1f`, color: m.color }}>
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-sm text-white">
          {e.title}
          {e.detail ? <span className="text-ink-400"> — {e.detail}</span> : null}
        </div>
        {!hideUser && (
          <div className="text-xs text-ink-500">
            {e.userId ? (
              <Link href={`/admin/clients/${e.userId}`} className="hover:text-brand-300">
                {e.userName || e.userEmail || 'client'}
              </Link>
            ) : (
              <span>{e.userEmail || 'system'}</span>
            )}
            {e.ip ? <span> · {e.ip}</span> : null}
          </div>
        )}
        {hideUser && e.ip ? <div className="text-xs text-ink-500">{e.ip}</div> : null}
      </div>
      <time className="shrink-0 whitespace-nowrap text-xs text-ink-500">{fmtDate(e.createdAt)}</time>
    </li>
  );
}
