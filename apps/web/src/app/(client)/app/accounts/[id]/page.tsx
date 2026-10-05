'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import type { AccountDto } from '@spova/shared';
import { get } from '@/lib/api';
import { useAccountStream } from '@/lib/ws';
import { fmtMoney } from '@/lib/utils';
import { PageHeader } from '@/components/app-shell';
import { LedgerTable } from '@/components/ledger-table';
import { Badge, Card, Spinner, Stat } from '@/components/ui';

export default function AccountStatementPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [acc, setAcc] = useState<AccountDto | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    get<AccountDto>(`/me/accounts/${id}`).then(setAcc).catch(() => setAcc(null));
  }, [id]);

  useAccountStream((s) => {
    if (s.accountId !== id) return;
    setAcc((a) => (a ? { ...a, balance: s.balance, credit: s.credit, equity: s.equity, freeMargin: s.freeMargin, usedMargin: s.usedMargin, marginLevel: s.marginLevel } : a));
    setVersion((v) => v + 1);
  });

  if (!acc)
    return (
      <div className="flex justify-center py-20">
        <Spinner />
      </div>
    );

  return (
    <>
      <PageHeader
        title={`Account ${acc.loginCode}`}
        sub={
          <span className="flex items-center gap-2">
            <Badge tone={acc.type === 'live' ? 'success' : 'info'}>{acc.type}</Badge>
            <Badge>{acc.tier}</Badge> <span>Leverage 1:{acc.leverage}</span>
          </span>
        }
        action={
          <Link href="/app/accounts" className="text-sm text-brand-300">
            ← All accounts
          </Link>
        }
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Balance" value={fmtMoney(acc.balance)} sub={acc.currency} />
        <Stat label="Credit" value={fmtMoney(acc.credit)} />
        <Stat label="Equity" value={fmtMoney(acc.equity)} />
        <Stat label="Free margin" value={fmtMoney(acc.freeMargin)} />
      </div>
      <Card title="Statement" className="mt-6" action={<span className="text-xs text-ink-500">PDF export arrives with milestone 2</span>}>
        <LedgerTable basePath={`/me/accounts/${id}`} version={version} />
      </Card>
    </>
  );
}
