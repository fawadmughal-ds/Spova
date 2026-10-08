'use client';

import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { AlertTriangle, Check, CornerDownLeft, Minus, Plus, X } from 'lucide-react';
import { dec, effectiveLeverage, quoteCurrency, requiredMarginUsd, validateLots, validateSlTp, type AccountDto, type OrderSide, type OrderType, type PlaceOrderResult } from '@spova/shared';
import { post } from '@/lib/api';
import { cn, fmtMoney } from '@/lib/utils';
import { useToast } from '@/components/toast';
import type { FriendlyError } from '@/components/portal/api-error';
import { Spinner } from '@/components/ui';
import { fmtPrice, pipSize, spreadPoints, type SymbolSpec } from './format';
import { quoteStore, useBookVersion, useQuote } from './quote-store';
import { tradeError } from './errors';

const PRICE_RE = /^\d{1,12}(\.\d{1,6})?$/;
const TYPES: { value: OrderType; label: string }[] = [
  { value: 'market', label: 'Market' },
  { value: 'limit', label: 'Limit' },
  { value: 'stop', label: 'Stop' },
];

/** -/+ around a numeric text input. */
function Stepper({ value, onChange, onStep, placeholder, label, hint, error, digits, clearable, disabled, id }: { value: string; onChange: (v: string) => void; onStep: (dir: 1 | -1) => void; placeholder?: string; label: ReactNode; hint?: ReactNode; error?: string | null; digits?: number; clearable?: boolean; disabled?: boolean; id: string }) {
  const btn = 'flex h-9 w-9 shrink-0 items-center justify-center text-ink-400 transition-colors hover:bg-white/[0.05] hover:text-white disabled:opacity-40 disabled:hover:bg-transparent';
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <label htmlFor={id} className="label">
          {label}
        </label>
        {hint && <span className="tabular font-mono text-[10px] text-ink-500">{hint}</span>}
      </div>
      <div className={cn('flex h-9 items-stretch overflow-hidden rounded-lg border bg-white/[0.02] transition-colors focus-within:border-brand-400/60', error ? 'border-down/50' : 'border-white/10')}>
        <button type="button" tabIndex={-1} onClick={() => onStep(-1)} disabled={disabled} aria-label={`Decrease ${typeof label === 'string' ? label : ''}`} className={cn(btn, 'border-r border-white/[0.08]')}>
          <Minus className="h-3.5 w-3.5" />
        </button>
        <input
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/[^\d.]/g, ''))}
          placeholder={placeholder}
          inputMode="decimal"
          autoComplete="off"
          disabled={disabled}
          aria-invalid={!!error || undefined}
          className="tabular min-w-0 flex-1 bg-transparent px-2 text-center font-mono text-[13px] text-ink-100 placeholder:text-ink-500 focus:outline-none disabled:opacity-50"
        />
        {clearable && value && (
          <button type="button" tabIndex={-1} onClick={() => onChange('')} aria-label="Clear" className={cn(btn, '!w-7')}>
            <X className="h-3 w-3" />
          </button>
        )}
        <button type="button" tabIndex={-1} onClick={() => onStep(1)} disabled={disabled} aria-label={`Increase ${typeof label === 'string' ? label : ''}`} className={cn(btn, 'border-l border-white/[0.08]')}>
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>
      {error && <div className="animate-pop-in mt-1 text-[11px] text-down">{error}</div>}
      {digits !== undefined && !error && value && !PRICE_RE.test(value) && <div className="mt-1 text-[11px] text-down">Enter a valid price</div>}
    </div>
  );
}

/**
 * Market / limit / stop ticket for one instrument. Validates with the same shared rules as the API
 * (lots grid, SL/TP side, margin) so a disabled button always says why; market orders confirm inline.
 */
