'use client';

import Link from 'next/link';
import { Ban, ShieldAlert, Siren, X } from 'lucide-react';
import type { WsNotice } from '@spova/shared';
import { cn } from '@/lib/utils';

/** Red strip while the live margin level sits at or under the margin-call level (100%). */
export function MarginCallStrip({ level, className }: { level: number; className?: string }) {
  return (
    <div role="alert" className={cn('animate-page-in flex shrink-0 items-center gap-3 bg-down px-3 py-1.5 text-paper sm:px-4', className)}>
      <ShieldAlert className="h-4 w-4 shrink-0 animate-pulse" />
      <div className="min-w-0 flex-1 text-xs leading-snug">
        <span className="font-semibold">Margin call.</span> Margin level is <span className="tabular font-mono font-semibold">{level.toFixed(2)}%</span>. Deposit funds or close positions; at the stop-out level (20%) the losing positions are closed automatically.
      </div>
      <Link href="/app/payments" className="hidden shrink-0 rounded-md bg-paper/15 px-2.5 py-1 text-[11px] font-semibold transition-colors hover:bg-paper/25 sm:inline-block">
        Deposit
      </Link>
    </div>
  );
}

/** Dismissible card after a stop_out notice arrives. */
export function StopOutCard({ notice, onDismiss, className }: { notice: WsNotice; onDismiss: () => void; className?: string }) {
  return (
    <div role="alert" className={cn('animate-pop-in mx-3 mt-2 flex shrink-0 items-start gap-3 rounded-xl border border-down/30 bg-down/[0.06] p-3 sm:mx-4', className)}>
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-down/10 text-down ring-1 ring-inset ring-down/30">
        <Siren className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold text-ink-100">{notice.title || 'Stop-out'}</div>
        <div className="mt-0.5 text-xs leading-relaxed text-ink-300">{notice.body || 'Your margin level fell to the stop-out level and positions were closed to protect the account. Your balance can never go below zero.'}</div>
        <Link href="/app/payments" className="mt-1.5 inline-block text-xs text-brand-300 underline-offset-2 hover:underline">
          Deposit funds
        </Link>
      </div>
      <button type="button" onClick={onDismiss} aria-label="Dismiss" className="rounded-md p-1 text-ink-500 transition-colors hover:bg-white/[0.06] hover:text-white">
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

/** Shown while the account has tradingBlocked; the ticket is disabled with the same reason. */
export function TradingBlockedBanner({ className }: { className?: string }) {
  return (
    <div role="alert" className={cn('animate-page-in flex shrink-0 items-center gap-3 border-b border-gold/25 bg-gold/[0.08] px-3 py-1.5 text-xs text-ink-200 sm:px-4', className)}>
      <Ban className="h-4 w-4 shrink-0 text-gold" />
      <span className="min-w-0 flex-1">
        <span className="font-semibold text-ink-100">Trading is blocked on this account.</span> You can still watch prices and cancel pending orders.
      </span>
      <Link href="/app/help" className="shrink-0 text-brand-300 underline-offset-2 hover:underline">
        Contact support
      </Link>
    </div>
  );
}
