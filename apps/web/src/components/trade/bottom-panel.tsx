'use client';

import { memo, useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { Check, ClipboardList, Download, FileText, Filter, History, Inbox, Info, Layers, Pencil, Wallet, X } from 'lucide-react';
import { dec, validateLots, validateSlTp, type AccountDto, type ClosePositionResult, type LedgerEntryDto, type OrderDto, type Paginated, type PositionDto } from '@spova/shared';
import { del, get, patch, post } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useToast } from '@/components/toast';
import { Spinner } from '@/components/ui';
import { fmtDateTimeParts, fmtLots, fmtNum, fmtPrice, fmtSignedNum, type SymbolSpec } from './format';
import { useBookVersion, useQuote, type LiveQuote } from './quote-store';
import { conversionPairs, livePnl } from './pnl';
import { CountBadge, Dropdown, EmptyState, SymbolTile } from './bits';
import { tradeError } from './errors';
import { CLOSE_REASON_LABEL, type TradingData } from './use-trading-data';

export type BottomTab = 'positions' | 'orders' | 'closed' | 'finance';
const PRICE_RE = /^\d{1,12}(\.\d{1,6})?$/;

function Pnl({ v, className, live }: { v: number | string | null; className?: string; live?: boolean }) {
  const n = v === null ? null : Number(v);
  return (
    <span className={cn('font-semibold', n === null ? 'text-[var(--t-dim)]' : n > 0 ? 't-pnl-up' : n < 0 ? 't-pnl-down' : 'text-[var(--t-text-2)]', className)} title={live === false ? 'Last known value' : undefined}>
      {n === null ? '—' : fmtNum(n)}
    </span>
  );
}

function SideTag({ side }: { side: 'buy' | 'sell' }) {
  return (
    <span className="t-side" data-side={side}>
      {side === 'buy' ? 'Buy' : 'Sell'}
    </span>
  );
}

function TwoLine({ a, b, className }: { a: ReactNode; b: ReactNode; className?: string }) {
  return (
    <span className={cn('block leading-tight', className)}>
      <span className="block">{a}</span>
      <span className="block text-[12px] text-[var(--t-muted)]">{b}</span>
    </span>
  );
}

function SymbolCell({ symbol, spec, side }: { symbol: string; spec: SymbolSpec | undefined; side?: 'buy' | 'sell' }) {
  return (
    <span className="flex items-center gap-2.5">
      <SymbolTile spec={spec} id={symbol} size={24} />
      <span className="text-[14px] font-semibold text-white">{symbol}</span>
      {side && <SideTag side={side} />}
    </span>
  );
}

function ErrorLine({ e }: { e: { title: string; body?: string } | null }) {
  if (!e) return null;
  return (
    <span className="animate-pop-in text-[12px] text-[var(--t-sell)]">
      {e.title}
      {e.body ? ` — ${e.body}` : ''}
    </span>
  );
}

