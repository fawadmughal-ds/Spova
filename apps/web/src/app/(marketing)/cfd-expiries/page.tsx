import type { Metadata } from 'next';
import type { CSSProperties } from 'react';
import { ArrowRight, Check, Infinity as InfinityIcon, TimerReset } from 'lucide-react';
import { cn } from '@/lib/utils';
import { buttonClass } from '@/lib/button';
import { publicGet, type PublicSymbol } from '@/lib/server-api';
import { Reveal, Spotlight } from '@/components/motion';
import { PageHero, Pending } from '@/components/marketing/page-hero';
import { SectionHead } from '@/components/marketing/section-head';
import { CtaBand } from '@/components/marketing/cta-band';
import { ExpiryLookup } from '@/components/marketing/expiry-lookup';
import { TradingRelated } from '@/components/marketing/trading-related';

export const metadata: Metadata = {
  title: 'CFD expiries',
  description: 'Which CFDs expire and which do not: cash CFDs versus contracts that roll, and the expiry calendar.',
};

const KINDS = [
  {
    key: 'cash',
    icon: InfinityIcon,
    name: 'Cash CFD',
    tag: 'No expiry',
    lead: 'Tracks the spot price of the underlying market.',
    rows: [
      ['Expiry date', 'None. The position stays open until you close it'],
      ['Cost of holding', 'A daily swap at the rollover'],
      ['At the end of a contract month', 'Nothing happens'],
      ['Typically used for', 'Short holds and intraday trading'],
    ],
  },
  {
    key: 'expiring',
    icon: TimerReset,
    name: 'Expiring CFD',
    tag: 'Fixed end date',
    lead: 'Tracks a futures contract for one delivery month.',
    rows: [
      ['Expiry date', 'Set by the futures contract it follows'],
      ['Cost of holding', 'Reflected in the contract price rather than a daily swap'],
      ['At the end of a contract month', 'The position is closed or rolled to the next month'],
      ['Typically used for', 'Holding a view for weeks'],
    ],
  },
];

