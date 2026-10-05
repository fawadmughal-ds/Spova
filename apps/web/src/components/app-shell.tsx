'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, type ComponentType, type ReactNode } from 'react';
import { LogOut, Menu, ShieldCheck, X } from 'lucide-react';
import { BRAND, cn, initials } from '@/lib/utils';
import { useAuth } from '@/lib/auth-context';
import { Logo } from '@/components/logo';
import { Badge } from '@/components/ui';

export interface NavItem {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  exact?: boolean;
}

/** Shared shell for /app and /admin: left rail (Spova-like), top bar, content. */
export function AppShell({ nav, children, variant }: { nav: NavItem[]; children: ReactNode; variant: 'client' | 'admin' }) {
  const path = usePathname();
  const { me, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const isAdmin = me?.role === 'admin' || me?.role === 'superadmin';

  const rail = (
    <nav className="flex h-full flex-col">
      <Link href="/" className="flex h-16 items-center gap-2 px-5">
        <Logo size={28} />
        <span className="font-bold">{BRAND}</span>
        {variant === 'admin' && <Badge tone="brand">Admin</Badge>}
      </Link>
      <ul className="flex-1 space-y-1 px-3 py-2">
        {nav.map((n) => {
          const active = n.exact ? path === n.href : path === n.href || path.startsWith(n.href + '/');
          return (
            <li key={n.href}>
              <Link
                href={n.href}
                onClick={() => setOpen(false)}
                className={cn(
                  'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition',
                  active ? 'bg-brand-500/15 text-brand-300 font-medium' : 'text-ink-300 hover:bg-white/5 hover:text-white',
                )}
              >
                <n.icon className="h-4 w-4" />
                {n.label}
              </Link>
            </li>
          );
        })}
      </ul>
      <div className="border-t border-white/5 p-3">
        {isAdmin && variant === 'client' && (
          <Link href="/admin" className="mb-1 flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-ink-300 hover:bg-white/5">
            <ShieldCheck className="h-4 w-4" /> Back office
          </Link>
        )}
        <div className="flex items-center gap-3 rounded-xl px-3 py-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-500/20 text-xs font-bold text-brand-300">
            {initials(me?.profile?.firstName, me?.profile?.lastName, me?.email?.[0]?.toUpperCase())}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm">{me?.profile ? `${me.profile.firstName} ${me.profile.lastName}` : me?.email}</div>
            <div className="truncate text-[11px] text-ink-500">{me?.email}</div>
          </div>
          <button onClick={() => void logout()} className="text-ink-400 hover:text-white" title="Log out">
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </nav>
  );

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[250px_1fr]">
      <aside className="hidden border-r border-white/5 bg-ink-900/60 lg:block">{rail}</aside>

      {/* mobile drawer */}
      <div className={cn('fixed inset-0 z-50 lg:hidden', open ? '' : 'pointer-events-none')}>
        <div className={cn('absolute inset-0 bg-black/60 transition-opacity', open ? 'opacity-100' : 'opacity-0')} onClick={() => setOpen(false)} />
        <aside className={cn('absolute left-0 top-0 h-full w-[260px] bg-ink-900 transition-transform', open ? 'translate-x-0' : '-translate-x-full')}>{rail}</aside>
      </div>

      <div className="flex min-h-screen flex-col">
        <header className="flex h-16 items-center gap-3 border-b border-white/5 px-4 lg:hidden">
          <button onClick={() => setOpen((v) => !v)} aria-label="Menu">
            {open ? <X /> : <Menu />}
          </button>
          <span className="font-bold">{BRAND}</span>
        </header>
        <main className="flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}

export function PageHeader({ title, sub, action }: { title: string; sub?: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {sub && <p className="mt-1 text-sm text-ink-400">{sub}</p>}
      </div>
      {action}
    </div>
  );
}
