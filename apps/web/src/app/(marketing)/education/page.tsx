import type { Metadata } from 'next';
import Link from 'next/link';
import type { CSSProperties, ReactNode } from 'react';
import { ArrowRight, ArrowUpRight } from 'lucide-react';
import { BRAND, cn } from '@/lib/utils';
import { buttonClass } from '@/lib/button';
import { EDUCATION_LINKS } from '@/lib/site-nav';
import { CountUp, Reveal, Spotlight } from '@/components/motion';
import { PageHero, Pending } from '@/components/marketing/page-hero';
import { SectionHead } from '@/components/marketing/section-head';
import { CtaBand } from '@/components/marketing/cta-band';
import { FEED_TOOLS } from '@/components/education/shared';
import { TERMS } from '@/components/education/glossary-data';

export const metadata: Metadata = {
  title: 'Education center',
  description: `Learn to trade CFDs with ${BRAND}: a step-by-step guide, a glossary, chart analysis, risk management tools and more.`,
};

const TOOLS = EDUCATION_LINKS.filter((l) => l.href !== '/education');
const READY = TOOLS.filter((l) => !FEED_TOOLS.includes(l.href));
const COMING = TOOLS.filter((l) => FEED_TOOLS.includes(l.href));

const PATH: { n: string; title: string; body: string; href: string; cta: string }[] = [
  { n: '01', title: 'Foundations', body: 'What a CFD is, long and short, leverage, margin and costs.', href: '/trading-education', cta: 'Read the guide' },
  { n: '02', title: 'Vocabulary', body: 'The words on the order ticket, each in a sentence or two.', href: '/glossary', cta: 'Open the glossary' },
  { n: '03', title: 'Charts', body: 'Candles, trends, levels and the patterns traders look for.', href: '/chart-analysis', cta: 'Learn to read charts' },
  { n: '04', title: 'Risk', body: 'Stops, targets and sizing a position from the loss you accept.', href: '/risk-management-tools', cta: 'Use the calculators' },
  { n: '05', title: 'Practice', body: 'Put it together on a demo account with $10,000 virtual funds.', href: '/register', cta: 'Open a free demo' },
];

/** Small looping illustration at the top of each "available now" card. */
const ART: Record<string, ReactNode> = {
  '/trading-education': (
    <div className="w-full max-w-[220px] space-y-2">
      {['What a CFD is', 'Long and short', 'Leverage and margin'].map((c, n) => (
        <div key={c} className="grow-x flex items-center gap-3 rounded-lg bg-white/[0.05] px-3 py-2" style={{ '--d': `${300 + n * 160}ms` } as CSSProperties}>
          <span className="font-mono text-[10px] text-brand-300">0{n + 1}</span>
          <span className="text-xs text-ink-200">{c}</span>
        </div>
      ))}
    </div>
  ),
  '/glossary': (
    <div className="flex items-end gap-4">
      <span className="font-serif text-8xl italic leading-none text-white transition-transform duration-700 ease-spring group-hover:-rotate-6">Aa</span>
      <span className="pb-2">
        <span className="tabular block font-display text-3xl font-bold">
          <CountUp to={TERMS.length} />
        </span>
        <span className="label">terms</span>
      </span>
    </div>
  ),
  '/chart-analysis': (
    <svg viewBox="0 0 220 110" className="w-full max-w-[240px]" fill="none">
      {[
        [20, 70, 30, 52],
        [48, 60, 22, 36],
        [76, 52, 30, 44],
        [104, 58, 26, 30],
        [132, 40, 12, 20],
        [160, 34, 14, 28],
        [188, 30, 4, 10],
      ].map(([x, a, hi, b], n) => {
        const up = b < a;
        return (
          <g key={n} className="grow-y" style={{ '--d': `${250 + n * 90}ms`, transformBox: 'fill-box' } as CSSProperties}>
            <path d={`M${x} ${hi} V${Math.max(a, b) + 14}`} stroke={up ? 'var(--color-up)' : 'var(--color-down)'} strokeWidth="1.5" />
            <rect x={x - 8} y={Math.min(a, b)} width="16" height={Math.abs(a - b)} rx="2.5" fill={up ? 'var(--color-up)' : 'var(--color-down)'} />
          </g>
        );
      })}
    </svg>
  ),
  '/risk-management-tools': (
    <div className="w-full max-w-[230px] space-y-2.5">
      {[
        ['Take profit', 'bg-up', 'w-4/5'],
        ['Entry', 'bg-white', 'w-1/2'],
        ['Stop loss', 'bg-down', 'w-1/4'],
      ].map(([k, color, w], n) => (
        <div key={k} className="grid grid-cols-[76px_1fr] items-center gap-3">
          <span className="label !text-[9px]">{k}</span>
          <span className="h-2 overflow-hidden rounded-full bg-white/[0.06]">
            <span className={cn('grow-x block h-full rounded-full', color, w)} style={{ '--d': `${300 + n * 160}ms` } as CSSProperties} />
          </span>
        </div>
      ))}
    </div>
  ),
};

