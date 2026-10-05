'use client';

import { forwardRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------- Button
type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline';
type Size = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

const variants: Record<Variant, string> = {
  primary: 'bg-brand-500 text-ink-950 hover:bg-brand-400 shadow-glow font-semibold',
  secondary: 'bg-ink-700 text-ink-100 hover:bg-ink-600',
  ghost: 'bg-transparent text-ink-200 hover:bg-white/5',
  danger: 'bg-down/90 text-white hover:bg-down',
  outline: 'border border-white/15 text-ink-100 hover:border-brand-500/60 hover:text-white',
};
const sizes: Record<Size, string> = {
  sm: 'h-8 px-3 text-xs rounded-lg',
  md: 'h-10 px-4 text-sm rounded-xl',
  lg: 'h-12 px-6 text-base rounded-xl',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = 'primary', size = 'md', loading, disabled, children, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center gap-2 whitespace-nowrap transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/60 disabled:cursor-not-allowed disabled:opacity-50',
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
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

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input({ className, label, error, hint, right, id, ...props }, ref) {
  const inputId = id ?? props.name;
  return (
    <label className="block" htmlFor={inputId}>
      {label && <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-ink-400">{label}</span>}
      <span className="relative block">
        <input
          ref={ref}
          id={inputId}
          className={cn(
            'h-11 w-full rounded-xl border bg-ink-900/70 px-3.5 text-sm text-ink-100 placeholder:text-ink-500 transition focus:outline-none focus:ring-2',
            error ? 'border-down/60 focus:ring-down/40' : 'border-white/10 focus:border-brand-500/60 focus:ring-brand-500/30',
            right && 'pr-11',
            className,
          )}
          {...props}
        />
        {right && <span className="absolute inset-y-0 right-0 flex items-center pr-3 text-ink-400">{right}</span>}
      </span>
      {error ? <span className="mt-1 block text-xs text-down">{error}</span> : hint ? <span className="mt-1 block text-xs text-ink-500">{hint}</span> : null}
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
    <label className="block" htmlFor={sid}>
      {label && <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-ink-400">{label}</span>}
      <select
        ref={ref}
        id={sid}
        className={cn(
          'h-11 w-full rounded-xl border border-white/10 bg-ink-900/70 px-3.5 text-sm text-ink-100 focus:border-brand-500/60 focus:outline-none focus:ring-2 focus:ring-brand-500/30',
          className,
        )}
        {...props}
      >
        {children}
      </select>
      {error && <span className="mt-1 block text-xs text-down">{error}</span>}
    </label>
  );
});

// ---------------------------------------------------------------- Card / Badge / Stat
export function Card({ className, children, title, action }: { className?: string; children: ReactNode; title?: ReactNode; action?: ReactNode }) {
  return (
    <section className={cn('card p-5', className)}>
      {(title || action) && (
        <header className="mb-4 flex items-center justify-between gap-3">
          {title && <h3 className="text-sm font-semibold text-ink-100">{title}</h3>}
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
  info: 'bg-sky-500/10 text-sky-300 ring-sky-500/30',
  brand: 'bg-brand-500/10 text-brand-300 ring-brand-500/30',
};
export function Badge({ tone = 'neutral', children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ring-1 ring-inset', tones[tone], className)}>
      {children}
    </span>
  );
}

export function Stat({ label, value, sub, tone }: { label: string; value: ReactNode; sub?: ReactNode; tone?: 'up' | 'down' }) {
  return (
    <div className="card p-4">
      <div className="text-[11px] font-medium uppercase tracking-wider text-ink-400">{label}</div>
      <div className={cn('tabular mt-1 text-2xl font-semibold', tone === 'up' && 'text-up', tone === 'down' && 'text-down')}>{value}</div>
      {sub && <div className="mt-1 text-xs text-ink-400">{sub}</div>}
    </div>
  );
}

export function Alert({ tone = 'info', children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return <div className={cn('rounded-xl px-4 py-3 text-sm ring-1 ring-inset', tones[tone], className)}>{children}</div>;
}

export function Spinner({ className }: { className?: string }) {
  return <div className={cn('h-6 w-6 animate-spin rounded-full border-2 border-ink-600 border-t-brand-500', className)} />;
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="rounded-xl border border-dashed border-white/10 p-8 text-center text-sm text-ink-400">{children}</div>;
}
