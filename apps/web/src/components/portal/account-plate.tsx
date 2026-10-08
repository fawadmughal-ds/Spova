'use client';

import type { CSSProperties, ReactNode } from 'react';
import type { AccountDto } from '@spova/shared';
import { cn } from '@/lib/utils';
import { AnimatedNumber, Spotlight } from '@/components/motion';
import { Badge } from '@/components/ui';
import { TIER_RGB } from './tier';

/** "100001" -> "100 001" */
export const fmtLogin = (code: number) => String(code).replace(/(\d{3})(?=\d)/g, '$1 ');

/**
 * A trading account drawn as a physical plate: tier-tinted metal, guilloche rings, hollow tier name.
 * Demo plates are hatched and dashed so they never read as real money.
 */
export function AccountPlate({
  a,
  size = 'md',
  countUp,
  children,
  className,
}: {
  a: AccountDto;
  size?: 'md' | 'lg';
  /** count the balance up from zero on mount */
  countUp?: boolean;
  /** footer slot (actions) */
  children?: ReactNode;
  className?: string;
}) {
  const rgb = TIER_RGB[a.tier] ?? TIER_RGB.classic;
  const demo = a.type === 'demo';
  const lg = size === 'lg';

  return (
    <Spotlight
      style={{ '--t': rgb, '--spot': rgb } as CSSProperties}
      className={cn(
        'plate group overflow-hidden rounded-3xl border bg-ink-900 shadow-lift transition-[border-color,box-shadow] duration-500',
        demo ? 'border-dashed border-[rgb(var(--t)/0.3)]' : 'border-[rgb(var(--t)/0.35)]',
        'hover:border-[rgb(var(--t)/0.6)] hover:shadow-[0_30px_80px_-34px_rgb(var(--t)/0.55)]',
        className,
      )}
    >
      {/* metal + pattern */}
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgb(var(--t)/0.2),rgb(var(--t)/0.04)_42%,transparent_70%)]" />
      {demo && <div className="plate-hatch pointer-events-none absolute inset-0 opacity-70" />}
      <svg viewBox="0 0 200 200" className={cn('pointer-events-none absolute -right-16 -top-20 text-[rgb(var(--t))] transition-transform duration-[1200ms] ease-out-expo group-hover:rotate-12 group-hover:scale-105', lg ? 'h-80 w-80' : 'h-64 w-64')} fill="none" aria-hidden>
        {[30, 44, 58, 72, 86, 99].map((r, i) => (
          <circle key={r} cx="100" cy="100" r={r} stroke="currentColor" strokeOpacity={0.3 - i * 0.04} strokeWidth="1" strokeDasharray={i % 2 ? '2 6' : undefined} />
        ))}
      </svg>
      <div aria-hidden className={cn('text-outline pointer-events-none absolute -bottom-[0.2em] right-3 select-none font-display font-extrabold uppercase leading-none tracking-tighter opacity-60 [-webkit-text-stroke-color:rgb(var(--t)/0.16)]', lg ? 'text-[5.5rem]' : 'text-[4rem]')}>
        {a.tier}
      </div>

      <div className={cn('relative', lg ? 'p-6 sm:p-7' : 'p-5')}>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={demo ? 'info' : 'success'} dot={!demo}>
            {a.type}
          </Badge>
          <span className="inline-flex items-center rounded-full bg-[rgb(var(--t)/0.12)] px-2.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-[rgb(var(--t))] ring-1 ring-inset ring-[rgb(var(--t)/0.3)]">
            {a.tier}
          </span>
          {a.tradingBlocked && <Badge tone="danger">trading blocked</Badge>}
          {a.status !== 'enabled' && <Badge tone="warning">{a.status}</Badge>}
        </div>

        <div className={cn(lg ? 'mt-8' : 'mt-6')}>
          <div className="label">Balance{demo ? ' · virtual funds' : ''}</div>
          <div className={cn('mt-1.5 flex items-baseline gap-2 font-display font-bold tracking-tight', lg ? 'text-[2.6rem] leading-none sm:text-6xl' : 'text-4xl leading-none')}>
            <AnimatedNumber value={a.balance} mountFrom={countUp ? 0 : undefined} duration={countUp ? 1200 : 800} />
            <span className={cn('font-mono font-medium text-ink-400', lg ? 'text-base' : 'text-sm')}>{a.currency}</span>
          </div>
        </div>

        <dl className={cn('grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4', lg ? 'mt-9' : 'mt-7')}>
          <div>
            <dt className="label">Login</dt>
            <dd className="tabular mt-1 font-mono text-[15px] tracking-[0.08em] text-white">{fmtLogin(a.loginCode)}</dd>
          </div>
          <div>
            <dt className="label">Equity</dt>
            <dd className="mt-1 font-mono text-[15px] text-ink-100">
              <AnimatedNumber value={a.equity} />
            </dd>
          </div>
          <div>
            <dt className="label">Free margin</dt>
            <dd className="mt-1 font-mono text-[15px] text-ink-100">
              <AnimatedNumber value={a.freeMargin} />
            </dd>
          </div>
          <div>
            <dt className="label">Leverage</dt>
            <dd className="tabular mt-1 font-mono text-[15px] text-ink-100">1:{a.leverage}</dd>
          </div>
        </dl>

        {children && <div className="mt-6 flex flex-wrap gap-2 border-t border-white/[0.07] pt-5">{children}</div>}
      </div>
    </Spotlight>
  );
}
