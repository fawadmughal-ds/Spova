'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ArrowDownToLine, ArrowRight, ArrowUpFromLine, ArrowUpRight, Coins, LineChart, Lock, PartyPopper, Receipt, Scale, Settings2, WalletMinimal } from 'lucide-react';
import { WS_EVENTS, type KycStatusMap, type LedgerEntryDto, type Paginated, type PaymentRequestDto } from '@spova/shared';
import { useAuth } from '@/lib/auth-context';
import { useAccounts } from '@/lib/use-accounts';
import { get } from '@/lib/api';
import { useUserEvent } from '@/lib/ws';
import { cn, fmtDate, fmtMoney } from '@/lib/utils';
import { PageHeader } from '@/components/app-shell';
import { AnimatedNumber, Tilt } from '@/components/motion';
import { Badge, Card, Empty, Skeleton, Stat } from '@/components/ui';
import { AccountPlate, fmtLogin } from '@/components/portal/account-plate';
import { BalanceChart } from '@/components/portal/balance-chart';
import { KycSteps } from '@/components/portal/kyc-steps';
import { LedgerIcon } from '@/components/portal/ledger-icon';
import { MarginGauge } from '@/components/portal/margin-gauge';
import { PaymentRow } from '@/components/portal/payment-row';
import { SlidingTabs } from '@/components/portal/sliding-tabs';

