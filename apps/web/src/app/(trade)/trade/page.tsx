'use client';

import Link from 'next/link';
import { useEffect, useState, type CSSProperties, type MouseEvent } from 'react';
import { ArrowLeft, CandlestickChart, Search } from 'lucide-react';
import { RequireAuth } from '@/lib/auth-context';
import { get } from '@/lib/api';
import { buttonClass } from '@/lib/button';
import { BRAND, cn } from '@/lib/utils';
import { marketByCls } from '@/lib/markets';
import { Logo } from '@/components/logo';
import { Reveal, Words } from '@/components/motion';
import { Skeleton } from '@/components/ui';
import { SimChart } from '@/components/trade/sim-chart';

interface WatchSymbol {
  id: string;
  name: string;
  assetClass: string;
  leverageMax: number;
  quote: { bid: string; ask: string } | null;
}

const FEATURES = ['Live Binance ticks', 'Candles 1m-1d', 'Market / limit / stop orders', 'Positions with live P/L', 'SL/TP', 'Margin engine'];
const TIMEFRAMES = ['1m', '5m', '15m', '1h', '4h', '1d'];

function UtcClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <span className="tabular inline-flex items-center gap-2 font-mono text-xs text-ink-400">
      <span className="live-dot text-brand-400" />
      UTC {now.toISOString().slice(11, 19)}
    </span>
  );
}

