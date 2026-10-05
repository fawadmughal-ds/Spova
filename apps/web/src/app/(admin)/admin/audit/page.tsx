'use client';

import { useEffect, useState } from 'react';
import type { Paginated } from '@spova/shared';
import { get } from '@/lib/api';
import { fmtDate } from '@/lib/utils';
import { PageHeader } from '@/components/app-shell';
import { Badge, Button, Card, Empty, Spinner } from '@/components/ui';

interface AuditRow {
  id: string;
  action: string;
  targetType: string;
  targetId: string | null;
  before: unknown;
  after: unknown;
  ip: string | null;
  createdAt: string;
  actor: { email: string };
}

export default function AuditPage() {
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Paginated<AuditRow> | null>(null);
  const limit = 30;

  useEffect(() => {
    setData(null);
    get<Paginated<AuditRow>>(`/admin/audit?page=${page}&limit=${limit}`)
      .then(setData)
      .catch(() => setData({ items: [], total: 0, page, limit }));
  }, [page]);

  const pages = data ? Math.max(1, Math.ceil(data.total / limit)) : 1;

  return (
    <>
      <PageHeader title="Audit log" sub="Every admin mutation. Append-only." />
      <Card>
        {!data ? (
          <div className="flex justify-center py-12">
            <Spinner />
          </div>
        ) : data.items.length === 0 ? (
          <Empty>Nothing yet.</Empty>
        ) : (
          <ul className="divide-y divide-white/5">
            {data.items.map((r) => (
              <li key={r.id} className="py-3 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={r.action.includes('debit') || r.action.includes('frozen') ? 'danger' : r.action.includes('credit') || r.action.includes('deposit') || r.action.includes('bonus') ? 'success' : 'info'}>{r.action}</Badge>
                  <span className="text-ink-300">{r.actor.email}</span>
                  <span className="text-xs text-ink-500">
                    {r.targetType} {r.targetId?.slice(0, 8)} · {fmtDate(r.createdAt)} {r.ip && `· ${r.ip}`}
                  </span>
                </div>
                <div className="mt-1.5 grid gap-2 font-mono text-[11px] text-ink-400 md:grid-cols-2">
                  {r.before != null && <pre className="overflow-x-auto rounded-lg bg-ink-900/70 p-2">before {JSON.stringify(r.before)}</pre>}
                  {r.after != null && <pre className="overflow-x-auto rounded-lg bg-ink-900/70 p-2">after {JSON.stringify(r.after)}</pre>}
                </div>
              </li>
            ))}
          </ul>
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
