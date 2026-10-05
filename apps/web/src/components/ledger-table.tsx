'use client';

import { useEffect, useState } from 'react';
import type { LedgerEntryDto, Paginated } from '@spova/shared';
import { get } from '@/lib/api';
import { cn, fmtDate, fmtMoney } from '@/lib/utils';
import { Badge, Button, Empty, Spinner } from '@/components/ui';

/** Paginated ledger for an account. `basePath` = /me/accounts/:id or /admin/accounts/:id. `version` bumps to refetch. */
export function LedgerTable({ basePath, version = 0 }: { basePath: string; version?: number }) {
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Paginated<LedgerEntryDto> | null>(null);
  const limit = 15;

  useEffect(() => {
    setData(null);
    get<Paginated<LedgerEntryDto>>(`${basePath}/ledger?page=${page}&limit=${limit}`)
      .then(setData)
      .catch(() => setData({ items: [], total: 0, page, limit }));
  }, [basePath, page, version]);

  if (!data)
    return (
      <div className="flex justify-center py-10">
        <Spinner />
      </div>
    );
  if (data.items.length === 0) return <Empty>No transactions.</Empty>;

  const pages = Math.max(1, Math.ceil(data.total / limit));

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-[11px] uppercase tracking-wider text-ink-500">
            <tr>
              <th className="py-2 pr-4 font-medium">Date</th>
              <th className="py-2 pr-4 font-medium">Type</th>
              <th className="py-2 pr-4 font-medium">Reason</th>
              <th className="py-2 pr-4 text-right font-medium">Amount</th>
              <th className="py-2 pr-4 text-right font-medium">Balance after</th>
              <th className="py-2 text-right font-medium">Credit after</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {data.items.map((e) => {
              const neg = e.amount.startsWith('-');
              return (
                <tr key={e.id}>
                  <td className="whitespace-nowrap py-2.5 pr-4 text-ink-300">{fmtDate(e.createdAt)}</td>
                  <td className="py-2.5 pr-4">
                    <Badge tone={neg ? 'danger' : 'success'}>{e.type}</Badge>
                  </td>
                  <td className="max-w-[320px] truncate py-2.5 pr-4 text-ink-300">{e.reason}</td>
                  <td className={cn('tabular py-2.5 pr-4 text-right font-semibold', neg ? 'text-down' : 'text-up')}>
                    {neg ? '' : '+'}
                    {fmtMoney(e.amount)}
                  </td>
                  <td className="tabular py-2.5 pr-4 text-right">{fmtMoney(e.balanceAfter)}</td>
                  <td className="tabular py-2.5 text-right text-ink-400">{fmtMoney(e.creditAfter)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {pages > 1 && (
        <div className="mt-3 flex items-center justify-between text-xs text-ink-400">
          <span>
            Page {page} of {pages} · {data.total} entries
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
    </div>
  );
}
