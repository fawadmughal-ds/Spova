'use client';

import { BookOpenCheck, CandlestickChart, FileCheck2, Landmark, LayoutDashboard, ListChecks, MessagesSquare, ShieldHalf, SlidersHorizontal, UserCog, Users } from 'lucide-react';
import { RequireAuth } from '@/lib/auth-context';
import { AppShell, type NavItem } from '@/components/app-shell';

const NAV: NavItem[] = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard, exact: true },
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
  return (
    <RequireAuth roles={['admin', 'superadmin']}>
      <AppShell nav={NAV} variant="admin">
        {children}
      </AppShell>
    </RequireAuth>
  );
}
