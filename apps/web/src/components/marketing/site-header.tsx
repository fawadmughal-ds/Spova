'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { ArrowRight, ArrowUpRight, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { buttonClass } from '@/lib/button';
import { MARKET_LIST } from '@/lib/markets';
import { COMPANY_LINKS, EDUCATION_LINKS, TIER_LINKS, TRADING_LINKS, tierHref, type NavLink } from '@/lib/site-nav';
import { useAuth } from '@/lib/auth-context';
import { Wordmark } from '@/components/logo';
import { ScrollProgress } from '@/components/motion';

const navLink = (active: boolean) => cn('relative rounded-full px-3.5 py-2 text-sm transition-colors duration-300', active ? 'text-white' : 'text-ink-300 hover:text-white');

/** Hover / focus dropdown. The panel is always in the DOM so links stay crawlable. */
function Menu({ label, active, width, children }: { label: string; active: boolean; width: number; children: ReactNode }) {
  return (
    <div className="group relative">
      <button className={cn(navLink(active), 'flex items-center gap-1')} aria-haspopup="true">
        {label}
        <ChevronDown className="h-3.5 w-3.5 transition-transform duration-300 group-focus-within:rotate-180 group-hover:rotate-180" />
        {active && <ActiveDot />}
      </button>
      <div
        style={{ width }}
        className="invisible absolute left-1/2 top-full -translate-x-1/2 translate-y-2 scale-[0.97] pt-4 opacity-0 transition-all duration-300 ease-out-expo group-focus-within:visible group-focus-within:translate-y-0 group-focus-within:scale-100 group-focus-within:opacity-100 group-hover:visible group-hover:translate-y-0 group-hover:scale-100 group-hover:opacity-100"
      >
        <div className="glass overflow-hidden rounded-3xl !bg-paper p-2 shadow-lift">{children}</div>
      </div>
    </div>
  );
}

function MenuLink({ link, path }: { link: NavLink; path: string }) {
  const on = path === link.href;
  return (
    <Link href={link.href} className={cn('group/item flex items-start gap-3 rounded-2xl p-3 transition-colors duration-300 hover:bg-white/[0.06]', on && 'bg-white/[0.05]')}>
      <span
        className={cn(
          'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ring-1 ring-inset transition-all duration-500 ease-spring group-hover/item:-rotate-6 group-hover/item:scale-110 group-hover/item:bg-brand-400/15 group-hover/item:text-brand-300 group-hover/item:ring-brand-400/30',
          on ? 'bg-brand-400/15 text-brand-300 ring-brand-400/30' : 'bg-white/[0.05] text-ink-300 ring-white/10',
        )}
      >
        <link.icon className="h-4 w-4" />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-medium text-white">{link.label}</span>
        <span className="block truncate text-xs text-ink-400">{link.blurb}</span>
      </span>
    </Link>
  );
}