function greeting() {
  const h = new Date().getHours();
  return h < 5 ? 'Good night' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

/** The client dashboard: balances, KYC steps, recent activity. Rendered as the /app page and inside the terminal overlay. */
export function DashboardView() {
  const { me, refresh } = useAuth();
  const { all, data, connected } = useAccounts();
  const welcome = useSearchParams().get('welcome') === '1';
  const [selected, setSelected] = useState<string | null>(null);
  const [ledger, setLedger] = useState<LedgerEntryDto[] | null>(null);
  const ledgerFor = useRef<string | null>(null);
  // time-of-day greeting is local to the browser, so resolve it after mount
  const [hello, setHello] = useState('Hello');
  useEffect(() => setHello(greeting()), []);

  const account = all.find((a) => a.id === selected) ?? all[0];

  useEffect(() => {
    if (!account) return;
    // switching account shows the skeleton; a live balance change keeps the old rows until the new ones land
    if (ledgerFor.current !== account.id) setLedger(null);
    ledgerFor.current = account.id;
    get<Paginated<LedgerEntryDto>>(`/me/accounts/${account.id}/ledger?limit=8`)
      .then((r) => setLedger(r.items))
      .catch(() => setLedger([]));
  }, [account?.id, account?.balance, account?.credit]); // eslint-disable-line react-hooks/exhaustive-deps

  const kycDone = me?.kyc.poi && me?.kyc.por;

  // verification track shows "in review" / "rejected", not just approved flags
  const [kyc, setKyc] = useState<KycStatusMap | null>(null);
  const loadKyc = useCallback(() => get<KycStatusMap>('/me/kyc/status').then(setKyc).catch(() => {}), []);
  useEffect(() => {
    if (!kycDone) void loadKyc();
  }, [kycDone, loadKyc]);
  useUserEvent(WS_EVENTS.KYC_STATUS, () => {
    void loadKyc();
    void refresh();
  });

  // latest deposit / withdrawal requests across all accounts
  const [requests, setRequests] = useState<PaymentRequestDto[] | null>(null);
  const loadRequests = useCallback(
    () =>
      get<Paginated<PaymentRequestDto>>('/me/payments?limit=4')
        .then((r) => setRequests(r.items))
        .catch(() => setRequests([])),
    [],
  );
  useEffect(() => {
    void loadRequests();
  }, [loadRequests]);
  useUserEvent(WS_EVENTS.PAYMENT_STATUS, () => void loadRequests());

  return (
    <>
      <PageHeader
        title={`${hello}, ${me?.profile?.firstName ?? 'trader'}`}
        sub="Your accounts at a glance."
        action={
          <span
            className={cn(
              'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] transition-colors duration-500',
              connected ? 'border-up/30 bg-up/10 text-up' : 'border-white/10 bg-white/[0.03] text-ink-400',
            )}
          >
            <span className={cn('live-dot !h-1.5 !w-1.5', !connected && 'animate-pulse after:hidden')} />
            {connected ? 'Live' : 'Connecting'}
          </span>
        }
      />

      {welcome && (
        <div className="animate-pop-in beam relative mb-6 flex items-start gap-4 overflow-hidden rounded-2xl border border-up/20 bg-up/[0.07] p-4 sm:p-5">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-up/15 text-up">
            <PartyPopper className="h-5 w-5" />
          </span>
          <div>
            <div className="font-display text-lg font-semibold">Welcome aboard</div>
            <p className="mt-0.5 text-sm text-ink-200">Your demo account is funded with virtual money. Verify your identity under Documents when you are ready to go live.</p>
          </div>
        </div>
      )}
      {me && !kycDone && <KycSteps poi={me.kyc.poi} por={me.kyc.por} status={kyc} />}

      {!data ? (
        <DashboardSkeleton />
      ) : !account ? (
        <Empty icon={<WalletMinimal className="h-6 w-6" />}>No trading account yet.</Empty>
      ) : (
        <>
          <div className="mb-5 flex flex-wrap items-center gap-3">
            <SlidingTabs
              value={account.id}
              onChange={setSelected}
              items={all.map((a) => ({
                value: a.id,
                label: (
                  <>
                    <span className={cn('h-1.5 w-1.5 rounded-full', a.type === 'live' ? 'bg-up shadow-[0_0_8px_rgb(var(--up-rgb))]' : 'bg-sky-400')} />
                    <span className="label !text-current">{a.type}</span>
                    <span className="tabular font-mono text-[13px]">{fmtLogin(a.loginCode)}</span>
                  </>
                ),
              }))}
            />
            <Link href="/app/accounts" className="group inline-flex items-center gap-1.5 text-sm text-brand-300">
              <Settings2 className="h-4 w-4 transition-transform duration-500 group-hover:rotate-90" />
              <span className="link-underline">Manage accounts</span>
            </Link>
          </div>

          {/* plate + dial */}
          <div className="grid gap-5 lg:grid-cols-3">
            <div key={account.id} className="animate-page-in lg:col-span-2">
              <Tilt max={3} className="h-full">
                <AccountPlate a={account} size="lg" countUp className="h-full">
                  <Link
                    href={`/client-area?acc=${account.id}`}
                    className="group/a inline-flex h-9 items-center gap-2 rounded-full bg-white px-4 text-sm font-semibold text-ink-950 transition-transform duration-300 hover:-translate-y-0.5"
                  >
                    <LineChart className="h-4 w-4" /> Trade this account
                    <ArrowRight className="h-3.5 w-3.5 transition-transform duration-300 group-hover/a:translate-x-0.5" />
                  </Link>
                  <Link
                    href={`/app/accounts/${account.id}`}
                    className="inline-flex h-9 items-center gap-2 rounded-full border border-white/15 px-4 text-sm text-ink-100 transition-colors duration-300 hover:border-white/40 hover:bg-white/[0.05]"
                  >
                    <Receipt className="h-4 w-4" /> Statement
                  </Link>
                </AccountPlate>
              </Tilt>
            </div>
            <Card title="Margin level" className="animate-page-in flex flex-col [animation-delay:90ms]" action={<span className="tabular font-mono text-[11px] text-ink-400">1:{account.leverage}</span>}>
              <MarginGauge key={account.id} level={account.marginLevel} usedMargin={account.usedMargin} freeMargin={account.freeMargin} />
            </Card>
          </div>

          {/* live figures: tween + flash whenever a snapshot arrives */}
          <div className="mt-5 grid grid-cols-2 gap-4 xl:grid-cols-4">
            {[
              { label: 'Equity', value: account.equity, sub: 'Balance + credit + floating P/L', icon: <Scale className="h-4 w-4" /> },
              { label: 'Free margin', value: account.freeMargin, sub: 'Available for new positions', icon: <WalletMinimal className="h-4 w-4" /> },
              { label: 'Used margin', value: account.usedMargin, sub: 'Held by open positions', icon: <Lock className="h-4 w-4" /> },
              ...(Number(account.credit) > 0 ? [{ label: 'Credit', value: account.credit, sub: 'Bonus, not withdrawable', icon: <Coins className="h-4 w-4" /> }] : []),
            ].map((s, i) => (
              <div key={s.label} className="animate-page-in" style={{ animationDelay: `${160 + i * 70}ms` }}>
                <Stat label={s.label} icon={s.icon} value={<AnimatedNumber key={account.id} value={s.value} mountFrom={0} />} sub={s.sub} />
              </div>
            ))}
          </div>

          <div className="mt-5 grid gap-5 lg:grid-cols-3">
            <Card
              title="Balance history"
              className="animate-page-in [animation-delay:420ms] lg:col-span-2"
              action={<span className="label">{ledger && ledger.length > 0 ? `last ${ledger.length} ${ledger.length === 1 ? 'entry' : 'entries'}` : 'ledger'}</span>}
            >
              {ledger === null ? <Skeleton className="h-52 rounded-xl" /> : <BalanceChart key={`${account.id}-${ledger[0]?.id ?? 'none'}`} entries={ledger} currency={account.currency} />}
            </Card>

            <Card title="Quick actions" className="animate-page-in [animation-delay:500ms]">
              <div className="grid gap-2.5">
                <ActionTile href={`/client-area?acc=${account.id}`} icon={<LineChart className="h-5 w-5" />} title="Open terminal" hint="Charts, orders and positions" primary />
                <ActionTile href="/app/payments" icon={<ArrowDownToLine className="h-5 w-5" />} title="Deposit" hint="Fund your account" />
                {account.type === 'demo' ? (
                  <ActionTile icon={<ArrowUpFromLine className="h-5 w-5" />} title="Withdraw" hint="Withdrawals are available on live accounts only." />
                ) : (
                  <ActionTile href="/app/payments?tab=withdraw" icon={<ArrowUpFromLine className="h-5 w-5" />} title="Withdraw" hint="Request a payout" />
                )}
              </div>
            </Card>
          </div>

          <div className="mt-5 grid gap-5 lg:grid-cols-3">
          <Card
            title="Recent transactions"
            className="animate-page-in min-w-0 [animation-delay:580ms] lg:col-span-2"
            action={
              <Link href={`/app/accounts/${account.id}`} className="group inline-flex items-center gap-1.5 text-xs text-brand-300">
                <span className="link-underline">
                  <span className="hidden sm:inline">Account {fmtLogin(account.loginCode)} </span>statement
                </span>
                <ArrowUpRight className="h-3.5 w-3.5 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
              </Link>
            }
          >
            {ledger === null ? (
              <div className="space-y-3">
                {[0, 1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-12 rounded-xl" />
                ))}
              </div>
            ) : ledger.length === 0 ? (
              <Empty icon={<Receipt className="h-6 w-6" />}>No transactions yet.</Empty>
            ) : (
              <ul key={`${account.id}-${ledger[0].id}`} className="-mx-2">
                {ledger.map((e, i) => {
                  const neg = e.amount.startsWith('-');
                  return (
                    <li
                      key={e.id}
                      className="animate-page-in group flex items-center gap-3.5 rounded-xl px-2 py-2.5 text-sm transition-colors duration-300 hover:bg-white/[0.035]"
                      style={{ animationDelay: `${i * 55}ms` }}
                    >
                      <LedgerIcon type={e.type} negative={neg} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <Badge tone={neg ? 'danger' : 'success'}>{e.type}</Badge>
                          <span className="truncate text-ink-200">{e.reason}</span>
                        </div>
                        <div className="mt-1 text-[11px] text-ink-500">{fmtDate(e.createdAt)}</div>
                      </div>
                      <div className="tabular text-right font-mono">
                        <div className={cn('font-semibold', neg ? 'text-down' : 'text-up')}>
                          {neg ? '' : '+'}
                          {fmtMoney(e.amount)}
                        </div>
                        <div className="mt-0.5 text-[11px] text-ink-500">bal {fmtMoney(e.balanceAfter)}</div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          <Card
            title="Recent requests"
            className="animate-page-in min-w-0 [animation-delay:640ms]"
            action={
              <Link href="/app/payments?tab=history" className="group inline-flex items-center gap-1.5 text-xs text-brand-300">
                <span className="link-underline">All requests</span>
                <ArrowUpRight className="h-3.5 w-3.5 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
              </Link>
            }
          >
            {requests === null ? (
              <div className="space-y-3">
                {[0, 1, 2].map((i) => (
                  <Skeleton key={i} className="h-12 rounded-xl" />
                ))}
              </div>
            ) : requests.length === 0 ? (
              <Empty icon={<ArrowDownToLine className="h-6 w-6" />}>
                No deposit or withdrawal requests yet.
                <div className="mt-2">
                  <Link href="/app/payments" className="group inline-flex items-center gap-1 text-sm font-medium text-brand-300">
                    <span className="link-underline">Make a deposit</span>
                    <ArrowRight className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-0.5" />
                  </Link>
                </div>
              </Empty>
            ) : (
              <ul key={requests[0].id + requests[0].status} className="-mx-2">
                {requests.map((p, i) => (
                  <PaymentRow key={p.id} p={p} index={i} compact />
                ))}
              </ul>
            )}
          </Card>
          </div>
        </>
      )}
    </>
  );
}

/** Row-shaped link with an icon that tips on hover. Without `href` it renders as an unavailable action. */
function ActionTile({ href, icon, title, hint, primary }: { href?: string; icon: React.ReactNode; title: string; hint: string; primary?: boolean }) {
  const body = (
    <>
      <span
        className={cn(
          'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-transform duration-500 ease-spring',
          href && 'group-hover:-rotate-6 group-hover:scale-110',
          primary ? 'bg-ink-950/15 text-ink-950' : href ? 'bg-brand-400/10 text-brand-300 ring-1 ring-inset ring-brand-400/20' : 'bg-white/[0.04] text-ink-500',
        )}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className={cn('block text-sm font-semibold', primary ? 'text-ink-950' : href ? 'text-white' : 'text-ink-400')}>{title}</span>
        <span className={cn('block text-xs', primary ? 'text-ink-950/70' : 'text-ink-500')}>{hint}</span>
      </span>
      {href ? (
        <ArrowRight className={cn('h-4 w-4 shrink-0 transition-transform duration-300 group-hover:translate-x-1', primary ? 'text-ink-950' : 'text-ink-500 group-hover:text-white')} />
      ) : (
        <Lock className="h-4 w-4 shrink-0 text-ink-600" />
      )}
    </>
  );
  const cls = cn(
    'group flex items-center gap-3.5 rounded-2xl p-3 text-left',
    primary
      ? 'btn btn-shine bg-gradient-to-b from-brand-300 to-brand-500 shadow-glow'
      : href
        ? 'border border-white/[0.07] bg-white/[0.03] transition-colors duration-300 hover:border-brand-400/30 hover:bg-white/[0.06]'
        : 'cursor-not-allowed border border-dashed border-white/[0.08]',
  );
  return href ? (
    <Link href={href} className={cls}>
      {body}
    </Link>
  ) : (
    <div className={cls} aria-disabled>
      {body}
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-5">
      <Skeleton className="h-11 w-72 rounded-2xl" />
      <div className="grid gap-5 lg:grid-cols-3">
        <Skeleton className="h-72 rounded-3xl lg:col-span-2" />
        <Skeleton className="h-72 rounded-3xl" />
      </div>
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-28 rounded-2xl" />
        ))}
      </div>
    </div>
  );
}
