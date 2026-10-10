'use client';

import { Check, FlaskConical, Lock, ShieldCheck } from 'lucide-react';
import type { AccountDto } from '@spova/shared';
import { cn, fmtMoney } from '@/lib/utils';
import { fmtLogin } from './account-plate';

/**
 * Radio-style list of trading accounts for a money movement. Only live accounts can be picked;
 * demo accounts stay visible but disabled so the client sees why they are not an option.
 */
export function AccountPicker({ accounts, value, onChange, showMargin, name }: { accounts: AccountDto[]; value: string | null; onChange: (id: string) => void; showMargin?: boolean; name: string }) {
  return (
    <div role="radiogroup" aria-label="Trading account" className="grid gap-2">
      {accounts.map((a, i) => {
        const live = a.type === 'live';
        const usable = live && a.status === 'enabled';
        const selected = a.id === value;
        return (
          <button
            key={a.id}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-disabled={!usable || undefined}
            name={name}
            disabled={!usable}
            onClick={() => usable && onChange(a.id)}
            style={{ animationDelay: `${i * 60}ms` }}
            className={cn(
              'animate-page-in group relative flex w-full items-center gap-3.5 rounded-2xl border p-3.5 text-left transition-[border-color,background-color,box-shadow] duration-300',
              usable ? 'cursor-pointer hover:border-brand-400/40 hover:bg-white/[0.04]' : 'cursor-not-allowed border-dashed opacity-70',
              selected ? 'border-brand-400/60 bg-brand-400/[0.06] shadow-[0_0_0_3px_rgb(var(--brand-rgb)/0.12)]' : 'border-white/[0.08] bg-white/[0.02]',
            )}
          >
            <span
              className={cn(
                'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors duration-300',
                selected ? 'bg-brand-400/15 text-brand-300' : live ? 'bg-up/10 text-up' : 'bg-sky-400/10 text-sky-700',
              )}
            >
              {usable ? live ? <ShieldCheck className="h-4.5 w-4.5" /> : <FlaskConical className="h-4.5 w-4.5" /> : <Lock className="h-4 w-4" />}
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                <span className="label !text-current">{a.type}</span>
                <span className="tabular font-mono text-sm text-white">{fmtLogin(a.loginCode)}</span>
                <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-500">{a.tier}</span>
                {live && a.status !== 'enabled' && <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-gold">{a.status}</span>}
              </span>
              <span className="mt-0.5 block text-xs text-ink-500">
                {live ? (
                  <>
                    Balance <span className="tabular font-mono text-ink-200">{fmtMoney(a.balance, a.currency)}</span>
                    {showMargin && (
                      <>
                        {' '}
                        · Free margin <span className="tabular font-mono text-ink-200">{fmtMoney(a.freeMargin, a.currency)}</span>
                      </>
                    )}
                  </>
                ) : (
                  'Virtual funds · not eligible for real-money transfers'
                )}
              </span>
            </span>
            <span
              className={cn(
                'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-all duration-300',
                selected ? 'border-brand-400 bg-brand-500 text-paper' : 'border-white/15 text-transparent group-hover:border-white/30',
              )}
            >
              <Check className="h-3 w-3" strokeWidth={3} />
            </span>
          </button>
        );
      })}
    </div>
  );
}