export function OrderTicket({ spec, account, onPlaced, onBeforePlace, className }: { spec: SymbolSpec; account: AccountDto; onPlaced: (r: PlaceOrderResult) => void; onBeforePlace?: (clientRef: string) => void; className?: string }) {
  const toast = useToast();
  const q = useQuote(spec.id);
  const bookVersion = useBookVersion();
  const [side, setSide] = useState<OrderSide>('buy');
  const [type, setType] = useState<OrderType>('market');
  const [lots, setLots] = useState(spec.minLot);
  const [price, setPrice] = useState('');
  const [sl, setSl] = useState('');
  const [tp, setTp] = useState('');
  const [confirm, setConfirm] = useState<{ ref: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<FriendlyError | null>(null);

  // new instrument: fresh ticket
  useEffect(() => {
    setLots(spec.minLot);
    setPrice('');
    setSl('');
    setTp('');
    setConfirm(null);
    setErr(null);
  }, [spec.id, spec.minLot]);
  useEffect(() => {
    setConfirm(null);
  }, [side, type, lots, price, sl, tp]);

  const hasQuote = !!q && !!q.bid && !!q.ask && !q.stale;
  const closed = q?.open === false || (q?.open === undefined && !spec.isOpen);
  const pip = pipSize(spec.digits);
  const lotDecimals = dec(spec.lotStep).decimalPlaces();
  const lotsErr = validateLots(lots || '0', spec.minLot, spec.maxLot, spec.lotStep);

  // reference price: the live side price for market orders, the entered price for pending ones
  const refPrice: string | null = type === 'market' ? (hasQuote ? (side === 'buy' ? q.ask : q.bid) : null) : PRICE_RE.test(price) ? price : null;

  let priceErr: string | null = null;
  if (type !== 'market') {
    if (!price) priceErr = 'Enter the order price';
    else if (!PRICE_RE.test(price)) priceErr = 'Enter a valid price';
    else if (hasQuote) {
      const p = dec(price);
      if (type === 'limit' && side === 'buy' && !p.lt(q.ask)) priceErr = `Limit buy must be below the ask (${fmtPrice(q.ask, spec.digits)})`;
      if (type === 'limit' && side === 'sell' && !p.gt(q.bid)) priceErr = `Limit sell must be above the bid (${fmtPrice(q.bid, spec.digits)})`;
      if (type === 'stop' && side === 'buy' && !p.gt(q.ask)) priceErr = `Stop buy must be above the ask (${fmtPrice(q.ask, spec.digits)})`;
      if (type === 'stop' && side === 'sell' && !p.lt(q.bid)) priceErr = `Stop sell must be below the bid (${fmtPrice(q.bid, spec.digits)})`;
    }
  }
  const slFormatErr = sl && !PRICE_RE.test(sl) ? 'Enter a valid price' : null;
  const tpFormatErr = tp && !PRICE_RE.test(tp) ? 'Enter a valid price' : null;
  const slTpErr = refPrice && !slFormatErr && !tpFormatErr ? validateSlTp(side, refPrice, sl || null, tp || null) : null;
  const slErr = slFormatErr ?? (slTpErr?.startsWith('Stop loss') ? slTpErr : null);
  const tpErr = tpFormatErr ?? (slTpErr?.startsWith('Take profit') ? slTpErr : null);

  const leverage = effectiveLeverage(account.leverage, spec.leverageMax);
  const quoteCcy = quoteCurrency(spec.id, spec.assetClass);
  // bookVersion keys the recompute on every tick
  const margin = useMemo(() => (refPrice && !lotsErr ? requiredMarginUsd({ lots, contractSize: spec.contractSize, price: refPrice, leverage, quoteCcy, book: quoteStore.book() }) : null), [refPrice, lots, lotsErr, spec.contractSize, leverage, quoteCcy, bookVersion]);
  const free = dec(account.freeMargin);
  const marginShort = margin !== null && margin.gt(free);
  const noConversion = refPrice !== null && !lotsErr && margin === null;

  const blocker: string | null = account.tradingBlocked
    ? 'Trading is blocked on this account'
    : account.status !== 'enabled'
      ? `Account is ${account.status}`
      : closed
        ? 'Market closed'
        : !hasQuote
          ? 'No live price'
          : lotsErr ?? priceErr ?? slTpErr ?? (noConversion ? `No ${quoteCcy}/USD rate to value the margin` : null) ?? (marginShort ? 'Not enough free margin' : null);
  const canSubmit = !blocker && !busy;

  const stepLots = (dir: 1 | -1) => {
    const step = dec(spec.lotStep);
    let next = dec(lots || 0).plus(step.times(dir));
    if (next.lt(spec.minLot)) next = dec(spec.minLot);
    if (next.gt(spec.maxLot)) next = dec(spec.maxLot);
    setLots(next.toFixed(lotDecimals));
  };
  /** Step a protective price by one pip; from empty, start half a percent away on the right side. */
  const stepPx = (kind: 'sl' | 'tp', value: string, dir: 1 | -1) => {
    const set = kind === 'sl' ? setSl : setTp;
    if (value && PRICE_RE.test(value)) {
      const next = dec(value).plus(dec(pip).times(dir));
      set(next.gt(0) ? next.toFixed(spec.digits) : value);
      return;
    }
    if (!refPrice) return;
    const r = dec(refPrice);
    const off = r.times(0.005);
    const below = (kind === 'sl') === (side === 'buy');
    set((below ? r.minus(off) : r.plus(off)).toFixed(spec.digits));
  };

  const submit = async (e?: FormEvent) => {
    e?.preventDefault();
    if (!canSubmit) return;
    if (type === 'market' && !confirm) {
      setErr(null);
      setConfirm({ ref: crypto.randomUUID() });
      return;
    }
    const clientRef = confirm?.ref ?? crypto.randomUUID();
    setBusy(true);
    setErr(null);
    try {
      onBeforePlace?.(clientRef);
      const body = { symbol: spec.id, side, type, lots: dec(lots).toFixed(lotDecimals), ...(type !== 'market' && { price }), ...(sl && { sl }), ...(tp && { tp }), clientRef };
      const r = await post<PlaceOrderResult>(`/me/accounts/${account.id}/orders`, body);
      const label = `${side === 'buy' ? 'Buy' : 'Sell'} ${r.order.lots} ${spec.id}`;
      if (r.position) toast({ level: 'success', title: `${label} filled`, body: `Opened at ${fmtPrice(r.position.openPrice, spec.digits)} · margin ${fmtMoney(r.position.marginUsed)} USD` });
      else toast({ level: 'success', title: `${type === 'limit' ? 'Limit' : 'Stop'} order placed`, body: `${label} at ${fmtPrice(r.order.price, spec.digits)} · waiting for the market` });
      onPlaced(r);
      setConfirm(null);
      setSl('');
      setTp('');
      if (type !== 'market') setPrice('');
    } catch (e) {
      setErr(tradeError(e));
      setConfirm(null);
    } finally {
      setBusy(false);
    }
  };

  // Esc cancels the confirm step, Enter confirms it (inputs submit the form natively)
  useEffect(() => {
    if (!confirm) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setConfirm(null);
      } else if (e.key === 'Enter' && !busy) {
        e.preventDefault();
        void submit();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [confirm, busy]); // eslint-disable-line react-hooks/exhaustive-deps

  const buy = side === 'buy';
  const sideBtn = (s: OrderSide, label: string, px: string | undefined) => {
    const on = side === s;
    const up = s === 'buy';
    return (
      <button
        type="button"
        onClick={() => setSide(s)}
        aria-pressed={on}
        className={cn(
          'flex flex-col items-center justify-center rounded-lg py-2 ring-1 ring-inset transition-all duration-200',
          on ? (up ? 'bg-up text-paper ring-up shadow-[0_8px_20px_-10px_rgb(var(--up-rgb)/0.8)]' : 'bg-down text-paper ring-down shadow-[0_8px_20px_-10px_rgb(var(--down-rgb)/0.8)]') : 'bg-white/[0.02] text-ink-300 ring-white/10 hover:bg-white/[0.05]',
        )}
      >
        <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em]">{label}</span>
        <span className={cn('tabular mt-0.5 font-mono text-[13px] font-semibold', !on && (up ? 'text-up' : 'text-down'))}>{hasQuote ? fmtPrice(px, spec.digits) : '—'}</span>
      </button>
    );
  };

  return (
    <form onSubmit={submit} className={cn('flex min-h-0 flex-col bg-paper', className)} aria-label="Order ticket">
      <div className="flex items-center justify-between px-3 pb-1.5 pt-3">
        <span className="label">Order ticket</span>
        <span className="tabular font-mono text-[10px] text-ink-500">1:{leverage} · contract {dec(spec.contractSize).toString()}</span>
      </div>
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3 pb-3 [scrollbar-width:thin]">
        <div>
          <div className="grid grid-cols-2 gap-1.5">
            {sideBtn('sell', 'Sell', q?.bid)}
            {sideBtn('buy', 'Buy', q?.ask)}
          </div>
          <div className="tabular mt-1 text-center font-mono text-[10px] text-ink-500">{hasQuote ? `spread ${spreadPoints(q.bid, q.ask, spec.digits)} pts` : closed ? 'market closed' : 'waiting for a price'}</div>
        </div>

        <div role="tablist" aria-label="Order type" className="grid grid-cols-3 rounded-lg border border-white/[0.08] bg-white/[0.03] p-0.5">
          {TYPES.map((t) => (
            <button key={t.value} type="button" role="tab" aria-selected={type === t.value} onClick={() => setType(t.value)} className={cn('rounded-md py-1 text-[11px] font-medium transition-colors duration-200', type === t.value ? 'bg-paper text-brand-300 shadow-sm ring-1 ring-inset ring-brand-400/30' : 'text-ink-500 hover:text-ink-100')}>
              {t.label}
            </button>
          ))}
        </div>

        <Stepper id="ticket-lots" label="Volume" hint={`${spec.minLot} – ${spec.maxLot} · step ${spec.lotStep}`} value={lots} onChange={setLots} onStep={stepLots} error={lots ? lotsErr : null} />

        {type !== 'market' && (
          <div className="animate-pop-in">
            <div className="mb-1 flex items-center justify-between">
              <label htmlFor="ticket-price" className="label">
                {type === 'limit' ? 'Limit price' : 'Stop price'}
              </label>
              <span className="tabular font-mono text-[10px] text-ink-500">{hasQuote ? `now ${fmtPrice(buy ? q.ask : q.bid, spec.digits)}` : ''}</span>
            </div>
            <input
              id="ticket-price"
              value={price}
              onChange={(e) => setPrice(e.target.value.replace(/[^\d.]/g, ''))}
              placeholder={hasQuote ? fmtPrice(buy ? q.ask : q.bid, spec.digits) : '0.00'}
              inputMode="decimal"
              autoComplete="off"
              aria-invalid={!!priceErr || undefined}
              className={cn('tabular h-9 w-full rounded-lg border bg-white/[0.02] px-3 text-center font-mono text-[13px] text-ink-100 placeholder:text-ink-500 transition-colors focus:border-brand-400/60 focus:outline-none', priceErr && price ? 'border-down/50' : 'border-white/10')}
            />
            {priceErr && price && <div className="animate-pop-in mt-1 text-[11px] text-down">{priceErr}</div>}
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          <Stepper id="ticket-sl" label="Stop loss" value={sl} onChange={setSl} onStep={(d) => stepPx('sl', sl, d)} placeholder="Not set" error={slErr} clearable />
          <Stepper id="ticket-tp" label="Take profit" value={tp} onChange={setTp} onStep={(d) => stepPx('tp', tp, d)} placeholder="Not set" error={tpErr} clearable />
        </div>

        <dl className="space-y-1 rounded-lg border border-white/[0.07] bg-ink-950 px-3 py-2 font-mono text-[11px]">
          <div className="flex justify-between">
            <dt className="text-ink-500">Required margin</dt>
            <dd className={cn('tabular', marginShort ? 'text-down' : 'text-ink-100')}>{margin ? `${fmtMoney(margin.toFixed(2))} USD` : '—'}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-ink-500">Free margin</dt>
            <dd className="tabular text-ink-100">{fmtMoney(account.freeMargin)} USD</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-ink-500">Swap long / short</dt>
            <dd className="tabular text-ink-300">
              {dec(spec.swapLong).toString()} / {dec(spec.swapShort).toString()}
            </dd>
          </div>
          {marginShort && (
            <div className="flex items-start gap-1.5 pt-1 text-[11px] text-down">
              <AlertTriangle className="mt-px h-3 w-3 shrink-0" /> This order needs more margin than is free. Reduce the volume or close a position.
            </div>
          )}
        </dl>

        {err && (
          <div role="alert" className="animate-pop-in rounded-lg border border-down/25 bg-down/[0.05] px-3 py-2 text-xs">
            <div className="font-semibold text-down">{err.title}</div>
            {err.body && <div className="mt-0.5 text-ink-300">{err.body}</div>}
            {err.link && (
              <a href={err.link.href} className="mt-1 inline-block text-brand-300 underline-offset-2 hover:underline">
                {err.link.label}
              </a>
            )}
          </div>
        )}
      </div>

      <div className="shrink-0 border-t border-white/[0.07] p-3">
        {confirm ? (
          <div className="animate-pop-in rounded-xl border border-brand-400/30 bg-brand-400/[0.05] p-3" role="dialog" aria-label="Confirm order">
            <div className="text-xs font-semibold text-ink-100">
              Confirm market {side}: {dec(lots).toFixed(lotDecimals)} {spec.id}
            </div>
            <div className="tabular mt-1 font-mono text-[11px] text-ink-400">
              at ~{fmtPrice(refPrice, spec.digits)} · margin {margin ? fmtMoney(margin.toFixed(2)) : '—'} USD
              {sl && ` · SL ${sl}`}
              {tp && ` · TP ${tp}`}
            </div>
            <div className="mt-2.5 grid grid-cols-[auto_1fr] gap-2">
              <button type="button" onClick={() => setConfirm(null)} disabled={busy} className="flex h-9 items-center gap-1 rounded-lg border border-white/10 px-3 text-xs text-ink-300 transition-colors hover:bg-white/[0.05] hover:text-white">
                <X className="h-3.5 w-3.5" /> Esc
              </button>
              <button type="submit" disabled={busy} className={cn('flex h-9 items-center justify-center gap-1.5 rounded-lg text-xs font-semibold text-paper transition-opacity disabled:opacity-60', buy ? 'bg-up' : 'bg-down')}>
                {busy ? <Spinner className="h-3.5" tone="current" /> : <Check className="h-3.5 w-3.5" strokeWidth={3} />}
                Confirm <CornerDownLeft className="h-3 w-3 opacity-70" />
              </button>
            </div>
          </div>
        ) : (
          <>
            <button
              type="submit"
              disabled={!canSubmit}
              className={cn('flex h-10 w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold text-paper transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-40', buy ? 'bg-up hover:brightness-110' : 'bg-down hover:brightness-110')}
            >
              {busy && <Spinner className="h-4" tone="current" />}
              {type === 'market' ? `${buy ? 'Buy' : 'Sell'} ${lots || '…'} ${spec.id}` : `Place ${type} ${buy ? 'buy' : 'sell'}`}
            </button>
            <div className={cn('mt-1.5 text-center text-[11px]', blocker ? 'text-ink-500' : 'text-ink-500')}>{blocker ?? (type === 'market' ? 'Fills at the current price after confirmation' : 'Executes when the market reaches your price')}</div>
          </>
        )}
      </div>
    </form>
  );
}
