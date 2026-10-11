'use client';

import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import { ArrowRight, FlaskConical, LineChart, Lock, Plus, Receipt, ShieldCheck } from 'lucide-react';
import type { AccountDto } from '@spova/shared';
import { useAccounts } from '@/lib/use-accounts';
import { useAuth } from '@/lib/auth-context';
import { post, ApiError } from '@/lib/api';
import { cn } from '@/lib/utils';
import { PageHeader } from '@/components/app-shell';
import { useToast } from '@/components/toast';
import { Button, Skeleton } from '@/components/ui';
import { AccountPlate } from '@/components/portal/account-plate';

const MAX_LIVE = 1;
const MAX_DEMO = 3;

function AccountCard({ a, index }: { a: AccountDto; index: number }) {
  return (
    <div className="animate-page-in" style={{ animationDelay: `${index * 90}ms` }}>
      <AccountPlate a={a} className="h-full">
        <Link
          href={`/client-area?acc=${a.id}`}
          className="group/a inline-flex h-9 flex-1 items-center justify-center gap-2 rounded-full bg-white px-4 text-sm font-semibold text-ink-950 transition-transform duration-300 hover:-translate-y-0.5"
        >
          <LineChart className="h-4 w-4" /> Trade
          <ArrowRight className="h-3.5 w-3.5 transition-transform duration-300 group-hover/a:translate-x-0.5" />
        </Link>
        <Link
          href={`/app/accounts/${a.id}`}
          className="inline-flex h-9 flex-1 items-center justify-center gap-2 rounded-full border border-white/15 px-4 text-sm text-ink-100 transition-colors duration-300 hover:border-white/40 hover:bg-white/[0.05]"
        >
          <Receipt className="h-4 w-4" /> Statement
        </Link>
      </AccountPlate>
    </div>
  );
}

/** Section heading with a slot counter drawn as pips: filled = accounts opened, hollow = slots left. */
function GroupHead({ icon, title, hint, used, max, action }: { icon: ReactNode; title: string; hint: string; used: number; max: number; action: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div className="flex items-center gap-3.5">
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.04] text-brand-300">{icon}</span>
        <div>
          <h2 className="flex items-center gap-3 text-xl font-bold">
            {title}
            <span className="flex items-center gap-1" title={`${used} of ${max} used`}>
              {Array.from({ length: max }, (_, i) => (
                <span key={i} className={cn('h-1.5 w-4 rounded-full transition-colors duration-500', i < used ? 'bg-brand-400 shadow-[0_0_8px_rgb(var(--brand-rgb)/0.6)]' : 'bg-white/10')} />
              ))}
            </span>
          </h2>
          <p className="text-xs text-ink-400">{hint}</p>
        </div>
      </div>
      {action}
    </div>
  );
}

/** Dashed placeholder the size of a plate. */
function EmptySlot({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <div className="bg-dots animate-page-in flex min-h-[220px] flex-col items-center justify-center gap-3 rounded-3xl border border-dashed border-white/10 p-8 text-center text-sm text-ink-400">
      <span className="relative flex h-12 w-12 items-center justify-center rounded-2xl bg-white/[0.04] text-ink-400">
        <span className="absolute inset-0 animate-pulse-ring rounded-2xl border border-white/15" />
        {icon}
      </span>
      <div className="max-w-xs">{children}</div>
    </div>
  );
}

export function AccountsView() {
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
        <div className="grid gap-5 md:grid-cols-2">
          <Skeleton className="h-64 rounded-3xl" />
          <Skeleton className="h-64 rounded-3xl" />
        </div>
      ) : (
        <div className="space-y-12">
          <section>
            <GroupHead
              icon={<ShieldCheck className="h-5 w-5" />}
              title="Live accounts"
              hint="Real funds. Deposits and withdrawals enabled."
              used={data.live.length}
              max={MAX_LIVE}
              action={
                <Button
                  size="sm"
                  variant="outline"
                  className="group h-9 rounded-full px-4"
                  onClick={() => void create('live')}
                  loading={busy === 'live'}
                  disabled={!kycDone || data.live.length >= MAX_LIVE}
                  title={!kycDone ? 'Complete verification first' : undefined}
                >
                  {!kycDone ? <Lock className="h-3.5 w-3.5" /> : <Plus className="h-4 w-4 transition-transform duration-500 group-hover:rotate-90" />} Open live account
                </Button>
              }
            />
            {data.live.length === 0 ? (
              <EmptySlot icon={kycDone ? <Plus className="h-5 w-5" /> : <Lock className="h-5 w-5" />}>
                {kycDone ? (
                  'No live account yet.'
                ) : (
                  <>
                    Verify your identity to open a live account.{' '}
                    <Link href="/app/documents" className="group inline-flex items-center gap-1 font-medium text-brand-300">
                      <span className="link-underline">Go to Documents</span>
                      <ArrowRight className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-0.5" />
                    </Link>
                  </>
                )}
              </EmptySlot>
            ) : (
              <div className="grid gap-5 md:grid-cols-2">
                {data.live.map((a, i) => (
                  <AccountCard key={a.id} a={a} index={i} />
                ))}
              </div>
            )}
          </section>

          <section>
            <GroupHead
              icon={<FlaskConical className="h-5 w-5" />}
              title="Demo accounts"
              hint="Virtual funds for practice. Same terminal, same rules."
              used={data.demo.length}
              max={MAX_DEMO}
              action={
                <Button size="sm" variant="outline" className="group h-9 rounded-full px-4" onClick={() => void create('demo')} loading={busy === 'demo'} disabled={data.demo.length >= MAX_DEMO}>
                  <Plus className="h-4 w-4 transition-transform duration-500 group-hover:rotate-90" /> New demo
                </Button>
              }
            />
            {data.demo.length === 0 ? (
              <EmptySlot icon={<FlaskConical className="h-5 w-5" />}>No demo account yet.</EmptySlot>
            ) : (
              <div className="grid gap-5 md:grid-cols-2">
                {data.demo.map((a, i) => (
                  <AccountCard key={a.id} a={a} index={i} />
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </>
  );
}
