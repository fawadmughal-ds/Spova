import type { Metadata } from 'next';
import Link from 'next/link';
import type { CSSProperties } from 'react';
import { ArrowDown } from 'lucide-react';
import { buttonClass } from '@/lib/button';
import { cn } from '@/lib/utils';
import { Reveal, Spotlight } from '@/components/motion';
import { PageHero } from '@/components/marketing/page-hero';
import { SectionHead } from '@/components/marketing/section-head';
import { CtaBand } from '@/components/marketing/cta-band';
import { ToolStrip } from '@/components/education/shared';
import { CandleAnatomy, ChartTypeSwitcher } from '@/components/education/chart-figures';

export const metadata: Metadata = {
  title: 'Chart analysis',
  description: 'How to read a price chart: chart types, candle anatomy, trends, support and resistance, classic patterns and timeframes.',
};

const d = (ms: number) => ({ '--d': `${ms}ms` }) as CSSProperties;

const TRENDS = [
  {
    name: 'Uptrend',
    rule: 'Higher highs and higher lows',
    body: 'Each push reaches further than the last and each pullback stops earlier. Buyers are in control for as long as that sequence holds.',
    path: 'M10 122 L52 78 L84 100 L128 52 L160 76 L206 26',
    marks: [[52, 78, 'H'], [84, 100, 'L'], [128, 52, 'HH'], [160, 76, 'HL'], [206, 26, 'HH']] as [number, number, string][],
    color: 'var(--color-up)',
  },
  {
    name: 'Downtrend',
    rule: 'Lower highs and lower lows',
    body: 'The mirror image. Rallies fail earlier each time and every drop goes further. Sellers are in control.',
    path: 'M10 24 L52 70 L84 46 L128 96 L160 72 L206 124',
    marks: [[52, 70, 'L'], [84, 46, 'H'], [128, 96, 'LL'], [160, 72, 'LH'], [206, 124, 'LL']] as [number, number, string][],
    color: 'var(--color-down)',
  },
  {
    name: 'Range',
    rule: 'Highs and lows at similar levels',
    body: 'Neither side wins. Price moves between a floor and a ceiling until one of them finally gives way.',
    path: 'M10 96 L44 44 L78 98 L112 46 L146 100 L180 44 L206 82',
    marks: [[44, 44, 'H'], [78, 98, 'L'], [112, 46, 'H'], [146, 100, 'L'], [180, 44, 'H']] as [number, number, string][],
    color: 'var(--color-gold)',
  },
];

const PATTERNS = [
  { name: 'Double top', kind: 'Reversal', body: 'Two failed attempts at the same high. The pattern is only complete if price then falls through the low between them.', path: 'M8 112 L44 34 L76 82 L110 34 L140 82 L168 120', level: 82 },
  { name: 'Head and shoulders', kind: 'Reversal', body: 'A high, a higher high, then a lower high. The line under the two dips is the neckline; a break below it completes the shape.', path: 'M6 110 L30 62 L52 88 L86 22 L120 88 L142 62 L168 116', level: 88 },
  { name: 'Ascending triangle', kind: 'Continuation', body: 'A flat ceiling tested again and again while the lows keep rising. Pressure builds toward the level.', path: 'M8 116 L40 40 L62 98 L92 40 L112 80 L138 40 L152 60 L170 24', level: 40 },
  { name: 'Flag', kind: 'Continuation', body: 'A sharp move, then a short, shallow drift against it. Often a pause before the earlier direction resumes, though not always.', path: 'M8 120 L60 34 L76 54 L92 44 L108 64 L124 54 L170 14', level: null },
];

const TIMEFRAMES = [
  ['1m', 'One minute', 'Entries and exits, noise included'],
  ['5m', 'Five minutes', 'Intraday swings'],
  ['15m', 'Fifteen minutes', 'The shape of a session'],
  ['1h', 'One hour', 'The trend within the day'],
  ['4h', 'Four hours', 'Multi-day structure'],
  ['1d', 'One day', 'The big picture'],
];