export default function EducationPage() {
  return (
    <>
      <PageHero
        eyebrow="Education center"
        title="Learn the markets *at your own pace*"
        lead="From your first pip to position sizing and risk management. Start with the written guide, look words up as you go, and practise every step on a demo account."
        actions={
          <>
            <Link href="/trading-education" className={buttonClass('primary', 'lg', 'group h-14 rounded-2xl px-7')}>
              Start the guide <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
            </Link>
            <Link href="/register" className={buttonClass('outline', 'lg', 'h-14 rounded-2xl px-7')}>
              Open free demo
            </Link>
          </>
        }
      >
        {/* syllabus board: every tool and its status */}
        <div className="relative mx-auto max-w-md">
          <div className="absolute -inset-8 -z-10 rounded-[3rem] bg-brand-500/15 blur-3xl" />
          <div className="beam glass overflow-hidden rounded-3xl p-2 shadow-lift">
            <div className="flex items-center justify-between px-4 py-3">
              <span className="label">Syllabus</span>
              <span className="label">
                {READY.length} ready · {COMING.length} in preparation
              </span>
            </div>
            <Reveal as="ul" variant="stagger" step={70} delay={450}>
              {TOOLS.map((t) => {
                const pending = FEED_TOOLS.includes(t.href);
                return (
                  <li key={t.href}>
                    <Link href={t.href} className="group flex items-center gap-3 rounded-2xl px-3 py-2.5 transition-colors duration-300 hover:bg-white/[0.06]">
                      <span
                        className={cn(
                          'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ring-1 ring-inset transition-transform duration-500 ease-spring group-hover:-rotate-6 group-hover:scale-110',
                          pending ? 'bg-white/[0.04] text-ink-400 ring-white/10' : 'bg-brand-400/12 text-brand-300 ring-brand-400/30',
                        )}
                      >
                        <t.icon className="h-4 w-4" />
                      </span>
                      <span className={cn('flex-1 text-sm', pending ? 'text-ink-300' : 'font-medium text-white')}>{t.label}</span>
                      <span className={cn('inline-flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.14em]', pending ? 'text-gold' : 'text-up')}>
                        <span className={cn('h-1.5 w-1.5 rounded-full bg-current', !pending && 'live-dot')} />
                        {pending ? 'Soon' : 'Ready'}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </Reveal>
          </div>
        </div>
      </PageHero>

      {/* available now */}
      <section className="relative border-y border-white/[0.06] bg-ink-900/40">
        <div className="bg-dots absolute inset-0 opacity-50" />
        <div className="relative mx-auto max-w-7xl px-4 py-24 sm:px-6 sm:py-28">
          <SectionHead eyebrow="01 — Available now" title="Four places *to start*" sub="Written by us, free to read, no account needed." />
          <Reveal variant="stagger" step={100} className="grid gap-4 md:grid-cols-2">
            {READY.map((t, i) => (
              <Spotlight key={t.href} href={t.href} className="card card-hover group flex flex-col overflow-hidden">
                <div className="relative flex h-44 items-center justify-center overflow-hidden border-b border-white/[0.05] bg-ink-900/40 px-6">
                  <div className="bg-grid absolute inset-0 opacity-60" />
                  <div className="relative flex w-full items-center justify-center">{ART[t.href]}</div>
                  <span className="text-outline absolute -bottom-4 right-4 font-display text-8xl font-extrabold leading-none transition-all duration-700 group-hover:[-webkit-text-stroke-color:rgb(var(--brand-rgb)/0.5)]">0{i + 1}</span>
                </div>
                <div className="flex flex-1 items-end justify-between gap-6 p-7">
                  <div>
                    <h3 className="flex items-center gap-2.5 text-2xl font-bold">
                      <t.icon className="h-5 w-5 text-brand-400 transition-transform duration-500 ease-spring group-hover:-rotate-12 group-hover:scale-125" />
                      {t.label}
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed text-ink-400">{DETAIL[t.href]}</p>
                  </div>
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/10 text-ink-300 transition-all duration-500 group-hover:border-brand-400 group-hover:bg-brand-400 group-hover:text-ink-950">
                    <ArrowUpRight className="h-4 w-4 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                  </span>
                </div>
              </Spotlight>
            ))}
          </Reveal>
        </div>
      </section>

      {/* learning path */}
      <section className="mx-auto max-w-7xl px-4 py-24 sm:px-6 sm:py-28">
        <SectionHead eyebrow="02 — Learning path" title="Five stops, *in order*" sub="Each step builds on the one before. Take them in sequence the first time through." />
        <Reveal variant="none" className="relative">
          <div className="absolute left-[10%] right-[10%] top-7 hidden h-0.5 rounded-full bg-white/[0.08] lg:block">
            <div className="grow-x h-full bg-gradient-to-r from-brand-500 via-brand-300 to-volt [animation-duration:2.6s]" />
          </div>
          <Reveal variant="stagger" step={160} className="grid gap-10 sm:grid-cols-2 lg:grid-cols-5 lg:gap-5">
            {PATH.map((s, i) => (
              <Link key={s.n} href={s.href} className="group relative block lg:text-center">
                <span
                  className={cn(
                    'relative flex h-14 w-14 items-center justify-center rounded-2xl border bg-ink-900 font-mono text-sm font-bold shadow-lift transition-all duration-500 ease-spring group-hover:-translate-y-1 lg:mx-auto',
                    i === PATH.length - 1 ? 'border-volt/40 text-volt group-hover:bg-volt group-hover:text-ink-950' : 'border-white/10 text-brand-300 group-hover:border-brand-400/50 group-hover:bg-brand-400 group-hover:text-ink-950',
                  )}
                >
                  {s.n}
                </span>
                <h3 className="mt-6 text-xl font-bold">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-400 lg:mx-auto lg:max-w-[14rem]">{s.body}</p>
                <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-brand-300">
                  <span className="link-underline">{s.cta}</span>
                  <ArrowRight className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-1" />
                </span>
              </Link>
            ))}
          </Reveal>
        </Reveal>
      </section>

      {/* in preparation */}
      <section className="relative border-y border-white/[0.06] bg-ink-900/40">
        <div className="relative mx-auto max-w-7xl px-4 py-24 sm:px-6 sm:py-28">
          <SectionHead
            eyebrow="03 — In preparation"
            title="Five tools *on the way*"
            sub="These depend on an external content feed. Each page shows what it will offer and a sample layout, with no real data yet."
          />
          <Reveal variant="stagger" step={90} className="border-t border-white/[0.08]">
            {COMING.map((t, i) => (
              <Link
                key={t.href}
                href={t.href}
                className="group relative grid items-center gap-x-6 gap-y-2 overflow-hidden border-b border-white/[0.08] py-7 transition-[padding] duration-500 ease-out-expo hover:px-4 md:grid-cols-[70px_1fr_1fr_130px] sm:hover:px-6"
              >
                <span className="absolute inset-0 -z-10 origin-left scale-x-0 bg-gradient-to-r from-gold/[0.07] to-transparent transition-transform duration-700 ease-out-expo group-hover:scale-x-100" />
                <span className="text-outline font-display text-5xl font-extrabold leading-none transition-all duration-500 group-hover:[-webkit-text-stroke-color:rgb(var(--gold-rgb)/0.7)]">0{i + 1}</span>
                <h3 className="flex items-center gap-3 font-display text-2xl font-bold tracking-tight sm:text-3xl">
                  <t.icon className="h-5 w-5 shrink-0 text-ink-400 transition-colors duration-300 group-hover:text-gold" />
                  {t.label}
                </h3>
                <p className="text-sm leading-relaxed text-ink-400">{DETAIL[t.href]}</p>
                <span className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.14em] text-gold md:justify-end">
                  <span className="live-dot !h-1.5 !w-1.5" /> In preparation
                </span>
              </Link>
            ))}
          </Reveal>
        </div>
      </section>

      <div className="pt-24 sm:pt-28">
        <CtaBand title="Practise *without the risk*" secondary={{ href: '/platform', label: 'See the platform' }} />
      </div>
    </>
  );
}

const DETAIL: Record<string, string> = {
  '/trading-education': 'Six short chapters on how CFDs work: long and short, leverage and margin, costs, goals and risks.',
  '/glossary': 'Every term you will meet on a chart or an order ticket, searchable and sorted from A to Z.',
  '/chart-analysis': 'Candle anatomy, trends, support and resistance, classic patterns and timeframes, drawn step by step.',
  '/risk-management-tools': 'Stops, targets and margin level explained, with a position-size calculator and a margin calculator.',
  '/economic-calendar': 'A schedule of rate decisions and data releases, with impact ratings and expected figures.',
  '/signals': 'Structured trade ideas with direction, entry, target and stop, to study next to your own analysis.',
  '/ebooks': 'Longer guides to download, one subject per book.',
  '/daily-market-videos': 'A short recap of each session with the charts on screen.',
  '/latest-market-news': 'A market news wire sorted by asset class.',
};
