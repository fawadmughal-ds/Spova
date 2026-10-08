import Link from 'next/link';
import type { CSSProperties } from 'react';
import { ArrowDown, ArrowRight, ArrowUpRight, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { buttonClass } from '@/lib/button';
import { MARKET_LIST, type MarketMeta } from '@/lib/markets';
import type { PublicSymbol } from '@/lib/server-api';
import { CountUp, Reveal, Spotlight, Words } from '@/components/motion';
import { SectionHead } from '@/components/marketing/section-head';
import { MarketMotif } from '@/components/marketing/market-motifs';
import { CtaBand } from '@/components/marketing/cta-band';

export interface MarketCopy {
  title: string;
  /** hero headline with the *accent* phrase marked */
  headline: string;
  intro: string;
  bullets: string[];
}

const num = (v: string | undefined, fallback: string) => (v === undefined ? fallback : Number(v).toLocaleString('en-US', { maximumFractionDigits: 2 }));

/** Asset-class landing page. Everything inside is tinted with the class accent via `--c`. */
export function MarketPage({ market, copy, symbols }: { market: MarketMeta; copy: MarketCopy; symbols: PublicSymbol[] }) {
  const lev = Number(market.leverage.split(':')[1]);
  const live = symbols.some((s) => s.quote);
  const others = MARKET_LIST.filter((m) => m.slug !== market.slug);

  return (
    <div className="tint" style={{ '--c': market.rgb, '--spot': market.rgb } as CSSProperties}>
      {/* ============================== HERO ============================== */}
      <section className="noise relative overflow-hidden pt-32 sm:pt-40">
        <div className="bg-grid absolute inset-0" />
        <div className="aurora-blob -top-44 left-[6%] h-[520px] w-[640px] bg-[rgb(var(--c)/0.16)]" />
        <div className="aurora-blob right-[-12%] top-40 h-[420px] w-[520px] bg-iris/15 [animation-delay:-9s]" />

        <div className="relative mx-auto grid max-w-7xl items-center gap-8 px-4 pb-16 sm:px-6 lg:grid-cols-[1.1fr_1fr] lg:pb-20">
          <Reveal variant="none">
            <Reveal variant="fade" className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.18em] text-ink-400">
              <Link href="/" className="transition-colors hover:text-white">
                Home
              </Link>
              <span className="text-ink-600">/</span>
              <span>Markets</span>
              <span className="text-ink-600">/</span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[rgb(var(--c)/0.3)] bg-[rgb(var(--c)/0.08)] px-2.5 py-1 text-[rgb(var(--c))]">
                <market.icon className="h-3 w-3" />
                {market.label}
              </span>
            </Reveal>

            <h1 className="mt-7 font-display text-6xl font-extrabold leading-[0.94] tracking-tighter sm:text-7xl xl:text-[5.6rem]">
              <Words text={copy.headline} delay={150} />
            </h1>

            <Reveal delay={550}>
              <p className="mt-7 max-w-xl text-lg leading-relaxed text-ink-300">{copy.intro}</p>
            </Reveal>

            <Reveal delay={700} className="mt-9 flex flex-wrap items-center gap-3">
              <Link href="/register" className={buttonClass('primary', 'lg', 'group h-14 rounded-2xl px-7')}>
                Start trading <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
              </Link>
              <a href="#instruments" className={buttonClass('outline', 'lg', 'group h-14 rounded-2xl px-7 hover:!border-[rgb(var(--c)/0.6)] hover:!bg-[rgb(var(--c)/0.06)]')}>
                See instruments <ArrowDown className="h-4 w-4 transition-transform duration-300 group-hover:translate-y-0.5" />
              </a>
            </Reveal>
          </Reveal>

          <Reveal variant="scale" delay={300}>
            <MarketMotif cls={market.cls} symbols={symbols} />
          </Reveal>
        </div>

        {/* key facts */}
        <div className="relative mx-auto max-w-7xl px-4 pb-16 sm:px-6 sm:pb-20">
          <Reveal as="dl" variant="stagger" delay={500} className="card corners grid grid-cols-2 overflow-hidden lg:grid-cols-4">
            {[
              { label: 'Max leverage', node: <CountUp to={lev} prefix="1:" /> },
              { label: 'Trading hours', node: market.hours },
              { label: 'Instruments', node: symbols.length ? <CountUp to={symbols.length} /> : '—' },
              { label: 'Min lot', node: symbols[0]?.minLot ?? '0.01' },
            ].map((f, i) => (
              <div key={f.label} className={cn('group relative p-6 sm:p-8', i > 0 && 'lg:border-l lg:border-white/[0.06]', i % 2 === 1 && 'max-lg:border-l max-lg:border-white/[0.06]', i > 1 && 'max-lg:border-t max-lg:border-white/[0.06]')}>
                <dt className="label">{f.label}</dt>
                <dd className="tabular mt-2 font-display text-3xl font-bold tracking-tight sm:text-4xl">{f.node}</dd>
                <span className="absolute inset-x-6 bottom-0 h-px origin-left scale-x-0 bg-[rgb(var(--c))] transition-transform duration-700 ease-out-expo group-hover:scale-x-100 sm:inset-x-8" />
              </div>
            ))}
          </Reveal>
        </div>
      </section>

      {/* ============================== CONDITIONS ============================== */}
      <section className="relative border-y border-white/[0.06] bg-ink-900/40">
        <div className="bg-dots absolute inset-0 opacity-50" />
        <div className="relative mx-auto max-w-7xl px-4 py-24 sm:px-6 sm:py-28">
          <SectionHead eyebrow={`01 — ${market.label}`} title="Conditions *at a glance*" />
          <Reveal variant="stagger" step={90} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {copy.bullets.map((b, i) => (
              <Spotlight key={b} className="card card-hover group flex min-h-[190px] flex-col justify-between overflow-hidden p-6 hover:!border-[rgb(var(--c)/0.4)]">
                <div className="flex items-start justify-between">
                  <span className="text-outline font-display text-6xl font-extrabold leading-none transition-all duration-500 group-hover:[-webkit-text-stroke-color:rgb(var(--c)/0.7)]">0{i + 1}</span>
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[rgb(var(--c)/0.12)] text-[rgb(var(--c))] ring-1 ring-inset ring-[rgb(var(--c)/0.3)] transition-transform duration-500 ease-spring group-hover:scale-125 group-hover:rotate-12">
                    <Check className="h-4 w-4" />
                  </span>
                </div>
                <div>
                  <h3 className="text-lg font-semibold leading-snug">{b}</h3>
                  <div className="mt-4 h-px bg-white/[0.07]">
                    <div className="grow-x h-full bg-gradient-to-r from-[rgb(var(--c))] to-transparent" style={{ '--d': `${400 + i * 140}ms` } as CSSProperties} />
                  </div>
                </div>
              </Spotlight>
            ))}
          </Reveal>
        </div>
      </section>

      {/* ============================== INSTRUMENTS ============================== */}
      <section id="instruments" className="mx-auto max-w-7xl px-4 py-24 sm:px-6 sm:py-28">
        <SectionHead
          eyebrow="02 — Instruments"
          title="Contract *specifications*"
          sub={live ? 'Specs and live bid / ask straight from the platform.' : 'Specs come straight from the platform. Bid and ask appear once the price feed is connected.'}
          action={
            <span className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-400">
              <span className={cn('live-dot', live ? 'text-up' : 'text-ink-500')} />
              {live ? 'Live quotes' : 'Quotes offline'}
            </span>
          }
        />
        <Reveal variant="none" className="card overflow-hidden" style={{ boxShadow: `0 40px 120px -70px rgb(${market.rgb} / 0.55)` }}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead className="border-b border-white/[0.06] text-left">
                <tr>
                  {['Symbol', 'Digits', 'Contract size', 'Min lot', 'Max leverage', 'Bid', 'Ask', ''].map((h, i) => (
                    <th key={i} className="label px-5 py-4 font-medium">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {symbols.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-5 py-14 text-center text-ink-500">
                      Instrument list unavailable right now.
                    </td>
                  </tr>
                )}
                {symbols.map((s, i) => (
                  <tr key={s.id} className="row-in group border-t border-white/[0.05] transition-colors duration-300 first:border-t-0 hover:bg-[rgb(var(--c)/0.05)]" style={{ '--i': i } as CSSProperties}>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[rgb(var(--c)/0.1)] font-mono text-[10px] font-bold text-[rgb(var(--c))] ring-1 ring-inset ring-[rgb(var(--c)/0.22)] transition-transform duration-500 ease-spring group-hover:-rotate-6 group-hover:scale-110">
                          {s.id.slice(0, 3)}
                        </span>
                        <span>
                          <span className="flex items-center gap-2 font-semibold text-white">
                            {s.id}
                            {s.isOpen === false && <span className="rounded bg-white/[0.06] px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-ink-400">closed</span>}
                          </span>
                          <span className="block text-xs text-ink-500">{s.name}</span>
                        </span>
                      </div>
                    </td>
                    <td className="tabular px-5 py-3.5 font-mono text-ink-300">{s.digits}</td>
                    <td className="tabular px-5 py-3.5 font-mono text-ink-300">{num(s.contractSize, '—')}</td>
                    <td className="tabular px-5 py-3.5 font-mono text-ink-300">{s.minLot ?? '0.01'}</td>
                    <td className="px-5 py-3.5">
                      <span className="tabular rounded-md bg-white/[0.05] px-2 py-1 font-mono text-xs text-ink-100">1:{s.leverageMax}</span>
                    </td>
                    <td className={cn('tabular px-5 py-3.5 font-mono', s.quote ? 'text-down/90' : 'text-ink-600')}>{s.quote?.bid ?? '—'}</td>
                    <td className={cn('tabular px-5 py-3.5 font-mono', s.quote ? 'text-up/90' : 'text-ink-600')}>{s.quote?.ask ?? '—'}</td>
                    <td className="px-5 py-3.5 text-right">
                      <Link
                        href="/register"
                        className="inline-flex items-center gap-1.5 rounded-lg bg-white/[0.05] px-3 py-1.5 text-xs font-medium text-ink-200 transition-all duration-300 hover:bg-[rgb(var(--c))] hover:text-ink-950"
                      >
                        Trade <ArrowRight className="h-3 w-3 transition-transform duration-300 group-hover:translate-x-0.5" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.06] px-5 py-3.5 text-xs text-ink-500">
            <span>
              {symbols.length} {symbols.length === 1 ? 'instrument' : 'instruments'} · {market.hours}
            </span>
            <span>Leverage shown is the instrument maximum; your account leverage also applies.</span>
          </div>
        </Reveal>
      </section>

      {/* ============================== OTHER MARKETS ============================== */}
      <section className="mx-auto max-w-7xl px-4 pb-24 sm:px-6 sm:pb-28">
        <SectionHead eyebrow="03 — More markets" title="Same account, *five more markets*" />
        <Reveal variant="stagger" step={70} className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
          {others.map((m, i) => (
            <Spotlight
              key={m.slug}
              href={`/${m.slug}`}
              style={{ '--c': m.rgb, '--spot': m.rgb } as CSSProperties}
              className={cn('card card-hover group block overflow-hidden p-5 hover:!border-[rgb(var(--c)/0.45)]', i === others.length - 1 && 'max-md:col-span-2')}
            >
              <div className="flex items-start justify-between">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[rgb(var(--c)/0.12)] text-[rgb(var(--c))] ring-1 ring-inset ring-[rgb(var(--c)/0.25)] transition-transform duration-500 ease-spring group-hover:-rotate-12 group-hover:scale-110">
                  <m.icon className="h-5 w-5" />
                </span>
                <ArrowUpRight className="h-4 w-4 text-ink-500 transition-all duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-white" />
              </div>
              <div className="mt-6 font-display text-xl font-bold">{m.label}</div>
              <div className="mt-1 text-xs text-ink-400">{m.blurb}</div>
              <div className="label mt-4 !text-[rgb(var(--c)/0.9)]">up to {m.leverage}</div>
            </Spotlight>
          ))}
        </Reveal>
      </section>

      <CtaBand title={`Trade ${market.label.toLowerCase()} *on a free demo*`} />
    </div>
  );
}
