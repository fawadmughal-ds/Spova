import { useId } from 'react';
import { BRAND, cn } from '@/lib/utils';

/**
 * Zerventa mark: a bold "Z" on a brand-blue tile whose diagonal is a rising price line ending in an arrow.
 * Hovering the wordmark redraws the line (stroke-dash animation), the way a chart ticks forward.
 */
export function Logo({ className, size = 32 }: { className?: string; size?: number }) {
  // per-instance gradient id: a shared id breaks when the first copy in the DOM sits inside a display:none parent
  const fill = useId();
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" className={cn('shrink-0 overflow-visible', className)} aria-hidden>
      <defs>
        <linearGradient id={fill} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="var(--color-brand-200)" />
          <stop offset="0.55" stopColor="var(--color-brand-400)" />
          <stop offset="1" stopColor="var(--color-brand-600)" />
        </linearGradient>
      </defs>
      <rect x="1" y="1" width="30" height="30" rx="9" fill={`url(#${fill})`} />
      <g fill="none" stroke="var(--color-paper)" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
        {/* top and bottom bars of the Z */}
        <path d="M8.5 9h15" />
        <path d="M8.5 23h15" />
        {/* the diagonal: a rising price line with an arrow head */}
        <path
          d="M8.5 23 L13.5 16.5 L16.5 19.5 L23.5 9"
          pathLength="1"
          strokeDasharray="1"
          className="[stroke-dashoffset:0] transition-[stroke-dashoffset] duration-700 ease-out group-hover/logo:animate-[logo-draw_0.9s_ease-out]"
        />
        <path d="M18.5 9h5v5" />
      </g>
    </svg>
  );
}

/** Mark + wordmark. Hovering redraws the rising line. */
export function Wordmark({ className, size = 30 }: { className?: string; size?: number }) {
  return (
    <span className={cn('group/logo inline-flex items-center gap-2.5', className)}>
      <Logo size={size} />
      <span className="font-display text-lg font-bold tracking-tight">{BRAND}</span>
    </span>
  );
}
