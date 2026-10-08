import type { CSSProperties, ReactNode } from 'react';
import { ArrowLeftRight, Bitcoin } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { PublicSymbol } from '@/lib/server-api';

/** One looping hero illustration per asset class. All of them tint from the page's `--c` accent. CSS/SVG only. */
export function MarketMotif({ cls, symbols }: { cls: string; symbols: PublicSymbol[] }) {
  const ids = symbols.map((s) => s.id);
  return (
    <div className="relative mx-auto h-[330px] w-full max-w-[460px] sm:h-[460px]" aria-hidden>
      {/* 460px design canvas, scaled down on phones */}
      <div className="absolute left-1/2 top-1/2 h-[460px] w-[460px] -translate-x-1/2 -translate-y-1/2 scale-[0.7] sm:scale-100">
        <div className="absolute inset-8 rounded-full bg-[rgb(var(--c)/0.14)] blur-3xl" />
        {cls === 'forex' && <ForexOrbit />}
        {cls === 'index' && <IndexSkyline ids={ids} />}
        {cls === 'commodity' && <CommodityDrop ids={ids} />}
        {cls === 'stock' && <ShareFan symbols={symbols} />}
        {cls === 'crypto' && <CryptoHive ids={ids} />}
        {cls === 'metal' && <MetalTiles ids={ids} />}
      </div>
    </div>
  );
}

const vars = (v: Record<string, string | number>) => v as CSSProperties;

function Chip({ children, className, style }: { children: ReactNode; className?: string; style?: CSSProperties }) {
  return (
    <span style={style} className={cn('glass inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 font-mono text-[11px] font-semibold text-white shadow-lift', className)}>
      <span className="h-1.5 w-1.5 rounded-full bg-[rgb(var(--c))]" />
      {children}
    </span>
  );
}

// ---------------------------------------------------------------- forex: currencies in orbit
const RINGS = [
  { r: 88, dur: 26, rev: false, codes: ['EUR', 'USD'] },
  { r: 150, dur: 42, rev: true, codes: ['GBP', 'JPY', 'AUD'] },
  { r: 212, dur: 64, rev: false, codes: ['CHF', 'CAD', 'NZD'] },
];

