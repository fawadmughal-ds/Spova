'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Activity, BookOpenCheck, CandlestickChart, FileCheck2, Landmark, LayoutDashboard, ListChecks, MessagesSquare, ShieldHalf, SlidersHorizontal, UserCog, Users } from 'lucide-react';
import { RequireAuth } from '@/lib/auth-context';
import { get } from '@/lib/api';
import { AppShell, type NavItem } from '@/components/app-shell';

const NAV: NavItem[] = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { href: '/admin/activity', label: 'Activity', icon: Activity },
  { href: '/admin/clients', label: 'Clients', icon: Users },
  { href: '/admin/kyc', label: 'KYC queue', icon: FileCheck2 },
  { href: '/admin/payments', label: 'Payments', icon: Landmark },
  { href: '/admin/tickets', label: 'Tickets', icon: MessagesSquare },
  { href: '/admin/trades', label: 'Trades', icon: CandlestickChart },
  { href: '/admin/instruments', label: 'Instruments', icon: ListChecks },
  { href: '/admin/risk', label: 'Risk & limits', icon: ShieldHalf },
  { href: '/admin/platform', label: 'Platform', icon: SlidersHorizontal },
  { href: '/admin/staff', label: 'Staff', icon: UserCog },
  { href: '/admin/audit', label: 'Audit log', icon: BookOpenCheck },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [unread, setUnread] = useState(0);
  const path = usePathname();

  useEffect(() => {
    let alive = true;
    const poll = () =>
      get<{ count: number }>('/admin/activity/unread')
        .then((r) => alive && setUnread(r.count))
        .catch(() => {});
    poll();
    const t = setInterval(poll, 20_000);
    return () => {
      alive = false;
      clearInterval(t);
    };
    // re-poll on navigation so the badge clears right after opening the feed
  }, [path]);

  const nav = NAV.map((n) => (n.href === '/admin/activity' ? { ...n, badge: unread } : n));

  return (
    <RequireAuth roles={['admin', 'superadmin']}>
      <AppShell nav={nav} variant="admin">
        {children}
      </AppShell>
    </RequireAuth>
  );
}
