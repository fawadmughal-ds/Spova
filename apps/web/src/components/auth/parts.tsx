'use client';

import type { InputHTMLAttributes, ReactNode } from 'react';
import { Check, Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Reveal, Words } from '@/components/motion';

/** Heading block shared by the four auth screens. `title` supports the *accent* marker. */
export function AuthHeading({ eyebrow, title, sub }: { eyebrow: string; title: string; sub?: ReactNode }) {
  return (
    <Reveal variant="stagger" step={90}>
      <span className="eyebrow">{eyebrow}</span>
      <h1 className="mt-4 font-display text-4xl font-extrabold leading-[1] tracking-tighter sm:text-[2.75rem]">
        <Words text={title} delay={120} />
      </h1>
      {sub && <p className="mt-3 text-sm leading-relaxed text-ink-400">{sub}</p>}
    </Reveal>
  );
}

/** Show / hide button for the right slot of a password <Input>. */
export function PasswordToggle({ show, onToggle }: { show: boolean; onToggle: () => void }) {
  return (
    <button type="button" onClick={onToggle} className="rounded-md p-1 transition-colors hover:text-ink-100" aria-label="Toggle password" aria-pressed={show}>
      <span key={String(show)} className="animate-pop-in block">
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </span>
    </button>
  );
}

// Mirrors passwordSchema in @spova/shared (8-32 chars, lower, upper, digit, symbol).
const RULES: { label: string; test: (v: string) => boolean }[] = [
  { label: '8-32 characters', test: (v) => v.length >= 8 && v.length <= 32 },
  { label: 'Lowercase', test: (v) => /[a-z]/.test(v) },
  { label: 'Uppercase', test: (v) => /[A-Z]/.test(v) },
  { label: 'Number', test: (v) => /[0-9]/.test(v) },
  { label: 'Symbol', test: (v) => /[^A-Za-z0-9]/.test(v) },
];
const LEVELS = ['Too weak', 'Weak', 'Getting there', 'Almost', 'Nearly there', 'Strong'];

/** Live checklist for the password rule: five segments fill as each requirement is met. */
export function PasswordStrength({ value }: { value: string }) {
  const passed = RULES.map((r) => r.test(value));
  const score = passed.filter(Boolean).length;
  const tone = score === RULES.length ? 'bg-up' : score >= 3 ? 'bg-gold' : 'bg-down';
  return (
    <div aria-live="polite">
      <div className="flex items-center gap-3">
        <div className="grid flex-1 grid-cols-5 gap-1.5">
          {RULES.map((_, i) => (
            <span key={i} className="h-1 overflow-hidden rounded-full bg-white/[0.08]">
              <span
                className={cn('block h-full origin-left rounded-full transition-transform duration-500 ease-out-expo', tone, i < score ? 'scale-x-100' : 'scale-x-0')}
                style={{ transitionDelay: `${i * 40}ms` }}
              />
            </span>
          ))}
        </div>
        <span className={cn('w-24 text-right font-mono text-[10px] uppercase tracking-[0.12em] transition-colors duration-300', !value ? 'text-ink-500' : score === RULES.length ? 'text-up' : score >= 3 ? 'text-gold' : 'text-down')}>
          {value ? LEVELS[score] : 'Password rule'}
        </span>
      </div>
      <ul className="mt-2.5 flex flex-wrap gap-1.5">
        {RULES.map((r, i) => (
          <li
            key={r.label}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[11px] ring-1 ring-inset transition-all duration-300',
              passed[i] ? 'bg-up/10 text-up ring-up/30' : 'bg-white/[0.03] text-ink-400 ring-white/[0.08]',
            )}
          >
            <span className={cn('flex h-3 w-3 items-center justify-center rounded-full transition-all duration-300 ease-spring', passed[i] ? 'scale-100 bg-up text-ink-950' : 'scale-75 bg-white/10 text-transparent')}>
              <Check className="h-2 w-2" strokeWidth={4} />
            </span>
            {r.label}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Checkbox row with a drawn tick. Spread f.bindCheckbox(name) into it. */
export function CheckRow({ children, error, ...input }: { children: ReactNode; error?: string } & Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'children'>) {
  return (
    <div>
      <label
        className={cn(
          'flex cursor-pointer items-start gap-3 rounded-xl border px-3.5 py-3 text-sm text-ink-300 transition-colors duration-300 hover:border-white/15 hover:bg-white/[0.03]',
          error ? 'border-down/50' : input.checked ? 'border-brand-400/30 bg-brand-400/[0.04]' : 'border-white/[0.07]',
        )}
      >
        <input type="checkbox" className="peer sr-only" {...input} />
        <span className="check-box mt-px">
          <svg viewBox="0 0 12 12" className="h-3 w-3" fill="none" stroke="var(--color-paper)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M2.5 6.2 5 8.6 9.6 3.6" pathLength={1} />
          </svg>
        </span>
        <span className="leading-relaxed">{children}</span>
      </label>
      {error && <p className="animate-pop-in mt-1.5 text-xs text-down">{error}</p>}
    </div>
  );
}

/** Confirmation state: a ring and a tick that draw themselves, then the message. */
export function SuccessPanel({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="animate-pop-in card corners mt-8 overflow-hidden p-7 text-center">
      <div className="aurora-blob -top-24 left-1/2 h-48 w-72 -translate-x-1/2 bg-up/20" />
      <div className="relative mx-auto flex h-16 w-16 items-center justify-center">
        <span className="absolute inset-0 animate-pulse-ring rounded-full border border-up/50" />
        <svg viewBox="0 0 64 64" className="h-16 w-16" fill="none" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="32" cy="32" r="29" stroke="rgb(var(--up-rgb) / 0.18)" strokeWidth="3" />
          <circle cx="32" cy="32" r="29" stroke="var(--color-up)" strokeWidth="3" pathLength={1} transform="rotate(-90 32 32)" className="[animation:rv-draw_0.9s_var(--ease)_0.15s_backwards] [stroke-dasharray:1]" />
          <path d="M20 33.5 28.5 42 45 24" stroke="var(--color-up)" strokeWidth="4" pathLength={1} className="[animation:rv-draw_0.5s_var(--ease)_0.85s_backwards] [stroke-dasharray:1]" />
        </svg>
      </div>
      <h2 className="relative mt-5 text-xl font-bold">{title}</h2>
      {children && <div className="relative mt-2 text-sm leading-relaxed text-ink-300">{children}</div>}
    </div>
  );
}
