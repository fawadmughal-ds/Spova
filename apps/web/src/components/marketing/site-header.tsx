'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Menu, X } from 'lucide-react';
import { BRAND, cn } from '@/lib/utils';
import { Logo } from '@/components/logo';

const NAV = [
  {
    label: 'Markets',
    items: [
      { href: '/forex', label: 'Forex' },
      { href: '/indices', label: 'Indices' },
      { href: '/commodities', label: 'Commodities' },
      { href: '/shares', label: 'Shares' },
      { href: '/cryptocurrencies', label: 'Crypto' },
      { href: '/metals', label: 'Metals' },
    ],
  },
  { label: 'Accounts', href: '/trading-account' },
  { label: 'Platform', href: '/platform' },
  { label: 'Education', href: '/education' },
  { label: 'About', href: '/about-us' },
];

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-50 border-b border-white/5 bg-ink-950/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2">
          <Logo />
          <span className="text-lg font-bold tracking-tight">{BRAND}</span>
        </Link>

        <nav className="hidden items-center gap-1 lg:flex">
          {NAV.map((n) =>
            'items' in n && n.items ? (
              <div key={n.label} className="group relative">
                <button className="rounded-lg px-3 py-2 text-sm text-ink-300 hover:text-white">{n.label}</button>
                <div className="invisible absolute left-0 top-full pt-2 opacity-0 transition group-hover:visible group-hover:opacity-100">
                  <div className="card w-48 p-2">
                    {n.items.map((i) => (
                      <Link key={i.href} href={i.href} className="block rounded-lg px-3 py-2 text-sm text-ink-300 hover:bg-white/5 hover:text-white">
                        {i.label}
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <Link key={n.label} href={n.href!} className="rounded-lg px-3 py-2 text-sm text-ink-300 hover:text-white">
                {n.label}
              </Link>
            ),
          )}
        </nav>

        <div className="hidden items-center gap-2 lg:flex">
          <Link href="/login" className="rounded-xl px-4 py-2 text-sm text-ink-200 hover:text-white">
            Log in
          </Link>
          <Link href="/register" className="rounded-xl bg-brand-500 px-4 py-2 text-sm font-semibold text-ink-950 shadow-glow hover:bg-brand-400">
            Open account
          </Link>
        </div>

        <button className="lg:hidden" onClick={() => setOpen((v) => !v)} aria-label="Menu">
          {open ? <X /> : <Menu />}
        </button>
      </div>

      <div className={cn('border-t border-white/5 lg:hidden', open ? 'block' : 'hidden')}>
        <div className="space-y-1 px-4 py-3">
          {NAV.flatMap((n) => ('items' in n && n.items ? n.items : [{ href: n.href!, label: n.label }])).map((i) => (
            <Link key={i.href} href={i.href} onClick={() => setOpen(false)} className="block rounded-lg px-3 py-2 text-sm text-ink-200 hover:bg-white/5">
              {i.label}
            </Link>
          ))}
          <div className="flex gap-2 pt-2">
            <Link href="/login" className="flex-1 rounded-xl border border-white/10 px-4 py-2 text-center text-sm">
              Log in
            </Link>
            <Link href="/register" className="flex-1 rounded-xl bg-brand-500 px-4 py-2 text-center text-sm font-semibold text-ink-950">
              Open account
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}
