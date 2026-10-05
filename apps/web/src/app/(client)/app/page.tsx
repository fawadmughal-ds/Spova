'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ArrowDownToLine, ArrowUpFromLine, LineChart, Wifi, WifiOff } from 'lucide-react';
import type { LedgerEntryDto, Paginated } from '@spova/shared';
import { useAuth } from '@/lib/auth-context';
import { useAccounts } from '@/lib/use-accounts';
import { get } from '@/lib/api';
import { cn, fmtDate, fmtMoney } from '@/lib/utils';
import { PageHeader } from '@/components/app-shell';
import { Alert, Badge, Button, Card, Empty, Spinner, Stat } from '@/components/ui';

function Dashboard() {
  const { me } = useAuth();
  const { all, data, connected } = useAccounts();
  const welcome = useSearchParams().get('welcome') === '1';
  const [selected, setSelected] = useState<string | null>(null);
  const [ledger, setLedger] = useState<LedgerEntryDto[] | null>(null);

  const account = all.find((a) => a.id === selected) ?? all[0];

  useEffect(() => {
    if (!account) return;
    setLedger(null);
    get<Paginated<LedgerEntryDto>>(`/me/accounts/${account.id}/ledger?limit=8`)
      .then((r) => setLedger(r.items))
      .catch(() => setLedger([]));
  }, [account?.id, account?.balance, account?.credit]); // eslint-disable-line react-hooks/exhaustive-deps

  const kycDone = me?.kyc.poi && me?.kyc.por;

  return (
    <>
      <PageHeader
        title={`Hello, ${me?.profile?.firstName ?? 'trader'}`}
        sub="Your accounts at a glance."
        action={
          <span className={cn('inline-flex items-center gap-1.5 text-xs', connected ? 'text-up' : 'text-ink-500')}>
            {connected ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
            {connected ? 'Live' : 'Connecting'}
          </span>
        }
      />

      {welcome && (
        <Alert tone="success" className="mb-5">
          Welcome aboard. Your demo account is funded with virtual money. Verify your identity under Documents when you are ready to go live.
        </Alert>
      )}
      {!kycDone && (
        <Alert tone="warning" className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <span>Verification incomplete. Upload your ID and proof of address to unlock live trading and withdrawals.</span>
          <Link href="/app/documents" className="text-sm font-semibold underline">
            Upload documents
          </Link>
        </Alert>
      )}

      {!data ? (
        <div className="flex justify-center py-20">
          <Spinner />
        </div>
      ) : !account ? (
        <Empty>No trading account yet.</Empty>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            {all.map((a) => (
              <button
                key={a.id}
                onClick={() => setSelected(a.id)}
                className={cn(
                  'flex items-center gap-2 rounded-xl border px-3 py-2 text-sm transition',
                  a.id === account.id ? 'border-brand-500/60 bg-brand-500/10 text-white' : 'border-white/10 text-ink-300 hover:border-white/20',
                )}
              >
                <Badge tone={a.type === 'live' ? 'success' : 'info'}>{a.type}</Badge>
                <span className="tabular">{a.loginCode}</span>
              </button>
            ))}
            <Link href="/app/accounts" className="text-sm text-brand-300 hover:text-brand-200">
              Manage →
            </Link>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Stat label="Balance" value={fmtMoney(account.balance)} sub={account.currency} />
            <Stat label="Equity" value={fmtMoney(account.equity)} sub={`Credit ${fmtMoney(account.credit)}`} />
            <Stat label="Free margin" value={fmtMoney(account.freeMargin)} sub={`Used ${fmtMoney(account.usedMargin)}`} />
            <Stat label="Margin level" value={account.marginLevel ? `${account.marginLevel}%` : '—'} sub={`Leverage 1:${account.leverage}`} />
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-3">
            <Card title="Quick actions" className="lg:col-span-1">
              <div className="grid gap-2">
                <Link href={`/trade?acc=${account.id}`}>
                  <Button className="w-full justify-start" variant="primary">
                    <LineChart className="h-4 w-4" /> Open terminal
                  </Button>
                </Link>
                <Link href="/app/payments">
                  <Button className="w-full justify-start" variant="secondary">
                    <ArrowDownToLine className="h-4 w-4" /> Deposit
                  </Button>
                </Link>
                <Link href="/app/payments?tab=withdraw">
                  <Button className="w-full justify-start" variant="outline" disabled={account.type === 'demo'}>
                    <ArrowUpFromLine className="h-4 w-4" /> Withdraw
                  </Button>
                </Link>
                {account.type === 'demo' && <p className="text-xs text-ink-500">Withdrawals are available on live accounts only.</p>}
              </div>
            </Card>

            <Card title="Recent transactions" className="lg:col-span-2" action={<span className="text-xs text-ink-500">Account {account.loginCode}</span>}>
              {ledger === null ? (
                <div className="flex justify-center py-8">
                  <Spinner />
                </div>
              ) : ledger.length === 0 ? (
                <Empty>No transactions yet.</Empty>
              ) : (
                <ul className="divide-y divide-white/5">
                  {ledger.map((e) => {
                    const neg = e.amount.startsWith('-');
                    return (
                      <li key={e.id} className="flex items-center justify-between py-2.5 text-sm">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <Badge tone={neg ? 'danger' : 'success'}>{e.type}</Badge>
                            <span className="truncate text-ink-300">{e.reason}</span>
                          </div>
                          <div className="mt-0.5 text-[11px] text-ink-500">{fmtDate(e.createdAt)}</div>
                        </div>
                        <div className="text-right tabular">
                          <div className={cn('font-semibold', neg ? 'text-down' : 'text-up')}>
                            {neg ? '' : '+'}
                            {fmtMoney(e.amount)}
                          </div>
                          <div className="text-[11px] text-ink-500">bal {fmtMoney(e.balanceAfter)}</div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>
          </div>
        </>
      )}
    </>
  );
}

export default function DashboardPage() {
  return (
    <Suspense>
      <Dashboard />
    </Suspense>
  );
}
