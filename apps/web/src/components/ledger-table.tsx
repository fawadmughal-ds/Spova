'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Receipt } from 'lucide-react';
import type { LedgerEntryDto, Paginated } from '@spova/shared';
import { get } from '@/lib/api';
import { cn, fmtDate, fmtMoney } from '@/lib/utils';
import { Badge, Empty, Skeleton } from '@/components/ui';
import { LedgerIcon } from '@/components/portal/ledger-icon';

/** Paginated ledger for an account. `basePath` = /me/accounts/:id or /admin/accounts/:id. `version` bumps to refetch. */
export function LedgerTable({ basePath, version = 0 }: { basePath: string; version?: number }) {
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Paginated<LedgerEntryDto> | null>(null);
  const [loading, setLoading] = useState(true);
  // rows replay their cascade when the page or account changes, not on every live refetch
  const view = useRef({ key: '', n: 0 });
  const limit = 15;

  useEffect(() => {
    const key = `${basePath}:${page}`;
    if (view.current.key !== key) {
      view.current = { key, n: view.current.n + 1 };
      setData(null);
    }
    setLoading(true);
    let stale = false;
    get<Paginated<LedgerEntryDto>>(`${basePath}/ledger?page=${page}&limit=${limit}`)
      .then((d) => !stale && setData(d))
      .catch(() => !stale && setData({ items: [], total: 0, page, limit }))
      .finally(() => !stale && setLoading(false));
    return () => {
      stale = true;
    };
  }, [basePath, page, version]);

  if (!data)
    return (
      <div className="space-y-2.5" role="status" aria-label="Loading">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="flex items-center gap-3.5" style={{ opacity: 1 - i * 0.14 }}>
            <Skeleton className="h-9 w-9 shrink-0 rounded-xl" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="hidden h-4 w-24 sm:block" />
          </div>
        ))}
      </div>
    );
  if (data.items.length === 0) return <Empty icon={<Receipt className="h-6 w-6" />}>No transactions.</Empty>;

  const pages = Math.max(1, Math.ceil(data.total / limit));

  return (
    <div>
      <div className="-mx-2 overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="text-left">
            <tr>
              <th className="label w-[1%] py-2 pl-2 pr-4 font-medium">Type</th>
              <th className="label py-2 pr-4 font-medium">Reason</th>
              <th className="label py-2 pr-4 font-medium">Date</th>
              <th className="label py-2 pr-4 text-right font-medium">Amount</th>
              <th className="label py-2 pr-4 text-right font-medium">Balance after</th>
              <th className="label py-2 pr-2 text-right font-medium">Credit after</th>
            </tr>
          </thead>
          <tbody key={view.current.n} className={cn('transition-opacity duration-300', loading && 'opacity-60')}>
            {data.items.map((e, i) => {
              const neg = e.amount.startsWith('-');
              return (
                <tr key={e.id} className="animate-page-in group border-t border-white/[0.05] transition-colors duration-300 hover:bg-white/[0.03]" style={{ animationDelay: `${i * 35}ms` }}>
                  <td className="py-2.5 pl-2 pr-4">
                    <div className="flex items-center gap-3">
                      <LedgerIcon type={e.type} negative={neg} />
                      <Badge tone={neg ? 'danger' : 'success'}>{e.type}</Badge>
                    </div>
                  </td>
                  <td className="max-w-[320px] truncate py-2.5 pr-4 text-ink-200" title={e.reason}>
                    {e.reason}
                  </td>
                  <td className="whitespace-nowrap py-2.5 pr-4 text-xs text-ink-400">{fmtDate(e.createdAt)}</td>
                  <td className={cn('tabular whitespace-nowrap py-2.5 pr-4 text-right font-mono font-semibold', neg ? 'text-down' : 'text-up')}>
                    {neg ? '' : '+'}
                    {fmtMoney(e.amount)}
                  </td>
                  <td className="tabular whitespace-nowrap py-2.5 pr-4 text-right font-mono text-ink-100">{fmtMoney(e.balanceAfter)}</td>
                  <td className="tabular whitespace-nowrap py-2.5 pr-2 text-right font-mono text-ink-400">{fmtMoney(e.creditAfter)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {pages > 1 && (
        <div className="mt-4 flex items-center justify-between gap-4 border-t border-white/[0.05] pt-4">
          <span className="font-mono text-[11px] text-ink-400">
            <span className="text-ink-100">{data.total}</span> entries
          </span>
          <div className="flex items-center gap-3">
            <PageButton label="Previous page" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              <ChevronLeft className="h-4 w-4 transition-transform duration-300 group-hover:-translate-x-0.5" />
            </PageButton>
            <div className="flex items-center gap-2.5">
              <span className="tabular font-mono text-xs text-ink-200">
                <span key={page} className="animate-pop-in inline-block text-white">
                  {page}
                </span>
                <span className="text-ink-500"> / {pages}</span>
              </span>
              <span className="hidden h-1 w-24 overflow-hidden rounded-full bg-white/[0.08] sm:block">
                <span className="block h-full rounded-full bg-gradient-to-r from-brand-500 to-brand-300 transition-[width] duration-500 ease-out-expo" style={{ width: `${(page / pages) * 100}%` }} />
              </span>
            </div>
            <PageButton label="Next page" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>
              <ChevronRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5" />
            </PageButton>
          </div>
        </div>
      )}
    </div>
  );
}

function PageButton({ label, disabled, onClick, children }: { label: string; disabled: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="group flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 text-ink-200 transition-colors duration-300 enabled:hover:border-brand-400/50 enabled:hover:bg-brand-400/10 enabled:hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
    >
      {children}
    </button>
  );
}
