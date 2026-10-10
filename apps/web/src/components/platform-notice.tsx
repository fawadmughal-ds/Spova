'use client';

import { CircleAlert, Info, Megaphone, PauseCircle, TriangleAlert } from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePlatform } from '@/lib/platform';

const tone: Record<string, string> = {
  info: 'border-brand-400/30 bg-brand-400/[0.08] text-ink-100',
  success: 'border-up/30 bg-up/[0.08] text-ink-100',
  warning: 'border-gold/30 bg-gold/[0.10] text-ink-100',
  danger: 'border-down/30 bg-down/[0.10] text-ink-100',
};
const icons = { info: Info, success: Megaphone, warning: TriangleAlert, danger: CircleAlert };

/** Trading-halt and announcement strips, driven by the back office in real time. Renders nothing when both are off. */
export function PlatformStrip({ className }: { className?: string }) {
  const p = usePlatform();
  if (!p.tradingHalt.enabled && !p.announcement.enabled) return null;
  const Icon = icons[p.announcement.level] ?? Info;
  return (
    <div className={cn('shrink-0 space-y-px', className)}>
      {p.tradingHalt.enabled && (
        <div role="alert" className="animate-page-in flex items-center gap-3 border-b border-down/30 bg-down/[0.10] px-3 py-1.5 text-xs text-ink-100 sm:px-4">
          <PauseCircle className="h-4 w-4 shrink-0 text-down" />
          <span className="min-w-0 flex-1">
            <span className="font-semibold">Trading is paused.</span> {p.tradingHalt.message || 'New orders are not accepted right now. Open positions can still be closed.'}
          </span>
        </div>
      )}
      {p.announcement.enabled && p.announcement.text && (
        <div role="status" className={cn('animate-page-in flex items-center gap-3 border-b px-3 py-1.5 text-xs sm:px-4', tone[p.announcement.level] ?? tone.info)}>
          <Icon className="h-4 w-4 shrink-0" />
          <span className="min-w-0 flex-1">{p.announcement.text}</span>
        </div>
      )}
    </div>
  );
}