/** A day candle on the left; the six four-hour candles that add up to it on the right. */
function Zoom() {
  // [open, high, low, close] on 0-100; together they open at 20, close at 80, range 12-90
  const parts: [number, number, number, number][] = [
    [20, 34, 12, 30],
    [30, 46, 26, 42],
    [42, 48, 30, 34],
    [34, 62, 32, 58],
    [58, 90, 54, 84],
    [84, 88, 72, 80],
  ];
  const y = (v: number) => 150 - v * 1.4;
  return (
    <svg viewBox="0 0 420 170" className="w-full" fill="none" role="img" aria-label="One daily candle equals six four-hour candles">
      <path d={`M60 ${y(90)} V${y(12)}`} stroke="var(--color-up)" strokeWidth="2.5" />
      <rect x="38" y={y(80)} width="44" height={y(20) - y(80)} rx="5" fill="var(--color-up)" className="grow-y" style={{ ...d(200), transformBox: 'fill-box' }} />
      <text x="60" y="166" textAnchor="middle" className="fill-ink-300 font-mono text-[10px] uppercase tracking-widest">
        1 × 1d
      </text>
      <path d="M104 80 H150 M140 72 L150 80 L140 88" stroke="rgb(var(--tint) / 0.35)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="draw" pathLength={1} style={d(700)} />
      {parts.map(([o, h, l, c], n) => {
        const x = 190 + n * 38;
        const col = c >= o ? 'var(--color-up)' : 'var(--color-down)';
        return (
          <g key={n} className="grow-y" style={{ ...d(900 + n * 110), transformBox: 'fill-box' }}>
            <path d={`M${x} ${y(h)} V${y(l)}`} stroke={col} strokeWidth="1.5" />
            <rect x={x - 9} y={y(Math.max(o, c))} width="18" height={Math.abs(y(o) - y(c))} rx="3" fill={col} />
          </g>
        );
      })}
      <path d={`M176 ${y(20)} H410`} stroke="rgb(var(--tint) / 0.18)" strokeDasharray="3 5" />
      <path d={`M176 ${y(80)} H410`} stroke="rgb(var(--tint) / 0.18)" strokeDasharray="3 5" />
      <text x="285" y="166" textAnchor="middle" className="fill-ink-300 font-mono text-[10px] uppercase tracking-widest">
        6 × 4h
      </text>
    </svg>
  );
}

