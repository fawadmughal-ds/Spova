'use client';

import { useState, type CSSProperties } from 'react';
import { cn } from '@/lib/utils';
import { AnimatedNumber } from '@/components/motion';

const BALANCES = [1_000, 5_000, 10_000, 50_000];
const STREAKS = [5, 10, 20];
const LOT_STEP = 0.01;

const usd = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const pct = (n: number) => `${n.toLocaleString('en-US', { maximumFractionDigits: 1 })}%`;

function Slider({ label, value, min, max, step, onChange, display }: { label: string; value: number; min: number; max: number; step: number; onChange: (n: number) => void; display: string }) {
  return (
    <div>
      <div className="mb-3 flex items-baseline justify-between">
        <span className="label">{label}</span>
        <span className="tabular font-mono text-sm text-white">{display}</span>
      </div>
      <input
        type="range"
        aria-label={label}
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="range"
        style={{ '--fill': `${((value - min) / (max - min)) * 100}%` } as CSSProperties}
      />
    </div>
  );
}

/**
 * Position sizing by fixed fractional risk:
 * amount at risk = account x risk %, lots = amount at risk / (stop distance x value of one pip per lot).
 * Pure arithmetic; nothing here touches an account.
 */
export function PositionSizeCalculator() {
  const [balance, setBalance] = useState(10_000);
  const [risk, setRisk] = useState(1);
  const [stop, setStop] = useState(30);
  const [pipValue, setPipValue] = useState(10);
  const [rr, setRr] = useState(2);

  const atRisk = (balance * risk) / 100;
  const rawLots = pipValue > 0 && stop > 0 ? atRisk / (stop * pipValue) : 0;
  const lots = Math.floor(rawLots / LOT_STEP + 1e-9) * LOT_STEP;
  const tooSmall = rawLots < LOT_STEP;
  const actualRisk = lots * stop * pipValue;
  const target = actualRisk * rr;
  const breakeven = 100 / (1 + rr);
  const tone = risk <= 1 ? 'ok' : risk <= 2 ? 'warn' : 'hot';

  return (
    <div className="card corners grid overflow-hidden lg:grid-cols-[1.1fr_1fr]">
      {/* inputs */}
      <div className="space-y-7 p-6 sm:p-8">
        <div>
          <div className="mb-2.5 flex items-baseline justify-between">
            <span className="label">Account size</span>
            <span className="tabular font-mono text-sm text-white">{usd(balance)}</span>
          </div>
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

        <Slider label="Risk per trade" value={risk} min={0.25} max={5} step={0.25} onChange={setRisk} display={pct(risk)} />
        <Slider label="Stop distance" value={stop} min={5} max={200} step={5} onChange={setStop} display={`${stop} pips`} />

        <div>
          <div className="mb-2.5 flex items-baseline justify-between">
            <span className="label">Value of one pip per 1.00 lot</span>
            <span className="tabular font-mono text-sm text-white">{usd(pipValue)}</span>
          </div>
          <div className="grid grid-cols-[1fr_1fr_1.2fr] gap-1.5">
            {[10, 1].map((v) => (
              <button
                key={v}
                onClick={() => setPipValue(v)}
                className={cn(
                  'tabular rounded-lg py-2 font-mono text-xs transition-all duration-300',
                  v === pipValue ? 'bg-white text-ink-950 shadow-[0_8px_24px_-8px_rgb(var(--tint)/0.5)]' : 'bg-white/[0.04] text-ink-300 hover:bg-white/[0.08] hover:text-white',
                )}
              >
                ${v}
              </button>
            ))}
            <input
              type="number"
              min={0.01}
              step={0.01}
              value={pipValue}
              onChange={(e) => setPipValue(Math.max(0, Number(e.target.value)))}
              aria-label="Custom pip value in USD"
              className="tabular rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 font-mono text-xs text-white outline-none transition-colors focus:border-brand-400/70"
            />
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-ink-500">
            $10 fits a pair quoted in US dollars with a 100,000 contract (100,000 × 0.0001). For anything else, multiply the contract size by one pip or point and convert to USD.
          </p>
        </div>

        <Slider label="Reward to risk" value={rr} min={0.5} max={5} step={0.5} onChange={setRr} display={`1 : ${rr}`} />
      </div>

      {/* result */}
      <div className="relative border-t border-white/[0.06] bg-ink-900/60 p-6 sm:p-8 lg:border-l lg:border-t-0">
        <div className="bg-dots absolute inset-0 opacity-60" />
        <div className="relative">
          <div className="label">Position size</div>
          <div className="mt-2 flex items-baseline gap-3 font-display text-5xl font-bold tracking-tight sm:text-6xl">
            <AnimatedNumber value={lots} format={(n) => n.toFixed(2)} flash={false} duration={450} />
            <span className="text-xl font-medium text-ink-400">lots</span>
          </div>
          <p className={cn('mt-2 font-mono text-[11px] transition-colors duration-300', tooSmall ? 'text-gold' : 'text-ink-500')}>
            {tooSmall ? 'Below the 0.01 minimum lot. At this risk, the stop is too wide for the account.' : `${usd(atRisk)} ÷ (${stop} × ${usd(pipValue)}), rounded down to 0.01`}
          </p>

          <dl className="mt-7 grid grid-cols-2 gap-4 border-t border-white/[0.06] pt-6">
            <div>
              <dt className="label">Amount at risk</dt>
              <dd className={cn('mt-1 font-mono text-lg transition-colors duration-500', tone === 'ok' ? 'text-white' : tone === 'warn' ? 'text-gold' : 'text-down')}>
                <AnimatedNumber value={actualRisk} format={usd} flash={false} duration={450} />
              </dd>
            </div>
            <div>
              <dt className="label">Target at 1 : {rr}</dt>
              <dd className="mt-1 font-mono text-lg text-up">
                <AnimatedNumber value={target} format={usd} flash={false} duration={450} />
              </dd>
            </div>
          </dl>

          {/* risk vs reward bar */}
          <div className="mt-6">
            <div className="flex h-3 overflow-hidden rounded-full bg-white/[0.06]">
              <span className="bg-down/80 transition-[width] duration-700 ease-out-expo" style={{ width: `${(1 / (1 + rr)) * 100}%` }} />
              <span className="bg-up/80 transition-[width] duration-700 ease-out-expo" style={{ width: `${(rr / (1 + rr)) * 100}%` }} />
            </div>
            <div className="mt-2 flex justify-between font-mono text-[11px] text-ink-400">
              <span>risk</span>
              <span>
                break-even win rate <span className="text-white">{pct(breakeven)}</span>
              </span>
              <span>reward</span>
            </div>
          </div>

          {/* losing streak */}
          <div className="mt-7 border-t border-white/[0.06] pt-6">
            <div className="label">If every trade lost at {pct(risk)}</div>
            <div className="mt-4 space-y-3">
              {STREAKS.map((n) => {
                const left = balance * Math.pow(1 - risk / 100, n);
                const share = (left / balance) * 100;
                return (
                  <div key={n} className="grid grid-cols-[76px_1fr_auto] items-center gap-3">
                    <span className="font-mono text-[11px] text-ink-400">{n} in a row</span>
                    <span className="h-2 overflow-hidden rounded-full bg-white/[0.06]">
                      <span
                        className={cn('block h-full rounded-full transition-[width,background-color] duration-700 ease-out-expo', share > 80 ? 'bg-up' : share > 55 ? 'bg-gold' : 'bg-down')}
                        style={{ width: `${share}%` }}
                      />
                    </span>
                    <span className="tabular w-24 text-right font-mono text-xs text-ink-200">{usd(left)}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <p className="mt-6 text-[11px] leading-relaxed text-ink-500">Estimate only. It ignores spread, swap and slippage, and a stop loss is not guaranteed to fill at its exact level.</p>
        </div>
      </div>
    </div>
  );
}
