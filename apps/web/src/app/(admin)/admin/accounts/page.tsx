'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { AdminAccountRowDto } from '@spova/shared';
import { cn, fmtMoney } from '@/lib/utils';
import { PageHeader } from '@/components/app-shell';
import { Badge, Card, Empty, Select } from '@/components/ui';
import { ClientCell, Pager, TableSkeleton, useQueue } from '@/components/admin/queue-bits';

const TIERS = ['classic', 'silver', 'gold', 'platinum', 'vip'];

export default function AdminAccountsPage() {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [type, setType] = useState<'' | 'demo' | 'live'>('');
  const [tier, setTier] = useState('');
  const query = useQueue<AdminAccountRowDto>('/admin/accounts', { q: q.trim() || undefined, type: type || undefined, tier: tier || undefined }, 25);
  const rows = query.data?.items ?? [];

  const level = (v: string | null) =>
    v === null ? <span className="text-ink-500">—</span> : <span className={cn(Number(v) <= 100 ? 'text-down' : Number(v) <= 200 ? 'text-gold' : 'text-up')}>{Number(v).toFixed(0)}%</span>;

  return (
    <div>
      <PageHeader title="Trading accounts" sub="Every demo and live account across all clients — search, filter, and click a row to open the client." />
      <Card>
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <input
            value={q}
            onChange={(e) => { setQ(e.target.value); query.setPage(1); }}
            placeholder="Search name, email or login id…"
            className="h-9 min-w-[240px] flex-1 rounded-lg border border-white/10 bg-white/[0.03] px-3 text-sm text-white outline-none focus:border-brand-500"
          />
          <Select value={type} onChange={(e) => { setType(e.target.value as '' | 'demo' | 'live'); query.setPage(1); }} className="h-9 w-32">
            <option value="">All types</option>
            <option value="demo">Demo</option>
            <option value="live">Live</option>
          </Select>
          <Select value={tier} onChange={(e) => { setTier(e.target.value); query.setPage(1); }} className="h-9 w-36">
            <option value="">All tiers</option>
            {TIERS.map((t) => (
              <option key={t} value={t} className="capitalize">{t}</option>
            ))}
          </Select>
        </div>

        {query.loading && !query.data ? (
          <TableSkeleton rows={8} cols={7} />
        ) : rows.length === 0 ? (
          <Empty>No accounts match these filters.</Empty>
        ) : (
          <div className="-mx-2 overflow-x-auto">
            <table className="w-full min-w-[840px] text-sm">
              <thead className="text-left text-[11px] uppercase tracking-wider text-ink-500">
                <tr>
                  <th className="px-3 py-2 font-medium">Client</th>
                  <th className="px-3 py-2 font-medium">Login</th>
                  <th className="px-3 py-2 font-medium">Type</th>
                  <th className="px-3 py-2 font-medium">Tier</th>
                  <th className="px-3 py-2 text-right font-medium">Balance</th>
                  <th className="px-3 py-2 text-right font-medium">Equity</th>
                  <th className="px-3 py-2 text-right font-medium">Margin level</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {rows.map((a) => (
                  <tr key={a.id} onClick={() => router.push(`/admin/clients/${a.userId}`)} className="cursor-pointer transition-colors hover:bg-white/[0.03]">
                    <td className="px-3 py-2.5">
                      <ClientCell user={{ id: a.userId, email: a.userEmail, firstName: a.firstName, lastName: a.lastName }} link={false} />
                    </td>
                    <td className="tabular px-3 py-2.5 font-mono font-semibold">{a.loginCode}</td>
                    <td className="px-3 py-2.5">
                      <Badge tone={a.type === 'live' ? 'success' : 'info'}>{a.type}</Badge>
                      {a.status !== 'enabled' && <Badge tone="warning" className="ml-1">{a.status}</Badge>}
                    </td>
                    <td className="px-3 py-2.5 capitalize">{a.tier}</td>
                    <td className="tabular px-3 py-2.5 text-right font-mono">{fmtMoney(a.balance)}</td>
                    <td className="tabular px-3 py-2.5 text-right font-mono font-semibold">{fmtMoney(a.equity)}</td>
                    <td className="tabular px-3 py-2.5 text-right font-mono">{level(a.marginLevel)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {query.data && query.pages > 1 && <Pager page={query.page} pages={query.pages} total={query.data.total} noun="account" onPage={query.setPage} />}
      </Card>
    </div>
  );
}
