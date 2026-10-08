import Link from 'next/link';
import type { CSSProperties } from 'react';
import { ArrowRight, Check, FileUser, Home, Rocket, UserCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { buttonClass } from '@/lib/button';

/** Verification as a four-stop track: registered -> identity -> address -> live trading. */
export function KycSteps({ poi, por }: { poi: boolean; por: boolean }) {
  const steps = [
    { label: 'Registered', hint: 'Demo account ready', icon: UserCheck, done: true },
    { label: 'Identity', hint: 'Passport or ID card', icon: FileUser, done: poi },
    { label: 'Address', hint: 'Utility bill or statement', icon: Home, done: por },
    { label: 'Live trading', hint: 'Deposits and withdrawals', icon: Rocket, done: poi && por },
  ];
  // the rail fills up to the last consecutive finished stop
  const reached = Math.max(0, steps.findIndex((s) => !s.done) - 1);
  const next = steps.findIndex((s) => !s.done);

  return (
    <section data-in="true" className="card corners mb-6 overflow-hidden p-5 sm:p-6" style={{ '--corner': 'rgb(var(--gold-rgb) / 0.4)' } as CSSProperties}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-xl">
          <div className="label !text-gold">Verification incomplete</div>
          <p className="mt-1.5 text-sm text-ink-200">Upload your ID and proof of address to unlock live trading and withdrawals.</p>
        </div>
        <Link href="/app/documents" className={buttonClass('outline', 'sm', 'group h-9 rounded-full border-gold/40 px-4 text-gold hover:border-gold hover:bg-gold/10 hover:text-gold')}>
          Upload documents <ArrowRight className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-0.5" />
        </Link>
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
                s.done ? 'border-up/50 bg-up text-ink-950' : i === next ? 'border-gold/60 bg-ink-900 text-gold' : 'border-white/10 bg-ink-900 text-ink-500',
              )}
            >
              {i === next && <span className="absolute inset-0 animate-pulse-ring rounded-full border border-gold/60" />}
              {s.done ? <Check className="h-4 w-4" strokeWidth={3} /> : <s.icon className="h-4 w-4" />}
            </span>
            <span className={cn('mt-2.5 text-xs font-medium sm:text-sm', s.done ? 'text-white' : i === next ? 'text-gold' : 'text-ink-400')}>{s.label}</span>
            <span className="mt-0.5 hidden text-[11px] text-ink-500 sm:block">{s.hint}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
