'use client';

import { useEffect, useState } from 'react';
import { fileUrl } from '@/lib/api';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { ArrowLeft, Coins, FileDown, LineChart, Lock, Scale, WalletMinimal } from 'lucide-react';
import type { AccountDto } from '@spova/shared';
import { get } from '@/lib/api';
import { useAccountStream } from '@/lib/ws';
import { AnimatedNumber } from '@/components/motion';
import { LedgerTable } from '@/components/ledger-table';
import { Card, Skeleton, Stat } from '@/components/ui';
import { AccountPlate } from '@/components/portal/account-plate';

export function StatementView({ id, embedded = false }: { id: string; embedded?: boolean }) {
  const [acc, setAcc] = useState<AccountDto | null>(null);
  const today = new Date().toISOString().slice(0, 10);
  const [from, setFrom] = useState(new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10));
  const [to, setTo] = useState(today);
  const rangeOk = from <= to;
  const dl = (format: 'pdf' | 'csv') => fileUrl(`/me/accounts/${id}/statement?from=${from}&to=${to}&format=${format}`);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    get<AccountDto>(`/me/accounts/${id}`).then(setAcc).catch(() => setAcc(null));
  }, [id]);

  useAccountStream((s) => {
    if (s.accountId !== id) return;
    setAcc((a) => (a ? { ...a, balance: s.balance, credit: s.credit, equity: s.equity, freeMargin: s.freeMargin, usedMargin: s.usedMargin, marginLevel: s.marginLevel } : a));
    setVersion((v) => v + 1);
  });

  const back = embedded ? null : (
    <Link href="/app/accounts" className="group mb-5 inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.14em] text-ink-400 transition-colors hover:text-white">
      <ArrowLeft className="h-3.5 w-3.5 transition-transform duration-300 group-hover:-translate-x-1" /> All accounts
    </Link>
  );

  if (!acc)
    return (
      <>
        {back}
        <div className="grid gap-5 xl:grid-cols-[1.25fr_1fr]">
          <Skeleton className="h-64 rounded-3xl" />
          <div className="grid grid-cols-2 gap-4">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-28 rounded-2xl" />
            ))}
          </div>
        </div>
        <Skeleton className="mt-5 h-80 rounded-2xl" />
      </>
    );

  return (
    <>
      {back}
      <h1 className="sr-only">Account {acc.loginCode}</h1>
      <div className="grid gap-5 xl:grid-cols-[1.25fr_1fr]">
        <div className="animate-page-in">
          <AccountPlate a={acc} countUp className="h-full">
            <Link
              href={`/trade?acc=${acc.id}`}
              className="inline-flex h-9 items-center gap-2 rounded-full bg-white px-4 text-sm font-semibold text-ink-950 transition-transform duration-300 hover:-translate-y-0.5"
            >
              <LineChart className="h-4 w-4" /> Trade this account
            </Link>
          </AccountPlate>
        </div>
        <div className="grid grid-cols-2 gap-4">
          {[
            { label: 'Equity', value: acc.equity, sub: acc.currency, icon: <Scale className="h-4 w-4" /> },
            ...(Number(acc.credit) > 0 ? [{ label: 'Credit', value: acc.credit, sub: 'Bonus, not withdrawable', icon: <Coins className="h-4 w-4" /> }] : []),
            { label: 'Free margin', value: acc.freeMargin, sub: 'Available for new positions', icon: <WalletMinimal className="h-4 w-4" /> },
            { label: 'Used margin', value: acc.usedMargin, sub: acc.marginLevel ? `Margin level ${acc.marginLevel}%` : 'No open positions', icon: <Lock className="h-4 w-4" /> },
          ].map((s, i) => (
            <div key={s.label} className="animate-page-in" style={{ animationDelay: `${100 + i * 70}ms` }}>
              <Stat label={s.label} icon={s.icon} value={<AnimatedNumber value={s.value} mountFrom={0} />} sub={s.sub} />
            </div>
          ))}
        </div>
      </div>

      <Card
        title="Statement"
        className="animate-page-in mt-5 [animation-delay:380ms]"
        action={
          <form className="flex flex-wrap items-end gap-2" onSubmit={(e) => e.preventDefault()}>
            <label className="text-[11px] text-ink-400">
              From
              <input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} className="ml-1.5 h-8 rounded-lg border border-white/10 bg-white/[0.03] px-2 text-xs text-white outline-none focus:border-brand-400/60" />
            </label>
            <label className="text-[11px] text-ink-400">
              To
              <input type="date" value={to} min={from} max={today} onChange={(e) => setTo(e.target.value)} className="ml-1.5 h-8 rounded-lg border border-white/10 bg-white/[0.03] px-2 text-xs text-white outline-none focus:border-brand-400/60" />
            </label>
            <a href={rangeOk ? dl('pdf') : undefined} download aria-disabled={!rangeOk} className={cn('inline-flex h-8 items-center gap-1.5 rounded-full bg-brand-500 px-3 text-xs font-semibold text-[#ffffff] transition-transform hover:-translate-y-0.5', !rangeOk && 'pointer-events-none opacity-50')}>
              <FileDown className="h-3.5 w-3.5" /> PDF
            </a>
            <a href={rangeOk ? dl('csv') : undefined} download aria-disabled={!rangeOk} className={cn('inline-flex h-8 items-center gap-1.5 rounded-full border border-white/15 px-3 text-xs font-semibold text-white transition-colors hover:border-brand-400/50', !rangeOk && 'pointer-events-none opacity-50')}>
              <FileDown className="h-3.5 w-3.5" /> CSV
            </a>
          </form>
        }
      >
        <p className="mb-3 text-xs text-ink-400">The download covers {from} to {to}: opening and closing balance, every deposit, withdrawal, credit and trade closed in the period. The table below is the live ledger.</p>
        <LedgerTable basePath={`/me/accounts/${id}`} version={version} />
      </Card>
    </>
  );
}
