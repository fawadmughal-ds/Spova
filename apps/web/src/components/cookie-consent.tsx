'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Cookie, Settings2, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Switch } from '@/components/ui';

export const CONSENT_KEY = 'xyz-cookie-consent';

export interface CookieConsent {
  necessary: true;
  analytics: boolean;
  marketing: boolean;
  /** ISO timestamp of the choice */
  at: string;
}

export function readConsent(): CookieConsent | null {
  try {
    const raw = localStorage.getItem(CONSENT_KEY);
    return raw ? (JSON.parse(raw) as CookieConsent) : null;
  } catch {
    return null;
  }
}

const CATEGORIES = [
  { key: 'necessary' as const, label: 'Strictly necessary', body: 'Keeps you signed in and the site working. Always on.', locked: true },
  { key: 'analytics' as const, label: 'Analytics', body: 'Helps us see which pages are used, so we can improve them. Not set today.', locked: false },
  { key: 'marketing' as const, label: 'Marketing', body: 'Lets us measure campaigns and show relevant offers. Not set today.', locked: false },
];

/**
 * First-visit cookie notice. The choice lives in localStorage; the app itself only sets the two
 * strictly necessary auth cookies, so the toggles record a preference for when optional tools are added.
 */
export function CookieConsent() {
  const [open, setOpen] = useState(false);
  const [manage, setManage] = useState(false);
  const [prefs, setPrefs] = useState({ analytics: false, marketing: false });

  useEffect(() => {
    if (readConsent()) return;
    const t = setTimeout(() => setOpen(true), 1200);
    return () => clearTimeout(t);
  }, []);

  const save = (analytics: boolean, marketing: boolean) => {
    const value: CookieConsent = { necessary: true, analytics, marketing, at: new Date().toISOString() };
    try {
      localStorage.setItem(CONSENT_KEY, JSON.stringify(value));
    } catch {
      /* storage unavailable: the notice simply shows again next time */
    }
    window.dispatchEvent(new CustomEvent('cookie-consent', { detail: value }));
    setOpen(false);
  };

  if (!open) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center p-4 sm:justify-start sm:p-6" role="dialog" aria-live="polite" aria-label="Cookie preferences">
      <div className="card pointer-events-auto w-full max-w-md overflow-hidden shadow-lift [animation:slide-in-up_0.6s_var(--ease)_both]">
        <div className="flex items-start gap-3 p-5">
          <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-400/10 text-brand-300">
            <span className="absolute inset-0 animate-pulse-ring rounded-xl bg-brand-400/20" />
            <Cookie className="relative h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-white">We use cookies</p>
            <p className="mt-1 text-xs leading-relaxed text-ink-400">
              Only the cookies that keep you signed in are set today. Choose whether we may add analytics or marketing cookies later. Read the{' '}
              <Link href="/cookies-privacy" className="font-medium text-brand-300 underline-offset-2 hover:underline">
                cookies &amp; privacy policy
              </Link>
              .
            </p>
          </div>
          <button type="button" onClick={() => save(false, false)} aria-label="Close and keep necessary cookies only" className="-mr-1 -mt-1 rounded-lg p-1 text-ink-500 transition-colors hover:bg-white/[0.06] hover:text-ink-200">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className={cn('grid transition-[grid-template-rows] duration-500 ease-out-expo', manage ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]')}>
          <div className="overflow-hidden">
            <ul className="divide-y divide-white/[0.06] border-t border-white/[0.06] px-5">
              {CATEGORIES.map((c) => (
                <li key={c.key} className="flex items-center justify-between gap-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-ink-100">{c.label}</p>
                    <p className="text-xs text-ink-400">{c.body}</p>
                  </div>
                  {c.locked ? (
                    <span className="label shrink-0 !text-up">Always on</span>
                  ) : (
                    <Switch label={c.label} checked={prefs[c.key as "analytics" | "marketing"]} onChange={(v) => setPrefs((p) => ({ ...p, [c.key]: v }))} />
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-white/[0.06] bg-ink-950/60 p-3">
          <button
            type="button"
            onClick={() => (manage ? save(prefs.analytics, prefs.marketing) : save(true, true))}
            className="btn btn-shine inline-flex h-10 flex-1 items-center justify-center rounded-xl bg-gradient-to-b from-brand-300 to-brand-500 px-4 text-sm font-semibold text-ink-950 shadow-glow"
          >
            {manage ? 'Save choices' : 'Accept all'}
          </button>
          <button type="button" onClick={() => save(false, false)} className="btn inline-flex h-10 flex-1 items-center justify-center rounded-xl border border-white/15 px-4 text-sm font-medium text-ink-100 hover:border-brand-400/60 hover:bg-brand-400/[0.06]">
            Necessary only
          </button>
          {!manage && (
            <button type="button" onClick={() => setManage(true)} className="inline-flex h-10 items-center gap-1.5 rounded-xl px-3 text-sm text-ink-300 transition-colors hover:bg-white/[0.06] hover:text-white" aria-expanded={manage}>
              <Settings2 className="h-4 w-4" /> Manage
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
