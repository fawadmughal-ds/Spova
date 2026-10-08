'use client';

import { useEffect, useState, type CSSProperties } from 'react';
import { cn } from '@/lib/utils';

/* Teaching figures for /chart-analysis. Every series here is a hand-drawn shape, not market data. */

const UP = 'var(--color-up)';
const DOWN = 'var(--color-down)';

// [open, high, low, close] on a 0-100 scale
const SERIES: [number, number, number, number][] = [
  [40, 52, 36, 48],
  [48, 58, 44, 55],
  [55, 60, 46, 50],
  [50, 54, 38, 42],
  [42, 50, 40, 49],
  [49, 66, 47, 63],
  [63, 70, 58, 60],
  [60, 64, 50, 53],
  [53, 62, 51, 60],
  [60, 76, 58, 72],
  [72, 80, 66, 69],
  [69, 86, 67, 82],
];
const X = (n: number) => 22 + n * 27;
const Y = (v: number) => 150 - v * 1.5;

const TYPES = [
  { key: 'Line', body: 'Joins one closing price to the next. The cleanest view of direction, with the least detail.' },
  { key: 'Bars', body: 'A vertical bar from low to high, a tick on the left for the open and one on the right for the close.' },
  { key: 'Candles', body: 'The same four prices as a bar, with the open-to-close range filled in so the direction of each period is obvious.' },
] as const;