function ForexOrbit() {
  return (
    <>
      {RINGS.map((ring, k) => (
        <div
          key={ring.r}
          className="absolute left-1/2 top-1/2 rounded-full border border-dashed border-[rgb(var(--c)/0.22)]"
          style={{ width: ring.r * 2, height: ring.r * 2, marginLeft: -ring.r, marginTop: -ring.r }}
        >
          <div className={cn('absolute inset-0', ring.rev ? 'orbit-rev' : 'orbit')} style={vars({ '--orbit-dur': `${ring.dur}s` })}>
            {ring.codes.map((code, i) => {
              const a = (360 / ring.codes.length) * i + k * 40;
              return (
                <div key={code} className="absolute left-1/2 top-1/2 h-0 w-0" style={{ transform: `rotate(${a}deg) translateX(${ring.r}px)` }}>
                  <div style={{ transform: `rotate(${-a}deg)` }}>
                    {/* counter-spin keeps the label upright */}
                    <div className={ring.rev ? 'orbit' : 'orbit-rev'} style={vars({ '--orbit-dur': `${ring.dur}s` })}>
                      <Chip className="-translate-x-1/2 -translate-y-1/2">{code}</Chip>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
      <div className="absolute left-1/2 top-1/2 flex h-24 w-24 -translate-x-1/2 -translate-y-1/2 items-center justify-center">
        <span className="absolute inset-0 animate-pulse-ring rounded-full border border-[rgb(var(--c)/0.6)]" />
        <span className="absolute inset-0 animate-pulse-ring rounded-full border border-[rgb(var(--c)/0.6)] [animation-delay:1.3s]" />
        <span className="relative flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-b from-brand-300 to-brand-600 text-ink-950 shadow-glow">
          <ArrowLeftRight className="h-8 w-8" />
        </span>
      </div>
    </>
  );
}

// ---------------------------------------------------------------- indices: a skyline of breathing bars
const BARS = [34, 46, 40, 58, 52, 70, 62, 78, 66, 88, 74, 96, 84, 100];

function IndexSkyline({ ids }: { ids: string[] }) {
  const step = 396 / BARS.length;
  const line = BARS.map((h, i) => `${i ? 'L' : 'M'}${32 + step * i + step / 2 - 3} ${392 - h * 3 - 22}`).join(' ');
  return (
    <>
      <div className="absolute inset-x-8 bottom-[68px] top-10 flex items-end gap-[6px]">
        {BARS.map((h, i) => (
          <div key={i} className="grow-y flex h-full flex-1 items-end" style={vars({ '--d': `${200 + i * 70}ms` })}>
            <div
              className="bar-breathe w-full rounded-t-md bg-gradient-to-t from-[rgb(var(--c)/0.08)] to-[rgb(var(--c)/0.85)]"
              style={vars({ height: `${h}%`, '--dur': `${2.6 + (i % 5) * 0.5}s`, '--s': 0.86 + (i % 3) * 0.04 })}
            />
          </div>
        ))}
      </div>
      <svg viewBox="0 0 460 460" className="absolute inset-0" fill="none">
        <path d={line} pathLength={1} stroke="var(--color-white)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="draw" style={vars({ '--d': '900ms' })} filter="drop-shadow(0 0 8px rgb(var(--tint) / 0.6))" />
      </svg>
      <div className="ruler absolute inset-x-8 bottom-[52px]" />
      <div className="absolute inset-x-0 bottom-2 flex justify-center gap-2">
        {(ids.length ? ids : ['US500', 'US100', 'US30']).slice(0, 4).map((id, i) => (
          <Chip key={id} className="animate-float" style={{ animationDelay: `${i * -1.6}s` }}>
            {id}
          </Chip>
        ))}
      </div>
    </>
  );
}

// ---------------------------------------------------------------- commodities: a drop with a live liquid level
const wave = (y: number, amp: number, len: number) => {
  let d = `M-${len * 2} ${y} q${len / 4} ${-amp} ${len / 2} 0`;
  for (let i = 0; i < 13; i++) d += ` t${len / 2} 0`;
  return `${d} V470 H-${len * 2} Z`;
};

function CommodityDrop({ ids }: { ids: string[] }) {
  const drop = 'M230 46 C230 46 104 204 104 288 a126 126 0 0 0 252 0 C356 204 230 46 230 46 Z';
  return (
    <>
      <svg viewBox="0 0 460 460" className="absolute inset-0" fill="none">
        <defs>
          <clipPath id="drop-clip">
            <path d={drop} />
          </clipPath>
          <linearGradient id="drop-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="rgb(var(--c))" stopOpacity="0.95" />
            <stop offset="1" stopColor="rgb(var(--c))" stopOpacity="0.25" />
          </linearGradient>
        </defs>
        <path d={drop} fill="rgb(var(--c) / 0.05)" />
        <g clipPath="url(#drop-clip)">
          <path d={wave(262, 16, 180)} fill="rgb(var(--c) / 0.3)">
            <animateTransform attributeName="transform" type="translate" from="0 0" to="180 0" dur="5s" repeatCount="indefinite" />
          </path>
          <path d={wave(276, 12, 140)} fill="url(#drop-fill)">
            <animateTransform attributeName="transform" type="translate" from="0 0" to="-140 0" dur="3.4s" repeatCount="indefinite" />
          </path>
          {[
            [190, 7, 4.2, 0],
            [246, 5, 3.4, 1.1],
            [284, 4, 5, 2.3],
          ].map(([cx, r, dur, begin]) => (
            <circle key={cx} cx={cx} r={r} fill="rgb(var(--tint) / 0.55)">
              <animate attributeName="cy" from="410" to="270" dur={`${dur}s`} begin={`${begin}s`} repeatCount="indefinite" />
              <animate attributeName="opacity" values="0;1;0" dur={`${dur}s`} begin={`${begin}s`} repeatCount="indefinite" />
            </circle>
          ))}
        </g>
        <path d={drop} pathLength={1} stroke="rgb(var(--c))" strokeWidth="2" className="draw" style={vars({ '--d': '300ms' })} />
        <path d="M176 300 a56 56 0 0 0 30 54" stroke="rgb(var(--tint) / 0.7)" strokeWidth="5" strokeLinecap="round" />
      </svg>
      {(ids.length ? ids : ['USOIL', 'UKOIL', 'NATGAS']).slice(0, 3).map((id, i) => (
        <Chip key={id} className={cn('animate-float absolute', ['left-0 top-24', 'right-0 top-44', 'bottom-10 left-6'][i])} style={{ animationDelay: `${i * -2.2}s` }}>
          {id}
        </Chip>
      ))}
    </>
  );
}

// ---------------------------------------------------------------- shares: a fanned hand of ticker cards
const FAN = [
  { rotate: '-14deg', x: -150, y: 26 },
  { rotate: '-5deg', x: -52, y: -6 },
  { rotate: '5deg', x: 52, y: -6 },
  { rotate: '14deg', x: 150, y: 26 },
];

function ShareFan({ symbols }: { symbols: PublicSymbol[] }) {
  const cards = (symbols.length ? symbols : [{ id: 'AAPL', name: 'Apple' }, { id: 'TSLA', name: 'Tesla' }, { id: 'AMZN', name: 'Amazon' }, { id: 'NVDA', name: 'NVIDIA' }]).slice(0, 4);
  return (
    <>
      {cards.map((s, i) => (
        <div key={s.id} className="absolute left-1/2 top-1/2" style={{ translate: `${FAN[i].x - 82}px ${FAN[i].y - 118}px`, rotate: FAN[i].rotate, zIndex: i }}>
          <div className="animate-float" style={{ animationDelay: `${i * -1.7}s` }}>
            <div className="card-solid corners group h-[236px] w-[164px] overflow-hidden p-4 shadow-lift transition-[translate] duration-500 ease-out-expo hover:-translate-y-6">
              <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-[rgb(var(--c)/0.28)] to-transparent" />
              <div className="relative flex h-full flex-col justify-between">
                <div>
                  <div className="label !text-[rgb(var(--c))]">Share CFD</div>
                  <div className="mt-2 font-display text-3xl font-extrabold tracking-tight">{s.id}</div>
                  <div className="mt-0.5 truncate text-[11px] text-ink-400">{s.name}</div>
                </div>
                <div className="flex items-end gap-1">
                  {[38, 54, 46, 70, 62, 88].map((h, k) => (
                    <span key={k} className="bar-breathe flex-1 rounded-sm bg-[rgb(var(--c)/0.7)]" style={vars({ height: `${h * 0.5}px`, '--dur': `${2.4 + ((k + i) % 4) * 0.5}s`, '--s': 0.7 })} />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      ))}
    </>
  );
}

// ---------------------------------------------------------------- crypto: a honeycomb that never sleeps
const hex = (cx: number, cy: number, r: number) =>
  Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 180) * (60 * i - 90);
    return `${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`;
  }).join(' ');

function CryptoHive({ ids }: { ids: string[] }) {
  const coins = (ids.length ? ids : ['BTCUSD', 'ETHUSD', 'SOLUSD', 'XRPUSD', 'LTCUSD']).map((id) => id.replace(/USD$/, ''));
  const outer = coins.filter((c) => c !== 'BTC').slice(0, 6);
  const cells = Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 180) * (60 * i - 60);
    return { x: 230 + 124 * Math.cos(a), y: 230 + 124 * Math.sin(a), label: outer[i] ?? '' };
  });
  return (
    <svg viewBox="0 0 460 460" className="absolute inset-0" fill="none">
      <g className="orbit origin-center [transform-box:fill-box]" style={vars({ '--orbit-dur': '70s' })}>
        <circle cx="230" cy="230" r="218" stroke="rgb(var(--c) / 0.35)" strokeDasharray="2 12" strokeWidth="2" strokeLinecap="round" />
      </g>
      {cells.map((c, i) => (
        <g key={i}>
          <line x1="230" y1="230" x2={c.x} y2={c.y} stroke="rgb(var(--c) / 0.5)" strokeWidth="1.5" strokeDasharray="4 8" className="animate-dash" />
          <g className="animate-pulse" style={{ animationDelay: `${i * 0.33}s`, animationDuration: '2.6s' }}>
            <polygon points={hex(c.x, c.y, 60)} fill={c.label ? 'rgb(var(--c) / 0.1)' : 'rgb(var(--tint) / 0.02)'} stroke={c.label ? 'rgb(var(--c) / 0.7)' : 'rgb(var(--tint) / 0.12)'} strokeWidth="1.5" />
          </g>
          <text x={c.x} y={c.y + 5} textAnchor="middle" className="fill-white font-mono text-[15px] font-bold">
            {c.label}
          </text>
        </g>
      ))}
      <polygon points={hex(230, 230, 62)} fill="rgb(var(--c))" filter="drop-shadow(0 0 26px rgb(var(--c) / 0.7))" />
      <Bitcoin x={206} y={206} width={48} height={48} color="var(--color-paper)" strokeWidth={2.2} />
      <g>
        <rect x="186" y="408" width="88" height="26" rx="13" fill="var(--color-paper)" stroke="rgb(var(--c) / 0.5)" />
        <text x="230" y="425.5" textAnchor="middle" className="fill-[rgb(var(--c))] font-mono text-[11px] font-bold tracking-widest">
          24 / 7
        </text>
      </g>
    </svg>
  );
}

// ---------------------------------------------------------------- metals: periodic tiles with a travelling shine
const ELEMENTS = [
  { z: 79, sym: 'Au', name: 'Gold', mass: '196.97', pair: 'XAUUSD', grad: 'from-[#fdeeb5] via-[var(--color-gold)] to-[#a8771c]', rotate: '-9deg', pos: 'left-6 top-10', delay: '0s' },
  { z: 47, sym: 'Ag', name: 'Silver', mass: '107.87', pair: 'XAGUSD', grad: 'from-[#f7f9fc] via-[#c5ccd9] to-[#737c90]', rotate: '8deg', pos: 'right-6 bottom-12', delay: '-3.5s' },
];

function MetalTiles({ ids }: { ids: string[] }) {
  return (
    <>
      {ELEMENTS.filter((e) => !ids.length || ids.includes(e.pair)).map((e) => (
        <div key={e.sym} className={cn('absolute', e.pos)} style={{ rotate: e.rotate }}>
          <div className="animate-float-slow" style={{ animationDelay: e.delay }}>
            <div className={cn('relative h-[236px] w-[200px] overflow-hidden rounded-3xl bg-gradient-to-br p-5 text-ink-950 shadow-lift', e.grad)}>
              <span className="animate-sweep absolute inset-y-0 left-0 w-1/2 bg-gradient-to-r from-transparent via-paper/70 to-transparent" style={{ animationDelay: e.delay }} />
              <div className="relative flex h-full flex-col justify-between">
                <div className="flex items-start justify-between font-mono text-sm font-bold">
                  <span>{e.z}</span>
                  <span className="text-[10px] uppercase tracking-[0.16em] opacity-70">{e.pair}</span>
                </div>
                <div>
                  <div className="font-display text-[5.5rem] font-extrabold leading-none tracking-tighter">{e.sym}</div>
                  <div className="mt-1 flex items-baseline justify-between">
                    <span className="text-sm font-semibold">{e.name}</span>
                    <span className="font-mono text-[11px] opacity-70">{e.mass}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ))}
      {[
        ['left-[210px] top-6', '0s', 'h-5 w-5'],
        ['right-10 top-28', '0.8s', 'h-3 w-3'],
        ['bottom-16 left-16', '1.5s', 'h-4 w-4'],
      ].map(([pos, delay, size]) => (
        <svg key={pos} viewBox="0 0 24 24" className={cn('absolute animate-pulse text-[rgb(var(--c))]', pos, size)} style={{ animationDelay: delay }} fill="currentColor">
          <path d="M12 0c1 7 5 11 12 12-7 1-11 5-12 12-1-7-5-11-12-12 7-1 11-5 12-12z" />
        </svg>
      ))}
    </>
  );
}
