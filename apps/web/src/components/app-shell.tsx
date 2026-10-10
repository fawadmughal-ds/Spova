'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useLayoutEffect, useRef, useState, type ComponentType, type CSSProperties, type ReactNode } from 'react';
import { ArrowRight, ArrowUpRight, BadgeCheck, ChevronRight, LogOut, ScrollText, ShieldCheck } from 'lucide-react';
import { cn, initials } from '@/lib/utils';
import { buttonClass } from '@/lib/button';
import { useAuth } from '@/lib/auth-context';
import { Wordmark } from '@/components/logo';
import { PlatformStrip } from '@/components/platform-notice';

export interface NavItem {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  exact?: boolean;
}

type Variant = 'client' | 'admin';

/** Surface accent ("r g b"): mint for the client area, gold for the back office. */
const ACCENT: Record<Variant, string> = { client: '37 99 235', admin: '173 108 7' };

const isActive = (n: NavItem, path: string) => (n.exact ? path === n.href : path === n.href || path.startsWith(n.href + '/'));

/** Left rail. Rendered twice (desktop + mobile drawer), so it owns its indicator measurements. */
function Rail({ nav, variant, shown = true, onNavigate }: { nav: NavItem[]; variant: Variant; shown?: boolean; onNavigate?: () => void }) {
  const path = usePathname();
  const { me, logout } = useAuth();
  const items = useRef<(HTMLLIElement | null)[]>([]);
  const [bar, setBar] = useState<{ top: number; height: number } | null>(null);
  const active = nav.findIndex((n) => isActive(n, path));
  const isAdmin = me?.role === 'admin' || me?.role === 'superadmin';

  useLayoutEffect(() => {
    const el = items.current[active];
    setBar(el ? { top: el.offsetTop, height: el.offsetHeight } : null);
  }, [active, nav.length]);

  const kycDone = (me?.kyc.poi ? 1 : 0) + (me?.kyc.por ? 1 : 0);
  const name = me?.profile ? `${me.profile.firstName} ${me.profile.lastName}` : me?.email;

  return (
    <nav className="flex h-full flex-col">
      <div className="flex h-16 shrink-0 items-center justify-between px-5">
        <Link href="/" aria-label="Home">
          <Wordmark size={28} />
        </Link>
        <span className="rounded-md border border-[rgb(var(--shell)/0.3)] bg-[rgb(var(--shell)/0.1)] px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-[0.16em] text-[rgb(var(--shell))]">
          {variant === 'admin' ? 'Back office' : 'Client'}
        </span>
      </div>

      <div className="label px-6 pb-2 pt-4">Menu</div>
      <ul className="relative min-h-0 flex-1 space-y-1 overflow-y-auto px-3 [scrollbar-width:none]">
        {bar && (
          <li
            aria-hidden
            style={{ top: bar.top, height: bar.height }}
            className="pointer-events-none absolute inset-x-3 rounded-xl bg-[rgb(var(--shell)/0.1)] ring-1 ring-inset ring-[rgb(var(--shell)/0.22)] transition-[top,height] duration-500 ease-out-expo"
          >
            <span className="absolute inset-y-2.5 left-0 w-[3px] rounded-full bg-[rgb(var(--shell))] shadow-[0_0_12px_rgb(var(--shell))]" />
          </li>
        )}
        {nav.map((n, i) => {
          const on = i === active;
          return (
            <li
              key={n.href}
              ref={(el) => {
                items.current[i] = el;
              }}
              style={{ transitionDelay: shown ? `${60 + i * 35}ms` : '0ms' }}
              className={cn('transition-[opacity,translate] duration-500 ease-out-expo', shown ? 'translate-x-0 opacity-100' : '-translate-x-3 opacity-0')}
            >
              <Link
                href={n.href}
                onClick={onNavigate}
                aria-current={on ? 'page' : undefined}
                className={cn('group relative flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm transition-colors duration-300', on ? 'font-medium text-white' : 'text-ink-300 hover:bg-white/[0.04] hover:text-white')}
              >
                <n.icon
                  className={cn(
                    'h-[18px] w-[18px] shrink-0 transition-all duration-500 ease-spring group-hover:-rotate-6 group-hover:scale-110',
                    on ? 'text-[rgb(var(--shell))]' : 'text-ink-400 group-hover:text-ink-100',
                  )}
                />
                <span className="flex-1">{n.label}</span>
                <ChevronRight className={cn('h-3.5 w-3.5 transition-all duration-300', on ? 'text-[rgb(var(--shell)/0.7)]' : '-translate-x-1 text-ink-500 opacity-0 group-hover:translate-x-0 group-hover:opacity-100')} />
              </Link>
            </li>
          );
        })}
      </ul>

      <div className="space-y-2 p-3">
        {variant === 'client' ? (
          <Link
            href="/app/documents"
            onClick={onNavigate}
            className="group block rounded-2xl border border-white/[0.07] bg-white/[0.03] p-3.5 transition-colors duration-300 hover:border-[rgb(var(--shell)/0.3)] hover:bg-white/[0.05]"
          >
            <div className="flex items-center justify-between">
              <span className="label">Verification</span>
              {kycDone === 2 ? (
                <BadgeCheck className="h-4 w-4 text-up" />
              ) : (
                <span className="tabular font-mono text-[11px] text-ink-300">
                  {kycDone}
                  <span className="text-ink-500">/2</span>
                </span>
              )}
            </div>
            <div className="mt-2.5 grid grid-cols-2 gap-1.5">
              {[me?.kyc.poi, me?.kyc.por].map((ok, i) => (
                <span key={i} className={cn('h-1.5 rounded-full transition-colors duration-700', ok ? 'bg-up shadow-[0_0_10px_rgb(var(--up-rgb)/0.6)]' : 'bg-white/[0.08]')} />
              ))}
            </div>
            <div className="mt-2.5 flex items-center justify-between text-xs">
              <span className="text-ink-400">{kycDone === 2 ? 'Live trading unlocked' : 'ID + proof of address'}</span>
              {kycDone < 2 && <ArrowRight className="h-3.5 w-3.5 text-ink-500 transition-all duration-300 group-hover:translate-x-0.5 group-hover:text-brand-300" />}
            </div>
          </Link>
        ) : (
          <Link
            href="/admin/audit"
            onClick={onNavigate}
            className="group flex items-start gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.03] p-3.5 transition-colors duration-300 hover:border-[rgb(var(--shell)/0.3)] hover:bg-white/[0.05]"
          >
            <ScrollText className="mt-0.5 h-4 w-4 shrink-0 text-[rgb(var(--shell))]" />
            <span className="text-xs leading-relaxed text-ink-400">
              <span className="block font-medium capitalize text-ink-100">{me?.role}</span>
              Every action here is written to the audit log.
            </span>
          </Link>
        )}

        {isAdmin && variant === 'client' && (
          <Link href="/admin" className="group flex items-center gap-3 rounded-xl px-3.5 py-2 text-sm text-ink-300 transition-colors hover:bg-white/[0.04] hover:text-white">
            <ShieldCheck className="h-[18px] w-[18px] text-gold" /> Back office
            <ArrowUpRight className="ml-auto h-3.5 w-3.5 text-ink-500 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
          </Link>
        )}

        <div className="flex items-center gap-3 rounded-2xl border border-white/[0.07] bg-ink-900/60 p-2.5">
          <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[rgb(var(--shell)/0.35)] to-[rgb(var(--shell)/0.08)] font-display text-xs font-bold text-white ring-1 ring-inset ring-[rgb(var(--shell)/0.35)]">
            {initials(me?.profile?.firstName, me?.profile?.lastName, me?.email?.[0]?.toUpperCase())}
            <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-ink-900 bg-up" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium">{name}</div>
            <div className="truncate text-[11px] text-ink-500">{me?.email}</div>
          </div>
          <button
            onClick={() => void logout()}
            title="Log out"
            aria-label="Log out"
            className="group flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-ink-400 transition-colors duration-300 hover:bg-down/10 hover:text-down"
          >
            <LogOut className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5" />
          </button>
        </div>
      </div>
    </nav>
  );
}

