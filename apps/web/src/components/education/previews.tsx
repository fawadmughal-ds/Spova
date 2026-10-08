import type { CSSProperties } from 'react';
import { ArrowDown, ArrowUp, Play } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MARKET_LIST } from '@/lib/markets';
import { Bar } from '@/components/education/shared';

/* Mocks for tools whose feed is not connected. They show layout only: no dates, prices, headlines or results. */

const i = (n: number) => ({ '--i': n }) as CSSProperties;

// ---------------------------------------------------------------- economic calendar
const EVENT_TYPES: [label: string, impact: number][] = [
  ['Central bank rate decision', 3],
  ['Inflation release', 3],
  ['Employment report', 3],
  ['GDP estimate', 2],
  ['PMI survey', 2],
  ['Retail sales', 1],
  ['Consumer confidence', 1],
];

export function CalendarPreview() {
  return (
    <div>
      <div className="grid grid-cols-5 gap-1.5">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].map((d, n) => (
          <span key={d} className={cn('rounded-lg py-2 text-center font-mono text-[10px] uppercase tracking-[0.14em]', n === 2 ? 'bg-brand-400/15 text-brand-300 ring-1 ring-inset ring-brand-400/30' : 'bg-white/[0.04] text-ink-400')}>
            {d}
          </span>
        ))}
      </div>
      <div className="mt-3 grid grid-cols-[44px_36px_1fr_repeat(3,34px)] items-center gap-x-3 px-1 pb-2">
        {['Time', 'Ccy', 'Event', 'Act', 'Fcst', 'Prev'].map((h) => (
          <span key={h} className="label !text-[9px]">
            {h}
          </span>
        ))}
      </div>
      <div className="relative">
        <span className="edu-scan absolute inset-x-0 top-0 z-10 h-px bg-gradient-to-r from-transparent via-brand-300 to-transparent shadow-[0_0_14px_2px_rgb(var(--brand-rgb)/0.6)]" style={{ '--scan': '270px' } as CSSProperties} />
        {EVENT_TYPES.map(([label, impact], n) => (
          <div key={label} className="animate-page-in grid grid-cols-[44px_36px_1fr_repeat(3,34px)] items-center gap-x-3 border-t border-white/[0.05] px-1 py-2.5" style={{ animationDelay: `${300 + n * 70}ms` }}>
            <Bar w="w-8" />
            <span className="rounded bg-white/[0.06] py-0.5 text-center font-mono text-[9px] text-ink-500">CCY</span>
            <span className="flex min-w-0 items-center gap-2.5">
              <span className="flex shrink-0 gap-0.5">
                {[1, 2, 3].map((d) => (
                  <span key={d} className={cn('h-1.5 w-1.5 rounded-full', d <= impact ? (impact === 3 ? 'bg-down' : impact === 2 ? 'bg-gold' : 'bg-ink-400') : 'bg-white/10')} />
                ))}
              </span>
              <span className="truncate text-xs text-ink-200">{label}</span>
            </span>
            <Bar />
            <Bar />
            <Bar />
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- signals
export function SignalsPreview() {
  return (
    <div className="grid grid-cols-2 gap-3">
      {[0, 1, 2, 3].map((n) => {
        const Up = n % 2 === 0;
        return (
          <div key={n} className="edu-glow rounded-2xl border border-white/[0.075] bg-white/[0.03] p-4" style={i(n)}>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <span className="h-7 w-7 rounded-lg bg-white/[0.07]" />
                <span className="space-y-1.5">
                  <Bar w="w-14" className="bg-white/[0.16]" />
                  <Bar w="w-9" />
                </span>
              </span>
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/[0.06] text-ink-400">{Up ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />}</span>
            </div>
            <dl className="mt-4 space-y-2.5">
              {['Entry', 'Target', 'Stop'].map((k) => (
                <div key={k} className="flex items-center justify-between gap-3">
                  <dt className="label !text-[9px]">{k}</dt>
                  <dd className="w-16">
                    <Bar />
                  </dd>
                </div>
              ))}
            </dl>
            <div className="mt-4 flex gap-1">
              {[0, 1, 2, 3, 4].map((s) => (
                <span key={s} className="animate-candle h-3 flex-1 origin-bottom rounded-sm bg-white/[0.12]" style={{ animationDelay: `${(n + s) * 0.18}s`, animationDuration: '2.4s' }} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------- ebooks
const SPINES: [topic: string, height: number, rgb: string][] = [
  ['CFD basics', 190, '37 99 235'],
  ['Order types', 160, '2 132 199'],
  ['Reading charts', 205, '124 58 237'],
  ['Managing risk', 175, '173 108 7'],
  ['Market drivers', 195, '211 78 9'],
  ['Trading routine', 150, '15 118 110'],
];

export function BookshelfPreview() {
  return (
    <div>
      <div className="flex h-56 items-end justify-center gap-2.5 px-2">
        {SPINES.map(([topic, h, rgb], n) => (
          <div
            key={topic}
            className="edu-book relative flex w-11 items-center justify-center rounded-t-md rounded-b-sm border border-white/10 sm:w-12"
            style={{ ...i(n), height: h, background: `linear-gradient(90deg, rgb(${rgb} / 0.28), rgb(${rgb} / 0.1) 30%, rgb(${rgb} / 0.2))` }}
          >
            <span className="absolute inset-x-1.5 top-3 h-px bg-white/25" />
            <span className="absolute inset-x-1.5 bottom-3 h-px bg-white/25" />
            <span className="whitespace-nowrap font-mono text-[10px] uppercase tracking-[0.14em] text-white/80 [writing-mode:vertical-rl]">{topic}</span>
          </div>
        ))}
      </div>
      <div className="h-2 rounded-sm bg-gradient-to-b from-white/20 to-white/5" />
      <div className="mt-4 flex items-center justify-between">
        <span className="label">Planned topics</span>
        <span className="label !text-gold">In preparation</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- videos
export function VideoWallPreview() {
  return (
    <div className="grid grid-cols-3 gap-2.5">
      <div className="relative col-span-2 row-span-2 flex min-h-[11rem] flex-col justify-between overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-brand-400/15 via-ink-800 to-iris/15 p-4">
        <div className="flex items-center justify-between">
          <span className="rounded-full bg-black/40 px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.14em] text-ink-200">Session recap</span>
          <span className="flex h-4 items-end gap-[3px] text-brand-300">
            {[0, 1, 2, 3].map((b) => (
              <span key={b} className="animate-candle h-full w-[3px] origin-bottom rounded-full bg-current" style={{ animationDelay: `${b * 0.15}s` }} />
            ))}
          </span>
        </div>
        <span className="relative mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur">
          <span className="absolute inset-0 animate-pulse-ring rounded-full border border-white/40" />
          <Play className="h-6 w-6 translate-x-0.5 fill-current" />
        </span>
        <div>
          <div className="h-1 overflow-hidden rounded-full bg-white/15">
            <div className="edu-progress h-full rounded-full bg-brand-400" />
          </div>
          <div className="mt-2 flex justify-between font-mono text-[9px] text-ink-400">
            <span>--:--</span>
            <span>--:--</span>
          </div>
        </div>
      </div>
      {[0, 1, 2, 3, 4].map((n) => (
        <div key={n} className={cn('animate-page-in overflow-hidden rounded-xl border border-white/[0.07] bg-white/[0.03]', n > 1 && 'col-span-1')} style={{ animationDelay: `${400 + n * 90}ms` }}>
          <div className="flex aspect-video items-center justify-center bg-gradient-to-br from-white/[0.07] to-transparent text-ink-400">
            <Play className="h-4 w-4 fill-current" />
          </div>
          <div className="space-y-1.5 p-2.5">
            <Bar className="bg-white/[0.14]" />
            <Bar w="w-2/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------- news
export function NewsWirePreview() {
  const rows = [...MARKET_LIST, ...MARKET_LIST.slice(0, 2)];
  const list = (copy: number) =>
    rows.map((m, n) => (
      <div key={`${copy}-${n}`} className="flex items-center gap-3 border-b border-white/[0.05] py-3.5" style={{ '--c': m.rgb } as CSSProperties}>
        <span className="w-24 shrink-0 rounded-md bg-[rgb(var(--c)/0.1)] py-1 text-center font-mono text-[9px] uppercase tracking-[0.12em] text-[rgb(var(--c))]">{m.label}</span>
        <span className="min-w-0 flex-1 space-y-1.5">
          <Bar className="bg-white/[0.14]" w={n % 3 === 0 ? 'w-11/12' : n % 3 === 1 ? 'w-4/5' : 'w-full'} />
          <Bar w={n % 2 ? 'w-1/2' : 'w-2/3'} />
        </span>
        <Bar w="w-8" className="shrink-0" />
      </div>
    ));
  return (
    <div>
      <div className="flex items-center justify-between rounded-lg bg-white/[0.04] px-3 py-2 font-mono text-[11px] text-ink-300">
        <span>
          wire &gt; awaiting feed<span className="animate-blink">_</span>
        </span>
        <span className="label !text-[9px]">By asset class</span>
      </div>
      <div className="relative mt-2 h-72 overflow-hidden [mask-image:linear-gradient(to_bottom,transparent,black_12%,black_88%,transparent)]">
        <div className="edu-wire">
          {list(0)}
          {list(1)}
        </div>
      </div>
    </div>
  );
}
