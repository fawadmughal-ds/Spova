'use client';

import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { AlertTriangle, Check, CornerDownLeft, Minus, Plus, X } from 'lucide-react';
import { dec, effectiveLeverage, quoteCurrency, requiredMarginUsd, validateLots, validateSlTp, type AccountDto, type OrderSide, type OrderType, type PlaceOrderResult } from '@spova/shared';
import { post } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useToast } from '@/components/toast';
import type { FriendlyError } from '@/components/portal/api-error';
import { Spinner } from '@/components/ui';
import { fmtNum, fmtPrice, pipSize, spreadPoints, type SymbolSpec } from './format';
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
  const btn = 'flex h-9 w-9 shrink-0 items-center justify-center text-[var(--t-text-2)] transition-colors hover:bg-white/[0.06] hover:text-white disabled:opacity-40 disabled:hover:bg-transparent';
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <label htmlFor={id} className="text-[11px] font-medium text-[var(--t-muted)]">
          {label}
        </label>
        {hint && <span className="text-[10px] text-[var(--t-muted)]">{hint}</span>}
      </div>
      <div className={cn('flex h-9 items-stretch overflow-hidden rounded-lg border bg-[var(--t-bg)] transition-colors focus-within:border-[var(--t-blue)]', error ? 'border-[var(--t-sell)]/60' : 'border-[var(--t-raised-2)]')}>
        <button type="button" tabIndex={-1} onClick={() => onStep(-1)} disabled={disabled} aria-label={`Decrease ${typeof label === 'string' ? label : ''}`} className={cn(btn, 'border-r border-[var(--t-raised-2)]')}>
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
          className="min-w-0 flex-1 bg-transparent px-2 text-center text-[13px] font-semibold text-white placeholder:text-[var(--t-dim)] focus:outline-none disabled:opacity-50"
        />
        {clearable && value && (
          <button type="button" tabIndex={-1} onClick={() => onChange('')} aria-label="Clear" className={cn(btn, '!w-7')}>
            <X className="h-3 w-3" />
          </button>
        )}
        <button type="button" tabIndex={-1} onClick={() => onStep(1)} disabled={disabled} aria-label={`Increase ${typeof label === 'string' ? label : ''}`} className={cn(btn, 'border-l border-[var(--t-raised-2)]')}>
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>
      {error && <div className="animate-pop-in mt-1 text-[11px] text-[var(--t-sell)]">{error}</div>}
      {digits !== undefined && !error && value && !PRICE_RE.test(value) && <div className="mt-1 text-[11px] text-[var(--t-sell)]">Enter a valid price</div>}
    </div>
  );
}

/**
 * Market / limit / stop ticket for one instrument. Validates with the same shared rules as the API
 * (lots grid, SL/TP side, margin) so a disabled button always says why; market orders confirm inline.
 */
