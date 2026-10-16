import type { CSSProperties, ReactNode } from 'react';
import { Headset, Landmark, Lock, ShieldCheck, User, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { marketByCls } from '@/lib/markets';
import type { PublicSymbol } from '@/lib/server-api';
import { Marquee, Reveal, RotatingWords, Spotlight } from '@/components/motion';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function Tile({ className, title, body, children, icon }: { className?: string; title: string; body: string; children: ReactNode; icon: ReactNode }) {
  return (
    <Spotlight className={cn('card card-hover group flex flex-col overflow-hidden', className)}>
      <div className="relative flex min-h-[168px] flex-1 items-center justify-center overflow-hidden border-b border-white/[0.05] bg-ink-900/40">{children}</div>
      <div className="p-6">
        <h3 className="flex items-center gap-2.5 text-lg font-semibold">
          <span className="text-brand-400 transition-transform duration-500 ease-spring group-hover:-rotate-12 group-hover:scale-125">{icon}</span>
          {title}
        </h3>
        <p className="mt-2 text-sm leading-relaxed text-ink-400">{body}</p>
      </div>
    </Spotlight>
  );
}

/** "Why us" as a bento grid. Every tile carries its own looping illustration instead of a stock icon. */
export function Advantages({ symbols }: { symbols: PublicSymbol[] }) {
  const half = Math.ceil(symbols.length / 2);
  const chip = (s: PublicSymbol) => (
    <span
      key={s.id}
      style={{ '--c': marketByCls(s.assetClass)?.rgb ?? '15 23 42' } as CSSProperties}
      className="mx-1 inline-flex items-center gap-2 rounded-full border border-white/[0.07] bg-white/[0.04] px-3 py-1.5 font-mono text-[11px] text-ink-200"
    >
      <span className="h-1.5 w-1.5 rounded-full bg-[rgb(var(--c))]" />
      {s.id}
    </span>
  );

  return (
    <Reveal variant="stagger" step={90} className="grid gap-4 md:grid-cols-6">
      {/* execution: an order travelling click -> price -> fill */}
      <Tile
        className="md:col-span-4"
        icon={<Zap className="h-5 w-5" />}
        title="Fast execution"
        body="Market orders fill instantly at live bid/ask. No requotes, no dealing desk delays."
      >
        <div className="bg-grid absolute inset-0 opacity-70" />
        <svg viewBox="0 0 520 120" className="relative w-full max-w-2xl px-6" fill="none">
          <path d="M60 60 H460" stroke="rgb(var(--tint) / 0.12)" strokeWidth="1.5" strokeDasharray="4 8" className="animate-dash" />
          <path d="M60 60 H460" stroke="url(#exec-line)" strokeWidth="2" pathLength={1} className="draw" />
          <defs>
            <linearGradient id="exec-line" x1="60" x2="460" gradientUnits="userSpaceOnUse">
              <stop stopColor="var(--color-brand-400)" stopOpacity="0" />
              <stop offset="0.5" stopColor="var(--color-brand-400)" />
              <stop offset="1" stopColor="var(--color-volt)" />
            </linearGradient>
          </defs>
          {[
            [60, 'Order'],
            [260, 'Live bid / ask'],
            [460, 'Filled'],
          ].map(([cx, label], i) => (
            <g key={label}>
              <circle cx={cx} cy="60" r="16" fill="var(--color-paper)" stroke={i === 2 ? 'var(--color-volt)' : 'rgb(var(--tint) / 0.2)'} strokeWidth="1.5" />
              <circle cx={cx} cy="60" r="4" fill={i === 2 ? 'var(--color-volt)' : 'var(--color-brand-400)'} />
              <text x={cx} y="102" textAnchor="middle" className="fill-ink-400 font-mono text-[10px] uppercase tracking-widest">
                {label}
              </text>
            </g>
          ))}
          <circle r="6" fill="var(--color-white)" filter="drop-shadow(0 0 8px var(--color-brand-400))">
            <animateMotion dur="1.8s" repeatCount="indefinite" path="M60 60 H460" keyTimes="0;0.7;1" keyPoints="0;1;1" calcMode="spline" keySplines="0.6 0 0.2 1;0 0 1 1" />
            <animate attributeName="opacity" dur="1.8s" repeatCount="indefinite" values="0;1;1;0" keyTimes="0;0.1;0.7;0.85" />
          </circle>
        </svg>
      </Tile>

      {/* protection: shield with sonar rings, loss bar that stops at zero */}
      <Tile
        className="md:col-span-2"
        icon={<ShieldCheck className="h-5 w-5" />}
        title="Negative balance protection"
        body="You can never lose more than your account balance. Stop-out keeps you protected."
      >
        <div className="relative flex h-20 w-20 items-center justify-center">
          <span className="absolute inset-0 animate-pulse-ring rounded-full border border-brand-400/50" />
          <span className="absolute inset-0 animate-pulse-ring rounded-full border border-brand-400/50 [animation-delay:0.9s]" />
          <span className="absolute inset-0 animate-pulse-ring rounded-full border border-brand-400/50 [animation-delay:1.8s]" />
          <span className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-b from-brand-300 to-brand-600 text-ink-950 shadow-glow transition-transform duration-700 ease-spring group-hover:scale-110">
            <ShieldCheck className="h-8 w-8" />
          </span>
        </div>
        <span className="label absolute bottom-3 left-1/2 -translate-x-1/2 whitespace-nowrap">balance floor · $0.00</span>
      </Tile>

      {/* hours: which days each market trades */}
      <Tile className="md:col-span-2" icon={<ClockGlyph />} title="24/5 markets, 24/7 crypto" body="Trade FX around the clock during the week and crypto every day of the year.">
        <div className="w-full max-w-[280px] space-y-3 px-6">
          {[
            ['FX', 5, 'bg-brand-400'],
            ['Crypto', 7, 'bg-volt'],
          ].map(([name, open, color], row) => (
            <div key={name as string} className="grid grid-cols-[52px_1fr] items-center gap-2">
              <span className="label">{name}</span>
              <div className="grid grid-cols-7 gap-1">
                {DAYS.map((d, i) => (
                  <span
                    key={d}
                    style={{ '--d': `${200 + row * 250 + i * 70}ms` } as CSSProperties}
                    className={cn('grow-y h-7 rounded-md', i < (open as number) ? (color as string) : 'bg-white/[0.06]')}
                  />
                ))}
              </div>
            </div>
          ))}
          <div className="grid grid-cols-[52px_1fr] gap-2">
            <span />
            <div className="grid grid-cols-7 gap-1 text-center font-mono text-[9px] uppercase text-ink-500">
              {DAYS.map((d) => (
                <span key={d}>{d[0]}</span>
              ))}
            </div>
          </div>
        </div>
      </Tile>

      {/* breadth: the real symbol list, drifting both ways */}
      <Tile className="md:col-span-2" icon={<GridGlyph />} title="250+ instruments" body="Forex majors and minors, indices, commodities, global shares, crypto and precious metals.">
        <div className="w-full space-y-2.5">
          <Marquee duration={38} pauseOnHover={false}>
            {symbols.slice(0, half).map(chip)}
          </Marquee>
          <Marquee duration={44} reverse pauseOnHover={false}>
            {symbols.slice(half).map(chip)}
          </Marquee>
        </div>
      </Tile>

      {/* support: a greeting that keeps changing language */}
      <Tile className="md:col-span-2" icon={<Headset className="h-5 w-5" />} title="Multilingual support" body="Real people, via chat, email and phone. Dedicated managers from Gold tier.">
        <div className="w-full max-w-[260px] space-y-2.5 px-6">
          <div className="flex items-end gap-2">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-400/15 text-brand-300">
              <Headset className="h-3.5 w-3.5" />
            </span>
            <div className="rounded-2xl rounded-bl-md bg-white/[0.07] px-4 py-2.5 text-sm">
              <RotatingWords words={['Hello!', 'مرحبا!', '¡Hola!', 'Bonjour !', '你好!', 'Olá!', 'नमस्ते!']} className="font-medium text-white" />
            </div>
          </div>
          <div className="flex items-end justify-end gap-2">
            <div className="flex items-center gap-1 rounded-2xl rounded-br-md bg-brand-400/15 px-4 py-3">
              {[0, 1, 2].map((i) => (
                <span key={i} className="h-1.5 w-1.5 animate-bounce rounded-full bg-brand-300" style={{ animationDelay: `${i * 0.15}s` }} />
              ))}
            </div>
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/[0.07] text-ink-300">
              <User className="h-3.5 w-3.5" />
            </span>
          </div>
        </div>
      </Tile>

      {/* segregation: two vaults that never touch */}
      <Spotlight className="card card-hover group grid items-center gap-6 overflow-hidden p-6 md:col-span-6 md:grid-cols-[1fr_1.2fr]">
        <div>
          <h3 className="flex items-center gap-2.5 text-lg font-semibold">
            <Landmark className="h-5 w-5 text-brand-400 transition-transform duration-500 ease-spring group-hover:-rotate-12 group-hover:scale-125" />
            Segregated funds
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-ink-400">Client money is held separately from the company&apos;s operating funds, and negative-balance protection means you never owe more than your balance.</p>
        </div>
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
          <div className="rounded-xl border border-brand-400/25 bg-brand-400/[0.07] p-4">
            <div className="label !text-brand-300">Client funds</div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/[0.06]">
              <div className="grow-x h-full rounded-full bg-gradient-to-r from-brand-500 to-brand-300" style={{ '--d': '300ms' } as CSSProperties} />
            </div>
          </div>
          <div className="flex flex-col items-center gap-1.5">
            <span className="h-5 w-px bg-gradient-to-b from-transparent to-white/25" />
            <span className="flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-ink-900 text-ink-200 transition-all duration-500 group-hover:border-brand-400/50 group-hover:text-brand-300">
              <Lock className="h-4 w-4" />
            </span>
            <span className="h-5 w-px bg-gradient-to-t from-transparent to-white/25" />
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <div className="label">Company funds</div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/[0.06]">
              <div className="grow-x h-full w-3/5 rounded-full bg-ink-500" style={{ '--d': '450ms' } as CSSProperties} />
            </div>
          </div>
        </div>
      </Spotlight>
    </Reveal>
  );
}

function ClockGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5" />
      <path d="M12 12l3.5 2" className="origin-center animate-spin-slow [animation-duration:6s]" />
    </svg>
  );
}

function GridGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
      <rect x="3" y="3" width="7.5" height="7.5" rx="2" />
      <rect x="13.5" y="3" width="7.5" height="7.5" rx="2" opacity="0.55" />
      <rect x="3" y="13.5" width="7.5" height="7.5" rx="2" opacity="0.55" />
      <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="2" opacity="0.3" />
    </svg>
  );
}
