'use client';

import { useEffect, useRef, useState } from 'react';
import { Minus, Plus, X, ChevronDown } from 'lucide-react';
import type { OrderSide } from '@spova/shared';
import { cn } from '@/lib/utils';

const NUM_RE = /^-?\d{0,12}(\.\d{0,6})?$/;
const isPrice = (s: string) => /^\d{1,12}(\.\d{1,6})?$/.test(s);

export type SlTpMode = 'price' | 'points' | 'percent' | 'value';
const MODES: { v: SlTpMode; label: string }[] = [
  { v: 'price', label: 'Price' },
  { v: 'points', label: 'Points' },
  { v: 'percent', label: 'Percent' },
  { v: 'value', label: 'Value (USD)' },
];

/**
 * Stop-loss / take-profit input that accepts the level as a price, a distance in points, a percent of the
 * entry price, or a USD profit/loss amount — and always stores the resulting PRICE (so the API is unchanged).
 */
export function SlTpField({
  kind, side, refPrice, digits, lots, contractSize, quoteToUsd, value, onChange, error, label,
}: {
  kind: 'sl' | 'tp';
  side: OrderSide;
  refPrice: string | null;
  digits: number;
  lots: string;
  contractSize: number;
  quoteToUsd: number | null;
  value: string; // the stored PRICE
  onChange: (price: string) => void;
  error?: string | null;
  label: string;
}) {
  const [mode, setMode] = useState<SlTpMode>('price');
  const [text, setText] = useState('');
  const [open, setOpen] = useState(false);
  const focused = useRef(false);

  const point = Math.pow(10, -digits);
  const ref = refPrice && isPrice(refPrice) ? Number(refPrice) : null;
  const priceN = value && isPrice(value) ? Number(value) : null;
  // SL sits below entry for a buy (above for a sell); TP the opposite
  const below = (kind === 'sl') === (side === 'buy');
  const perUsd = Number(lots || 0) * contractSize * (quoteToUsd ?? 0); // USD per 1.0 of price move

  const priceFromMode = (n: number, m: SlTpMode): number | null => {
    if (m === 'price') return n;
    if (ref == null) return null;
    let d: number;
    if (m === 'points') d = n * point;
    else if (m === 'percent') d = ref * (n / 100);
    else {
      if (!perUsd) return null;
      d = Math.abs(n) / perUsd;
    }
    return below ? ref - d : ref + d;
  };
  const textFromPrice = (p: number | null, m: SlTpMode): string => {
    if (p == null) return '';
    if (m === 'price') return value;
    if (ref == null) return '';
    const dist = p - ref;
    if (m === 'points') return String(Math.round(Math.abs(dist) / point));
    if (m === 'percent') return (Math.abs(dist) / ref * 100).toFixed(2);
    return ((side === 'buy' ? dist : -dist) * perUsd).toFixed(2); // signed P/L
  };

  // keep the displayed text in sync with the stored price when the user is not typing
  useEffect(() => {
    if (!focused.current) setText(textFromPrice(priceN, mode));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, mode, refPrice, lots]);

  const commit = (raw: string) => {
    setText(raw);
    if (raw === '' || raw === '-') return onChange('');
    const n = Number(raw);
    if (!isFinite(n)) return;
    const p = priceFromMode(n, mode);
    if (p != null && p > 0) onChange(p.toFixed(digits));
  };

  const step = (dir: 1 | -1) => {
    const stepBy = mode === 'points' ? 10 : mode === 'percent' ? 0.1 : mode === 'value' ? 10 : point * (digits >= 4 ? 10 : 1);
    const cur = text && NUM_RE.test(text) ? Number(text) : mode === 'price' ? (ref ?? 0) : 0;
    const next = cur + stepBy * dir;
    const nn = mode === 'percent' ? next.toFixed(2) : mode === 'price' ? next.toFixed(digits) : String(Math.round(next));
    commit(nn);
  };

  // live equivalents line (what this level means in the other units)
  const equiv = (() => {
    if (priceN == null || ref == null) return null;
    const dist = priceN - ref;
    const pts = Math.round(Math.abs(dist) / point).toLocaleString();
    const pct = (Math.abs(dist) / ref * 100).toFixed(2);
    const usd = perUsd ? ((side === 'buy' ? dist : -dist) * perUsd) : null;
    return `${pts} pts · ${pct}%${usd != null ? ` · ${usd >= 0 ? '+' : ''}${usd.toFixed(2)} USD` : ''}`;
  })();

  const btn = 'flex h-9 w-9 shrink-0 items-center justify-center text-[var(--t-text-2)] transition-colors hover:bg-white/[0.06] hover:text-white disabled:opacity-40';
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <span className="text-[12px] text-[var(--t-muted)]">{label}</span>
        <div className="relative">
          <button type="button" onClick={() => setOpen((o) => !o)} className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium text-[var(--t-text-2)] hover:bg-white/[0.06]">
            {MODES.find((m) => m.v === mode)!.label} <ChevronDown className="h-3 w-3" />
          </button>
          {open && (
            <div className="absolute right-0 top-6 z-30 rounded-lg border border-[var(--t-raised-2)] bg-[var(--t-menu)] p-1 shadow-xl">
              {MODES.map((m) => (
                <button key={m.v} type="button" disabled={m.v === 'value' && !perUsd} onClick={() => { setMode(m.v); setOpen(false); }} className={cn('block w-full whitespace-nowrap rounded px-3 py-1.5 text-left text-[12px] hover:bg-white/[0.06] disabled:opacity-40', mode === m.v ? 'text-[var(--t-blue)]' : 'text-[var(--t-text)]')}>
                  {m.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className={cn('flex items-center overflow-hidden rounded-lg border bg-[var(--t-bg)]', error ? 'border-[var(--t-sell)]' : 'border-[var(--t-line)]')}>
        <button type="button" onClick={() => step(-1)} className={btn} aria-label="decrease"><Minus className="h-3.5 w-3.5" /></button>
        <input
          inputMode="decimal"
          value={text}
          placeholder="Not set"
          onFocus={() => (focused.current = true)}
          onBlur={() => { focused.current = false; setText(textFromPrice(priceN, mode)); }}
          onChange={(e) => { const v = e.target.value; if (v === '' || NUM_RE.test(v)) commit(v); }}
          className="min-w-0 flex-1 bg-transparent px-2 text-center text-[13px] text-white outline-none placeholder:text-[var(--t-muted)]"
        />
        {text && (
          <button type="button" onClick={() => commit('')} className={btn} aria-label="clear"><X className="h-3.5 w-3.5" /></button>
        )}
        <button type="button" onClick={() => step(1)} className={btn} aria-label="increase"><Plus className="h-3.5 w-3.5" /></button>
      </div>
      {error ? (
        <div className="mt-1 text-[11px] text-[var(--t-sell)]">{error}</div>
      ) : equiv && mode !== 'price' ? (
        <div className="mt-1 text-[11px] text-[var(--t-muted)]">≈ {priceN?.toFixed(digits)} price</div>
      ) : equiv ? (
        <div className="mt-1 text-[11px] text-[var(--t-muted)]">≈ {equiv}</div>
      ) : null}
    </div>
  );
}

/** USD value of one unit of the quote currency, from the live book. null when no rate is available. */
export function quoteToUsdRate(quoteCcy: string, book: Record<string, { bid: string; ask: string }>): number | null {
  if (quoteCcy === 'USD') return 1;
  const mid = (q?: { bid: string; ask: string }) => (q ? (Number(q.bid) + Number(q.ask)) / 2 : null);
  const d = mid(book[`${quoteCcy}USD`]);
  if (d) return d;
  const inv = mid(book[`USD${quoteCcy}`]);
  if (inv) return 1 / inv;
  return null;
}
