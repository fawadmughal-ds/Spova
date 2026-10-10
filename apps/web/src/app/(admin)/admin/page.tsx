'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight, FileCheck2, Landmark } from 'lucide-react';
import type { AdminDashboardDto } from '@spova/shared';
import { get } from '@/lib/api';
import { fmtMoney } from '@/lib/utils';
import { PageHeader } from '@/components/app-shell';
import { Card, Spinner, Stat } from '@/components/ui';

export default function AdminHome() {
  const [d, setD] = useState<AdminDashboardDto | null>(null);
  useEffect(() => {
    get<AdminDashboardDto>('/admin/dashboard').then(setD).catch(() => setD(null));
  }, []);

  return (
    <>
      <PageHeader title="Back office" sub="Overview" />
      {!d ? (
        <div className="flex justify-center py-20">
          <Spinner />
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Stat label="Clients" value={d.clients} sub={`+${d.newClients7d} last 7 days`} />
            <Link href="/admin/kyc" className="block rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/60" aria-label="Open the KYC queue">
              <Stat label="Pending KYC" value={d.pendingKyc} sub={<span className="inline-flex items-center gap-1 text-brand-300">Review queue <ArrowUpRight className="h-3 w-3" /></span>} icon={<FileCheck2 className="h-4 w-4" />} />
            </Link>
            <Link href="/admin/payments" className="block rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/60" aria-label="Open the payments queue">
              <Stat label="Pending payments" value={d.pendingPayments} sub={<span className="inline-flex items-center gap-1 text-brand-300">Deposits and withdrawals <ArrowUpRight className="h-3 w-3" /></span>} icon={<Landmark className="h-4 w-4" />} />
            </Link>
            <Stat label="Open positions" value={d.openPositions} />
            <Stat label="Demo balances" value={fmtMoney(d.demoBalanceTotal)} sub="USD, virtual" />
            <Stat label="Live balances" value={fmtMoney(d.liveBalanceTotal)} sub="USD, client money" />
          </div>
          <Card title="Shortcuts" className="mt-6 max-w-xl">
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/admin/clients" className="text-brand-300 hover:text-brand-200">
                  → Find a client and credit / debit an account
                </Link>
              </li>
              <li>
                <Link href="/admin/kyc" className="text-brand-300 hover:text-brand-200">
                  → Review pending KYC documents
                </Link>
              </li>
              <li>
                <Link href="/admin/payments" className="text-brand-300 hover:text-brand-200">
                  → Approve or decline deposit and withdrawal requests
                </Link>
              </li>
              <li>
                <Link href="/admin/tickets" className="text-brand-300 hover:text-brand-200">
                  → Answer support tickets
                </Link>
              </li>
              <li>
                <Link href="/admin/audit" className="text-brand-300 hover:text-brand-200">
                  → Review the audit log
                </Link>
              </li>
            </ul>
          </Card>
        </>
      )}
    </>
  );
}
