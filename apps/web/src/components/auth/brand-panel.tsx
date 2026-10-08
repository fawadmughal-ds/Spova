import Link from 'next/link';
import type { CSSProperties } from 'react';
import { MARKET_LIST, type MarketMeta } from '@/lib/markets';
import { Logo, Wordmark } from '@/components/logo';
import { CountUp, Reveal, RotatingWords, Words } from '@/components/motion';

const OUTER = MARKET_LIST.filter((_, i) => i % 2 === 0);
const INNER = MARKET_LIST.filter((_, i) => i % 2 === 1);

/** One ring of the orbit, sized as a fraction of --orbit. The ring spins; every chip counter-spins so its icon stays upright. */
function Ring({ markets, size, duration, reverse, phase = 0 }: { markets: MarketMeta[]; size: number; duration: number; reverse?: boolean; phase?: number }) {
  const spin = (dir: 'normal' | 'reverse'): CSSProperties => ({ animation: `orbit ${duration}s linear infinite`, animationDirection: dir });
  const pct = `${size * 100}%`;
  return (
    <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2" style={{ width: pct, height: pct }}>
      <div className="absolute inset-0 rounded-full border border-dashed border-white/[0.09]" />
      <div className="absolute inset-0" style={spin(reverse ? 'reverse' : 'normal')}>
        {markets.map((m, i) => {
          const angle = phase + (360 / markets.length) * i;
          return (
            <div key={m.slug} className="absolute left-1/2 top-1/2 h-0 w-0" style={{ transform: `rotate(${angle}deg) translateX(calc(var(--orbit) * ${size / 2})) rotate(${-angle}deg)` }}>
              <div style={spin(reverse ? 'normal' : 'reverse')}>
                <div
                  style={{ '--c': m.rgb } as CSSProperties}
                  className="glass flex -translate-x-1/2 -translate-y-1/2 items-center gap-2 whitespace-nowrap rounded-full py-1.5 pl-1.5 pr-3.5 shadow-lift"
                >
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[rgb(var(--c)/0.14)] text-[rgb(var(--c))] ring-1 ring-inset ring-[rgb(var(--c)/0.3)]">
                    <m.icon className="h-3.5 w-3.5" />
                  </span>
                  <span className="text-xs font-medium text-ink-100">{m.label}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Left half of every auth screen: the account at the centre, six asset classes in orbit around it. */
export function BrandPanel() {
  return (
    <aside className="noise relative hidden overflow-hidden border-r border-white/[0.06] bg-ink-900 lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col">
      <div className="bg-grid absolute inset-0" />
      <div className="aurora-blob -left-32 -top-40 h-[460px] w-[520px] bg-brand-500/20" />
      <div className="aurora-blob -bottom-48 right-[-20%] h-[440px] w-[520px] bg-iris/20 [animation-delay:-9s]" />

      <div className="relative flex items-center justify-between px-10 pt-9 xl:px-12">
        <Link href="/" aria-label="Home" className="animate-page-in">
          <Wordmark />
        </Link>
        <span className="animate-page-in inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-400" style={{ animationDelay: '120ms' }}>
          <span className="live-dot text-brand-400" /> Demo accounts open
        </span>
      </div>

      {/* orbit */}
      <Reveal
        variant="scale"
        delay={150}
        className="relative mx-auto my-auto h-[var(--orbit)] w-[var(--orbit)] shrink-0"
        style={{ '--orbit': 'clamp(210px, 37vh, 440px)' } as CSSProperties}
      >
        <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle,rgb(var(--brand-rgb)/0.12),transparent_62%)]" />
        <Ring markets={OUTER} size={1} duration={46} />
        <Ring markets={INNER} size={0.62} duration={46} phase={60} />
        <div className="absolute left-1/2 top-1/2 flex h-[calc(var(--orbit)*0.24)] w-[calc(var(--orbit)*0.24)] -translate-x-1/2 -translate-y-1/2 items-center justify-center">
          <span className="absolute inset-0 animate-pulse-ring rounded-full border border-brand-400/50" />
          <span className="absolute inset-0 animate-pulse-ring rounded-full border border-brand-400/50 [animation-delay:1.3s]" />
          <span className="beam glass relative flex h-[84%] w-[84%] items-center justify-center rounded-[28%] shadow-glow">
            <Logo size={44} className="h-[55%] w-[55%]" />
          </span>
        </div>
      </Reveal>

      <div className="relative px-10 pb-8 pt-4 xl:px-12">
        <Reveal variant="none">
          <h2 className="font-display text-5xl font-extrabold leading-[0.95] tracking-tighter">
            <Words text="One account. *Every market.*" delay={250} />
          </h2>
          <Reveal delay={700}>
            <p className="mt-4 max-w-md text-ink-300 [@media(max-height:760px)]:hidden">
              Live pricing and instant execution across{' '}
              <RotatingWords words={MARKET_LIST.map((m) => m.label)} interval={1900} className="font-serif text-xl italic leading-none text-brand-300" />
            </p>
          </Reveal>
        </Reveal>

        <Reveal as="dl" variant="stagger" delay={850} step={110} className="mt-7 grid grid-cols-3 gap-3">
          {[
            { label: 'Demo funds', node: <CountUp to={10000} prefix="$" /> },
            { label: 'Leverage', node: <CountUp to={400} prefix="1:" /> },
            { label: 'Crypto', node: '24/7' },
          ].map((s) => (
            <div key={s.label} className="card corners px-4 py-3.5">
              <dt className="tabular font-display text-2xl font-bold tracking-tight">{s.node}</dt>
              <dd className="label mt-1">{s.label}</dd>
            </div>
          ))}
        </Reveal>

        <p className="mt-6 text-xs leading-relaxed text-ink-500">CFDs are complex instruments and come with a high risk of losing money rapidly due to leverage.</p>
      </div>
    </aside>
  );
}
