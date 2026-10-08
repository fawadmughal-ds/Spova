'use client';

import { memo, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Check, History, Inbox, Layers, Pencil, X } from 'lucide-react';
import { dec, floatingPnl, quoteCurrency, toUsd, validateLots, validateSlTp, type AccountDto, type ClosePositionResult, type OrderDto, type PositionDto } from '@spova/shared';
import { del, patch, post } from '@/lib/api';
import { cn, fmtDate, fmtMoney } from '@/lib/utils';
import { useToast } from '@/components/toast';
import { SlidingTabs } from '@/components/portal/sliding-tabs';
import { Badge, Spinner } from '@/components/ui';
import { fmtPrice, fmtSigned, type SymbolSpec } from './format';
import { quoteStore, useBookVersion, useQuote, type LiveQuote } from './quote-store';
import { tradeError } from './errors';
import { CLOSE_REASON_LABEL, type TradingData } from './use-trading-data';

type Tab = 'positions' | 'orders' | 'history';
const PRICE_RE = /^\d{1,12}(\.\d{1,6})?$/;

/** Live close price + floating P/L in USD; falls back to the server's last figures when the store cannot value it. */
export function livePnl(p: PositionDto, spec: SymbolSpec | undefined, q: LiveQuote | undefined): { price: string | null; pnl: number | null; live: boolean } {
  const fallback = { price: p.currentPrice, pnl: p.floatingPnl === null ? null : Number(p.floatingPnl), live: false };
  if (!spec || !q || !q.bid || !q.ask || q.stale) return fallback;
  const raw = floatingPnl({ side: p.side, openPrice: p.openPrice, lots: p.lots, contractSize: spec.contractSize, bid: q.bid, ask: q.ask });
  const usd = toUsd(raw, quoteCurrency(spec.id, spec.assetClass), quoteStore.book());
  if (!usd) return fallback;
  return { price: p.side === 'buy' ? q.bid : q.ask, pnl: usd.toNumber(), live: true };
}

const conversionPairs = (spec: SymbolSpec | undefined): [string | null, string | null] => {
  if (!spec) return [null, null];
  const ccy = quoteCurrency(spec.id, spec.assetClass);
  return ccy === 'USD' ? [null, null] : [`${ccy}USD`, `USD${ccy}`];
};

function SideBadge({ side }: { side: 'buy' | 'sell' }) {
  return <Badge tone={side === 'buy' ? 'success' : 'danger'}>{side}</Badge>;
}

function ReasonChip({ reason }: { reason: PositionDto['closeReason'] }) {
  const tone = reason === 'tp' ? 'success' : reason === 'sl' || reason === 'stopout' ? 'danger' : reason === 'admin' ? 'warning' : 'neutral';
  return <Badge tone={tone}>{reason ?? '—'}</Badge>;
}

function Pnl({ v, live, className }: { v: number | string | null; live?: boolean; className?: string }) {
  const n = v === null ? null : Number(v);
  return (
    <span className={cn('tabular font-mono font-semibold', n === null ? 'text-ink-500' : n > 0 ? 'text-up' : n < 0 ? 'text-down' : 'text-ink-300', className)} title={live === false ? 'Last known value' : undefined}>
      {n === null ? '—' : fmtSigned(n)}
    </span>
  );
}

const th = 'label whitespace-nowrap px-2 py-1.5 text-left font-medium first:pl-3 last:pr-3';
const td = 'whitespace-nowrap px-2 py-1.5 align-middle first:pl-3 last:pr-3';
const num = 'tabular font-mono text-[12px]';
const miniInput = 'tabular h-7 w-24 rounded-md border border-white/10 bg-paper px-2 text-center font-mono text-[12px] text-ink-100 placeholder:text-ink-500 focus:border-brand-400/60 focus:outline-none';
const miniBtn = 'inline-flex h-7 items-center gap-1 rounded-md px-2 text-[11px] font-medium transition-colors disabled:opacity-50';

function ErrorLine({ e }: { e: { title: string; body?: string } | null }) {
  if (!e) return null;
  return (
    <span className="animate-pop-in text-[11px] text-down">
      {e.title}
      {e.body ? ` — ${e.body}` : ''}
    </span>
  );
}