export function OrderTicket({ spec, account, onPlaced, onBeforePlace, className, initialSide = 'buy', initialLots, confirmOrders = true, onClose }: { spec: SymbolSpec; account: AccountDto; onPlaced: (r: PlaceOrderResult) => void; onBeforePlace?: (clientRef: string) => void; className?: string; initialSide?: OrderSide; initialLots?: string; /** ask before sending market orders */ confirmOrders?: boolean; onClose?: () => void }) {
  const toast = useToast();
  const q = useQuote(spec.id);
  const bookVersion = useBookVersion();
  const [side, setSide] = useState<OrderSide>(initialSide);
  const [type, setType] = useState<OrderType>('market');
  const [lots, setLots] = useState(initialLots ?? spec.minLot);
  const [price, setPrice] = useState('');
  const [sl, setSl] = useState('');
  const [tp, setTp] = useState('');
  const [confirm, setConfirm] = useState<{ ref: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<FriendlyError | null>(null);

  // new instrument: fresh ticket
  useEffect(() => {
    setLots(initialLots ?? spec.minLot);
    setPrice('');
    setSl('');
    setTp('');
    setConfirm(null);
    setErr(null);
  }, [spec.id, spec.minLot]); // eslint-disable-line react-hooks/exhaustive-deps
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
    if (type === 'market' && confirmOrders && !confirm) {
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
      if (r.position) toast({ level: 'success', title: `${label} filled`, body: `Opened at ${fmtPrice(r.position.openPrice, spec.digits)} · margin ${fmtNum(r.position.marginUsed)} USD` });
      else toast({ level: 'success', title: `${type === 'limit' ? 'Limit' : 'Stop'} order placed`, body: `${label} at ${fmtPrice(r.order.price, spec.digits)} · waiting for the market` });
      onPlaced(r);
      setConfirm(null);
      setSl('');
      setTp('');
      if (type !== 'market') setPrice('');
      onClose?.();
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
          'flex h-[58px] flex-col items-center justify-center rounded-lg transition-all duration-200',
          on ? (up ? 'bg-[var(--t-buy)] text-white' : 'bg-[var(--t-sell)] text-white') : 'bg-[var(--t-bg)] text-[var(--t-text-2)] ring-1 ring-inset ring-[var(--t-raised-2)] hover:bg-white/[0.04]',
        )}
      >
        <span className="text-[12px] font-bold tracking-wide uppercase">{label}</span>
        <span className={cn('mt-0.5 text-[15px] font-semibold', !on && (up ? 'text-[var(--t-buy)]' : 'text-[var(--t-sell)]'))}>{hasQuote ? fmtPrice(px, spec.digits) : '—'}</span>
      </button>
    );
  };

  return (
    <form onSubmit={submit} className={cn('flex min-h-0 flex-col', className)} aria-label="Order ticket">
      <div className="flex h-[43px] items-center gap-2 bg-[var(--t-raised)] pl-4 pr-2">
        <span className="text-[14px] font-semibold text-white">Advanced Order</span>
        <span className="text-[13px] text-[var(--t-text-2)]">· {spec.id}</span>
        <span className="ml-auto text-[11px] text-[var(--t-muted)]">1:{leverage} · contract {dec(spec.contractSize).toString()}</span>
        {onClose && (
          <button type="button" onClick={onClose} aria-label="Close" className="t-icon-btn !h-8 !w-8">
            <X />
          </button>
        )}
      </div>
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 pb-3 pt-3">
        <div>
          <div className="grid grid-cols-2 gap-1.5">
            {sideBtn('sell', 'Sell', q?.bid)}
            {sideBtn('buy', 'Buy', q?.ask)}
          </div>
          <div className="mt-1 text-center text-[11px] text-[var(--t-muted)]">{hasQuote ? `Spread: ${spreadPoints(q.bid, q.ask, spec.digits)}` : closed ? 'Market closed' : 'Waiting for a price'}</div>
        </div>

        <div role="tablist" aria-label="Order type" className="grid grid-cols-3 rounded-lg bg-[var(--t-raised)] p-0.5">
          {TYPES.map((t) => (
            <button key={t.value} type="button" role="tab" aria-selected={type === t.value} onClick={() => setType(t.value)} className={cn('rounded-md py-1.5 text-[12px] font-medium transition-colors duration-200', type === t.value ? 'bg-[var(--t-bg)] text-white' : 'text-[var(--t-text-2)] hover:text-white')}>
              {t.label}
            </button>
          ))}
        </div>

        <Stepper id="ticket-lots" label="Volume" hint={`${spec.minLot} – ${spec.maxLot} · step ${spec.lotStep}`} value={lots} onChange={setLots} onStep={stepLots} error={lots ? lotsErr : null} />

        {type !== 'market' && (
          <div className="animate-pop-in">
            <div className="mb-1 flex items-center justify-between">
              <label htmlFor="ticket-price" className="text-[11px] font-medium text-[var(--t-muted)]">
                {type === 'limit' ? 'Limit price' : 'Stop price'}
              </label>
              <span className="text-[10px] text-[var(--t-muted)]">{hasQuote ? `now ${fmtPrice(buy ? q.ask : q.bid, spec.digits)}` : ''}</span>
            </div>
            <input
              id="ticket-price"
              value={price}
              onChange={(e) => setPrice(e.target.value.replace(/[^\d.]/g, ''))}
              placeholder={hasQuote ? fmtPrice(buy ? q.ask : q.bid, spec.digits) : '0.00'}
              inputMode="decimal"
              autoComplete="off"
              aria-invalid={!!priceErr || undefined}
              className={cn('t-input !h-9 text-center font-semibold', priceErr && price && '!border-[var(--t-sell)]')}
            />
            {priceErr && price && <div className="animate-pop-in mt-1 text-[11px] text-[var(--t-sell)]">{priceErr}</div>}
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          <Stepper id="ticket-sl" label="Stop loss" value={sl} onChange={setSl} onStep={(d) => stepPx('sl', sl, d)} placeholder="Not set" error={slErr} clearable />
          <Stepper id="ticket-tp" label="Take profit" value={tp} onChange={setTp} onStep={(d) => stepPx('tp', tp, d)} placeholder="Not set" error={tpErr} clearable />
        </div>

        <dl className="space-y-1 rounded-lg bg-[var(--t-raised)] px-3 py-2 text-[12px]">
          <div className="flex justify-between">
            <dt className="text-[var(--t-muted)]">Required margin</dt>
            <dd className={cn('font-medium', marginShort ? 'text-[var(--t-sell)]' : 'text-white')}>{margin ? `${fmtNum(margin.toFixed(2))} USD` : '—'}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-[var(--t-muted)]">Free margin</dt>
            <dd className="font-medium text-white">{fmtNum(account.freeMargin)} USD</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-[var(--t-muted)]">Swap long / short</dt>
            <dd className="text-[var(--t-text-2)]">
              {dec(spec.swapLong).toString()} / {dec(spec.swapShort).toString()}
            </dd>
          </div>
          {marginShort && (
            <div className="flex items-start gap-1.5 pt-1 text-[11px] text-[var(--t-sell)]">
              <AlertTriangle className="mt-px h-3 w-3 shrink-0" /> This order needs more margin than is free. Reduce the volume or close a position.
            </div>
          )}
        </dl>

        {err && (
          <div role="alert" className="animate-pop-in rounded-lg border border-[var(--t-sell)]/40 bg-[rgb(239_85_109_/_0.08)] px-3 py-2 text-xs">
            <div className="font-semibold text-[var(--t-sell)]">{err.title}</div>
            {err.body && <div className="mt-0.5 text-[var(--t-text-2)]">{err.body}</div>}
            {err.link && (
              <a href={err.link.href} className="mt-1 inline-block text-[var(--t-blue)] underline-offset-2 hover:underline">
                {err.link.label}
              </a>
            )}
          </div>
        )}
      </div>

      <div className="shrink-0 border-t border-[var(--t-line)] p-4">
        {confirm ? (
          <div className="animate-pop-in rounded-lg border border-[var(--t-blue-deep)] bg-[var(--t-bg)] p-3" role="dialog" aria-label="Confirm order">
            <div className="text-xs font-semibold text-white">
              Confirm market {side}: {dec(lots).toFixed(lotDecimals)} {spec.id}
            </div>
            <div className="mt-1 text-[11px] text-[var(--t-muted)]">
              at ~{fmtPrice(refPrice, spec.digits)} · margin {margin ? fmtNum(margin.toFixed(2)) : '—'} USD
              {sl && ` · SL ${sl}`}
              {tp && ` · TP ${tp}`}
            </div>
            <div className="mt-2.5 grid grid-cols-[auto_1fr] gap-2">
              <button type="button" onClick={() => setConfirm(null)} disabled={busy} className="t-btn t-btn-ghost !h-9">
                <X className="h-3.5 w-3.5" /> Esc
              </button>
              <button type="submit" disabled={busy} className={cn('t-btn !h-9', buy ? 't-btn-buy' : 't-btn-sell')}>
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
              className={cn('t-btn !h-11 w-full !text-[14px]', buy ? 't-btn-buy' : 't-btn-sell')}
            >
              {busy && <Spinner className="h-4" tone="current" />}
              {type === 'market' ? `${buy ? 'Buy' : 'Sell'} ${lots || '…'} ${spec.id}` : `Place ${type} ${buy ? 'buy' : 'sell'}`}
            </button>
            <div className="mt-1.5 text-center text-[11px] text-[var(--t-muted)]">{blocker ?? (type === 'market' ? (confirmOrders ? 'Fills at the current price after confirmation' : 'Fills at the current price immediately') : 'Executes when the market reaches your price')}</div>
          </>
        )}
      </div>
    </form>
  );
}
