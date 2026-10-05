import { cn } from '@/lib/utils';

/** Placeholder mark until the real brand is supplied. */
export function Logo({ className, size = 32 }: { className?: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" className={cn('shrink-0', className)} aria-hidden>
      <defs>
        <linearGradient id="lg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#34d399" />
          <stop offset="1" stopColor="#059669" />
        </linearGradient>
      </defs>
      <rect x="1" y="1" width="30" height="30" rx="9" fill="url(#lg)" />
      <path d="M8 21 L13 14 L17 18 L24 9" fill="none" stroke="#06101a" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="24" cy="9" r="2" fill="#06101a" />
    </svg>
  );
}
