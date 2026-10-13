'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Search } from 'lucide-react';
import type { AdminUserRowDto, Paginated } from '@spova/shared';
import { get } from '@/lib/api';
import { fmtDate, fmtMoney } from '@/lib/utils';
import { PageHeader } from '@/components/app-shell';
import { Badge, Button, Card, Empty, Input, Select, Spinner } from '@/components/ui';

const statusTone = { active: 'success', frozen: 'danger', closed: 'neutral' } as const;

export default function ClientsPage() {
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Paginated<AdminUserRowDto> | null>(null);
  const limit = 25;

  useEffect(() => {
    const t = setTimeout(() => {
      setData(null);
      const p = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (q) p.set('q', q);
      if (status) p.set('status', status);
      get<Paginated<AdminUserRowDto>>(`/admin/users?${p}`)
        .then(setData)
        .catch(() => setData({ items: [], total: 0, page, limit }));
    }, 250);
    return () => clearTimeout(t);
  }, [q, status, page]);

  const pages = data ? Math.max(1, Math.ceil(data.total / limit)) : 1;

  return (
    <>
      <PageHeader title="Clients" sub={data ? `${data.total} total` : undefined} />
      <Card>
        <div className="mb-4 flex flex-wrap gap-3">
          <div className="min-w-[260px] flex-1">
            <Input placeholder="Search email, name, phone or login code" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} right={<Search className="h-4 w-4" />} />
          </div>
          <div className="w-40">
            <Select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
              <option value="">All statuses</option>
              <option value="active">Active</option>
              <option value="frozen">Frozen</option>
              <option value="closed">Closed</option>
            </Select>
          </div>
        </div>

        {!data ? (
          <div className="flex justify-center py-12">
            <Spinner />
          </div>
        ) : data.items.length === 0 ? (
          <Empty>No clients match.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-[11px] uppercase tracking-wider text-ink-500">
                <tr>
                  <th className="py-2 pr-4 font-medium">Client</th>
                  <th className="py-2 pr-4 font-medium">Country</th>
                  <th className="py-2 pr-4 font-medium">Status</th>
                  <th className="py-2 pr-4 font-medium">KYC</th>
                  <th className="py-2 pr-4 text-right font-medium">Open</th>
                  <th className="py-2 pr-4 text-right font-medium">Accounts</th>
                  <th className="py-2 pr-4 text-right font-medium">Total balance</th>
                  <th className="py-2 pr-4 font-medium">Registered</th>
                  <th className="py-2 font-medium">Last login</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {data.items.map((u) => (
                  <tr key={u.id} className="hover:bg-white/[0.03]">
                    <td className="py-2.5 pr-4">
                      <Link href={`/admin/clients/${u.id}`} className="block">
                        <div className="flex items-center gap-2">
                          <span
                            className="inline-block h-2 w-2 shrink-0 rounded-full"
                            style={{ background: u.online ? '#22c55e' : '#52607a', boxShadow: u.online ? '0 0 0 3px rgba(34,197,94,0.18)' : 'none' }}
                            title={u.online ? 'Online now' : u.lastSeenAt ? `Last seen ${fmtDate(u.lastSeenAt)}` : 'Offline'}
                          />
                          <span className="font-medium text-white">{u.firstName || u.lastName ? `${u.firstName ?? ''} ${u.lastName ?? ''}` : '—'}</span>
                        </div>
                        <div className="pl-4 text-xs text-ink-400">{u.email}</div>
                      </Link>
                    </td>
                    <td className="py-2.5 pr-4">{u.countryCode ?? '—'}</td>
                    <td className="py-2.5 pr-4">
                      <Badge tone={statusTone[u.status]}>{u.status}</Badge>
                    </td>
                    <td className="py-2.5 pr-4">
                      <div className="flex gap-1">
                        <Badge tone={u.kyc.poi ? 'success' : 'neutral'}>POI</Badge>
                        <Badge tone={u.kyc.por ? 'success' : 'neutral'}>POR</Badge>
                      </div>
                    </td>
                    <td className="tabular py-2.5 pr-4 text-right">{u.openTrades > 0 ? <span className="font-semibold text-white">{u.openTrades}</span> : <span className="text-ink-500">0</span>}</td>
                    <td className="tabular py-2.5 pr-4 text-right">{u.accountsCount}</td>
                    <td className="tabular py-2.5 pr-4 text-right">{fmtMoney(u.totalBalance)}</td>
                    <td className="whitespace-nowrap py-2.5 pr-4 text-ink-400">{fmtDate(u.createdAt, false)}</td>
                    <td className="whitespace-nowrap py-2.5 text-ink-400">{fmtDate(u.lastLoginAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {pages > 1 && (
          <div className="mt-3 flex items-center justify-between text-xs text-ink-400">
            <span>
              Page {page} / {pages}
            </span>
            <div className="flex gap-2">
              <Button size="sm" variant="ghost" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                Prev
              </Button>
              <Button size="sm" variant="ghost" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>
                Next
              </Button>
            </div>
          </div>
        )}
      </Card>
    </>
  );
}