const sub = 'flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2.5';
const mini = 't-input !h-8 !w-28 text-center';

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
    <tr className="animate-pop-in">
      <td colSpan={9} className="!h-auto bg-[rgb(42_195_237_/_0.05)] !p-0">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
          className={sub}
        >
          <span className="text-[12px] font-semibold text-white">Edit {p.symbol}</span>
          <label className="flex items-center gap-1.5 text-[12px] text-[var(--t-muted)]">
            <span className="font-semibold text-[var(--t-tp)]">TP</span>
            <input value={tp} onChange={(e) => setTp(e.target.value.replace(/[^\d.]/g, ''))} placeholder="none" inputMode="decimal" className={mini} aria-label="Take profit" />
          </label>
          <label className="flex items-center gap-1.5 text-[12px] text-[var(--t-muted)]">
            <span className="font-semibold text-[var(--t-sl)]">SL</span>
            <input value={sl} onChange={(e) => setSl(e.target.value.replace(/[^\d.]/g, ''))} placeholder="none" inputMode="decimal" autoFocus className={mini} aria-label="Stop loss" />
          </label>
          <span className="text-[12px] text-[var(--t-muted)]">now {fmtPrice(ref, digits)}</span>
          <button type="submit" disabled={!!v || busy || unchanged} className="t-btn t-btn-blue !h-8">
            {busy ? <Spinner className="h-3" tone="current" /> : <Check className="h-3.5 w-3.5" strokeWidth={3} />} Save
          </button>
          <button type="button" onClick={onDone} className="t-btn t-btn-ghost !h-8">
            Cancel
          </button>
          {v && (sl || tp) ? <span className="text-[12px] text-[var(--t-sell)]">{v}</span> : null}
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
  const partPnl = live.pnl !== null && !v ? live.pnl * dec(lots).div(p.lots).toNumber() : null;
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
      toast({ level: pnl >= 0 ? 'success' : 'warning', title: `${full ? 'Closed' : `Closed ${lots} of ${p.lots}`} ${p.side} ${p.symbol}`, body: `At ${fmtPrice(r.position.closePrice ?? live.price, digits)} · realised ${fmtSignedNum(r.realizedPnl)} USD` });
      onDone();
    } catch (e) {
      setErr(tradeError(e));
      setBusy(false);
    }
  };
  return (
    <tr className="animate-pop-in">
      <td colSpan={9} className="!h-auto bg-[rgb(239_85_109_/_0.06)] !p-0">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void close();
          }}
          className={sub}
        >
          <span className="text-[12px] font-semibold text-[var(--t-sell)]">Close {p.symbol}</span>
          <label className="flex items-center gap-1.5 text-[12px] text-[var(--t-muted)]">
            Volume <input value={lots} onChange={(e) => setLots(e.target.value.replace(/[^\d.]/g, ''))} inputMode="decimal" autoFocus className={mini} aria-label="Lots to close" />
          </label>
          {!full && (
            <button type="button" onClick={() => setLots(p.lots)} className="text-[12px] text-[var(--t-blue)] hover:underline">
              all {p.lots}
            </button>
          )}
          <span className="text-[12px] text-[var(--t-muted)]">
            at ~{fmtPrice(live.price, digits)} · est. <Pnl v={partPnl} />
          </span>
          <button type="submit" disabled={!!v || busy} className="t-btn t-btn-sell !h-8">
            {busy ? <Spinner className="h-3" tone="current" /> : <Check className="h-3.5 w-3.5" strokeWidth={3} />} {full ? 'Close position' : `Close ${lots || '…'} lots`}
          </button>
          <button type="button" onClick={onDone} className="t-btn t-btn-ghost !h-8">
            Keep
          </button>
          {v && lots ? <span className="text-[12px] text-[var(--t-sell)]">{v}</span> : null}
          <ErrorLine e={err} />
        </form>
      </td>
    </tr>
  );
}

function InfoRow({ p, spec, live }: { p: PositionDto; spec: SymbolSpec | undefined; live: { price: string | null; pnl: number | null } }) {
  const digits = spec?.digits ?? 2;
  const [d1, t1] = fmtDateTimeParts(p.openAt);
  const items: [string, ReactNode][] = [
    ['Position', p.id.slice(0, 8)],
    ['Opened', `${d1} ${t1} UTC`],
    ['Open price', fmtPrice(p.openPrice, digits)],
    ['Current', fmtPrice(live.price, digits)],
    ['Margin used', `${fmtNum(p.marginUsed)} USD`],
    ['Swap', `${fmtSignedNum(p.swapAccrued)} USD`],
    ['Commission', `${fmtNum(p.commission)} USD`],
    ['Contract size', spec ? dec(spec.contractSize).toString() : '—'],
    ['Floating P/L', <Pnl key="pnl" v={live.pnl} />],
  ];
  return (
    <tr className="animate-pop-in">
      <td colSpan={9} className="!h-auto bg-white/[0.02] !p-0">
        <dl className="grid grid-cols-2 gap-x-6 gap-y-1 px-4 py-2.5 text-[12px] sm:grid-cols-3 lg:grid-cols-5">
          {items.map(([k, v]) => (
            <div key={k} className="flex justify-between gap-2 border-b border-[var(--t-line)] py-1 last:border-0">
              <dt className="text-[var(--t-muted)]">{k}</dt>
              <dd className="font-medium text-white">{v}</dd>
            </div>
          ))}
        </dl>
      </td>
    </tr>
  );
}