/** Inline SL/TP editor under a position row. */
function EditRow({ p, spec, q, account, data, onDone }: { p: PositionDto; spec: SymbolSpec | undefined; q: LiveQuote | undefined; account: AccountDto; data: TradingData; onDone: () => void }) {
  const toast = useToast();
  const [sl, setSl] = useState(p.sl ?? '');
  const [tp, setTp] = useState(p.tp ?? '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<{ title: string; body?: string } | null>(null);
  const digits = spec?.digits ?? 2;
  const ref = q && q.bid && q.ask ? (p.side === 'buy' ? q.bid : q.ask) : p.currentPrice;
  const fmtErr = (sl && !PRICE_RE.test(sl)) || (tp && !PRICE_RE.test(tp)) ? 'Enter valid prices' : null;
  const sideErr = !fmtErr && ref ? validateSlTp(p.side, ref, sl || null, tp || null) : null;
  const v = fmtErr ?? sideErr;
  const unchanged = (sl || null) === p.sl && (tp || null) === p.tp;

  const save = async () => {
    if (v || busy) return;
    setBusy(true);
    setErr(null);
    try {
      data.markOwn(p.id);
      const r = await patch<PositionDto>(`/me/accounts/${account.id}/positions/${p.id}`, { sl: sl || null, tp: tp || null });
      data.upsertPosition(r);
      toast({ level: 'success', title: `${p.symbol}: protection updated`, body: `SL ${r.sl ? fmtPrice(r.sl, digits) : 'none'} · TP ${r.tp ? fmtPrice(r.tp, digits) : 'none'}` });
      onDone();
    } catch (e) {
      setErr(tradeError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <tr className="animate-pop-in bg-brand-400/[0.04]">
      <td colSpan={10} className="px-3 py-2">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
          className="flex flex-wrap items-center gap-x-3 gap-y-2"
        >
          <span className="label">Edit {p.symbol}</span>
          <label className="flex items-center gap-1.5 text-[11px] text-ink-400">
            SL <input value={sl} onChange={(e) => setSl(e.target.value.replace(/[^\d.]/g, ''))} placeholder="none" inputMode="decimal" autoFocus className={miniInput} aria-label="Stop loss" />
          </label>
          <label className="flex items-center gap-1.5 text-[11px] text-ink-400">
            TP <input value={tp} onChange={(e) => setTp(e.target.value.replace(/[^\d.]/g, ''))} placeholder="none" inputMode="decimal" className={miniInput} aria-label="Take profit" />
          </label>
          <span className="tabular font-mono text-[10px] text-ink-500">now {fmtPrice(ref, digits)}</span>
          <button type="submit" disabled={!!v || busy || unchanged} className={cn(miniBtn, 'bg-brand-500 text-paper hover:bg-brand-600')}>
            {busy ? <Spinner className="h-3" tone="current" /> : <Check className="h-3 w-3" strokeWidth={3} />} Save
          </button>
          <button type="button" onClick={onDone} className={cn(miniBtn, 'border border-white/10 text-ink-300 hover:bg-white/[0.05]')}>
            <X className="h-3 w-3" /> Cancel
          </button>
          {v && (sl || tp) ? <span className="text-[11px] text-down">{v}</span> : null}
          <ErrorLine e={err} />
        </form>
      </td>
    </tr>
  );
}

/** Inline close confirm: full or partial via the lots field. */
function CloseRow({ p, spec, q, account, data, onDone, onAccount }: { p: PositionDto; spec: SymbolSpec | undefined; q: LiveQuote | undefined; account: AccountDto; data: TradingData; onDone: () => void; onAccount: (a: AccountDto) => void }) {
  const toast = useToast();
  const [lots, setLots] = useState(p.lots);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<{ title: string; body?: string } | null>(null);
  const digits = spec?.digits ?? 2;
  const live = livePnl(p, spec, q);
  const v = spec ? validateLots(lots || '0', spec.minLot, p.lots, spec.lotStep) : dec(lots || 0).lte(0) || dec(lots || 0).gt(p.lots) ? `Up to ${p.lots} lots` : null;
  const full = dec(lots || 0).eq(p.lots);
  const partPnl = live.pnl !== null && !v ? (live.pnl * dec(lots).div(p.lots).toNumber()) : null;

  const close = async () => {
    if (v || busy) return;
    setBusy(true);
    setErr(null);
    try {
      data.markOwn(p.id);
      const r = await post<ClosePositionResult>(`/me/accounts/${account.id}/positions/${p.id}/close`, full ? {} : { lots });
      data.upsertPosition(r.position);
      onAccount(r.account);
      const pnl = Number(r.realizedPnl);
      toast({ level: pnl >= 0 ? 'success' : 'warning', title: `${full ? 'Closed' : `Closed ${lots} of ${p.lots}`} ${p.side} ${p.symbol}`, body: `At ${fmtPrice(r.position.closePrice ?? live.price, digits)} · realised ${fmtSigned(r.realizedPnl)} USD` });
      onDone();
    } catch (e) {
      setErr(tradeError(e));
      setBusy(false);
    }
  };

  return (
    <tr className="animate-pop-in bg-down/[0.04]">
      <td colSpan={10} className="px-3 py-2">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void close();
          }}
          className="flex flex-wrap items-center gap-x-3 gap-y-2"
        >
          <span className="label !text-down">Close {p.symbol}</span>
          <label className="flex items-center gap-1.5 text-[11px] text-ink-400">
            Lots <input value={lots} onChange={(e) => setLots(e.target.value.replace(/[^\d.]/g, ''))} inputMode="decimal" autoFocus className={miniInput} aria-label="Lots to close" />
          </label>
          {!full && (
            <button type="button" onClick={() => setLots(p.lots)} className="text-[11px] text-brand-300 hover:underline">
              all {p.lots}
            </button>
          )}
          <span className="tabular font-mono text-[11px] text-ink-400">
            at ~{fmtPrice(live.price, digits)} · est. <Pnl v={partPnl} />
          </span>
          <button type="submit" disabled={!!v || busy} className={cn(miniBtn, 'bg-down text-paper hover:brightness-110')}>
            {busy ? <Spinner className="h-3" tone="current" /> : <Check className="h-3 w-3" strokeWidth={3} />} {full ? 'Close position' : `Close ${lots || '…'} lots`}
          </button>
          <button type="button" onClick={onDone} className={cn(miniBtn, 'border border-white/10 text-ink-300 hover:bg-white/[0.05]')}>
            <X className="h-3 w-3" /> Keep
          </button>
          {v && lots ? <span className="text-[11px] text-down">{v}</span> : null}
          <ErrorLine e={err} />
        </form>
      </td>
    </tr>
  );
}

const PositionRow = memo(function PositionRow({ p, spec, index, mode, onMode, account, data, onAccount }: { p: PositionDto; spec: SymbolSpec | undefined; index: number; mode: 'edit' | 'close' | null; onMode: (m: 'edit' | 'close' | null) => void; account: AccountDto; data: TradingData; onAccount: (a: AccountDto) => void }) {
  const q = useQuote(p.symbol);
  const [c1, c2] = conversionPairs(spec);
  useQuote(c1);
  useQuote(c2);
  const digits = spec?.digits ?? 2;
  const live = livePnl(p, spec, q);
  return (
    <>
      <tr style={{ animationDelay: `${Math.min(index, 12) * 30}ms` }} className={cn('animate-page-in border-t border-white/[0.05] transition-colors hover:bg-white/[0.03]', mode && 'bg-white/[0.03]')}>
        <td className={cn(td, 'font-semibold text-ink-100')}>{p.symbol}</td>
        <td className={td}>
          <SideBadge side={p.side} />
        </td>
        <td className={cn(td, num, 'text-ink-100')}>{p.lots}</td>
        <td className={cn(td, num, 'text-ink-300')}>{fmtPrice(p.openPrice, digits)}</td>
        <td className={cn(td, num, 'text-ink-100')}>
          <span key={q?.n} className={cn(live.live && q?.dir === 'up' && 'animate-flash-up', live.live && q?.dir === 'down' && 'animate-flash-down')}>{fmtPrice(live.price, digits)}</span>
        </td>
        <td className={cn(td, num, p.sl ? 'text-down' : 'text-ink-500')}>{p.sl ? fmtPrice(p.sl, digits) : '—'}</td>
        <td className={cn(td, num, p.tp ? 'text-up' : 'text-ink-500')}>{p.tp ? fmtPrice(p.tp, digits) : '—'}</td>
        <td className={cn(td, num, 'text-ink-400')}>{fmtSigned(p.swapAccrued)}</td>
        <td className={cn(td, 'text-right')}>
          <Pnl v={live.pnl} live={live.live} className="text-[12px]" />
        </td>
        <td className={cn(td, 'text-right')}>
          <span className="inline-flex gap-1">
            <button type="button" onClick={() => onMode(mode === 'edit' ? null : 'edit')} aria-pressed={mode === 'edit'} className={cn(miniBtn, 'border border-white/10 text-ink-300 hover:border-brand-400/40 hover:text-brand-300', mode === 'edit' && 'border-brand-400/40 text-brand-300')}>
              <Pencil className="h-3 w-3" /> Edit
            </button>
            <button type="button" onClick={() => onMode(mode === 'close' ? null : 'close')} aria-pressed={mode === 'close'} className={cn(miniBtn, 'border border-down/30 text-down hover:bg-down/[0.06]', mode === 'close' && 'bg-down/[0.08]')}>
              <X className="h-3 w-3" /> Close
            </button>
          </span>
        </td>
      </tr>
      {mode === 'edit' && <EditRow p={p} spec={spec} q={q} account={account} data={data} onDone={() => onMode(null)} />}
      {mode === 'close' && <CloseRow p={p} spec={spec} q={q} account={account} data={data} onDone={() => onMode(null)} onAccount={onAccount} />}
    </>
  );
});

/** Sum of live floating P/L across open positions (re-rendered on every tick, cheap). */
function FloatingTotal({ positions, symbols }: { positions: PositionDto[]; symbols: Map<string, SymbolSpec> }) {
  useBookVersion();
  let sum = 0;
  let known = 0;
  for (const p of positions) {
    const { pnl } = livePnl(p, symbols.get(p.symbol), quoteStore.get(p.symbol));
    if (pnl !== null) {
      sum += pnl;
      known++;
    }
  }
  return (
    <span className="tabular inline-flex items-baseline gap-1.5 font-mono text-[11px] text-ink-400">
      Floating <Pnl v={known ? sum : null} className="text-[12px]" /> USD
    </span>
  );
}

function PositionsTable({ positions, symbols, account, data, onAccount }: { positions: PositionDto[] | null; symbols: Map<string, SymbolSpec>; account: AccountDto; data: TradingData; onAccount: (a: AccountDto) => void }) {
  const [active, setActive] = useState<{ id: string; mode: 'edit' | 'close' } | null>(null);
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setActive(null);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [active]);
  useEffect(() => {
    if (active && positions && !positions.some((p) => p.id === active.id)) setActive(null);
  }, [positions, active]);

  if (positions === null) return <Loading />;
  if (positions.length === 0) return <EmptyState icon={<Layers className="h-5 w-5" />}>No open positions. Place an order from the ticket to get started.</EmptyState>;
  return (
    <table className="w-full min-w-[760px] border-separate border-spacing-0 text-[12px]">
      <thead className="sticky top-0 z-10 bg-paper">
        <tr>
          <th className={th}>Symbol</th>
          <th className={th}>Side</th>
          <th className={th}>Lots</th>
          <th className={th}>Open</th>
          <th className={th}>Current</th>
          <th className={th}>S/L</th>
          <th className={th}>T/P</th>
          <th className={th}>Swap</th>
          <th className={cn(th, 'text-right')}>P/L USD</th>
          <th className={cn(th, 'text-right')} />
        </tr>
      </thead>
      <tbody>
        {positions.map((p, i) => (
          <PositionRow key={p.id} p={p} spec={symbols.get(p.symbol)} index={i} mode={active?.id === p.id ? active.mode : null} onMode={(m) => setActive(m ? { id: p.id, mode: m } : null)} account={account} data={data} onAccount={onAccount} />
        ))}
      </tbody>
    </table>
  );
}