export default function ChartAnalysisPage() {
  return (
    <>
      <PageHero
        eyebrow="Education — Chart analysis"
        title="Read the chart *before the news*"
        lead="A chart is a record of every decision buyers and sellers have made. Learning to read one will not tell you the future, but it will tell you where price has been, who was in control, and where a trade idea stops making sense."
        actions={
          <>
            <a href="#candles" className={buttonClass('primary', 'lg', 'group h-14 rounded-2xl px-7')}>
              Start with a candle <ArrowDown className="h-4 w-4 transition-transform duration-300 group-hover:translate-y-1" />
            </a>
            <Link href="/glossary" className={buttonClass('outline', 'lg', 'h-14 rounded-2xl px-7')}>
              Open the glossary
            </Link>
          </>
        }
      >
        <ChartTypeSwitcher />
      </PageHero>

      {/* 01 candle */}
      <section id="candles" className="relative scroll-mt-24 border-y border-white/[0.06] bg-ink-900/40">
        <div className="relative mx-auto max-w-7xl px-4 py-24 sm:px-6 sm:py-28">
          <SectionHead eyebrow="01 — The candle" title="Four prices, *one shape*" sub="Every candle answers the same four questions about its period: where did price start, how high and how low did it go, and where did it finish?" />
          <Reveal variant="scale">
            <CandleAnatomy />
          </Reveal>
        </div>
      </section>

      {/* 02 trend */}
      <section className="mx-auto max-w-7xl px-4 py-24 sm:px-6 sm:py-28">
        <SectionHead eyebrow="02 — Trend" title="Which way is *the staircase* going?" sub="Ignore single candles and look at the turning points. The order of the highs and lows tells you the trend." />
        <Reveal variant="stagger" step={130} className="grid gap-4 md:grid-cols-3">
          {TRENDS.map((t, n) => (
            <Spotlight key={t.name} className="card card-hover group overflow-hidden">
              <div className="relative border-b border-white/[0.05] bg-ink-900/40 p-4">
                <div className="bg-grid absolute inset-0 opacity-60" />
                <svg viewBox="0 0 216 150" className="relative w-full" fill="none">
                  <path d={t.path} stroke={t.color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" pathLength={1} className="draw" style={d(250 + n * 130)} />
                  {t.marks.map(([x, y, label], k) => {
                    const high = label === 'H' || label === 'HH' || label === 'LH';
                    return (
                      <g key={k} className="animate-page-in" style={{ animationDelay: `${900 + n * 130 + k * 140}ms` }}>
                        <circle cx={x} cy={y} r="3.5" fill="var(--color-paper)" stroke={t.color} strokeWidth="1.5" />
                        <text x={x} y={high ? y - 9 : y + 17} textAnchor="middle" className="fill-ink-200 font-mono text-[9px] font-bold">
                          {label}
                        </text>
                      </g>
                    );
                  })}
                </svg>
              </div>
              <div className="p-6">
                <h3 className="text-xl font-bold">{t.name}</h3>
                <p className="label mt-1.5" style={{ color: t.color }}>
                  {t.rule}
                </p>
                <p className="mt-3 text-sm leading-relaxed text-ink-400">{t.body}</p>
              </div>
            </Spotlight>
          ))}
        </Reveal>
      </section>

      {/* 03 levels */}
      <section className="relative border-y border-white/[0.06] bg-ink-900/40">
        <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-4 py-24 sm:px-6 sm:py-28 lg:grid-cols-[1fr_1.2fr]">
          <div>
            <SectionHead eyebrow="03 — Levels" title="Floors, ceilings and *the break*" className="mb-8" />
            <Reveal variant="stagger" step={110} className="space-y-5">
              {[
                ['Support', 'A price area where falls have stopped before. Buyers have shown up there, so traders watch it for them to show up again.', 'text-up'],
                ['Resistance', 'A price area where rises have stopped before. The more often it has held, the more attention it gets.', 'text-down'],
                ['Breakout', 'When price finally closes beyond a level. Old resistance often turns into new support, but false breaks are common, which is why stops exist.', 'text-volt'],
              ].map(([k, v, tone]) => (
                <div key={k} className="grid grid-cols-[112px_1fr] gap-4 border-t border-white/[0.07] pt-5">
                  <h3 className={cn('font-display text-xl font-bold', tone)}>{k}</h3>
                  <p className="text-sm leading-relaxed text-ink-400">{v}</p>
                </div>
              ))}
            </Reveal>
          </div>
          <Reveal variant="scale" className="card corners overflow-hidden p-5">
            <svg viewBox="0 0 480 260" className="w-full" fill="none" role="img" aria-label="Price moving between support and resistance, then breaking out">
              <rect x="0" y="66" width="480" height="14" fill="rgb(var(--down-rgb) / 0.1)" />
              <rect x="0" y="184" width="480" height="14" fill="rgb(var(--up-rgb) / 0.1)" />
              <path d="M0 73 H480" stroke="var(--color-down)" strokeDasharray="5 6" className="animate-dash" />
              <path d="M0 191 H480" stroke="var(--color-up)" strokeDasharray="5 6" className="animate-dash" />
              <text x="8" y="58" className="fill-down font-mono text-[10px] uppercase tracking-widest">
                Resistance
              </text>
              <text x="8" y="216" className="fill-up font-mono text-[10px] uppercase tracking-widest">
                Support
              </text>
              <path
                d="M0 150 L42 188 L88 78 L134 190 L182 76 L228 186 L276 80 L310 132 L348 58 L372 76 L412 30 L440 44 L472 14"
                stroke="url(#sr-line)"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                pathLength={1}
                className="edu-trace [animation-duration:7s]"
              />
              <defs>
                <linearGradient id="sr-line" x1="0" x2="480" gradientUnits="userSpaceOnUse">
                  <stop stopColor="var(--color-ink-300)" />
                  <stop offset="0.65" stopColor="var(--color-ink-100)" />
                  <stop offset="1" stopColor="var(--color-volt)" />
                </linearGradient>
              </defs>
              {[[42, 188], [134, 190], [228, 186]].map(([x, y]) => (
                <circle key={x} cx={x} cy={y} r="5" fill="none" stroke="var(--color-up)" strokeWidth="1.5" />
              ))}
              {[[88, 78], [182, 76], [276, 80]].map(([x, y]) => (
                <circle key={x} cx={x} cy={y} r="5" fill="none" stroke="var(--color-down)" strokeWidth="1.5" />
              ))}
              <circle cx="348" cy="62" r="13" stroke="var(--color-volt)" strokeWidth="1.5" className="origin-center animate-pulse-ring [transform-box:fill-box]" />
              <text x="366" y="104" className="fill-volt font-mono text-[10px] uppercase tracking-widest">
                Breakout
              </text>
              <text x="366" y="118" className="fill-ink-400 text-[10px]">
                then a retest from above
              </text>
            </svg>
            <p className="label mt-2 text-center">Illustrative shapes · not market data</p>
          </Reveal>
        </div>
      </section>

      {/* 04 patterns */}
      <section className="mx-auto max-w-7xl px-4 py-24 sm:px-6 sm:py-28">
        <SectionHead
          eyebrow="04 — Patterns"
          title="Shapes that *keep turning up*"
          sub="Patterns are shorthand for a tug of war that has played out many times. They describe a setup; they do not guarantee the ending."
        />
        <Reveal variant="stagger" step={100} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {PATTERNS.map((p, n) => (
            <Spotlight key={p.name} className="card card-hover group flex flex-col overflow-hidden">
              <div className="relative border-b border-white/[0.05] bg-ink-900/40 p-4">
                <svg viewBox="0 0 176 132" className="w-full" fill="none">
                  {p.level !== null && <path d={`M0 ${p.level} H176`} stroke="rgb(var(--tint) / 0.25)" strokeDasharray="3 5" />}
                  <path d={p.path} stroke={p.kind === 'Reversal' ? 'var(--color-down)' : 'var(--color-brand-400)'} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" pathLength={1} className="edu-trace" style={d(n * 500)} />
                </svg>
              </div>
              <div className="flex flex-1 flex-col p-6">
                <span className={cn('label', p.kind === 'Reversal' ? '!text-down' : '!text-brand-300')}>{p.kind}</span>
                <h3 className="mt-2 text-lg font-bold">{p.name}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-400">{p.body}</p>
              </div>
            </Spotlight>
          ))}
        </Reveal>
      </section>

      {/* 05 timeframes */}
      <section className="relative border-y border-white/[0.06] bg-ink-900/40">
        <div className="relative mx-auto max-w-7xl px-4 py-24 sm:px-6 sm:py-28">
          <SectionHead eyebrow="05 — Timeframes" title="Same market, *six zoom levels*" sub="The terminal draws six timeframes. A trend on one can be a pullback on the next one up, so check the larger picture before acting on the smaller." />
          <div className="grid items-center gap-8 lg:grid-cols-[1.1fr_1fr]">
            <Reveal variant="none" className="card corners p-6">
              <Zoom />
              <p className="mt-4 text-sm leading-relaxed text-ink-400">One daily candle and the six four-hour candles inside it: the same open, the same close, the same high and low, with more of the story visible.</p>
            </Reveal>
            <Reveal variant="stagger" step={70} className="grid grid-cols-2 gap-px overflow-hidden rounded-3xl border border-white/[0.07] bg-white/[0.07] sm:grid-cols-3 lg:grid-cols-2">
              {TIMEFRAMES.map(([k, name, use]) => (
                <div key={k} className="group bg-ink-950 p-5 transition-colors duration-500 hover:bg-ink-900">
                  <div className="font-mono text-2xl font-bold text-white transition-colors duration-300 group-hover:text-brand-300">{k}</div>
                  <div className="label mt-1">{name}</div>
                  <p className="mt-2 text-xs leading-relaxed text-ink-400">{use}</p>
                </div>
              ))}
            </Reveal>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pt-16 sm:px-6">
        <Reveal>
          <div className="card flex flex-col gap-3 border-dashed !border-gold/25 p-7 sm:flex-row sm:items-center sm:gap-6">
            <span className="label shrink-0 !text-gold">Keep in mind</span>
            <p className="text-sm leading-relaxed text-ink-300">
              Chart analysis describes probabilities, not certainties. Every level breaks eventually and every pattern fails some of the time. Past price behaviour is not a reliable indicator of future
              results.
            </p>
          </div>
        </Reveal>
      </section>

      <ToolStrip current="/chart-analysis" />
      <CtaBand title="Open a chart *and practise*" body="Open a free demo with $10,000 virtual funds and mark up live charts on six timeframes." secondary={{ href: '/platform', label: 'See the platform' }} />
    </>
  );
}
