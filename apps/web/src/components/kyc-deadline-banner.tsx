'use client';

import Link from 'next/link';
import { CalendarClock, Lock } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { cn } from '@/lib/utils';

/**
 * Document deadline strip: amber from 3 days before the 15-day deadline, red once the account is frozen.
 * `onDocuments` opens the Documents overlay (terminal); otherwise it links to the client-area page.
 */
export function KycDeadlineBanner({ onDocuments, className }: { onDocuments?: () => void; className?: string }) {
  const { me } = useAuth();
  if (!me || me.role !== 'client' || me.kyc.complete) return null;
  const { frozen, daysLeft } = me.kyc;
  if (!frozen && (daysLeft === null || daysLeft > 3)) return null;
  const cta = onDocuments ? (
    <button type="button" onClick={onDocuments} className="shrink-0 font-semibold underline underline-offset-2">
      Upload documents
    </button>
  ) : (
    <Link href="/app/documents" className="shrink-0 font-semibold underline underline-offset-2">
      Upload documents
    </Link>
  );
  if (frozen)
    return (
      <div role="alert" className={cn('animate-page-in flex shrink-0 items-center gap-3 border-b border-down/30 bg-down/[0.10] px-3 py-1.5 text-xs text-ink-100 sm:px-4', className)}>
        <Lock className="h-4 w-4 shrink-0 text-down" />
        <span className="min-w-0 flex-1">
          <span className="font-semibold">Your account is frozen.</span> The 15-day window to upload your documents has passed, so trading is paused. Upload proof of identity, proof of residence, a payment document and any other requested document and trading resumes at once.
        </span>
        {cta}
      </div>
    );
  const d = Math.max(0, daysLeft ?? 0);
  return (
    <div role="status" className={cn('animate-page-in flex shrink-0 items-center gap-3 border-b border-gold/30 bg-gold/[0.10] px-3 py-1.5 text-xs text-ink-100 sm:px-4', className)}>
      <CalendarClock className="h-4 w-4 shrink-0 text-gold" />
      <span className="min-w-0 flex-1">
        <span className="font-semibold">{d === 0 ? 'Last day' : `${d} day${d === 1 ? '' : 's'} left`} to upload your documents.</span> After the deadline trading is paused until all four documents are received.
      </span>
      {cta}
    </div>
  );
}
