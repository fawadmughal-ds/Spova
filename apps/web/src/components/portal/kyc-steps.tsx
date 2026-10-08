import Link from 'next/link';
import type { CSSProperties } from 'react';
import { ArrowRight, Check, FileUser, Home, Hourglass, Rocket, UserCheck, X, type LucideIcon } from 'lucide-react';
import type { KycStatusMap } from '@spova/shared';
import { cn } from '@/lib/utils';
import { buttonClass } from '@/lib/button';

type StepState = 'done' | 'pending' | 'rejected' | 'next' | 'todo';
type GroupStatus = KycStatusMap['poi'];

const fromGroup = (s: GroupStatus | undefined, done: boolean): Exclude<StepState, 'next'> => {
  if (done || s === 'approved') return 'done';
  if (s === 'pending') return 'pending';
  if (s === 'rejected') return 'rejected';
  return 'todo';
};

/**
 * Verification as a four-stop track: registered -> identity -> address -> live trading.
 * `poi`/`por` are the account flags (approved); `status` adds the in-between states (pending review, rejected).
 */
export function KycSteps({ poi, por, status, cta = true, className }: { poi: boolean; por: boolean; status?: KycStatusMap | null; cta?: boolean; className?: string }) {
  const steps: { label: string; hint: string; icon: LucideIcon; state: StepState }[] = [
    { label: 'Registered', hint: 'Demo account ready', icon: UserCheck, state: 'done' },
    { label: 'Identity', hint: 'Passport or ID card', icon: FileUser, state: fromGroup(status?.poi, poi) },
    { label: 'Address', hint: 'Utility bill or statement', icon: Home, state: fromGroup(status?.por, por) },
    { label: 'Live trading', hint: 'Deposits and withdrawals', icon: Rocket, state: poi && por ? 'done' : 'todo' },
  ];
  // the first stop that still needs the client's attention pulses
  const next = steps.findIndex((s) => s.state === 'todo' || s.state === 'rejected');
  if (next > 0 && steps[next].state === 'todo') steps[next].state = 'next';
  // the rail fills up to the last consecutive finished stop
  const firstOpen = steps.findIndex((s) => s.state !== 'done');
  const reached = firstOpen === -1 ? 3 : Math.max(0, firstOpen - 1);

  const rejected = steps.some((s) => s.state === 'rejected');
  const pending = !rejected && steps.some((s) => s.state === 'pending');
  const headline = rejected ? 'Action needed' : pending ? 'Documents in review' : 'Verification incomplete';
  const copy = rejected
    ? 'A document was rejected. Check the reason and upload a clearer copy.'
    : pending
      ? 'Our compliance team is checking your documents. This usually takes under one business day.'
      : 'Upload your ID and proof of address to unlock live trading and withdrawals.';
  const tone = rejected ? 'down' : pending ? 'sky' : 'gold';
  const corner = rejected ? 'rgb(var(--down-rgb) / 0.4)' : pending ? 'rgb(2 132 199 / 0.4)' : 'rgb(var(--gold-rgb) / 0.4)';

  return (
    <section data-in="true" className={cn('card corners mb-6 overflow-hidden p-5 sm:p-6', className)} style={{ '--corner': corner } as CSSProperties}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-xl">
          <div className={cn('label', tone === 'down' ? '!text-down' : tone === 'sky' ? '!text-sky-700' : '!text-gold')}>{headline}</div>
          <p className="mt-1.5 text-sm text-ink-200">{copy}</p>
        </div>
        {cta && (
          <Link
            href="/app/documents"
            className={buttonClass(
              'outline',
              'sm',
              cn(
                'group h-9 rounded-full px-4',
                tone === 'down' && 'border-down/40 text-down hover:border-down hover:bg-down/10 hover:text-down',
                tone === 'sky' && 'border-sky-400/50 text-sky-700 hover:border-sky-500 hover:bg-sky-400/10 hover:text-sky-700',
                tone === 'gold' && 'border-gold/40 text-gold hover:border-gold hover:bg-gold/10 hover:text-gold',
              ),
            )}
          >
            {rejected ? 'Fix document' : pending ? 'View documents' : 'Upload documents'} <ArrowRight className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-0.5" />
          </Link>
        )}
      </div>

      <ol className="relative mt-6 grid grid-cols-4">
        {/* rail runs between the centres of the first and last stop */}
        <div className="absolute left-[12.5%] right-[12.5%] top-[17px] h-0.5 rounded-full bg-white/[0.08]" aria-hidden>
          <div className="grow-x h-full rounded-full bg-gradient-to-r from-up to-brand-300 shadow-[0_0_10px_rgb(var(--up-rgb)/0.6)]" style={{ width: `${(reached / 3) * 100}%`, '--d': '250ms' } as CSSProperties} />
        </div>
        {steps.map((s, i) => (
          <li key={s.label} className="animate-page-in relative flex flex-col items-center px-1 text-center" style={{ animationDelay: `${120 + i * 90}ms` }}>
            <span
              className={cn(
                'relative flex h-9 w-9 items-center justify-center rounded-full border transition-colors duration-500',
                s.state === 'done' && 'border-up/50 bg-up text-ink-950',
                s.state === 'pending' && 'border-sky-400/60 bg-sky-400/10 text-sky-700',
                s.state === 'rejected' && 'border-down/60 bg-down/10 text-down',
                s.state === 'next' && 'border-gold/60 bg-ink-900 text-gold',
                s.state === 'todo' && 'border-white/10 bg-ink-900 text-ink-500',
              )}
            >
              {s.state === 'next' && <span className="absolute inset-0 animate-pulse-ring rounded-full border border-gold/60" />}
              {s.state === 'rejected' && <span className="absolute inset-0 animate-pulse-ring rounded-full border border-down/60" />}
              {s.state === 'pending' && <span className="absolute inset-0 animate-pulse-ring rounded-full border border-sky-400/60 [animation-duration:3.6s]" />}
              {s.state === 'done' ? <Check className="h-4 w-4" strokeWidth={3} /> : s.state === 'pending' ? <Hourglass className="h-4 w-4" /> : s.state === 'rejected' ? <X className="h-4 w-4" strokeWidth={3} /> : <s.icon className="h-4 w-4" />}
            </span>
            <span
              className={cn(
                'mt-2.5 text-xs font-medium sm:text-sm',
                s.state === 'done' && 'text-white',
                s.state === 'pending' && 'text-sky-700',
                s.state === 'rejected' && 'text-down',
                s.state === 'next' && 'text-gold',
                s.state === 'todo' && 'text-ink-400',
              )}
            >
              {s.label}
            </span>
            <span className="mt-0.5 hidden text-[11px] text-ink-500 sm:block">
              {s.state === 'pending' ? 'In review' : s.state === 'rejected' ? 'Rejected, re-upload' : s.hint}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