/** Ticking UTC time; rendered after mount so server and client markup agree. */
function UtcClock() {
  const [now, setNow] = useState<string | null>(null);
  useEffect(() => {
    const tick = () => setNow(new Date().toISOString().slice(11, 19));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <span className="hidden items-center gap-2 rounded-full border border-white/[0.07] bg-white/[0.03] px-3 py-1.5 font-mono text-[11px] text-ink-300 sm:inline-flex" title="Server time (UTC)">
      <span className="live-dot !h-1.5 !w-1.5 text-up" />
      <span className="tabular min-w-[4.6rem]">{now ?? '--:--:--'}</span>
      <span className="text-ink-500">UTC</span>
    </span>
  );
}

/** Shared shell for /app and /admin: left rail with a sliding marker, glass top bar, content. */
export function AppShell({ nav, children, variant }: { nav: NavItem[]; children: ReactNode; variant: Variant }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const current = nav.find((n) => isActive(n, path));

  useEffect(() => setOpen(false), [path]);
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[264px_minmax(0,1fr)]" style={{ '--shell': ACCENT[variant] } as CSSProperties}>
      <aside className="sticky top-0 hidden h-screen border-r border-white/[0.06] bg-ink-900/70 lg:block">
        <Rail nav={nav} variant={variant} />
      </aside>

      {/* mobile drawer */}
      <div className={cn('fixed inset-0 z-50 lg:hidden', open ? '' : 'pointer-events-none')} aria-hidden={!open}>
        <div className={cn('absolute inset-0 bg-ink-950/70 backdrop-blur-sm transition-opacity duration-500', open ? 'opacity-100' : 'opacity-0')} onClick={() => setOpen(false)} />
        <aside
          className={cn(
            'absolute inset-y-0 left-0 w-[284px] max-w-[86vw] border-r border-white/[0.08] bg-ink-900 shadow-lift transition-transform duration-500 ease-out-expo',
            open ? 'translate-x-0' : '-translate-x-full',
          )}
        >
          <Rail nav={nav} variant={variant} shown={open} onNavigate={() => setOpen(false)} />
        </aside>
      </div>

      <div className="relative flex min-h-screen min-w-0 flex-col">
        {/* backdrop */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[460px] overflow-hidden" aria-hidden>
          <div className="aurora-blob -top-56 left-[18%] h-[380px] w-[620px] bg-[rgb(var(--shell)/0.1)]" />
          <div className="aurora-blob -top-40 right-[-8%] h-[320px] w-[420px] bg-iris/10 [animation-delay:-9s]" />
          <div className="bg-dots absolute inset-0 opacity-70" />
        </div>

        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-white/[0.06] bg-ink-950/70 px-4 backdrop-blur-xl sm:px-6 lg:px-8">
          <button className="relative -ml-1 h-10 w-10 lg:hidden" onClick={() => setOpen((v) => !v)} aria-label="Menu" aria-expanded={open}>
            <span className={cn('absolute left-2.5 h-0.5 w-5 rounded-full bg-white transition-all duration-500 ease-out-expo', open ? 'top-[19px] rotate-45' : 'top-[14px]')} />
            <span className={cn('absolute left-2.5 h-0.5 rounded-full bg-white transition-all duration-500 ease-out-expo', open ? 'top-[19px] w-5 -rotate-45' : 'top-[23px] w-3.5')} />
          </button>
          <Link href="/" className="lg:hidden" aria-label="Home">
            <Wordmark size={26} />
          </Link>

          <div className="hidden min-w-0 items-center gap-2 font-mono text-[11px] uppercase tracking-[0.16em] lg:flex">
            <span className="text-ink-500">{variant === 'admin' ? 'Back office' : 'Client area'}</span>
            <span className="text-ink-600">/</span>
            <span key={current?.href ?? path} className="animate-pop-in truncate text-ink-100">
              {current?.label ?? 'Overview'}
            </span>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <UtcClock />
            {variant === 'client' ? (
              <>
                <Link href="/app/payments" className={buttonClass('ghost', 'sm', 'hidden h-9 rounded-full px-3.5 md:inline-flex')}>
                  Deposit
                </Link>
                <Link href="/trade" className={buttonClass('primary', 'sm', 'group h-9 rounded-full px-4')}>
                  Terminal <ArrowUpRight className="h-3.5 w-3.5 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                </Link>
              </>
            ) : (
              <Link href="/app" className={buttonClass('outline', 'sm', 'group h-9 rounded-full px-4')}>
                Client view <ArrowUpRight className="h-3.5 w-3.5 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
              </Link>
            )}
          </div>
        </header>

        <main key={path} className="animate-page-in relative flex-1 p-4 sm:p-6 lg:p-8">
          <div className="mx-auto max-w-[1320px]">
            {variant === 'client' && <PlatformStrip className="mb-5 overflow-hidden rounded-xl" />}
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

export function PageHeader({ title, sub, action }: { title: string; sub?: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="font-display text-3xl font-bold tracking-tight sm:text-[2.15rem]">{title}</h1>
        {sub && <div className="mt-1.5 text-sm text-ink-400">{sub}</div>}
      </div>
      {action}
    </div>
  );
}
