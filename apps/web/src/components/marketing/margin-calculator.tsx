'use client';

import { useMemo, useState, type CSSProperties } from 'react';
import { cn } from '@/lib/utils';
import { INDICATIVE_PRICE, marketByCls } from '@/lib/markets';
import type { PublicSymbol } from '@/lib/server-api';
import { AnimatedNumber } from '@/components/motion';

const LEVERAGES = [5, 20, 50, 100, 200, 400];
const BALANCES = [1_000, 5_000, 10_000, 50_000];
const MARGIN_CALL = 100;
const STOP_OUT = 20;

/** Symbols whose notional we can express in USD without a cross rate. */
const usdEstimable = (s: PublicSymbol) =>
  s.assetClass === 'stock' || s.assetClass === 'crypto' || s.assetClass === 'metal' || s.assetClass === 'commodity' || s.id.endsWith('USD') || s.id.startsWith('US');

/** Maps a margin level (%) onto the 0-100 gauge: stop-out and margin-call zones get fixed slices, the rest is logarithmic. */
function gaugePos(level: number) {
  if (!Number.isFinite(level)) return 100;
  if (level <= STOP_OUT) return (level / STOP_OUT) * 14;
  if (level <= MARGIN_CALL) return 14 + ((level - STOP_OUT) / (MARGIN_CALL - STOP_OUT)) * 24;
  return Math.min(100, 38 + (Math.log10(level / MARGIN_CALL) / 2) * 62);
}