/** Floating bar: full width over the hero, condenses into a glass pill once the page scrolls. */
export function SiteHeader() {
  const path = usePathname();
  const { me } = useAuth();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  useEffect(() => setOpen(false), [path]);
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  const inMarkets = MARKET_LIST.some((m) => path === `/${m.slug}`);
  const inTrading = TRADING_LINKS.some((l) => path === l.href) || TIER_LINKS.some((t) => path === tierHref(t.tier));
  const inEducation = EDUCATION_LINKS.some((l) => path === l.href);
  const inCompany = COMPANY_LINKS.some((l) => path === l.href);
  const portalHref = me?.role === 'admin' || me?.role === 'superadmin' ? '/admin' : '/app';
  const tab = open ? 0 : -1;

  return (
    <>
      <ScrollProgress />
      <header className="fixed inset-x-0 top-0 z-50 px-3 pt-3 sm:px-5">
        <div
          className={cn(
            'mx-auto flex items-center justify-between rounded-2xl border px-3 transition-all duration-700 ease-out-expo sm:px-4',
            scrolled || open ? 'glass h-14 max-w-5xl shadow-lift' : 'h-16 max-w-7xl border-transparent',
          )}
        >
          <Link href="/" aria-label="Home" className="animate-page-in">
            <Wordmark />
          </Link>

          <nav className="animate-page-in hidden items-center lg:flex" style={{ animationDelay: '80ms' }}>
            <Menu label="Markets" active={inMarkets} width={620}>
              <div className="grid grid-cols-3 gap-1">
                {MARKET_LIST.map((m) => (
                  <Link
                    key={m.slug}
                    href={`/${m.slug}`}
                    style={{ '--c': m.rgb } as CSSProperties}
                    className="group/item relative overflow-hidden rounded-2xl p-4 transition-colors duration-300 hover:bg-[rgb(var(--c)/0.08)]"
                  >
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[rgb(var(--c)/0.12)] text-[rgb(var(--c))] ring-1 ring-inset ring-[rgb(var(--c)/0.25)] transition-transform duration-500 ease-spring group-hover/item:-rotate-6 group-hover/item:scale-110">
                      <m.icon className="h-4 w-4" />
                    </span>
                    <span className="mt-3 flex items-center gap-1 text-sm font-semibold text-white">
                      {m.label}
                      <ArrowUpRight className="h-3.5 w-3.5 -translate-x-1 opacity-0 transition-all duration-300 group-hover/item:translate-x-0 group-hover/item:opacity-100" />
                    </span>
                    <span className="mt-0.5 block text-xs text-ink-400">{m.blurb}</span>
                    <span className="label mt-3 block !text-[rgb(var(--c)/0.9)]">up to {m.leverage}</span>
                  </Link>
                ))}
              </div>
              <Link href="/cfds-list" className="group/row mt-1 flex items-center justify-between rounded-2xl bg-white/[0.04] px-4 py-3 text-sm text-ink-200 transition-colors hover:bg-white/[0.08] hover:text-white">
                <span>
                  Six asset classes, <span className="font-serif text-base italic text-brand-300">one account</span>. See the full CFD list
                </span>
                <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover/row:translate-x-1" />
              </Link>
            </Menu>

            <Menu label="Trading" active={inTrading} width={600}>
              <div className="grid grid-cols-[1fr_1.15fr] gap-1">
                <div className="rounded-2xl bg-white/[0.03] p-3">
                  <p className="label px-1 pb-2">Account tiers</p>
                  {TIER_LINKS.map((t, i) => (
                    <Link
                      key={t.tier}
                      href={tierHref(t.tier)}
                      className={cn('group/tier flex items-center justify-between rounded-xl px-3 py-2 text-sm transition-colors duration-300 hover:bg-white/[0.07]', path === tierHref(t.tier) ? 'text-white' : 'text-ink-200')}
                    >
                      <span className="flex items-center gap-2.5">
                        {/* signal bars: one more lit per tier */}
                        <span className="flex h-3.5 items-end gap-[2px]">
                          {[0, 1, 2, 3, 4].map((b) => (
                            <span
                              key={b}
                              style={{ height: `${40 + b * 15}%` }}
                              className={cn('w-[3px] rounded-full transition-colors duration-300', b <= i ? (t.tier === 'vip' ? 'bg-gold' : 'bg-brand-400') : 'bg-white/15')}
                            />
                          ))}
                        </span>
                        {t.label}
                      </span>
                      <span className="label transition-colors group-hover/tier:text-ink-200">{t.level}</span>
                    </Link>
                  ))}
                </div>
                <div>
                  {TRADING_LINKS.map((l) => (
                    <MenuLink key={l.href} link={l} path={path} />
                  ))}
                </div>
              </div>
            </Menu>

            <Link href="/platform" className={navLink(path === '/platform')}>
              Platform
              {path === '/platform' && <ActiveDot />}
            </Link>

            <Menu label="Education" active={inEducation} width={600}>
              <div className="grid grid-cols-2 gap-x-1">
                {EDUCATION_LINKS.map((l) => (
                  <MenuLink key={l.href} link={l} path={path} />
                ))}
              </div>
            </Menu>

            <Menu label="Company" active={inCompany} width={560}>
              <div className="grid grid-cols-2 gap-x-1">
                {COMPANY_LINKS.map((l) => (
                  <MenuLink key={l.href} link={l} path={path} />
                ))}
              </div>
            </Menu>
          </nav>

          <div className="animate-page-in hidden items-center gap-1.5 lg:flex" style={{ animationDelay: '160ms' }}>
            {me ? (
              <Link href={portalHref} className={buttonClass('primary', 'md', 'rounded-full')}>
                Client area <ArrowRight className="h-4 w-4" />
              </Link>
            ) : (
              <>
                <Link href="/login" className="rounded-full px-4 py-2 text-sm text-ink-200 transition-colors hover:text-white">
                  Log in
                </Link>
                <Link href="/register" className={buttonClass('primary', 'md', 'rounded-full')}>
                  Open account
                </Link>
              </>
            )}
          </div>

          <button className="relative h-10 w-10 lg:hidden" onClick={() => setOpen((v) => !v)} aria-label="Menu" aria-expanded={open}>
            <span className={cn('absolute left-2.5 h-0.5 w-5 rounded-full bg-white transition-all duration-500 ease-out-expo', open ? 'top-[19px] rotate-45' : 'top-[14px]')} />
            <span className={cn('absolute left-2.5 h-0.5 rounded-full bg-white transition-all duration-500 ease-out-expo', open ? 'top-[19px] w-5 -rotate-45' : 'top-[23px] w-3.5')} />
          </button>
        </div>
      </header>

      {/* mobile sheet */}
      <div className={cn('fixed inset-0 z-40 lg:hidden', open ? '' : 'pointer-events-none')} aria-hidden={!open}>
        <div className={cn('absolute inset-0 bg-ink-950/95 backdrop-blur-xl transition-opacity duration-500', open ? 'opacity-100' : 'opacity-0')} />
        <div className="relative flex h-full flex-col overflow-y-auto px-6 pb-8 pt-24">
          <p className={cn('label transition-opacity duration-500', open ? 'opacity-100' : 'opacity-0')}>Markets</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {MARKET_LIST.map((m, i) => (
              <Link
                key={m.slug}
                href={`/${m.slug}`}
                tabIndex={tab}
                style={{ '--c': m.rgb, transitionDelay: open ? `${80 + i * 45}ms` : '0ms' } as CSSProperties}
                className={cn(
                  'flex items-center gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.03] p-3 transition-all duration-500 ease-out-expo',
                  open ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0',
                )}
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[rgb(var(--c)/0.12)] text-[rgb(var(--c))]">
                  <m.icon className="h-4 w-4" />
                </span>
                <span className="text-sm font-medium">{m.label}</span>
              </Link>
            ))}
          </div>

          <div className="mt-8 flex flex-col">
            {[
              { label: 'Trading', links: [...TRADING_LINKS.slice(0, 1), ...TIER_LINKS.map((t) => ({ href: tierHref(t.tier), label: `${t.label} account` })), ...TRADING_LINKS.slice(1)] },
              { label: 'Education', links: EDUCATION_LINKS },
              { label: 'Company', links: COMPANY_LINKS },
            ].map((g, i) => (
              <details
                key={g.label}
                style={{ transitionDelay: open ? `${360 + i * 60}ms` : '0ms' }}
                className={cn('group/d border-b border-white/[0.06] transition-all duration-500 ease-out-expo', open ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0')}
              >
                <summary className="flex cursor-pointer list-none items-center justify-between py-4 font-display text-3xl font-semibold tracking-tight [&::-webkit-details-marker]:hidden" tabIndex={tab}>
                  {g.label}
                  <ChevronDown className="h-5 w-5 text-ink-500 transition-transform duration-300 group-open/d:rotate-180" />
                </summary>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 pb-5">
                  {g.links.map((l) => (
                    <Link key={l.href} href={l.href} tabIndex={tab} className={cn('py-1.5 text-sm transition-colors', path === l.href ? 'text-brand-300' : 'text-ink-300 hover:text-white')}>
                      {l.label}
                    </Link>
                  ))}
                </div>
              </details>
            ))}
            <Link
              href="/platform"
              tabIndex={tab}
              style={{ transitionDelay: open ? '540ms' : '0ms' }}
              className={cn(
                'flex items-center justify-between border-b border-white/[0.06] py-4 font-display text-3xl font-semibold tracking-tight transition-all duration-500 ease-out-expo',
                open ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0',
              )}
            >
              Platform
              <ArrowUpRight className="h-5 w-5 text-ink-500" />
            </Link>
          </div>

          <div className={cn('mt-auto flex gap-2 pt-8 transition-all delay-500 duration-500', open ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0')}>
            {me ? (
              <Link href={portalHref} tabIndex={tab} className={buttonClass('primary', 'lg', 'flex-1')}>
                Client area
              </Link>
            ) : (
              <>
                <Link href="/login" tabIndex={tab} className={buttonClass('outline', 'lg', 'flex-1')}>
                  Log in
                </Link>
                <Link href="/register" tabIndex={tab} className={buttonClass('primary', 'lg', 'flex-1')}>
                  Open account
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

function ActiveDot() {
  return <span className="absolute inset-x-0 -bottom-0.5 mx-auto h-1 w-1 rounded-full bg-brand-400 shadow-[0_0_10px_2px_rgb(var(--brand-rgb)/0.7)]" />;
}
