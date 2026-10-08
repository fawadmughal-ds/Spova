'use client';

import { Bitcoin, Check, CreditCard, Landmark, Timer, Wallet, type LucideIcon } from 'lucide-react';
import type { PaymentKind, PaymentMethodDto } from '@spova/shared';
import { cn, fmtMoney } from '@/lib/utils';

const ICONS: Record<string, LucideIcon> = { bank: Landmark, crypto_usdt: Bitcoin, card: CreditCard };
export const methodIcon = (id: string) => ICONS[id] ?? Wallet;

/** Payment methods as pickable tiles. Disabled methods stay visible with a "Coming soon" tag. */
export function MethodCards({ methods, kind, value, onChange }: { methods: PaymentMethodDto[]; kind: PaymentKind; value: string | null; onChange: (id: string) => void }) {
  const list = methods.filter((m) => m.kinds.includes(kind));
  return (
    <div role="radiogroup" aria-label="Payment method" className="grid gap-2.5 sm:grid-cols-3">
      {list.map((m, i) => {
        const Icon = methodIcon(m.id);
        const selected = m.id === value;
        const min = kind === 'deposit' ? m.minDeposit : m.minWithdraw;
        const max = kind === 'deposit' ? m.maxDeposit : m.maxWithdraw;
        return (
          <button
            key={m.id}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={!m.enabled}
            onClick={() => m.enabled && onChange(m.id)}
            style={{ animationDelay: `${i * 60}ms` }}
            className={cn(
              'animate-page-in group relative flex flex-col gap-3 overflow-hidden rounded-2xl border p-4 text-left transition-[border-color,background-color,box-shadow,transform] duration-300',
              m.enabled ? 'cursor-pointer hover:-translate-y-0.5 hover:border-brand-400/40' : 'cursor-not-allowed border-dashed',
              selected ? 'border-brand-400/60 bg-brand-400/[0.06] shadow-[0_0_0_3px_rgb(var(--brand-rgb)/0.12)]' : 'border-white/[0.08] bg-white/[0.02]',
            )}
          >
            <span className="flex items-start justify-between gap-2">
              <span className={cn('flex h-10 w-10 items-center justify-center rounded-xl transition-colors duration-300', selected ? 'bg-brand-400/15 text-brand-300' : m.enabled ? 'bg-white/[0.04] text-ink-300 group-hover:text-brand-300' : 'bg-white/[0.03] text-ink-500')}>
                <Icon className="h-5 w-5" />
              </span>
              {m.enabled ? (
                <span className={cn('flex h-5 w-5 items-center justify-center rounded-full border transition-all duration-300', selected ? 'border-brand-400 bg-brand-500 text-paper' : 'border-white/15 text-transparent group-hover:border-white/30')}>
                  <Check className="h-3 w-3" strokeWidth={3} />
                </span>
              ) : (
                <span className="rounded-full bg-gold/10 px-2 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-[0.12em] text-gold ring-1 ring-inset ring-gold/30">Coming soon</span>
              )}
            </span>
            <span>
              <span className={cn('block text-sm font-semibold', m.enabled ? 'text-white' : 'text-ink-400')}>{m.label}</span>
              <span className="mt-1 flex items-center gap-1 text-[11px] text-ink-500">
                <Timer className="h-3 w-3" /> {m.eta}
              </span>
            </span>
            {m.enabled && (
              <span className="tabular font-mono text-[10px] uppercase tracking-[0.1em] text-ink-500">
                {fmtMoney(min)} – {fmtMoney(max)} USD
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
