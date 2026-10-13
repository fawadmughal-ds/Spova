'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { LogIn, LogOut, UserPlus, ArrowDownToLine, ArrowUpFromLine, TrendingUp, TrendingDown, LifeBuoy, Link2, Activity as ActivityIcon } from 'lucide-react';
import type { ActivityFeedDto, ActivityEventDto } from '@spova/shared';
import { get, post } from '@/lib/api';
import { fmtDate } from '@/lib/utils';
import { PageHeader } from '@/components/app-shell';
import { Card, Select, Spinner, Button } from '@/components/ui';

const KINDS: { value: string; label: string }[] = [
  { value: '', label: 'All activity' },
  { value: 'login', label: 'Logins' },
  { value: 'logout', label: 'Logouts' },
  { value: 'register', label: 'Sign-ups' },
  { value: 'deposit_request', label: 'Deposits' },
  { value: 'withdraw_request', label: 'Withdrawals' },
  { value: 'trade_open', label: 'Trades opened' },
  { value: 'trade_close', label: 'Trades closed' },
  { value: 'ticket_open', label: 'Support tickets' },
  { value: 'deposit_link', label: 'Deposit links' },
];

const META: Record<string, { icon: typeof LogIn; color: string }> = {
  login: { icon: LogIn, color: '#38bdf8' },
  logout: { icon: LogOut, color: '#94a3b8' },
  register: { icon: UserPlus, color: '#2563eb' },
  deposit_request: { icon: ArrowDownToLine, color: '#22c55e' },
  withdraw_request: { icon: ArrowUpFromLine, color: '#f59e0b' },
  trade_open: { icon: TrendingUp, color: '#2563eb' },
  trade_close: { icon: TrendingDown, color: '#64748b' },
  ticket_open: { icon: LifeBuoy, color: '#a855f7' },
  deposit_link: { icon: Link2, color: '#22c55e' },
};

export default function ActivityPage() {
  const [kind, setKind] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<ActivityFeedDto | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const p = new URLSearchParams({ page: String(page), limit: '50' });
    if (kind) p.set('kind', kind);
    get<ActivityFeedDto>(`/admin/activity?${p}`)
      .then(setData)
      .finally(() => setLoading(false));
    // opening the feed clears the unread badge
    void post('/admin/activity/read').catch(() => {});
  }, [kind, page]);

  const pages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;

  return (
    <div>
      <PageHeader title="Activity" sub="Everything your clients do, newest first." />
      <Card
        title={data ? `${data.total} events` : 'Activity feed'}
        action={
          <Select value={kind} onChange={(e) => { setKind(e.target.value); setPage(1); }} className="w-48">
            {KINDS.map((k) => (
              <option key={k.value} value={k.value}>{k.label}</option>
            ))}
          </Select>
        }
      >
        {loading && !data ? (
          <div className="flex justify-center py-16"><Spinner /></div>
        ) : !data || data.items.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-16 text-ink-400">
            <ActivityIcon className="h-7 w-7 opacity-40" />
            <span className="text-sm">No activity yet.</span>
          </div>
        ) : (
          <ul className="divide-y divide-white/5">
            {data.items.map((e) => (
              <Row key={e.id} e={e} />
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
      </Card>
    </div>
  );
}

function Row({ e }: { e: ActivityEventDto }) {
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
      </div>
      <time className="shrink-0 whitespace-nowrap text-xs text-ink-500">{fmtDate(e.createdAt)}</time>
    </li>
  );
}
