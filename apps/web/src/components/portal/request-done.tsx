'use client';

import { BadgeCheck, History, Plus } from 'lucide-react';
import type { PaymentMethodDto, PaymentRequestDto } from '@spova/shared';
import { fmtMoney } from '@/lib/utils';
import { Button } from '@/components/ui';
import { fmtLogin } from './account-plate';
import { shortId } from './payment-row';

/** Confirmation card after a deposit / withdrawal request was sent (or a card payment confirmed). */
export function RequestDone({ req, method, onAgain, onHistory }: { req: PaymentRequestDto; method?: PaymentMethodDto; onAgain: () => void; onHistory: () => void }) {
  const withdraw = req.kind === 'withdraw';
  const steps = withdraw
    ? ['Our back office checks the destination belongs to you and that funds are free of open-position margin.', `The payout is sent by ${method?.label ?? req.method}; typical time ${method?.eta ?? 'a few business days'}.`, 'Your balance updates the moment the request is approved. You can cancel while it is still pending.']
    : [
        `Send the funds by ${method?.label ?? req.method}${req.reference ? ` quoting your reference ${req.reference}` : ''}, if you have not already.`,
        req.proof ? `Your payment proof (${req.proof.name}) is attached. Our back office matches it with the incoming payment; typical time ${method?.eta ?? 'a few business days'}.` : `Our back office matches the incoming payment; typical time ${method?.eta ?? 'a few business days'}. You can attach the slip from your history.`,
        'Your balance updates instantly on approval and you are notified here and by email.',
      ];
  return (
    <section className="card corners animate-pop-in mx-auto max-w-2xl overflow-hidden p-6 text-center sm:p-10" style={{ '--corner': 'rgb(var(--up-rgb) / 0.4)' } as React.CSSProperties}>
      <span className="relative mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-up text-ink-950 shadow-[0_0_0_8px_rgb(var(--up-rgb)/0.12)]">
        <span className="absolute inset-0 animate-pulse-ring rounded-full border border-up/60" />
        <BadgeCheck className="h-8 w-8" />
      </span>
      <div className="label mt-6 !text-up">{withdraw ? 'Withdrawal' : 'Deposit'} request received</div>
      <div className="tabular mt-2 font-display text-4xl font-bold tracking-tight sm:text-5xl">
        {fmtMoney(req.amount)} <span className="font-mono text-base font-medium text-ink-400">{req.currency}</span>
      </div>
      <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 font-mono text-xs text-ink-300">
        Request <span className="font-semibold text-white">#{shortId(req.id)}</span> · account {fmtLogin(req.accountLogin)}
      </div>
      <ol className="mx-auto mt-8 max-w-md space-y-3 text-left">
        {steps.map((t, i) => (
          <li key={i} className="animate-page-in flex gap-3 text-sm text-ink-300" style={{ animationDelay: `${200 + i * 90}ms` }}>
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-white/[0.05] font-mono text-[11px] text-ink-200 ring-1 ring-inset ring-white/10">{i + 1}</span>
            {t}
          </li>
        ))}
      </ol>
      <div className="mt-8 flex flex-wrap justify-center gap-2">
        <Button onClick={onHistory}>
          <History className="h-4 w-4" /> View history
        </Button>
        <Button variant="outline" onClick={onAgain}>
          <Plus className="h-4 w-4" /> New request
        </Button>
      </div>
    </section>
  );
}
