'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import type { AccountDto } from '@spova/shared';
import { useAccounts } from '@/lib/use-accounts';
import { useAuth } from '@/lib/auth-context';
import { post, ApiError } from '@/lib/api';
import { fmtMoney } from '@/lib/utils';
import { PageHeader } from '@/components/app-shell';
import { useToast } from '@/components/toast';
import { Badge, Button, Card, Empty, Spinner } from '@/components/ui';

function AccountCard({ a }: { a: AccountDto }) {
  return (
    <div className="card p-5">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Badge tone={a.type === 'live' ? 'success' : 'info'}>{a.type}</Badge>
            <Badge tone="neutral">{a.tier}</Badge>
            {a.tradingBlocked && <Badge tone="danger">trading blocked</Badge>}
            {a.status !== 'enabled' && <Badge tone="warning">{a.status}</Badge>}
          </div>
          <div className="mt-2 text-xs uppercase tracking-wider text-ink-500">Login</div>
          <div className="tabular text-xl font-bold">{a.loginCode}</div>
        </div>
        <div className="text-right">
          <div className="text-xs uppercase tracking-wider text-ink-500">Equity</div>
          <div className="tabular text-xl font-bold">{fmtMoney(a.equity, a.currency)}</div>
        </div>
      </div>
      <dl className="mt-4 grid grid-cols-3 gap-3 border-t border-white/5 pt-4 text-sm">
        <div>
          <dt className="text-[11px] uppercase tracking-wider text-ink-500">Balance</dt>
          <dd className="tabular">{fmtMoney(a.balance)}</dd>
        </div>
        <div>
          <dt className="text-[11px] uppercase tracking-wider text-ink-500">Free margin</dt>
          <dd className="tabular">{fmtMoney(a.freeMargin)}</dd>
        </div>
        <div>
          <dt className="text-[11px] uppercase tracking-wider text-ink-500">Leverage</dt>
          <dd className="tabular">1:{a.leverage}</dd>
        </div>
      </dl>
      <div className="mt-4 flex gap-2">
        <Link href={`/trade?acc=${a.id}`} className="flex-1">
          <Button className="w-full" size="sm">
            Trade
          </Button>
        </Link>
        <Link href={`/app/accounts/${a.id}`} className="flex-1">
          <Button className="w-full" size="sm" variant="outline">
            Statement
          </Button>
        </Link>
      </div>
    </div>
  );
}

export default function AccountsPage() {
  const { data, reload } = useAccounts();
  const { me } = useAuth();
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);

  const create = async (type: 'demo' | 'live') => {
    setBusy(type);
    try {
      await post('/me/accounts', { type });
      toast({ title: `${type === 'live' ? 'Live' : 'Demo'} account created`, level: 'success' });
      await reload();
    } catch (e) {
      toast({ title: 'Could not create account', body: e instanceof ApiError ? e.message : undefined, level: 'danger' });
    } finally {
      setBusy(null);
    }
  };

  const kycDone = me?.kyc.poi && me?.kyc.por;

  return (
    <>
      <PageHeader title="Trading accounts" sub="Demo accounts use virtual funds. Live accounts require verification." />
      {!data ? (
        <div className="flex justify-center py-20">
          <Spinner />
        </div>
      ) : (
        <div className="space-y-8">
          <section>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-semibold">Live accounts</h2>
              <Button size="sm" variant="outline" onClick={() => void create('live')} loading={busy === 'live'} disabled={!kycDone || data.live.length >= 1} title={!kycDone ? 'Complete verification first' : undefined}>
                <Plus className="h-4 w-4" /> Open live account
              </Button>
            </div>
            {data.live.length === 0 ? (
              <Card>
                <Empty>
                  {kycDone ? 'No live account yet.' : (
                    <>
                      Verify your identity to open a live account.{' '}
                      <Link href="/app/documents" className="text-brand-300 underline">
                        Go to Documents
                      </Link>
                    </>
                  )}
                </Empty>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {data.live.map((a) => (
                  <AccountCard key={a.id} a={a} />
                ))}
              </div>
            )}
          </section>

          <section>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-semibold">Demo accounts</h2>
              <Button size="sm" variant="outline" onClick={() => void create('demo')} loading={busy === 'demo'} disabled={data.demo.length >= 3}>
                <Plus className="h-4 w-4" /> New demo
              </Button>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {data.demo.map((a) => (
                <AccountCard key={a.id} a={a} />
              ))}
            </div>
          </section>
        </div>
      )}
    </>
  );
}
