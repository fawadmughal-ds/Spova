'use client';

import { cn } from '@/lib/utils';
import { AnimatedNumber } from '@/components/motion';

// Platform defaults (PLATFORM_PLAN §7). Used only to place the zone ticks on the dial.
const MARGIN_CALL = 100;
const STOP_OUT = 20;
const SWEEP = 270;
const R = 70;

/** Level (%) -> 0..1 along the dial. Stop-out and margin-call zones get fixed slices; above that the scale is logarithmic. */
function dialPos(level: number) {
  if (level <= STOP_OUT) return (Math.max(0, level) / STOP_OUT) * 0.14;
  if (level <= MARGIN_CALL) return 0.14 + ((level - STOP_OUT) / (MARGIN_CALL - STOP_OUT)) * 0.24;
  return Math.min(1, 0.38 + (Math.log10(level / MARGIN_CALL) / 2) * 0.62);
}
const polar = (pos: number, r: number) => {
  const a = ((135 + SWEEP * pos) * Math.PI) / 180;
  return [100 + r * Math.cos(a), 100 + r * Math.sin(a)] as const;
};

/** Radial margin-level dial. `level` is null while the account has no open positions. */
export function MarginGauge({ level, usedMargin, freeMargin }: { level: string | null; usedMargin: string; freeMargin: string }) {
  const n = level === null ? null : Number(level);
  const idle = n === null || !Number.isFinite(n);
  const pos = idle ? 0 : dialPos(n);
  const state = idle ? 'idle' : n <= STOP_OUT ? 'stop' : n <= MARGIN_CALL ? 'call' : 'ok';
  const color = { idle: 'text-ink-500', ok: 'text-up', call: 'text-gold', stop: 'text-down' }[state];
  const caption = { idle: 'No open positions', ok: 'Healthy', call: 'Margin call zone', stop: 'Stop-out zone' }[state];

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="relative mx-auto my-auto aspect-square w-full max-w-[250px]">
        <svg viewBox="0 0 200 200" className="h-full w-full overflow-visible" fill="none" aria-hidden>
          {/* track */}
          <circle cx="100" cy="100" r={R} pathLength={360} strokeDasharray={`${SWEEP} 360`} transform="rotate(135 100 100)" stroke="rgb(var(--tint) / 0.07)" strokeWidth="12" strokeLinecap="round" />
          {/* value */}
          <circle
            cx="100"
            cy="100"
            r={R}
            pathLength={360}
            strokeDasharray={`${SWEEP * pos} 360`}
            transform="rotate(135 100 100)"
            stroke="currentColor"
            strokeWidth="12"
            strokeLinecap="round"
            className={cn('gauge-arc', color, idle && 'opacity-0')}
          />
          {/* zone ticks */}
          {[
            [0.14, `${STOP_OUT}%`],
            [0.38, `${MARGIN_CALL}%`],
          ].map(([p, label]) => {
            const [x1, y1] = polar(p as number, R - 9);
            const [x2, y2] = polar(p as number, R + 9);
            const [tx, ty] = polar(p as number, R + 21);
            return (
              <g key={label}>
                <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--color-paper)" strokeWidth="2.5" />
                <text x={tx} y={ty} textAnchor="middle" dominantBaseline="middle" className="fill-ink-500 font-mono text-[9px]">
                  {label}
                </text>
              </g>
            );
          })}
          {/* idle sweep so the empty dial still breathes */}
          {idle && <circle cx="100" cy="100" r={R} pathLength={360} strokeDasharray="14 346" transform="rotate(135 100 100)" stroke="rgb(var(--tint) / 0.22)" strokeWidth="12" strokeLinecap="round" className="gauge-idle" />}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center pt-2 text-center">
          <div className={cn('font-display text-4xl font-bold leading-none tracking-tight transition-colors duration-700', idle ? 'font-mono text-2xl text-ink-500' : 'text-white')}>
            {idle ? '– –' : <AnimatedNumber value={n} format={(v) => `${v.toFixed(0)}%`} mountFrom={0} />}
          </div>
          <div className={cn('mt-2 inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.14em] transition-colors duration-700', color)}>
            {!idle && <span className="live-dot !h-1.5 !w-1.5" />}
            {caption}
          </div>
        </div>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-white/[0.06] pt-4">
        <div>
          <dt className="label">Used margin</dt>
          <dd className="mt-1 font-mono text-sm text-ink-100">
            <AnimatedNumber value={usedMargin} />
          </dd>
        </div>
        <div className="text-right">
          <dt className="label">Free margin</dt>
          <dd className="mt-1 font-mono text-sm text-ink-100">
            <AnimatedNumber value={freeMargin} />
          </dd>
        </div>
      </dl>
    </div>
  );
}