type Mode = 'edit' | 'close' | 'info' | null;

const PositionRow = memo(function PositionRow({ p, spec, mode, onMode, account, data, onAccount, checked, onCheck }: { p: PositionDto; spec: SymbolSpec | undefined; mode: Mode; onMode: (m: Mode) => void; account: AccountDto; data: TradingData; onAccount: (a: AccountDto) => void; checked: boolean; onCheck: (v: boolean) => void }) {
  const q = useQuote(p.symbol);
  const [c1, c2] = conversionPairs(spec);
  useQuote(c1);
  useQuote(c2);
  const digits = spec?.digits ?? 2;
  const live = livePnl(p, spec, q);
  const pct = live.pnl !== null && Number(p.marginUsed) > 0 ? (live.pnl / Number(p.marginUsed)) * 100 : null;
  const [d1, t1] = fmtDateTimeParts(p.openAt);
  return (
    <>
      <tr className={cn(mode && 'bg-white/[0.02]')}>
        <td className="!pr-0">
          <input type="checkbox" className="t-check" checked={checked} onChange={(e) => onCheck(e.target.checked)} aria-label={`Select ${p.symbol} position`} />
        </td>
        <td>
          <SymbolCell symbol={p.symbol} spec={spec} side={p.side} />
        </td>
        <td className="text-right text-[14px] text-white">{fmtLots(p.lots)}</td>
        <td className="text-right text-[14px] text-white">{fmtPrice(p.openPrice, digits)}</td>
        <td className="text-right text-[14px] text-white">
          <span key={q?.n} className={cn(live.live && q?.dir === 'up' && 't-flash-up', live.live && q?.dir === 'down' && 't-flash-down')}>{fmtPrice(live.price, digits)}</span>
        </td>
        <td>
          <span className="flex items-center gap-3">
            <span className="block text-[12px] leading-tight">
              <span className="block text-[var(--t-muted)]">
                TP: <span className={p.tp ? 'text-[var(--t-tp)]' : ''}>{p.tp ? fmtPrice(p.tp, digits) : '-'}</span>
              </span>
              <span className="block text-[var(--t-muted)]">
                SL: <span className={p.sl ? 'text-[var(--t-sl)]' : ''}>{p.sl ? fmtPrice(p.sl, digits) : '-'}</span>
              </span>
            </span>
            <button type="button" onClick={() => onMode(mode === 'edit' ? null : 'edit')} aria-pressed={mode === 'edit'} title="Edit TP / SL" className="t-row-btn">
              <Pencil />
            </button>
          </span>
        </td>
        <td className="text-right text-[14px] text-white">
          <TwoLine a={d1} b={t1} />
        </td>
        <td className="text-right">
          <TwoLine a={<Pnl v={live.pnl} live={live.live} className="text-[14px]" />} b={<span className={cn(pct === null ? '' : pct > 0 ? 't-pnl-up' : pct < 0 ? 't-pnl-down' : '')}>{pct === null ? '' : `${pct.toFixed(2)}%`}</span>} />
        </td>
        <td className="text-right">
          <span className="inline-flex gap-1.5">
            <button type="button" onClick={() => onMode(mode === 'info' ? null : 'info')} aria-pressed={mode === 'info'} title="Position details" className="t-row-btn">
              <Info />
            </button>
            <button type="button" onClick={() => onMode(mode === 'edit' ? null : 'edit')} aria-pressed={mode === 'edit'} title="Edit TP / SL" className="t-row-btn">
              <Pencil />
            </button>
            <button type="button" onClick={() => onMode(mode === 'close' ? null : 'close')} aria-pressed={mode === 'close'} title="Close position" className="t-row-btn">
              <X />
            </button>
          </span>
        </td>
      </tr>
      {mode === 'edit' && <EditRow p={p} spec={spec} q={q} account={account} data={data} onDone={() => onMode(null)} />}
      {mode === 'close' && <CloseRow p={p} spec={spec} q={q} account={account} data={data} onDone={() => onMode(null)} onAccount={onAccount} />}
      {mode === 'info' && <InfoRow p={p} spec={spec} live={live} />}
    </>
  );
});