export default async function CfdExpiriesPage() {
  const symbols = await publicGet<PublicSymbol[]>('/market/symbols', []);

  return (
    <>
      <PageHero
        eyebrow="Trading — CFD expiries"
        title="Contracts that expire, *and the ones that don't*"
        lead="Some CFDs follow a futures contract and end with it. Others follow the spot price and never expire. This page shows which is which on our platform."
        actions={
          <>
            <a href="#calendar" className={buttonClass('primary', 'lg', 'group h-14 rounded-2xl px-7')}>
              Expiry calendar <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
            </a>
            <a href="#types" className={buttonClass('outline', 'lg', 'h-14 rounded-2xl px-7')}>
              Cash vs expiring
            </a>
          </>
        }
      >
        {/* two tracks: one runs forever, one is cut into contract months that hand over */}
        <div className="relative mx-auto max-w-lg">
          <div className="absolute -inset-8 -z-10 rounded-[3rem] bg-brand-500/10 blur-3xl" />
          <div className="glass corners rounded-3xl p-6 shadow-lift sm:p-7">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-sm font-semibold">
                <InfinityIcon className="h-4 w-4 text-brand-300" /> Cash CFD
              </span>
              <span className="label !text-brand-300">no expiry</span>
            </div>
            <svg viewBox="0 0 400 44" className="mt-3 w-full" fill="none">
              <line x1="0" y1="22" x2="400" y2="22" stroke="rgb(var(--tint) / 0.08)" strokeWidth="6" strokeLinecap="round" />
              <line x1="0" y1="22" x2="400" y2="22" stroke="url(#exp-cash)" strokeWidth="6" strokeLinecap="round" pathLength={1} className="draw [animation-duration:2s]" />
              <defs>
                <linearGradient id="exp-cash" x1="0" x2="400" gradientUnits="userSpaceOnUse">
                  <stop stopColor="var(--color-brand-500)" stopOpacity="0.35" />
                  <stop offset="1" stopColor="var(--color-brand-400)" />
                </linearGradient>
              </defs>
              <circle r="7" cy="22" fill="var(--color-white)" filter="drop-shadow(0 0 8px var(--color-brand-400))">
                <animate attributeName="cx" dur="5s" repeatCount="indefinite" values="-10;410" />
              </circle>
            </svg>

            <div className="mt-7 flex items-center justify-between">
              <span className="flex items-center gap-2 text-sm font-semibold">
                <TimerReset className="h-4 w-4 text-gold" /> Expiring CFD
              </span>
              <span className="label !text-gold">rolls each contract</span>
            </div>
            <svg viewBox="0 0 400 64" className="mt-3 w-full" fill="none">
              {[0, 1, 2].map((i) => (
                <g key={i}>
                  <line x1={i * 136 + 4} y1="22" x2={i * 136 + 122} y2="22" stroke="rgb(var(--tint) / 0.08)" strokeWidth="6" strokeLinecap="round" />
                  <line x1={i * 136 + 4} y1="22" x2={i * 136 + 122} y2="22" stroke="var(--color-gold)" strokeOpacity={0.45 + i * 0.25} strokeWidth="6" strokeLinecap="round" pathLength={1} className="draw" style={{ '--d': `${600 + i * 500}ms`, animationDuration: '0.9s' } as CSSProperties} />
                  <text x={i * 136 + 63} y="52" textAnchor="middle" className="fill-ink-500 font-mono text-[9px] uppercase tracking-widest">
                    month {i + 1}
                  </text>
                  {i < 2 && (
                    <g>
                      <circle cx={i * 136 + 131} cy="22" r="5" fill="var(--color-paper)" stroke="var(--color-gold)" strokeWidth="1.5" />
                      <circle cx={i * 136 + 131} cy="22" r="5" stroke="var(--color-gold)" strokeWidth="1">
                        <animate attributeName="r" dur="2.4s" begin={`${i * 1.2}s`} repeatCount="indefinite" values="5;14" />
                        <animate attributeName="opacity" dur="2.4s" begin={`${i * 1.2}s`} repeatCount="indefinite" values="0.8;0" />
                      </circle>
                    </g>
                  )}
                </g>
              ))}
              <circle r="6" cy="22" fill="var(--color-white)" filter="drop-shadow(0 0 8px var(--color-gold))">
                <animate attributeName="cx" dur="6s" repeatCount="indefinite" values="4;122;122;140;258;258;276;394" keyTimes="0;0.27;0.33;0.36;0.63;0.69;0.72;1" />
              </circle>
            </svg>
            <p className="mt-4 border-t border-white/[0.06] pt-4 font-mono text-[10px] leading-relaxed text-ink-500">Illustration of the two contract types. Not a price chart.</p>
          </div>
        </div>
      </PageHero>

      {/* ============================== TYPES ============================== */}
      <section id="types" className="mx-auto max-w-7xl scroll-mt-24 px-4 py-24 sm:px-6 sm:py-28">
        <SectionHead eyebrow="01 — Two kinds of CFD" title="Same market, *different clock*" sub="Both let you trade a price without owning the asset. What differs is whether the contract has an end date." />
        <Reveal variant="stagger" step={120} className="grid gap-4 lg:grid-cols-2">
          {KINDS.map((k) => {
            const cash = k.key === 'cash';
            return (
              <Spotlight key={k.key} style={{ '--spot': cash ? '37 99 235' : '173 108 7' } as CSSProperties} className={cn('card card-hover group overflow-hidden p-6 sm:p-8', cash ? 'hover:!border-brand-400/40' : 'hover:!border-gold/40')}>
                <div className="flex items-start justify-between gap-4">
                  <span className={cn('flex h-12 w-12 items-center justify-center rounded-2xl ring-1 ring-inset transition-transform duration-500 ease-spring group-hover:-rotate-6 group-hover:scale-110', cash ? 'bg-brand-400/15 text-brand-300 ring-brand-400/30' : 'bg-gold/15 text-gold ring-gold/30')}>
                    <k.icon className="h-6 w-6" />
                  </span>
                  <span className={cn('rounded-full px-3 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] ring-1 ring-inset', cash ? 'bg-brand-400/10 text-brand-300 ring-brand-400/30' : 'bg-gold/10 text-gold ring-gold/30')}>{k.tag}</span>
                </div>
                <h3 className="mt-6 font-display text-3xl font-bold tracking-tight">{k.name}</h3>
                <p className="mt-2 text-ink-300">{k.lead}</p>
                <dl className="mt-6 divide-y divide-white/[0.06] border-t border-white/[0.06]">
                  {k.rows.map(([q, a]) => (
                    <div key={q} className="grid gap-1 py-3.5 sm:grid-cols-[190px_1fr] sm:gap-4">
                      <dt className="label !normal-case !tracking-normal sm:pt-0.5">{q}</dt>
                      <dd className="text-sm text-ink-100">{a}</dd>
                    </div>
                  ))}
                </dl>
                {cash && (
                  <p className="mt-5 flex items-center gap-2 text-sm font-medium text-brand-300">
                    <Check className="h-4 w-4" /> Every instrument listed today is this type
                  </p>
                )}
              </Spotlight>
            );
          })}
        </Reveal>
      </section>

      {/* ============================== CALENDAR ============================== */}
      <section id="calendar" className="relative scroll-mt-24 border-y border-white/[0.06] bg-ink-900/40">
        <div className="bg-dots absolute inset-0 opacity-50" />
        <div className="relative mx-auto max-w-7xl px-4 py-24 sm:px-6 sm:py-28">
          <SectionHead eyebrow="02 — Expiry calendar" title="What expires, *and when*" sub="Contracts with an end date appear here with their last trading day. Search any instrument to see whether it expires." />
          <Reveal variant="scale">
            <ExpiryLookup symbols={symbols} />
          </Reveal>
          <Reveal variant="fade" delay={200} className="mt-5 flex flex-col items-start gap-3">
            <p className="max-w-3xl text-xs leading-relaxed text-ink-500">
              When an expiring contract is added it will be listed with its contract month and last trading day before trading opens, so the date is known from the first order.
            </p>
            <Pending>[PLACEHOLDER - rollover policy (close at expiry or roll to next contract, and any price adjustment) to be confirmed before expiring contracts are listed]</Pending>
          </Reveal>
        </div>
      </section>

      <TradingRelated current="/cfd-expiries" />
      <CtaBand title="Hold a cash CFD *on a demo*" body="Open a free demo with $10,000 virtual funds and see how an open position behaves overnight. No card required." secondary={{ href: '/swap-fees', label: 'Swap fees' }} />
    </>
  );
}