/** Hero figure: one set of prices drawn three ways. Cycles on its own until the reader picks a tab. */
export function ChartTypeSwitcher() {
  const [type, setType] = useState(2);
  const [auto, setAuto] = useState(true);

  useEffect(() => {
    if (!auto || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const t = setInterval(() => setType((v) => (v + 1) % TYPES.length), 3600);
    return () => clearInterval(t);
  }, [auto]);

  return (
    <div className="relative mx-auto max-w-lg">
      <div className="absolute -inset-8 -z-10 rounded-[3rem] bg-brand-500/15 blur-3xl" />
      <div className="beam glass overflow-hidden rounded-3xl shadow-lift">
        <div className="flex items-center justify-between border-b border-white/[0.06] p-2">
          <div className="flex rounded-xl bg-white/[0.04] p-1">
            {TYPES.map((t, n) => (
              <button
                key={t.key}
                onClick={() => {
                  setType(n);
                  setAuto(false);
                }}
                className={cn('rounded-lg px-4 py-1.5 font-mono text-[11px] uppercase tracking-[0.12em] transition-all duration-300', n === type ? 'bg-white text-ink-950' : 'text-ink-400 hover:text-white')}
              >
                {t.key}
              </button>
            ))}
          </div>
          <span className="label mr-3 hidden sm:block">Same prices · three views</span>
        </div>

        <svg viewBox="0 0 340 170" className="w-full px-2 pt-3" fill="none">
          {[30, 75, 120].map((y) => (
            <path key={y} d={`M0 ${y} H340`} stroke="rgb(var(--tint) / 0.05)" />
          ))}
          <g key={type} className="animate-page-in">
            {type === 0 && (
              <>
                <path d={`M${SERIES.map((c, n) => `${X(n)} ${Y(c[3])}`).join(' L')} L${X(11)} 170 L${X(0)} 170 Z`} fill="url(#ct-fill)" />
                <path d={`M${SERIES.map((c, n) => `${X(n)} ${Y(c[3])}`).join(' L')}`} stroke="var(--color-brand-400)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" pathLength={1} className="edu-trace [animation-iteration-count:1]" />
              </>
            )}
            {type > 0 &&
              SERIES.map(([o, h, l, c], n) => {
                const col = c >= o ? UP : DOWN;
                return type === 1 ? (
                  <path key={n} d={`M${X(n)} ${Y(h)} V${Y(l)} M${X(n) - 7} ${Y(o)} H${X(n)} M${X(n)} ${Y(c)} H${X(n) + 7}`} stroke={col} strokeWidth="2" strokeLinecap="round" />
                ) : (
                  <g key={n}>
                    <path d={`M${X(n)} ${Y(h)} V${Y(l)}`} stroke={col} strokeWidth="1.5" />
                    <rect x={X(n) - 7} y={Y(Math.max(o, c))} width="14" height={Math.max(2, Math.abs(Y(o) - Y(c)))} rx="2" fill={col} />
                  </g>
                );
              })}
          </g>
          <defs>
            <linearGradient id="ct-fill" x1="0" y1="0" x2="0" y2="1">
              <stop stopColor="var(--color-brand-400)" stopOpacity="0.22" />
              <stop offset="1" stopColor="var(--color-brand-400)" stopOpacity="0" />
            </linearGradient>
          </defs>
        </svg>

        <div className="border-t border-white/[0.06] p-5">
          <p key={type} className="animate-pop-in min-h-[3.5rem] text-sm leading-relaxed text-ink-300">
            <span className="font-semibold text-white">{TYPES[type].key}. </span>
            {TYPES[type].body}
          </p>
        </div>
      </div>
      <p className="label mt-4 text-center">Illustrative shapes · not market data</p>
    </div>
  );
}

/** One large candle with its four prices labelled; flips between a rising and a falling period. */
export function CandleAnatomy() {
  const [bull, setBull] = useState(true);
  const col = bull ? UP : DOWN;
  const labels = [
    { y: 28, name: 'High', note: 'The highest price reached in the period' },
    { y: 86, name: bull ? 'Close' : 'Open', note: bull ? 'Where the period ended' : 'Where the period started' },
    { y: 214, name: bull ? 'Open' : 'Close', note: bull ? 'Where the period started' : 'Where the period ended' },
    { y: 272, name: 'Low', note: 'The lowest price reached in the period' },
  ];
  return (
    <div className="card corners grid items-center gap-8 overflow-hidden p-6 sm:p-10 lg:grid-cols-[1fr_1.1fr]">
      <div>
        <div className="inline-flex rounded-xl bg-white/[0.04] p-1">
          {[true, false].map((b) => (
            <button
              key={String(b)}
              onClick={() => setBull(b)}
              aria-pressed={bull === b}
              className={cn(
                'rounded-lg px-5 py-2 text-sm font-medium transition-all duration-300',
                bull === b ? (b ? 'bg-up text-ink-950 shadow-[0_8px_30px_-8px_rgb(var(--up-rgb)/0.8)]' : 'bg-down text-paper shadow-[0_8px_30px_-8px_rgb(var(--down-rgb)/0.8)]') : 'text-ink-400 hover:text-white',
              )}
            >
              {b ? 'Rising period' : 'Falling period'}
            </button>
          ))}
        </div>
        <h3 className="mt-7 font-display text-3xl font-bold tracking-tight">
          {bull ? 'Closed above its open' : 'Closed below its open'}
        </h3>
        <p className="mt-3 max-w-md text-sm leading-relaxed text-ink-400">
          The thick <strong className="text-white">body</strong> spans the open and the close. The thin <strong className="text-white">wicks</strong> show how far price travelled beyond them before coming
          back. A long wick means a move was rejected; a long body means one side stayed in control.
        </p>
        <dl className="mt-7 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.07]">
          {[
            ['Body', 'Open to close'],
            ['Upper wick', 'Close or open up to the high'],
            ['Lower wick', 'Open or close down to the low'],
            ['Colour', bull ? 'Green: finished higher' : 'Red: finished lower'],
          ].map(([k, v]) => (
            <div key={k} className="bg-ink-950 p-4">
              <dt className="label">{k}</dt>
              <dd className="mt-1 text-sm text-ink-200">{v}</dd>
            </div>
          ))}
        </dl>
      </div>

      <svg viewBox="0 0 430 300" className="mx-auto w-full max-w-lg" fill="none" role="img" aria-label={`Anatomy of a ${bull ? 'rising' : 'falling'} candle`}>
        <path d="M110 28 V272" stroke={col} strokeWidth="3" strokeLinecap="round" className="transition-[stroke] duration-500" />
        <rect x="74" y="86" width="72" height="128" rx="8" fill={col} className="transition-[fill] duration-500" />
        <rect x="74" y="86" width="72" height="128" rx="8" fill="url(#ca-sheen)" />
        <defs>
          <linearGradient id="ca-sheen" x1="0" x2="1">
            <stop stopColor="var(--color-white)" stopOpacity="0.25" />
            <stop offset="0.5" stopColor="var(--color-white)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {/* direction arrow inside the body */}
        <path key={String(bull)} d={bull ? 'M110 190 V112 M98 126 L110 112 L122 126' : 'M110 112 V190 M98 176 L110 190 L122 176'} stroke="var(--color-paper)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="animate-pop-in" />
        {labels.map((l, n) => (
          <g key={`${l.name}-${n}`} className="animate-page-in" style={{ animationDelay: `${n * 90}ms` } as CSSProperties}>
            <path d={`M${n === 0 || n === 3 ? 118 : 152} ${l.y} H196`} stroke="rgb(var(--tint) / 0.3)" strokeDasharray="3 4" />
            <circle cx={n === 0 || n === 3 ? 110 : 146} cy={l.y} r="4" fill="var(--color-white)" />
            <text x="204" y={l.y - 2} className="fill-white font-display text-[17px] font-bold">
              {l.name}
            </text>
            <text x="204" y={l.y + 13} className="fill-ink-400 text-[10px]">
              {l.note}
            </text>
          </g>
        ))}
        {/* body bracket */}
        <path d="M56 86 V214 M50 86 H62 M50 214 H62" stroke="rgb(var(--tint) / 0.35)" />
        <text x="44" y="154" textAnchor="end" className="fill-ink-300 font-mono text-[10px] uppercase tracking-widest">
          Body
        </text>
      </svg>
    </div>
  );
}
