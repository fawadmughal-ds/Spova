'use client';

import { forwardRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { buttonClass, type ButtonSize, type ButtonVariant } from '@/lib/button';

// ---------------------------------------------------------------- Button
export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = 'primary', size = 'md', loading, disabled, children, ...props },
  ref,
) {
  return (
    <button ref={ref} disabled={disabled || loading} className={cn(buttonClass(variant, size), 'disabled:cursor-not-allowed disabled:opacity-50', className)} {...props}>
      {loading && <Spinner className="h-4" tone="current" />}
      {children}
    </button>
  );
});

// ---------------------------------------------------------------- Input
export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  right?: ReactNode;
}

const fieldBase =
  'h-11 w-full rounded-xl border bg-white/[0.03] px-3.5 text-sm text-ink-100 placeholder:text-ink-500 transition-[border-color,box-shadow,background-color] duration-300 hover:bg-white/[0.05] focus:bg-ink-900 focus:outline-none focus:ring-4';
const fieldOk = 'border-white/10 hover:border-white/20 focus:border-brand-400/70 focus:ring-brand-400/15';
const fieldErr = 'border-down/60 focus:border-down focus:ring-down/15';

function FieldLabel({ children }: { children: ReactNode }) {
  return <span className="label mb-1.5 block transition-colors group-focus-within/field:text-brand-300">{children}</span>;
}
function FieldMessage({ error, hint }: { error?: string; hint?: string }) {
  if (error) return <span className="animate-pop-in mt-1.5 block text-xs text-down">{error}</span>;
  if (hint) return <span className="mt-1.5 block text-xs text-ink-500">{hint}</span>;
  return null;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input({ className, label, error, hint, right, id, ...props }, ref) {
  const inputId = id ?? props.name;
  return (
    <label className="group/field block" htmlFor={inputId}>
      {label && <FieldLabel>{label}</FieldLabel>}
      <span className="relative block">
        <input ref={ref} id={inputId} aria-invalid={!!error || undefined} className={cn(fieldBase, error ? fieldErr : fieldOk, right && 'pr-11', className)} {...props} />
        {right && <span className="absolute inset-y-0 right-0 flex items-center pr-3 text-ink-400">{right}</span>}
      </span>
      <FieldMessage error={error} hint={hint} />
    </label>
  );
});

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
}
export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select({ className, label, error, id, children, ...props }, ref) {
  const sid = id ?? props.name;
  return (
    <label className="group/field block" htmlFor={sid}>
      {label && <FieldLabel>{label}</FieldLabel>}
      <span className="relative block">
        <select ref={ref} id={sid} className={cn(fieldBase, 'appearance-none pr-10', error ? fieldErr : fieldOk, className)} {...props}>
          {children}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400 transition-transform group-focus-within/field:rotate-180 group-focus-within/field:text-brand-300" />
      </span>
      <FieldMessage error={error} />
    </label>
  );
});

// ---------------------------------------------------------------- Card / Badge / Stat
export function Card({ className, children, title, action }: { className?: string; children: ReactNode; title?: ReactNode; action?: ReactNode }) {
  return (
    <section className={cn('card p-5', className)}>
      {(title || action) && (
        <header className="mb-4 flex items-center justify-between gap-3">
          {title && (
            <h3 className="flex items-center gap-2 text-sm font-semibold text-ink-100">
              <span className="h-3.5 w-0.5 rounded-full bg-gradient-to-b from-brand-300 to-brand-600" />
              {title}
            </h3>
          )}
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

type Tone = 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'brand';
const tones: Record<Tone, string> = {
  neutral: 'bg-white/5 text-ink-300 ring-white/10',
  success: 'bg-up/10 text-up ring-up/30',
  warning: 'bg-gold/10 text-gold ring-gold/30',
  danger: 'bg-down/10 text-down ring-down/30',
  info: 'bg-sky-400/10 text-sky-700 ring-sky-400/30',
  brand: 'bg-brand-400/10 text-brand-300 ring-brand-400/30',
};
export function Badge({ tone = 'neutral', children, className, dot }: { tone?: Tone; children: ReactNode; className?: string; dot?: boolean }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] ring-1 ring-inset', tones[tone], className)}>
      {dot && <span className="live-dot !h-1.5 !w-1.5" />}
      {children}
    </span>
  );
}

export function Stat({ label, value, sub, tone, icon }: { label: string; value: ReactNode; sub?: ReactNode; tone?: 'up' | 'down'; icon?: ReactNode }) {
  return (
    <div className="card card-hover corners group h-full overflow-hidden p-5">
      <div className="flex items-center justify-between">
        <div className="label">{label}</div>
        {icon && <div className="text-ink-500 transition-colors group-hover:text-brand-300">{icon}</div>}
      </div>
      <div className={cn('tabular mt-2 font-display text-[1.7rem] font-semibold leading-none tracking-tight', tone === 'up' && 'text-up', tone === 'down' && 'text-down')}>{value}</div>
      {sub && <div className="mt-2 text-xs text-ink-400">{sub}</div>}
    </div>
  );
}

export function Alert({ tone = 'info', children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return <div className={cn('animate-pop-in rounded-xl px-4 py-3 text-sm ring-1 ring-inset', tones[tone], className)}>{children}</div>;
}

/** Loader drawn as four breathing candles. Pass a height class (default h-6). */
export function Spinner({ className, tone = 'brand' }: { className?: string; tone?: 'brand' | 'current' }) {
  return (
    <span role="status" aria-label="Loading" className={cn('inline-flex h-6 items-center gap-[3px]', tone === 'brand' ? 'text-brand-400' : 'text-current', className)}>
      {[0, 1, 2, 3].map((i) => (
        <span key={i} className="animate-candle h-full w-[3px] origin-center rounded-full bg-current" style={{ animationDelay: `${i * 0.14}s` }} />
      ))}
    </span>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('skeleton h-4', className)} />;
}

export function Empty({ children, icon }: { children: ReactNode; icon?: ReactNode }) {
  return (
    <div className="bg-dots flex flex-col items-center gap-3 rounded-xl border border-dashed border-white/10 p-8 text-center text-sm text-ink-400">
      {icon && <div className="text-ink-500">{icon}</div>}
      <div>{children}</div>
    </div>
  );
}

// ---------------------------------------------------------------- Switch / Tabs
export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative h-6 w-11 shrink-0 rounded-full ring-1 ring-inset transition-colors duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/60',
        checked ? 'bg-brand-500 ring-brand-300/50 shadow-[0_0_18px_-2px_rgb(var(--brand-rgb)/0.7)]' : 'bg-white/[0.08] ring-white/10',
      )}
    >
      <span className={cn('absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-paper shadow transition-transform duration-300 ease-spring', checked ? 'translate-x-5' : 'translate-x-0')} />
    </button>
  );
}
