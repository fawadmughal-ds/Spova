'use client';

import { useState, type FormEvent } from 'react';
import { ArrowRight, CheckCircle2, Mail } from 'lucide-react';
import { post, ApiError } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Spinner } from '@/components/ui';

type State = 'idle' | 'sending' | 'done' | 'error';

/** Footer newsletter sign-up. POST /newsletter/subscribe is idempotent, so a repeat address simply succeeds again. */
export function NewsletterForm({ source = 'footer', className }: { source?: string; className?: string }) {
  const [email, setEmail] = useState('');
  const [state, setState] = useState<State>('idle');
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (state === 'sending') return;
    const value = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      setError('Enter a valid email address');
      setState('error');
      return;
    }
    setState('sending');
    setError(null);
    try {
      await post('/newsletter/subscribe', { email: value, source });
      setState('done');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not subscribe right now. Please try again.');
      setState('error');
    }
  };

  if (state === 'done') {
    return (
      <div className={cn('animate-pop-in flex items-start gap-3 rounded-2xl border border-up/30 bg-up/[0.07] p-4', className)}>
        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-up" />
        <div>
          <p className="text-sm font-semibold text-white">You are subscribed</p>
          <p className="mt-0.5 text-xs text-ink-400">
            Market notes and platform updates will go to <span className="font-medium text-ink-200">{email.trim().toLowerCase()}</span>. Unsubscribe any time from the email footer.
          </p>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className={className}>
      <label htmlFor="newsletter-email" className="label block">
        Newsletter
      </label>
      <p className="mt-1.5 text-sm text-ink-400">Weekly market notes and platform updates. No spam, one click to leave.</p>
      <div
        className={cn(
          'mt-3 flex items-center gap-1 rounded-2xl border bg-paper p-1 transition-[border-color,box-shadow] duration-300 focus-within:ring-4',
          state === 'error' ? 'border-down/60 focus-within:ring-down/15' : 'border-white/10 focus-within:border-brand-400/70 focus-within:ring-brand-400/15',
        )}
      >
        <Mail className="ml-3 h-4 w-4 shrink-0 text-ink-400" />
        <input
          id="newsletter-email"
          type="email"
          name="email"
          autoComplete="email"
          inputMode="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (state === 'error') setState('idle');
          }}
          aria-invalid={state === 'error' || undefined}
          aria-describedby={error ? 'newsletter-error' : undefined}
          className="h-10 min-w-0 flex-1 bg-transparent px-2 text-sm text-ink-100 placeholder:text-ink-500 focus:outline-none"
        />
        <button
          type="submit"
          disabled={state === 'sending'}
          className="btn btn-shine inline-flex h-10 shrink-0 items-center gap-2 rounded-xl bg-gradient-to-b from-brand-300 to-brand-500 px-4 text-sm font-semibold text-ink-950 shadow-glow disabled:opacity-70"
        >
          {state === 'sending' ? <Spinner className="h-4" tone="current" /> : null}
          Subscribe
          {state !== 'sending' && <ArrowRight className="h-4 w-4" />}
        </button>
      </div>
      {error && (
        <p id="newsletter-error" className="animate-pop-in mt-2 text-xs text-down">
          {error}
        </p>
      )}
      <p className="mt-2 text-[11px] text-ink-500">
        By subscribing you agree to our{' '}
        <a href="/cookies-privacy" className="underline decoration-ink-500/50 underline-offset-2 hover:text-ink-300">
          privacy policy
        </a>
        .
      </p>
    </form>
  );
}