const usd = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** used_margin = lots x contract_size x price / leverage, with the margin level the risk engine would see. */
export function MarginCalculator({ symbols }: { symbols: PublicSymbol[] }) {
  const list = useMemo(() => symbols.filter(usdEstimable), [symbols]);
  const [id, setId] = useState(list[0]?.id ?? '');
  const [lots, setLots] = useState(1);
  const [lev, setLev] = useState(100);
  const [balance, setBalance] = useState(10_000);

  const sym = list.find((s) => s.id === id) ?? list[0];
  if (!sym) return null;

  const market = marketByCls(sym.assetClass);
  const price = sym.quote ? Number(sym.quote.ask) : (INDICATIVE_PRICE[sym.id] ?? 100);
  const contract = Number(sym.contractSize ?? 1);
  const usdBase = sym.assetClass === 'forex' && sym.id.startsWith('USD');
  const notional = lots * contract * (usdBase ? 1 : price);
  const leverage = Math.min(lev, sym.leverageMax);
  const margin = notional / leverage;
  const level = margin > 0 ? (balance / margin) * 100 : Infinity;
  const state = level <= STOP_OUT ? 'stop' : level <= MARGIN_CALL ? 'call' : 'ok';
  const maxLots = Math.min(Number(sym.maxLot ?? 50), 10);

  return (
    <div className="card corners grid overflow-hidden lg:grid-cols-[1.1fr_1fr]" style={{ '--c': market?.rgb ?? '37 99 235' } as CSSProperties}>
      {/* controls */}
      <div className="space-y-7 p-6 sm:p-8">
        <div>
          <div className="label mb-2.5">Instrument</div>
          <div className="flex flex-wrap gap-1.5">
            {list
              .filter((s) => s.featured || s.id === sym.id)
              .map((s) => (
                <button
                  key={s.id}
                  onClick={() => setId(s.id)}
                  className={cn(
                    'rounded-lg px-3 py-1.5 font-mono text-xs transition-all duration-300',
                    s.id === sym.id ? 'bg-[rgb(var(--c)/0.15)] text-[rgb(var(--c))] ring-1 ring-inset ring-[rgb(var(--c)/0.4)]' : 'bg-white/[0.04] text-ink-300 hover:bg-white/[0.08] hover:text-white',
                  )}
                >
                  {s.id}
                </button>
              ))}
            <select
              aria-label="More instruments"
              value=""
              onChange={(e) => e.target.value && setId(e.target.value)}
              className="rounded-lg bg-white/[0.04] px-2 py-1.5 font-mono text-xs text-ink-300 outline-none transition-colors hover:bg-white/[0.08]"
            >
              <option value="">More…</option>
              {list
                .filter((s) => !s.featured)
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.id}
                  </option>
                ))}
            </select>
          </div>
        </div>

        <div>
          <div className="mb-3 flex items-baseline justify-between">
            <span className="label">Volume</span>
            <span className="tabular font-mono text-sm text-white">
              {lots.toFixed(2)} <span className="text-ink-500">lots</span>
            </span>
          </div>
          <input
            type="range"
            aria-label="Volume in lots"
            min={0.01}
            max={maxLots}
            step={0.01}
            value={Math.min(lots, maxLots)}
            onChange={(e) => setLots(Number(e.target.value))}
            className="range"
            style={{ '--fill': `${(Math.min(lots, maxLots) / maxLots) * 100}%` } as CSSProperties}
          />
          <div className="mt-2 flex justify-between font-mono text-[10px] text-ink-500">
            <span>0.01</span>
            <span>{maxLots}</span>
          </div>
        </div>

        <div>
          <div className="mb-2.5 flex items-baseline justify-between">
            <span className="label">Leverage</span>
            <span className="text-[11px] text-ink-500">
              {sym.id} max 1:{sym.leverageMax}
            </span>
          </div>
          <div className="grid grid-cols-6 gap-1.5">
            {LEVERAGES.map((l) => {
              const off = l > sym.leverageMax;
              return (
                <button
                  key={l}
                  disabled={off}
                  onClick={() => setLev(l)}
                  className={cn(
                    'tabular rounded-lg py-2 font-mono text-xs transition-all duration-300',
                    off ? 'cursor-not-allowed text-ink-600 line-through' : l === leverage ? 'bg-white text-ink-950 shadow-[0_8px_24px_-8px_rgb(var(--tint)/0.5)]' : 'bg-white/[0.04] text-ink-300 hover:bg-white/[0.08] hover:text-white',
                  )}
                >
                  1:{l}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <div className="label mb-2.5">Account equity</div>
          <div className="grid grid-cols-4 gap-1.5">
            {BALANCES.map((b) => (
              <button
                key={b}
                onClick={() => setBalance(b)}
                className={cn(
                  'tabular rounded-lg py-2 font-mono text-xs transition-all duration-300',
                  b === balance ? 'bg-white text-ink-950 shadow-[0_8px_24px_-8px_rgb(var(--tint)/0.5)]' : 'bg-white/[0.04] text-ink-300 hover:bg-white/[0.08] hover:text-white',
                )}
              >
                ${b.toLocaleString('en-US')}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ticket */}
      <div className="relative border-t border-white/[0.06] bg-ink-900/60 p-6 sm:p-8 lg:border-l lg:border-t-0">
        <div className="bg-dots absolute inset-0 opacity-60" />
        <div className="relative">
          <div className="label">Required margin</div>
          <div className="mt-2 font-display text-5xl font-bold tracking-tight sm:text-6xl">
            <AnimatedNumber value={margin} format={usd} flash={false} duration={500} />
          </div>
          <p className="mt-2 font-mono text-[11px] text-ink-500">
            {lots.toFixed(2)} × {contract.toLocaleString('en-US')} {usdBase ? '' : `× ${price}`} ÷ {leverage}
          </p>

          <dl className="mt-7 grid grid-cols-2 gap-4 border-t border-white/[0.06] pt-6">
            <div>
              <dt className="label">Position size</dt>
              <dd className="mt-1 font-mono text-lg">
                <AnimatedNumber value={notional} format={usd} flash={false} duration={500} />
              </dd>
            </div>
            <div>
              <dt className="label">Free margin</dt>
              <dd className={cn('mt-1 font-mono text-lg transition-colors duration-500', balance - margin < 0 && 'text-down')}>
                <AnimatedNumber value={balance - margin} format={usd} flash={false} duration={500} />
              </dd>
            </div>
          </dl>

          <div className="mt-7">
            <div className="flex items-baseline justify-between">
              <span className="label">Margin level</span>
              <span className={cn('tabular font-mono text-sm font-semibold transition-colors duration-500', state === 'ok' ? 'text-up' : state === 'call' ? 'text-gold' : 'text-down')}>
                {Number.isFinite(level) ? `${level.toFixed(0)}%` : '—'} · {state === 'ok' ? 'Healthy' : state === 'call' ? 'Margin call' : 'Stop-out'}
              </span>
            </div>
            <div className="relative mt-3 h-2.5 rounded-full bg-gradient-to-r from-down via-gold via-[30%] to-up">
              <span className="absolute inset-y-[-3px] w-px bg-ink-950/70" style={{ left: '14%' }} />
              <span className="absolute inset-y-[-3px] w-px bg-ink-950/70" style={{ left: '38%' }} />
              <span
                className="absolute top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-ink-950 bg-white shadow-[0_0_0_3px_rgb(var(--tint)/0.2)] transition-[left] duration-700 ease-out-expo"
                style={{ left: `${gaugePos(level)}%` }}
              />
            </div>
            <div className="relative mt-2 h-4 font-mono text-[10px] text-ink-500">
              <span className="absolute -translate-x-1/2" style={{ left: '14%' }}>
                {STOP_OUT}%
              </span>
              <span className="absolute -translate-x-1/2" style={{ left: '38%' }}>
                {MARGIN_CALL}%
              </span>
            </div>
          </div>

          <p className="mt-6 text-[11px] leading-relaxed text-ink-500">
            Estimate in USD at {sym.quote ? 'the current ask' : `an indicative price of ${price}`}. The platform computes the exact margin when you place the order.
          </p>
        </div>
      </div>
    </div>
  );
}
