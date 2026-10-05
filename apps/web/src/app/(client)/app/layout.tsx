'use client';

import { CreditCard, FileText, HelpCircle, LayoutDashboard, LineChart, UserCircle2, Wallet } from 'lucide-react';
import { RequireAuth } from '@/lib/auth-context';
import { AppShell, type NavItem } from '@/components/app-shell';
import { LiveNotices } from '@/components/live-notices';

const NAV: NavItem[] = [
  { href: '/app', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { href: '/app/accounts', label: 'Trading accounts', icon: Wallet },
  { href: '/app/payments', label: 'Deposit / Withdraw', icon: CreditCard },
  { href: '/app/documents', label: 'Documents (KYC)', icon: FileText },
  { href: '/trade', label: 'Web terminal', icon: LineChart },
  { href: '/app/help', label: 'Help', icon: HelpCircle },
  { href: '/app/profile', label: 'Profile', icon: UserCircle2 },
];

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireAuth>
      <LiveNotices />
      <AppShell nav={NAV} variant="client">
        {children}
      </AppShell>
    </RequireAuth>
  );
}