/** The terminal ships with milestone 2. Until then: its skeleton, a simulated chart behind glass, and what is coming. */
function TerminalPreview() {
  const [symbols, setSymbols] = useState<WatchSymbol[] | null>(null);
  useEffect(() => {
    get<WatchSymbol[]>('/market/symbols')
      .then(setSymbols)
      .catch(() => setSymbols([]));
  }, []);

  // crosshair that follows the pointer over the chart
  const onMove = (e: MouseEvent<HTMLElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty('--cx', `${e.clientX - r.left}px`);
    e.currentTarget.style.setProperty('--cy', `${e.clientY - r.top}px`);
  };

  return (
    <div className="flex h-screen min-h-[640px] flex-col overflow-hidden bg-ink-950">
      <header className="animate-page-in relative z-20 flex h-12 shrink-0 items-center justify-between border-b border-white/[0.06] bg-ink-900/60 px-4 backdrop-blur">
        <Link href="/app" className="group flex items-center gap-2 text-sm text-ink-300 transition-colors hover:text-white">
          <ArrowLeft className="h-4 w-4 transition-transform duration-300 group-hover:-translate-x-1" /> Client area
        </Link>
        <div className="group/logo flex items-center gap-2">
          <Logo size={22} />
          <span className="font-display text-sm font-bold">{BRAND} WebTrader</span>
          <span className="hidden rounded-full bg-gold/10 px-2 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-[0.14em] text-gold ring-1 ring-inset ring-gold/30 sm:inline">Preview</span>
        </div>
        <UtcClock />
      </header>

      <div className="grid min-h-0 flex-1 lg:grid-cols-[250px_1fr_290px]">
        {/* watchlist */}
        <aside className="preview-mock hidden min-h-0 flex-col border-r border-white/[0.06] lg:flex" aria-hidden>
          <div className="flex items-center justify-between px-4 pb-2 pt-4">
            <span className="label">Watchlist</span>
            <span className="label !text-ink-500">Milestone 2</span>
          </div>
          <div className="mx-3 mb-2 flex h-9 items-center gap-2 rounded-lg bg-white/[0.04] px-3 text-xs text-ink-500">
            <Search className="h-3.5 w-3.5" /> Search symbols
          </div>
          <ul className="min-h-0 flex-1 overflow-hidden px-2">
            {symbols === null &&
              Array.from({ length: 12 }, (_, i) => (
                <li key={i} className="flex items-center justify-between px-2 py-2.5">
                  <Skeleton className="w-20" />
                  <Skeleton className="w-12" />
                </li>
              ))}
            {symbols?.map((s, i) => (
              <li
                key={s.id}
                style={{ '--c': marketByCls(s.assetClass)?.rgb ?? '15 23 42', animationDelay: `${Math.min(i, 18) * 40}ms` } as CSSProperties}
                className={cn('animate-page-in flex items-center justify-between rounded-lg px-2 py-2', i === 0 && 'bg-white/[0.06]')}
              >
                <span className="flex items-center gap-2.5">
                  <span className="h-1.5 w-1.5 rotate-45 bg-[rgb(var(--c))]" />
                  <span>
                    <span className="block text-[13px] font-semibold text-ink-100">{s.id}</span>
                    <span className="block max-w-[120px] truncate text-[10px] text-ink-500">{s.name}</span>
                  </span>
                </span>
                <span className="tabular text-right font-mono text-[11px] text-ink-400">{s.quote ? s.quote.bid : `1:${s.leverageMax}`}</span>
              </li>
            ))}
          </ul>
        </aside>

        {/* chart + announcement */}
        <main className="group/chart relative flex min-h-0 min-w-0 flex-col" onMouseMove={onMove}>
          <div className="preview-mock flex h-11 shrink-0 items-center justify-between border-b border-white/[0.06] px-4" aria-hidden>
            <div className="flex items-center gap-3">
              <span className="font-display text-sm font-bold">{symbols?.[0]?.id ?? 'EURUSD'}</span>
              <div className="flex rounded-md bg-white/[0.04] p-0.5">
                {TIMEFRAMES.map((t, i) => (
                  <span key={t} className={cn('rounded px-2 py-0.5 font-mono text-[10px]', i === 0 ? 'bg-white/10 text-white' : 'text-ink-500')}>
                    {t}
                  </span>
                ))}
              </div>
            </div>
            <span className="inline-flex shrink-0 items-center gap-2 whitespace-nowrap font-mono text-[10px] uppercase tracking-[0.14em] text-ink-400">
              <span className="live-dot text-gold" /> Simulated<span className="hidden sm:inline"> chart · not market data</span>
            </span>
          </div>

          <div className="relative min-h-0 flex-1 overflow-hidden">
            <div className="absolute inset-0 opacity-45 blur-[1.5px]">
              <SimChart />
            </div>
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgb(var(--paper-rgb)/0.88)_0%,rgb(var(--paper-rgb)/0.55)_45%,transparent_75%)]" />
            {/* crosshair */}
            <span className="pointer-events-none absolute inset-y-0 left-[var(--cx,-10px)] w-px bg-white/15 opacity-0 transition-opacity duration-300 group-hover/chart:opacity-100" />
            <span className="pointer-events-none absolute inset-x-0 top-[calc(var(--cy,-10px)-2.75rem)] h-px bg-white/15 opacity-0 transition-opacity duration-300 group-hover/chart:opacity-100" />

            <div className="absolute inset-0 flex items-center justify-center p-4">
              <Reveal variant="scale" delay={200} className="w-full max-w-xl">
                <div className="beam glass relative overflow-hidden rounded-3xl p-7 text-center shadow-lift sm:p-9">
                  <div className="aurora-blob -top-28 left-1/2 h-56 w-80 -translate-x-1/2 bg-brand-500/20" />
                  <div className="relative mx-auto flex h-16 w-16 items-center justify-center">
                    <span className="absolute inset-0 animate-pulse-ring rounded-2xl border border-brand-400/50" />
                    <span className="absolute inset-0 animate-pulse-ring rounded-2xl border border-brand-400/50 [animation-delay:1.3s]" />
                    <span className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-b from-brand-300 to-brand-600 text-ink-950 shadow-glow">
                      <CandlestickChart className="h-7 w-7" />
                    </span>
                  </div>
                  <span className="eyebrow relative mt-6">Milestone 2 · 13 Oct</span>
                  <h1 className="relative mt-4 font-display text-4xl font-extrabold leading-[0.98] tracking-tighter sm:text-5xl">
                    <Words text="The terminal *is on its way*" delay={350} />
                  </h1>
                  <p className="relative mt-4 font-semibold text-ink-200">Terminal arrives with milestone 2 (13 Oct)</p>
                  <Reveal as="ul" variant="stagger" delay={700} step={70} className="relative mt-5 flex flex-wrap justify-center gap-1.5">
                    {FEATURES.map((f) => (
                      <li key={f} className="rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 font-mono text-[11px] text-ink-200">
                        {f}
                      </li>
                    ))}
                  </Reveal>
                  <Link href="/app" className={buttonClass('primary', 'md', 'group relative mt-7 rounded-full')}>
                    <ArrowLeft className="h-4 w-4 transition-transform duration-300 group-hover:-translate-x-1" /> Back to client area
                  </Link>
                </div>
              </Reveal>
            </div>
          </div>

          {/* positions strip */}
          <div className="preview-mock hidden h-36 shrink-0 border-t border-white/[0.06] md:block" aria-hidden>
            <div className="flex gap-5 border-b border-white/[0.06] px-4">
              {['Positions', 'Pending orders', 'History'].map((t, i) => (
                <span key={t} className={cn('-mb-px border-b-2 py-2.5 text-xs', i === 0 ? 'border-brand-400 text-white' : 'border-transparent text-ink-500')}>
                  {t}
                </span>
              ))}
            </div>
            <div className="space-y-3 p-4">
              {[0, 1].map((r) => (
                <div key={r} className="grid grid-cols-6 gap-4">
                  {Array.from({ length: 6 }, (_, i) => (
                    <Skeleton key={i} className={i === 5 ? 'w-2/3 justify-self-end' : 'w-full'} />
                  ))}
                </div>
              ))}
            </div>
          </div>
        </main>

        {/* order ticket */}
        <aside className="preview-mock hidden min-h-0 flex-col gap-4 border-l border-white/[0.06] p-4 lg:flex" aria-hidden>
          <div className="flex items-center justify-between">
            <span className="label">Order ticket</span>
            <span className="label !text-ink-500">Milestone 2</span>
          </div>
          <div className="grid grid-cols-3 rounded-lg bg-white/[0.04] p-0.5 text-center font-mono text-[11px]">
            {['Market', 'Limit', 'Stop'].map((t, i) => (
              <span key={t} className={cn('rounded-md py-1.5', i === 0 ? 'bg-white/10 text-white' : 'text-ink-500')}>
                {t}
              </span>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-xl bg-down/10 px-3 py-3 ring-1 ring-inset ring-down/25">
              <div className="label !text-down/80">Sell</div>
              <Skeleton className="mt-2 h-5 w-20" />
            </div>
            <div className="rounded-xl bg-up/10 px-3 py-3 text-right ring-1 ring-inset ring-up/25">
              <div className="label !text-up/80">Buy</div>
              <Skeleton className="ml-auto mt-2 h-5 w-20" />
            </div>
          </div>
          {['Volume (lots)', 'Stop loss', 'Take profit'].map((l) => (
            <div key={l}>
              <div className="label mb-1.5">{l}</div>
              <div className="flex h-10 items-center rounded-lg border border-white/[0.08] bg-white/[0.03] px-3">
                <Skeleton className="w-16" />
              </div>
            </div>
          ))}
          <div className="mt-auto space-y-2.5 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
            {['Required margin', 'Free margin', 'Margin level'].map((l) => (
              <div key={l} className="flex items-center justify-between">
                <span className="text-[11px] text-ink-500">{l}</span>
                <Skeleton className="h-3 w-14" />
              </div>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}

export default function TradePage() {
  return (
    <RequireAuth>
      <TerminalPreview />
    </RequireAuth>
  );
}