function PositionsTable({ positions, symbols, account, data, onAccount, selectedIds, onSelect }: { positions: PositionDto[] | null; symbols: Map<string, SymbolSpec>; account: AccountDto; data: TradingData; onAccount: (a: AccountDto) => void; selectedIds: Set<string>; onSelect: (ids: Set<string>) => void }) {
  const [active, setActive] = useState<{ id: string; mode: Mode } | null>(null);
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
  if (positions.length === 0)
    return (
      <EmptyState icon={<Layers />} title="No open positions">
        Use the SELL / BUY buttons in the instrument list to open one.
      </EmptyState>
    );
  const all = positions.every((p) => selectedIds.has(p.id));
  return (
    <table className="t-table min-w-[900px]">
      <thead>
        <tr>
          <th className="w-8 !pr-0">
            <input type="checkbox" className="t-check" checked={all} onChange={(e) => onSelect(e.target.checked ? new Set(positions.map((p) => p.id)) : new Set())} aria-label="Select all positions" />
          </th>
          <th>Symbol</th>
          <th className="text-right">Volume</th>
          <th className="text-right">Open Price</th>
          <th className="text-right">Current Price</th>
          <th>TP/SL</th>
          <th className="text-right">Open Time</th>
          <th className="text-right">Profit</th>
          <th className="w-28" />
        </tr>
      </thead>
      <tbody>
        {positions.map((p) => (
          <PositionRow
            key={p.id}
            p={p}
            spec={symbols.get(p.symbol)}
            mode={active?.id === p.id ? active.mode : null}
            onMode={(m) => setActive(m ? { id: p.id, mode: m } : null)}
            account={account}
            data={data}
            onAccount={onAccount}
            checked={selectedIds.has(p.id)}
            onCheck={(v) => {
              const next = new Set(selectedIds);
              if (v) next.add(p.id);
              else next.delete(p.id);
              onSelect(next);
            }}
          />
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
  const [d1, t1] = fmtDateTimeParts(o.createdAt);
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
    <tr>
      <td>
        <SymbolCell symbol={o.symbol} spec={spec} side={o.side} />
      </td>
      <td className="capitalize text-[var(--t-text-2)]">{o.type}</td>
      <td className="text-right text-[14px] text-white">{fmtLots(o.lots)}</td>
      <td className="text-right text-[14px] text-white">{fmtPrice(o.price, digits)}</td>
      <td>
        <span className="block text-[12px] leading-tight text-[var(--t-muted)]">
          <span className="block">
            TP: <span className={o.tp ? 'text-[var(--t-tp)]' : ''}>{o.tp ? fmtPrice(o.tp, digits) : '-'}</span>
          </span>
          <span className="block">
            SL: <span className={o.sl ? 'text-[var(--t-sl)]' : ''}>{o.sl ? fmtPrice(o.sl, digits) : '-'}</span>
          </span>
        </span>
      </td>
      <td className="text-right text-[14px] text-white">
        <TwoLine a={d1} b={t1} />
      </td>
      <td className="text-right">
        {confirm ? (
          <span className="animate-pop-in inline-flex items-center gap-2">
            <span className="text-[12px] text-[var(--t-muted)]">Cancel this order?</span>
            <button type="button" onClick={() => void cancel()} disabled={busy} className="t-btn t-btn-sell !h-7 !px-2.5 !text-[12px]">
              {busy ? <Spinner className="h-3" tone="current" /> : <Check className="h-3 w-3" strokeWidth={3} />} Yes
            </button>
            <button type="button" onClick={() => setConfirm(false)} disabled={busy} className="t-btn t-btn-ghost !h-7 !px-2.5 !text-[12px]">
              Keep
            </button>
          </span>
        ) : (
          <span className="inline-flex items-center gap-2">
            <ErrorLine e={err} />
            <button type="button" onClick={() => setConfirm(true)} title="Cancel order" className="t-row-btn">
              <X />
            </button>
          </span>
        )}
      </td>
    </tr>
  );
}

function OrdersTable({ orders, symbols, account, data }: { orders: OrderDto[] | null; symbols: Map<string, SymbolSpec>; account: AccountDto; data: TradingData }) {
  if (orders === null) return <Loading />;
  if (orders.length === 0)
    return (
      <EmptyState icon={<Inbox />} title="No pending orders">
        Limit and stop orders placed from the Advanced Order ticket wait here until the market reaches their price.
      </EmptyState>
    );
  return (
    <table className="t-table min-w-[760px]">
      <thead>
        <tr>
          <th>Symbol</th>
          <th>Type</th>
          <th className="text-right">Volume</th>
          <th className="text-right">Price</th>
          <th>TP/SL</th>
          <th className="text-right">Placed</th>
          <th className="w-16" />
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

function ClosedTable({ history, symbols }: { history: PositionDto[] | null; symbols: Map<string, SymbolSpec> }) {
  if (history === null) return <Loading />;
  if (history.length === 0) return <EmptyState icon={<History />} title="Nothing closed yet on this account" />;
  return (
    <table className="t-table min-w-[960px]">
      <thead>
        <tr>
          <th>Symbol</th>
          <th className="text-right">Volume</th>
          <th className="text-right">Open Price</th>
          <th className="text-right">Close Price</th>
          <th className="text-right">Open Time</th>
          <th className="text-right">Close Time</th>
          <th className="text-right">Swap</th>
          <th className="text-right">Profit</th>
          <th>Reason</th>
        </tr>
      </thead>
      <tbody>
        {history.map((p) => {
          const digits = symbols.get(p.symbol)?.digits ?? 2;
          const [d1, t1] = fmtDateTimeParts(p.openAt);
          const [d2, t2] = fmtDateTimeParts(p.closeAt);
          return (
            <tr key={p.id}>
              <td>
                <SymbolCell symbol={p.symbol} spec={symbols.get(p.symbol)} side={p.side} />
              </td>
              <td className="text-right text-[14px] text-white">{fmtLots(p.lots)}</td>
              <td className="text-right text-[14px] text-white">{fmtPrice(p.openPrice, digits)}</td>
              <td className="text-right text-[14px] text-white">{fmtPrice(p.closePrice, digits)}</td>
              <td className="text-right text-[14px] text-white">
                <TwoLine a={d1} b={t1} />
              </td>
              <td className="text-right text-[14px] text-white">
                <TwoLine a={d2} b={t2} />
              </td>
              <td className="text-right text-[var(--t-text-2)]">{fmtSignedNum(p.swapAccrued)}</td>
              <td className="text-right">
                <Pnl v={p.realizedPnl} className="text-[14px]" />
              </td>
              <td>
                <span className={cn('rounded px-1.5 py-0.5 text-[11px] font-medium', p.closeReason === 'tp' ? 'bg-[#1f6867] text-[#9ff0e5]' : p.closeReason === 'sl' || p.closeReason === 'stopout' ? 'bg-[#5a2a35] text-[#ffb3bf]' : 'bg-[var(--t-raised)] text-[var(--t-text-2)]')} title={p.closeReason ? CLOSE_REASON_LABEL[p.closeReason] : undefined}>
                  {p.closeReason ? CLOSE_REASON_LABEL[p.closeReason] ?? p.closeReason : '—'}
                </span>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

const LEDGER_LABEL: Record<string, string> = { deposit: 'Deposit', withdraw: 'Withdrawal', credit: 'Credit', debit: 'Debit', bonus: 'Bonus', pnl: 'Trade P/L', swap: 'Swap', fee: 'Fee', commission: 'Commission', adjustment: 'Adjustment' };

export function useLedger(accountId: string | null, version: number, limit = 20) {
  const [ledger, setLedger] = useState<LedgerEntryDto[] | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    if (!accountId) return;
    let alive = true;
    setError(false);
    get<Paginated<LedgerEntryDto>>(`/me/accounts/${accountId}/ledger?page=1&limit=${limit}`)
      .then((r) => alive && setLedger(r.items))
      .catch(() => alive && setError(true));
    return () => {
      alive = false;
    };
  }, [accountId, version, limit]);
  return { ledger, error };
}

function FinanceTab({ account, ledgerVersion }: { account: AccountDto; ledgerVersion: number }) {
  const { ledger, error } = useLedger(account.id, ledgerVersion);
  const level = account.marginLevel === null ? null : Number(account.marginLevel);
  const figures: [string, string, string?][] = [
    ['Balance', fmtNum(account.balance)],
    ['Equity', fmtNum(account.equity)],
    ['Credit', fmtNum(account.credit)],
    ['Margin', fmtNum(account.usedMargin)],
    ['Free margin', fmtNum(account.freeMargin)],
    ['Margin level', level === null ? '—' : `${fmtNum(level)}%`, level === null ? undefined : level <= 100 ? 't-pnl-down' : level <= 200 ? 'text-[var(--t-alert)]' : 't-pnl-up'],
  ];
  return (
    <div>
      <div className="grid grid-cols-2 gap-px border-b border-[var(--t-line)] bg-[var(--t-line)] sm:grid-cols-3 xl:grid-cols-6">
        {figures.map(([k, v, tone]) => (
          <div key={k} className="bg-[var(--t-bg)] px-4 py-3">
            <div className="text-[11px] text-[var(--t-muted)]">{k}</div>
            <div className={cn('mt-0.5 text-[16px] font-semibold text-white', tone)}>
              {v}
              {k !== 'Margin level' && <span className="ml-1 text-[11px] font-normal text-[var(--t-muted)]">{account.currency}</span>}
            </div>
          </div>
        ))}
      </div>
      {ledger === null ? (
        error ? (
          <EmptyState title="Could not load the ledger" />
        ) : (
          <Loading />
        )
      ) : ledger.length === 0 ? (
        <EmptyState icon={<Wallet />} title="No ledger entries yet" />
      ) : (
        <table className="t-table min-w-[720px]">
          <thead>
            <tr>
              <th>Type</th>
              <th>Reason</th>
              <th className="text-right">Amount</th>
              <th className="text-right">Balance after</th>
              <th className="text-right">Time</th>
            </tr>
          </thead>
          <tbody>
            {ledger.map((e) => {
              const [d1, t1] = fmtDateTimeParts(e.createdAt);
              return (
                <tr key={e.id} className="[&>td]:!h-[42px]">
                  <td className="font-medium text-white">{LEDGER_LABEL[e.type] ?? e.type}</td>
                  <td className="max-w-[420px] truncate text-[var(--t-text-2)]" title={e.reason}>
                    {e.reason}
                  </td>
                  <td className="text-right">
                    <span className={cn('font-semibold', Number(e.amount) > 0 ? 't-pnl-up' : Number(e.amount) < 0 ? 't-pnl-down' : 'text-white')}>{fmtSignedNum(e.amount)}</span>
                  </td>
                  <td className="text-right text-white">{fmtNum(e.balanceAfter)}</td>
                  <td className="text-right text-[var(--t-text-2)]">
                    {d1} <span className="text-[var(--t-muted)]">{t1}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

function Loading() {
  return (
    <div className="flex h-full min-h-[120px] items-center justify-center">
      <Spinner />
    </div>
  );
}

/** Download `rows` as CSV. */
function downloadCsv(name: string, headers: string[], rows: (string | number | null | undefined)[][]) {
  const esc = (v: string | number | null | undefined) => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [headers, ...rows].map((r) => r.map(esc).join(',')).join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export interface BottomPanelProps {
  account: AccountDto;
  symbols: Map<string, SymbolSpec>;
  data: TradingData;
  onAccount: (a: AccountDto) => void;
  /** bump to refetch the ledger (after a close / fill) */
  ledgerVersion: number;
  className?: string;
  style?: CSSProperties;
  tab?: BottomTab;
  onTab?: (t: BottomTab) => void;
}

/** Open positions / pending orders / closed positions / finance under the chart. */
export function BottomPanel({ account, symbols, data, onAccount, ledgerVersion, className, style, tab: tabProp, onTab }: BottomPanelProps) {
  const [tabState, setTabState] = useState<BottomTab>('positions');
  const tab = tabProp ?? tabState;
  const setTab = (t: BottomTab) => {
    setTabState(t);
    onTab?.(t);
  };
  const [filter, setFilter] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [closingAll, setClosingAll] = useState(false);
  const toast = useToast();
  useBookVersion();
  useEffect(() => {
    if (tab === 'closed' && data.history === null) void data.loadHistory();
  }, [tab, data.history, data]);
  useEffect(() => {
    setSelected(new Set());
    setFilter(null);
  }, [account.id]);
  // drop selections of positions that are gone
  useEffect(() => {
    if (!data.positions || selected.size === 0) return;
    const ids = new Set(data.positions.map((p) => p.id));
    if (Array.from(selected).some((id) => !ids.has(id))) setSelected(new Set(Array.from(selected).filter((id) => ids.has(id))));
  }, [data.positions, selected]);

  const symbolsInView = useMemo(() => {
    const src = tab === 'orders' ? data.orders : tab === 'closed' ? data.history : data.positions;
    return Array.from(new Set((src ?? []).map((x) => x.symbol))).sort();
  }, [tab, data.orders, data.history, data.positions]);
  const by = <T extends { symbol: string }>(xs: T[] | null) => (xs && filter ? xs.filter((x) => x.symbol === filter) : xs);
  const positions = by(data.positions);
  const orders = by(data.orders);
  const history = by(data.history);

  const closeSelected = async () => {
    if (!data.positions || selected.size === 0 || closingAll) return;
    setClosingAll(true);
    let ok = 0;
    let fail = 0;
    for (const id of Array.from(selected)) {
      const p = data.positions.find((x) => x.id === id);
      if (!p) continue;
      try {
        data.markOwn(p.id);
        const r = await post<ClosePositionResult>(`/me/accounts/${account.id}/positions/${p.id}/close`, {});
        data.upsertPosition(r.position);
        onAccount(r.account);
        ok++;
      } catch {
        fail++;
      }
    }
    setClosingAll(false);
    setSelected(new Set());
    toast({ level: fail ? 'warning' : 'success', title: `Closed ${ok} position${ok === 1 ? '' : 's'}`, body: fail ? `${fail} could not be closed.` : undefined });
  };

  const exportCsv = () => {
    const d = (iso: string | null | undefined) => (iso ? new Date(iso).toISOString() : '');
    if (tab === 'positions' && positions) {
      downloadCsv(`open-positions-${account.loginCode}.csv`, ['Symbol', 'Side', 'Volume', 'Open price', 'Current price', 'TP', 'SL', 'Open time', 'Margin', 'Swap', 'Profit'], positions.map((p) => {
        const live = livePnl(p, symbols.get(p.symbol), undefined);
        return [p.symbol, p.side, p.lots, p.openPrice, p.currentPrice, p.tp, p.sl, d(p.openAt), p.marginUsed, p.swapAccrued, live.pnl];
      }));
    } else if (tab === 'orders' && orders) {
      downloadCsv(`pending-orders-${account.loginCode}.csv`, ['Symbol', 'Side', 'Type', 'Volume', 'Price', 'TP', 'SL', 'Placed'], orders.map((o) => [o.symbol, o.side, o.type, o.lots, o.price, o.tp, o.sl, d(o.createdAt)]));
    } else if (tab === 'closed' && history) {
      downloadCsv(`closed-positions-${account.loginCode}.csv`, ['Symbol', 'Side', 'Volume', 'Open price', 'Close price', 'Open time', 'Close time', 'Swap', 'Commission', 'Profit', 'Reason'], history.map((p) => [p.symbol, p.side, p.lots, p.openPrice, p.closePrice, d(p.openAt), d(p.closeAt), p.swapAccrued, p.commission, p.realizedPnl, p.closeReason]));
    } else if (tab === 'finance') {
      downloadCsv(`account-${account.loginCode}.csv`, ['Balance', 'Equity', 'Credit', 'Margin', 'Free margin', 'Margin level'], [[account.balance, account.equity, account.credit, account.usedMargin, account.freeMargin, account.marginLevel]]);
    }
  };

  const tabs: { value: BottomTab; label: string; icon: ReactNode; count?: number }[] = [
    { value: 'positions', label: 'Open Positions', icon: <ClipboardList />, count: data.positions?.length },
    { value: 'orders', label: 'Pending Orders', icon: <FileText />, count: data.orders?.length },
    { value: 'closed', label: 'Closed Positions', icon: <History /> },
    { value: 'finance', label: 'Finance', icon: <Wallet /> },
  ];

  return (
    <section className={cn('t-panel', className)} style={style} aria-label="Positions and orders">
      <div className="t-bar !gap-1 overflow-x-auto [scrollbar-width:none]">
        {tabs.map((t) => (
          <button key={t.value} type="button" role="tab" aria-selected={tab === t.value} data-on={tab === t.value} onClick={() => setTab(t.value)} className="t-tab">
            {t.icon} {t.label} {t.value === 'positions' && <CountBadge n={t.count} />}
            {t.value === 'orders' && t.count ? <span className="text-[11px] text-[var(--t-muted)]">{t.count}</span> : null}
          </button>
        ))}
        <div className="flex-1" />
        {data.error && <span className="mr-2 text-[11px] text-[var(--t-sell)]">{data.error}</span>}
        {tab === 'positions' && selected.size > 0 && (
          <button type="button" onClick={() => void closeSelected()} disabled={closingAll} className="t-btn t-btn-sell mr-1 !h-8 !px-3 !text-[12px]">
            {closingAll ? <Spinner className="h-3" tone="current" /> : <X className="h-3.5 w-3.5" />} Close selected ({selected.size})
          </button>
        )}
        <Dropdown title="Filter by symbol" align="right" buttonClassName={cn('t-icon-btn', filter && '!text-[var(--t-blue)]')} button={() => <Filter />}>
          {(close) => (
            <div className="w-44">
              <button
                type="button"
                data-on={!filter}
                onClick={() => {
                  setFilter(null);
                  close();
                }}
                className="t-menu-item"
              >
                All symbols
              </button>
              {symbolsInView.map((s) => (
                <button
                  key={s}
                  type="button"
                  data-on={filter === s}
                  onClick={() => {
                    setFilter(s);
                    close();
                  }}
                  className="t-menu-item"
                >
                  <SymbolTile spec={symbols.get(s)} id={s} size={18} /> {s}
                </button>
              ))}
              {symbolsInView.length === 0 && <div className="px-2.5 py-1.5 text-[11px] text-[var(--t-muted)]">Nothing to filter.</div>}
            </div>
          )}
        </Dropdown>
        <button type="button" onClick={exportCsv} title="Export as CSV" aria-label="Export as CSV" className="t-icon-btn">
          <Download />
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        {tab === 'positions' && <PositionsTable positions={positions} symbols={symbols} account={account} data={data} onAccount={onAccount} selectedIds={selected} onSelect={setSelected} />}
        {tab === 'orders' && <OrdersTable orders={orders} symbols={symbols} account={account} data={data} />}
        {tab === 'closed' && <ClosedTable history={history} symbols={symbols} />}
        {tab === 'finance' && <FinanceTab account={account} ledgerVersion={ledgerVersion} />}
      </div>
    </section>
  );
}
