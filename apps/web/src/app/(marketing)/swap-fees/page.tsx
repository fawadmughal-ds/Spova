import Link from 'next/link';
import type { Metadata } from 'next';
import type { CSSProperties } from 'react';
import { ArrowRight, CalendarRange, MoonStar, ReceiptText, Scale } from 'lucide-react';
import { cn } from '@/lib/utils';
import { buttonClass } from '@/lib/button';
import { publicGet, type PublicSymbol } from '@/lib/server-api';
import { Reveal, Spotlight } from '@/components/motion';
import { PageHero, Pending } from '@/components/marketing/page-hero';
import { SectionHead } from '@/components/marketing/section-head';
import { CtaBand } from '@/components/marketing/cta-band';
import { SwapCalculator, SwapTable } from '@/components/marketing/swap-tools';
import { TradingRelated } from '@/components/marketing/trading-related';

export const metadata: Metadata = {
  title: 'Swap fees',
  description: 'Overnight financing explained: when swaps are applied, how they are calculated, and the long and short rate for every instrument.',
};

const WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const money = (n: number) => `${n > 0 ? '+' : n < 0 ? '−' : ''}$${Math.abs(n).toFixed(2)}`;

export default async function SwapFeesPage() {
  const symbols = await publicGet<PublicSymbol[]>('/market/symbols', []);
  // worked example: the first listed instrument that actually carries a long swap
  const eg = symbols.find((s) => Number(s.swapLong ?? 0) !== 0);
  const egRate = eg ? Number(eg.swapLong) : 0;

  return (
    <>
      <PageHero
        eyebrow="Trading — Swap fees"
        title="What it costs to *hold overnight*"
        lead="Keep a position open past the daily rollover and a financing adjustment is applied. Depending on the instrument and direction it is either charged to you or credited to you."
        actions={
          <>
            <a href="#calculator" className={buttonClass('primary', 'lg', 'group h-14 rounded-2xl px-7')}>
              Calculate a swap <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
            </a>
            <a href="#rates" className={buttonClass('outline', 'lg', 'h-14 rounded-2xl px-7')}>
              See all rates
            </a>
          </>
        }
      >
        {/* 24-hour dial: the hand sweeps the trading day and trips the rollover at the top */}
        <div className="relative mx-auto max-w-md">
          <div className="absolute -inset-10 -z-10 rounded-full bg-iris/15 blur-3xl" />
          <div className="glass corners rounded-3xl p-6 shadow-lift">
            <div className="relative mx-auto aspect-square w-full max-w-[280px]">
              <svg viewBox="0 0 200 200" className="h-full w-full" fill="none">
                <circle cx="100" cy="100" r="88" stroke="rgb(var(--tint) / 0.08)" strokeWidth="1" />
                <circle cx="100" cy="100" r="88" stroke="url(#swap-arc)" strokeWidth="2" strokeLinecap="round" pathLength={1} className="draw [animation-duration:2.4s]" transform="rotate(-90 100 100)" />
                <defs>
                  <linearGradient id="swap-arc" x1="0" y1="0" x2="200" y2="200" gradientUnits="userSpaceOnUse">
                    <stop stopColor="var(--color-iris)" />
                    <stop offset="1" stopColor="var(--color-brand-400)" />
                  </linearGradient>
                </defs>
                {Array.from({ length: 24 }, (_, h) => (
                  <line
                    key={h}
                    x1="100"
                    y1={h % 6 === 0 ? 18 : 21}
                    x2="100"
                    y2="26"
                    stroke={h === 0 ? 'var(--color-gold)' : 'rgb(var(--tint) / 0.28)'}
                    strokeWidth={h % 6 === 0 ? 1.6 : 0.8}
                    transform={`rotate(${h * 15} 100 100)`}
                  />
                ))}
                {[
                  ['06', 164, 104],
                  ['12', 100, 170],
                  ['18', 36, 104],
                ].map(([t, x, y]) => (
                  <text key={t} x={x} y={y} textAnchor="middle" className="fill-ink-500 font-mono text-[9px]">
                    {t}
                  </text>
                ))}
                {/* hand: one lap = one trading day */}
                <g className="origin-center animate-spin-slow [animation-duration:14s]">
                  <line x1="100" y1="100" x2="100" y2="30" stroke="var(--color-brand-400)" strokeWidth="1.6" strokeLinecap="round" />
                  <circle cx="100" cy="30" r="3.5" fill="var(--color-brand-400)" />
                </g>
                <circle cx="100" cy="100" r="4" fill="var(--color-paper)" stroke="var(--color-brand-400)" strokeWidth="1.6" />
              </svg>
              <div className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/3">
                <span className="relative flex h-11 w-11 items-center justify-center rounded-full border border-gold/50 bg-ink-900 text-gold shadow-[0_0_30px_-4px_rgb(var(--gold-rgb)/0.7)]">
                  <span className="absolute inset-0 animate-pulse-ring rounded-full border border-gold/60" />
                  <MoonStar className="h-5 w-5" />
                </span>
              </div>
              <div className="absolute inset-x-0 top-[60%] text-center">
                <div className="label">Daily rollover</div>
                <div className="tabular font-mono text-xl font-semibold text-white">00:00 UTC</div>
              </div>
            </div>

            <Reveal variant="none" className="mt-6 grid grid-cols-7 gap-1.5">
              {WEEK.map((d, i) => (
                <div key={d} className="text-center">
                  <div
                    style={{ '--d': `${700 + i * 80}ms` } as CSSProperties}
                    className={cn(
                      'grow-y flex h-10 items-center justify-center rounded-lg font-mono text-[10px] font-bold',
                      d === 'Wed' ? 'bg-gold/20 text-gold ring-1 ring-inset ring-gold/40' : i > 4 ? 'border border-dashed border-white/10 text-ink-600' : 'bg-white/[0.06] text-ink-300',
                    )}
                  >
                    {d === 'Wed' ? '×3' : i > 4 ? '—' : '×1'}
                  </div>
                  <div className="label mt-1.5">{d}</div>
                </div>
              ))}
            </Reveal>
            <p className="mt-3 text-center font-mono text-[10px] text-ink-500">FX convention · positions open at the rollover</p>
          </div>
        </div>
      </PageHero>

      {/* ============================== HOW ============================== */}
      <section className="mx-auto max-w-7xl px-4 py-24 sm:px-6 sm:py-28">
        <SectionHead eyebrow="01 — The rule" title="One formula, *two rates*" sub="Every instrument has a long rate and a short rate. Which one applies depends on the direction of your position." />
        <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
          <Reveal variant="scale" className="beam relative overflow-hidden rounded-3xl border border-white/[0.08] bg-ink-900 p-7 sm:p-10">
            <div className="bg-dots absolute inset-0 opacity-60" />
            <div className="relative">
              <div className="label">Swap per night</div>
              <p className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-2 font-display text-3xl font-bold tracking-tight sm:text-5xl">
                <span>lots</span>
                <span className="text-ink-500">×</span>
                <span className="accent">rate</span>
              </p>
              <p className="mt-5 max-w-md text-sm leading-relaxed text-ink-400">
                The rate is quoted in USD per lot, per night: the <span className="text-ink-100">long</span> rate for buy positions, the <span className="text-ink-100">short</span> rate for sell positions. A negative rate is a charge; a
                positive rate is a credit.
              </p>
              {eg && (
                <div className="mt-8 rounded-2xl border border-white/[0.07] bg-white/[0.03] p-5">
                  <div className="label">Worked example · {eg.id} long</div>
                  <p className="tabular mt-3 font-mono text-sm text-ink-200">
                    1.00 lot × {money(egRate)} = <span className={egRate < 0 ? 'text-down' : 'text-up'}>{money(egRate)}</span> per night
                  </p>
                  <p className="tabular mt-1.5 font-mono text-sm text-ink-200">
                    0.10 lot × {money(egRate)} = <span className={egRate < 0 ? 'text-down' : 'text-up'}>{money(egRate * 0.1)}</span> per night
                  </p>
                </div>
              )}
            </div>
          </Reveal>

          <Reveal variant="stagger" step={90} className="grid gap-4">
            {[
              { icon: MoonStar, title: 'Applied at 00:00 UTC', body: 'Swaps are calculated once a day for positions that are open at the rollover. Close before it and nothing is applied for that night.' },
              { icon: CalendarRange, title: 'Three nights on Wednesday', body: 'Following the FX convention, the Wednesday rollover counts three times to cover the weekend, when the market is shut.' },
              { icon: ReceiptText, title: 'Its own line in your statement', body: 'Each swap is posted to your account as a separate entry, so financing never hides inside your trading result.' },
            ].map((t) => (
              <Spotlight key={t.title} className="card card-hover group flex gap-4 p-5">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/[0.05] text-brand-300 ring-1 ring-inset ring-white/10 transition-transform duration-500 ease-spring group-hover:-rotate-6 group-hover:scale-110">
                  <t.icon className="h-5 w-5" />
                </span>
                <span>
                  <span className="block font-semibold">{t.title}</span>
                  <span className="mt-1 block text-sm leading-relaxed text-ink-400">{t.body}</span>
                </span>
              </Spotlight>
            ))}
            <Pending>[PLACEHOLDER - confirm whether the Wednesday triple applies to non-FX instruments]</Pending>
          </Reveal>
        </div>
      </section>

      {/* ============================== CALCULATOR ============================== */}
      <section id="calculator" className="relative scroll-mt-24 border-y border-white/[0.06] bg-ink-900/40">
        <div className="bg-dots absolute inset-0 opacity-50" />
        <div className="relative mx-auto max-w-7xl px-4 py-24 sm:px-6 sm:py-28">
          <SectionHead eyebrow="02 — Calculator" title="Price the hold *before you take it*" sub="Choose the instrument, direction and size, then how many nights you expect to hold." />
          <Reveal variant="scale">
            <SwapCalculator symbols={symbols} />
          </Reveal>
        </div>
      </section>

      {/* ============================== TABLE ============================== */}
      <section id="rates" className="mx-auto max-w-7xl scroll-mt-24 px-4 py-24 sm:px-6 sm:py-28">
        <SectionHead
          eyebrow="03 — Rates"
          title="Long and short, *every instrument*"
          sub="Read straight from the platform. Click a column to sort it."
          action={
            <span className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-400">
              <Scale className="h-3.5 w-3.5" /> USD per lot, per night
            </span>
          }
        />
        <Reveal variant="fade">
          <SwapTable symbols={symbols} />
        </Reveal>
        <Reveal variant="fade" delay={200}>
          <p className="mt-5 max-w-3xl text-xs leading-relaxed text-ink-500">
            Swap rates follow financing conditions in the underlying markets and can be updated without notice. The rate in force at each rollover is the one applied. Leverage does not change the swap: it is calculated on the full
            position size, not on your margin.
          </p>
        </Reveal>
      </section>

      <div className="border-t border-white/[0.06] bg-ink-900/40">
        <TradingRelated current="/swap-fees" />
      </div>
      <div className="pt-24 sm:pt-28">
        <CtaBand title="See swaps post *on a demo*" body="Open a free demo with $10,000 virtual funds and hold a position overnight. No card required." secondary={{ href: '/cfds-list', label: 'Full CFD list' }} />
      </div>
    </>
  );
}
