'use client';

import { useEffect, useState } from 'react';
import { ArrowDownRight, ArrowUpRight, CandlestickChart, ListOrdered } from 'lucide-react';
import type { OrderDto, PositionDto } from '@spova/shared';
import { WS_EVENTS } from '@spova/shared';
import { post, ApiError } from '@/lib/api';
import { useUserEvent } from '@/lib/ws';
import { cn, fmtDate, fmtMoney } from '@/lib/utils';
import { PageHeader } from '@/components/app-shell';
import { useToast } from '@/components/toast';
import { Badge, Button, Card, Empty } from '@/components/ui';
import { ClientCell, Pager, StatusTabs, TableSkeleton, Textarea, TimeAgo, useQueue } from '@/components/admin/queue-bits';

type Tab = 'open' | 'closed' | 'pending';
type PosRow = PositionDto & { account: { loginCode: number; type: 'demo' | 'live' }; user: { id: string; email: string } };
type OrdRow = OrderDto & { account: { loginCode: number }; user: { id: string; email: string } };

const Side = ({ side }: { side: 'buy' | 'sell' }) => (
  <Badge tone={side === 'buy' ? 'success' : 'danger'} className="gap-1">
    {side === 'buy' ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
    {side}
  </Badge>
);
const Pnl = ({ v }: { v: string | null }) => (v === null ? <span className="text-ink-500">—</span> : <span className={cn('tabular font-mono font-semibold', Number(v) >= 0 ? 'text-up' : 'text-down')}>{Number(v) >= 0 ? '+' : ''}{fmtMoney(v)}</span>);

/** Back-office view of the book: live positions (force close), closed history and pending orders. */
export default function AdminTradesPage() {
  const [tab, setTab] = useState<Tab>('open');
  const toast = useToast();
  const positions = useQueue<PosRow>('/admin/positions', { open: tab === 'closed' ? 'false' : 'true' }, 25);
  const orders = useQueue<OrdRow>('/admin/orders', { status: 'pending' }, 25);
  const [closing, setClosing] = useState<{ id: string; reason: string; busy: boolean; error: string | null } | null>(null);

  // live refresh from the engine + a slow poll for floating P/L
  useUserEvent(WS_EVENTS.ADMIN_POSITION, () => positions.refresh());
  useUserEvent(WS_EVENTS.ADMIN_STOPOUT, () => positions.refresh());
  useEffect(() => {
    if (tab !== 'open') return;
    const t = setInterval(() => positions.refresh(), 5000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const forceClose = async () => {
    if (!closing) return;
    if (closing.reason.trim().length < 3) return setClosing({ ...closing, error: 'Give a reason (at least 3 characters); it goes to the audit log.' });
    setClosing({ ...closing, busy: true, error: null });
    try {
      const r = await post<{ realizedPnl: string }>(`/admin/positions/${closing.id}/close`, { reason: closing.reason.trim() });
      toast({ title: 'Position closed', body: `Realised P/L ${fmtMoney(r.realizedPnl)} USD`, level: 'success' });
      setClosing(null);
      positions.refresh();
    } catch (e) {
      setClosing({ ...closing, busy: false, error: e instanceof ApiError ? e.message : 'Could not close' });
    }
  };

  const rows = tab === 'closed' ? (positions.data?.items ?? []).filter((p) => p.status === 'closed') : positions.data?.items ?? [];
  const floatingTotal = rows.reduce((a, p) => a + Number(p.floatingPnl ?? 0), 0);

  return (
    <>
      <PageHeader title="Trades" sub="Every open position on the book, closed history, and pending orders. Force-closes are written to the audit log." />
      <StatusTabs<Tab>
        items={[
          { value: 'open', label: `Open${positions.data && tab === 'open' ? ` · ${positions.data.total}` : ''}` },
          { value: 'pending', label: `Pending orders${orders.data ? ` · ${orders.data.total}` : ''}` },
          { value: 'closed', label: 'Closed' },
        ]}
        value={tab}
        onChange={setTab}
        className="mb-4"
      />

      {tab === 'pending' ? (
        <Card>
          {orders.loading && !orders.data ? (
            <TableSkeleton rows={4} cols={6} />
          ) : !orders.data?.items.length ? (
            <Empty icon={<ListOrdered className="h-6 w-6" />}>No pending orders.</Empty>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left">
                  <tr>
                    {['Client', 'Account', 'Order', 'Trigger', 'SL / TP', 'Placed'].map((h) => (
                      <th key={h} className="label px-3 py-2 font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.06]">
                  {orders.data.items.map((o) => (
                    <tr key={o.id} className="animate-page-in">
                      <td className="px-3 py-2.5"><ClientCell user={{ ...o.user, firstName: null, lastName: null }} /></td>
                      <td className="tabular px-3 py-2.5 font-mono text-xs">{o.account.loginCode}</td>
                      <td className="px-3 py-2.5"><div className="flex items-center gap-2"><Side side={o.side} /><span className="font-semibold">{o.symbol}</span><span className="font-mono text-xs text-ink-400">{o.type} · {o.lots} lots</span></div></td>
                      <td className="tabular px-3 py-2.5 font-mono">{o.price}</td>
                      <td className="tabular px-3 py-2.5 font-mono text-xs text-ink-400">{o.sl ?? '—'} / {o.tp ?? '—'}</td>
                      <td className="px-3 py-2.5 text-xs text-ink-400"><TimeAgo iso={o.createdAt} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {orders.data && <Pager page={orders.page} pages={orders.pages} total={orders.data.total} noun="orders" onPage={orders.setPage} />}
        </Card>
      ) : (
        <Card
          action={
            tab === 'open' && rows.length ? (
              <span className="text-xs text-ink-400">
                Floating P/L <Pnl v={floatingTotal.toFixed(2)} />
              </span>
            ) : undefined
          }
        >
          {positions.loading && !positions.data ? (
            <TableSkeleton rows={5} cols={8} />
          ) : rows.length === 0 ? (
            <Empty icon={<CandlestickChart className="h-6 w-6" />}>{tab === 'open' ? 'No open positions on the book.' : 'No closed positions yet.'}</Empty>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left">
                  <tr>
                    {['Client', 'Account', 'Position', 'Open', tab === 'open' ? 'Current' : 'Close', 'SL / TP', 'Margin', tab === 'open' ? 'Floating' : 'Realised', tab === 'open' ? '' : 'Reason'].map((h, i) => (
                      <th key={i} className="label px-3 py-2 font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.06]">
                  {rows.map((p) => (
                    <tr key={p.id} className="animate-page-in align-top">
                      <td className="px-3 py-2.5"><ClientCell user={{ ...p.user, firstName: null, lastName: null }} /></td>
                      <td className="px-3 py-2.5">
                        <div className="tabular font-mono text-xs">{p.account.loginCode}</div>
                        <Badge tone={p.account.type === 'live' ? 'success' : 'info'} className="mt-1">{p.account.type}</Badge>
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-2"><Side side={p.side} /><span className="font-semibold">{p.symbol}</span></div>
                        <div className="mt-1 font-mono text-xs text-ink-400">{p.lots} lots · <TimeAgo iso={p.openAt} /></div>
                      </td>
                      <td className="tabular px-3 py-2.5 font-mono">{p.openPrice}</td>
                      <td className="tabular px-3 py-2.5 font-mono">{tab === 'open' ? p.currentPrice ?? <span className="text-ink-500">—</span> : p.closePrice}{tab !== 'open' && p.closeAt && <div className="text-[11px] text-ink-500">{fmtDate(p.closeAt)}</div>}</td>
                      <td className="tabular px-3 py-2.5 font-mono text-xs text-ink-400">{p.sl ?? '—'} / {p.tp ?? '—'}</td>
                      <td className="tabular px-3 py-2.5 font-mono">{fmtMoney(p.marginUsed)}</td>
                      <td className="px-3 py-2.5"><Pnl v={tab === 'open' ? p.floatingPnl : p.realizedPnl} /></td>
                      <td className="px-3 py-2.5">
                        {tab === 'open' ? (
                          closing?.id === p.id ? (
                            <div className="w-64 space-y-2 rounded-xl border border-down/30 bg-down/[0.05] p-3">
                              <p className="text-xs text-ink-300">Closes at the current market price. The client is notified.</p>
                              <Textarea value={closing.reason} onChange={(e) => setClosing({ ...closing, reason: e.target.value })} placeholder="Reason (audit log)" rows={2} />
                              {closing.error && <p className="text-xs text-down">{closing.error}</p>}
                              <div className="flex gap-2">
                                <Button size="sm" variant="danger" loading={closing.busy} onClick={() => void forceClose()}>Force close</Button>
                                <Button size="sm" variant="ghost" onClick={() => setClosing(null)}>Keep</Button>
                              </div>
                            </div>
                          ) : (
                            <Button size="sm" variant="outline" onClick={() => setClosing({ id: p.id, reason: '', busy: false, error: null })}>Force close</Button>
                          )
                        ) : (
                          <Badge tone={p.closeReason === 'stopout' ? 'danger' : p.closeReason === 'admin' ? 'warning' : 'neutral'}>{p.closeReason}</Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {positions.data && <Pager page={positions.page} pages={positions.pages} total={positions.data.total} noun="positions" onPage={positions.setPage} />}
        </Card>
      )}
    </>
  );
}
