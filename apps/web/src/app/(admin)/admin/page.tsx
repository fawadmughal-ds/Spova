'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight, FileCheck2, Landmark, MessagesSquare, PauseCircle, Radio, Users } from 'lucide-react';
import type { AdminDashboardDto } from '@spova/shared';
import { get } from '@/lib/api';
import { cn, fmtMoney } from '@/lib/utils';
import { PageHeader } from '@/components/app-shell';
import { Badge, Card, Spinner, Stat } from '@/components/ui';
import { KycDeadlines } from '@/components/admin/kyc-deadlines';

const link = (href: string, label: string) => (
  <span className="inline-flex items-center gap-1 text-brand-300">
    {label} <ArrowUpRight className="h-3 w-3" />
  </span>
);

export default function AdminHome() {
  const [d, setD] = useState<AdminDashboardDto | null>(null);
  useEffect(() => {
    const load = () => get<AdminDashboardDto>('/admin/dashboard').then(setD).catch(() => undefined);
    void load();
    const id = setInterval(() => void load(), 30_000);
    return () => clearInterval(id);
  }, []);

  return (
    <>
      <PageHeader title="Back office" sub="Live overview. Figures refresh every 30 seconds." />
      {!d ? (
        <div className="flex justify-center py-20">
          <Spinner />
        </div>
      ) : (
        <>
          {d.tradingHalt && (
            <Link href="/admin/platform" className="mb-5 flex items-center gap-3 rounded-2xl border border-down/40 bg-down/[0.08] px-4 py-3 text-sm text-ink-100">
              <PauseCircle className="h-5 w-5 text-down" />
              <span className="flex-1">
                <strong>Trading is paused platform-wide.</strong> New orders are refused until the halt is switched off.
              </span>
              <span className="text-brand-300">Open Platform</span>
            </Link>
          )}
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Link href="/admin/clients" className="block rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/60">
              <Stat label="Clients" value={d.clients} sub={`+${d.newClients7d} last 7 days · ${d.activeClients24h} active today`} icon={<Users className="h-4 w-4" />} />
            </Link>
            <Link href="/admin/kyc" className="block rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/60">
              <Stat label="Pending KYC" value={d.pendingKyc} sub={link('/admin/kyc', 'Review queue')} icon={<FileCheck2 className="h-4 w-4" />} />
            </Link>
            <Link href="/admin/payments" className="block rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/60">
              <Stat label="Pending payments" value={d.pendingPayments} sub={`${fmtMoney(d.pendingDepositsTotal)} in · ${fmtMoney(d.pendingWithdrawalsTotal)} out`} icon={<Landmark className="h-4 w-4" />} />
            </Link>
            <Link href="/admin/tickets" className="block rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/60">
              <Stat label="Open tickets" value={d.openTickets} sub={link('/admin/tickets', 'Answer')} icon={<MessagesSquare className="h-4 w-4" />} />
            </Link>
            <Link href="/admin/activity?kind=deposit" className="block rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/60">
              <Stat label="Deposits today" value={fmtMoney(d.depositsToday)} sub={`${fmtMoney(d.depositsTotal)} all-time · view all`} tone="up" />
            </Link>
            <Link href="/admin/activity?kind=withdraw" className="block rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/60">
              <Stat label="Withdrawals today" value={fmtMoney(d.withdrawalsToday)} sub={`${fmtMoney(d.withdrawalsTotal)} all-time · view all`} tone="down" />
            </Link>
            <Link href="/admin/activity?kind=credit" className="block rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/60">
              <Stat label="Manual credits" value={fmtMoney(d.manualCreditsTotal)} sub="Admin credits + bonuses · view all" />
            </Link>
            <Stat label="Live balances" value={fmtMoney(d.liveBalanceTotal)} sub="USD, client money" />
            <Link href="/admin/trades" className="block rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/60">
              <Stat label="Open positions" value={d.openPositions} sub={`Demo balances ${fmtMoney(d.demoBalanceTotal)} (virtual) · view book`} />
            </Link>
            <Link href="/admin/kyc" className="block rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/60">
              <Stat label="Documents due in 3 days" value={d.kycDueSoon} sub="Clients reminded, not yet complete" tone={d.kycDueSoon > 0 ? 'down' : undefined} />
            </Link>
            <Link href="/admin/kyc" className="block rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/60">
              <Stat label="Frozen for documents" value={d.kycFrozen} sub="Trading paused until uploads arrive" tone={d.kycFrozen > 0 ? 'down' : undefined} />
            </Link>
          </div>
          <KycDeadlines limit={6} className="mt-6" />

          <div className="mt-6 grid gap-5 lg:grid-cols-[1.3fr_1fr]">
            <Card title="Open exposure by instrument" action={<Link href="/admin/trades" className="text-xs text-brand-300">All positions</Link>}>
              {d.exposure.length === 0 ? (
                <p className="text-sm text-ink-400">No open positions.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead className="text-left">
                    <tr>
                      <th className="label py-1 pr-4 font-medium">Symbol</th>
                      <th className="label py-1 pr-4 text-right font-medium">Buy lots</th>
                      <th className="label py-1 pr-4 text-right font-medium">Sell lots</th>
                      <th className="label py-1 pr-4 text-right font-medium">Net</th>
                      <th className="label py-1 text-right font-medium">Positions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.exposure.map((e) => (
                      <tr key={e.symbol} className="border-t border-white/[0.05]">
                        <td className="py-2 pr-4 font-mono font-semibold text-white">{e.symbol}</td>
                        <td className="tabular py-2 pr-4 text-right font-mono text-up">{e.buyLots}</td>
                        <td className="tabular py-2 pr-4 text-right font-mono text-down">{e.sellLots}</td>
                        <td className={cn('tabular py-2 pr-4 text-right font-mono font-semibold', Number(e.netLots) > 0 ? 'text-up' : Number(e.netLots) < 0 ? 'text-down' : 'text-ink-300')}>{Number(e.netLots) > 0 ? '+' : ''}{e.netLots}</td>
                        <td className="tabular py-2 text-right font-mono">{e.positions}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Card>
            <Card title="Price feeds" action={<Link href="/admin/instruments" className="text-xs text-brand-300">Instruments</Link>}>
              <ul className="space-y-2">
                {d.feeds.map((f) => (
                  <li key={f.source} className="flex items-center justify-between rounded-xl border border-white/[0.06] px-3 py-2 text-sm">
                    <span className="flex items-center gap-2 capitalize">
                      <Radio className={cn('h-4 w-4', f.status === 'up' ? 'text-up' : f.status === 'down' ? 'text-down' : 'text-ink-500')} /> {f.source}
                    </span>
                    <Badge tone={f.status === 'up' ? 'success' : f.status === 'down' ? 'danger' : 'neutral'} dot={f.status === 'up'}>
                      {f.status === 'unknown' ? 'not running' : f.status}
                    </Badge>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-xs text-ink-500">"Synthetic" is the demo generator; it should be down once real feeds cover every instrument.</p>
            </Card>
          </div>
        </>
      )}
    </>
  );
}