function OrderRow({ o, spec, account, data }: { o: OrderDto; spec: SymbolSpec | undefined; account: AccountDto; data: TradingData }) {
  const toast = useToast();
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<{ title: string; body?: string } | null>(null);
  const digits = spec?.digits ?? 2;
  useEffect(() => {
    if (!confirm) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setConfirm(false);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [confirm]);

  const cancel = async () => {
    setBusy(true);
    setErr(null);
    try {
      data.markOwn(o.id);
      await del(`/me/accounts/${account.id}/orders/${o.id}`);
      data.removeOrder(o.id);
      toast({ level: 'info', title: 'Order cancelled', body: `${o.side} ${o.type} ${o.lots} ${o.symbol} at ${fmtPrice(o.price, digits)}` });
    } catch (e) {
      setErr(tradeError(e));
      setBusy(false);
      setConfirm(false);
    }
  };
  return (
    <tr className="animate-page-in border-t border-white/[0.05] hover:bg-white/[0.03]">
      <td className={cn(td, 'font-semibold text-ink-100')}>{o.symbol}</td>
      <td className={td}>
        <SideBadge side={o.side} />
      </td>
      <td className={cn(td, 'capitalize text-ink-300')}>{o.type}</td>
      <td className={cn(td, num, 'text-ink-100')}>{o.lots}</td>
      <td className={cn(td, num, 'text-ink-100')}>{fmtPrice(o.price, digits)}</td>
      <td className={cn(td, num, o.sl ? 'text-down' : 'text-ink-500')}>{o.sl ? fmtPrice(o.sl, digits) : '—'}</td>
      <td className={cn(td, num, o.tp ? 'text-up' : 'text-ink-500')}>{o.tp ? fmtPrice(o.tp, digits) : '—'}</td>
      <td className={cn(td, 'text-ink-400')}>{fmtDate(o.createdAt)}</td>
      <td className={cn(td, 'text-right')}>
        {confirm ? (
          <span className="animate-pop-in inline-flex items-center gap-1.5">
            <span className="text-[11px] text-ink-400">Cancel this order?</span>
            <button type="button" onClick={() => void cancel()} disabled={busy} className={cn(miniBtn, 'bg-down text-paper')}>
              {busy ? <Spinner className="h-3" tone="current" /> : <Check className="h-3 w-3" strokeWidth={3} />} Yes
            </button>
            <button type="button" onClick={() => setConfirm(false)} disabled={busy} className={cn(miniBtn, 'border border-white/10 text-ink-300')}>
              Keep
            </button>
          </span>
        ) : (
          <span className="inline-flex items-center gap-2">
            <ErrorLine e={err} />
            <button type="button" onClick={() => setConfirm(true)} className={cn(miniBtn, 'border border-down/30 text-down hover:bg-down/[0.06]')}>
              <X className="h-3 w-3" /> Cancel
            </button>
          </span>
        )}
      </td>
    </tr>
  );
}

function OrdersTable({ orders, symbols, account, data }: { orders: OrderDto[] | null; symbols: Map<string, SymbolSpec>; account: AccountDto; data: TradingData }) {
  if (orders === null) return <Loading />;
  if (orders.length === 0) return <EmptyState icon={<Inbox className="h-5 w-5" />}>No pending orders. Limit and stop orders wait here until the market reaches their price.</EmptyState>;
  return (
    <table className="w-full min-w-[720px] border-separate border-spacing-0 text-[12px]">
      <thead className="sticky top-0 z-10 bg-paper">
        <tr>
          <th className={th}>Symbol</th>
          <th className={th}>Side</th>
          <th className={th}>Type</th>
          <th className={th}>Lots</th>
          <th className={th}>Price</th>
          <th className={th}>S/L</th>
          <th className={th}>T/P</th>
          <th className={th}>Placed</th>
          <th className={cn(th, 'text-right')} />
        </tr>
      </thead>
      <tbody>
        {orders.map((o) => (
          <OrderRow key={o.id} o={o} spec={symbols.get(o.symbol)} account={account} data={data} />
        ))}
      </tbody>
    </table>
  );
}

function HistoryTable({ history, symbols }: { history: PositionDto[] | null; symbols: Map<string, SymbolSpec> }) {
  if (history === null) return <Loading />;
  if (history.length === 0) return <EmptyState icon={<History className="h-5 w-5" />}>Nothing closed yet on this account.</EmptyState>;
  return (
    <table className="w-full min-w-[820px] border-separate border-spacing-0 text-[12px]">
      <thead className="sticky top-0 z-10 bg-paper">
        <tr>
          <th className={th}>Symbol</th>
          <th className={th}>Side</th>
          <th className={th}>Lots</th>
          <th className={th}>Open</th>
          <th className={th}>Close</th>
          <th className={th}>Opened</th>
          <th className={th}>Closed</th>
          <th className={th}>Swap</th>
          <th className={cn(th, 'text-right')}>P/L USD</th>
          <th className={th}>Reason</th>
        </tr>
      </thead>
      <tbody>
        {history.map((p, i) => {
          const digits = symbols.get(p.symbol)?.digits ?? 2;
          return (
            <tr key={p.id} style={{ animationDelay: `${Math.min(i, 12) * 25}ms` }} className="animate-page-in border-t border-white/[0.05] hover:bg-white/[0.03]">
              <td className={cn(td, 'font-semibold text-ink-100')}>{p.symbol}</td>
              <td className={td}>
                <SideBadge side={p.side} />
              </td>
              <td className={cn(td, num, 'text-ink-100')}>{p.lots}</td>
              <td className={cn(td, num, 'text-ink-300')}>{fmtPrice(p.openPrice, digits)}</td>
              <td className={cn(td, num, 'text-ink-100')}>{fmtPrice(p.closePrice, digits)}</td>
              <td className={cn(td, 'text-ink-400')}>{fmtDate(p.openAt)}</td>
              <td className={cn(td, 'text-ink-400')}>{fmtDate(p.closeAt)}</td>
              <td className={cn(td, num, 'text-ink-400')}>{fmtSigned(p.swapAccrued)}</td>
              <td className={cn(td, 'text-right')}>
                <Pnl v={p.realizedPnl} className="text-[12px]" />
              </td>
              <td className={td} title={p.closeReason ? CLOSE_REASON_LABEL[p.closeReason] : undefined}>
                <ReasonChip reason={p.closeReason} />
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function Loading() {
  return (
    <div className="flex h-full min-h-[120px] items-center justify-center">
      <Spinner />
    </div>
  );
}
function EmptyState({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <div className="flex h-full min-h-[120px] items-center justify-center p-4">
      <div className="bg-dots flex max-w-sm flex-col items-center gap-2 rounded-xl border border-dashed border-white/10 px-6 py-5 text-center text-xs text-ink-400">
        <span className="text-ink-500">{icon}</span>
        {children}
      </div>
    </div>
  );
}

/** Open positions / pending orders / history under the chart. */
export function BottomPanel({ account, symbols, data, onAccount, className }: { account: AccountDto; symbols: Map<string, SymbolSpec>; data: TradingData; onAccount: (a: AccountDto) => void; className?: string }) {
  const [tab, setTab] = useState<Tab>('positions');
  useEffect(() => {
    if (tab === 'history' && data.history === null) void data.loadHistory();
  }, [tab, data.history, data.loadHistory, data]);

  const count = (n: number | undefined) => (n ? <span className="tabular ml-0.5 rounded-full bg-white/[0.07] px-1.5 font-mono text-[10px] text-ink-300">{n}</span> : null);
  const items = useMemo(
    () => [
      { value: 'positions' as Tab, label: <>Open positions{count(data.positions?.length)}</> },
      { value: 'orders' as Tab, label: <>Pending orders{count(data.orders?.length)}</> },
      { value: 'history' as Tab, label: <>History</> },
    ],
    [data.positions?.length, data.orders?.length],
  );

  return (
    <section className={cn('flex min-h-0 flex-col bg-paper', className)} aria-label="Positions and orders">
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-white/[0.06] px-2">
        <SlidingTabs items={items} value={tab} onChange={setTab} variant="underline" className="!border-b-0 [&_button]:!px-3 [&_button]:!py-2 [&_button]:!text-xs" />
        <div className="hidden items-center gap-3 pr-2 sm:flex">
          {data.error && <span className="text-[11px] text-down">{data.error}</span>}
          {tab === 'positions' && data.positions && data.positions.length > 0 && <FloatingTotal positions={data.positions} symbols={symbols} />}
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-auto [scrollbar-width:thin]">
        {tab === 'positions' && <PositionsTable positions={data.positions} symbols={symbols} account={account} data={data} onAccount={onAccount} />}
        {tab === 'orders' && <OrdersTable orders={data.orders} symbols={symbols} account={account} data={data} />}
        {tab === 'history' && <HistoryTable history={data.history} symbols={symbols} />}
      </div>
    </section>
  );
}
