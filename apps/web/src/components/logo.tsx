import { useId } from 'react';
import { BRAND, cn } from '@/lib/utils';

/** Placeholder mark until the real brand is supplied: three rising candles cut out of a brand-blue tile. */
export function Logo({ className, size = 32 }: { className?: string; size?: number }) {
  // per-instance gradient id: a shared id breaks when the first copy in the DOM sits inside a display:none parent
  const fill = useId();
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" className={cn('shrink-0 overflow-visible', className)} aria-hidden>
      <defs>
        <linearGradient id={fill} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="var(--color-brand-200)" />
          <stop offset="0.5" stopColor="var(--color-brand-400)" />
          <stop offset="1" stopColor="var(--color-brand-600)" />
        </linearGradient>
      </defs>
      <rect x="1" y="1" width="30" height="30" rx="9" fill={`url(#${fill})`} />
      <g fill="var(--color-paper)" className="[&>rect]:origin-bottom [&>rect]:transition-transform [&>rect]:duration-500 [&>rect]:[transform-box:fill-box] group-hover/logo:[&>rect:nth-child(1)]:scale-y-125 group-hover/logo:[&>rect:nth-child(2)]:scale-y-90 group-hover/logo:[&>rect:nth-child(3)]:scale-y-110">
        <rect x="8" y="15" width="4" height="9" rx="1.2" />
        <rect x="14" y="11" width="4" height="13" rx="1.2" />
        <rect x="20" y="7" width="4" height="17" rx="1.2" />
      </g>
    </svg>
  );
}

/** Mark + wordmark. Hovering makes the candles tick. */
export function Wordmark({ className, size = 30 }: { className?: string; size?: number }) {
  return (
    <span className={cn('group/logo inline-flex items-center gap-2.5', className)}>
      <Logo size={size} />
      <span className="font-display text-lg font-bold tracking-tight">{BRAND}</span>
    </span>
  );
}
