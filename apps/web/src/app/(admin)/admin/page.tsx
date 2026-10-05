'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
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
            <Stat label="Pending KYC" value={d.pendingKyc} sub="milestone 2" />
            <Stat label="Pending payments" value={d.pendingPayments} sub="milestone 2" />
            <Stat label="Open positions" value={d.openPositions} sub="milestone 2" />
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
