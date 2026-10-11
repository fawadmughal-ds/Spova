'use client';

import { useCallback, useEffect, useMemo, useReducer, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowDownToLine, ArrowRight, ArrowUpFromLine, BadgeCheck, ChevronLeft, ChevronRight, FileCheck2, History, Lock, Plus, Receipt, ShieldCheck, Wallet } from 'lucide-react';
import { withdrawRequestSchema, WS_EVENTS, type AccountDto, type Paginated, type PaymentKind, type PaymentMethodDto, type PaymentRequestDto, type WsPaymentStatus } from '@spova/shared';
import { useAuth } from '@/lib/auth-context';
import { useAccounts } from '@/lib/use-accounts';
import { get, post } from '@/lib/api';
import { useUserEvent } from '@/lib/ws';
import { buttonClass } from '@/lib/button';
import { cn, fmtMoney } from '@/lib/utils';
import { PageHeader } from '@/components/app-shell';
import { useToast } from '@/components/toast';
import { Alert, Button, Empty, Input, Skeleton } from '@/components/ui';
import { SlidingTabs } from '@/components/portal/sliding-tabs';
import { AccountPicker } from '@/components/portal/account-picker';
import { MethodCards, methodIcon } from '@/components/portal/method-cards';
import { CashierDeposit } from '@/components/portal/cashier-deposit';
import { RequestDone } from '@/components/portal/request-done';
import { PaymentRow, shortId } from '@/components/portal/payment-row';
import { fmtLogin } from '@/components/portal/account-plate';
import { availableFrom, friendlyError, type FriendlyError } from '@/components/portal/api-error';

type Tab = 'deposit' | 'withdraw' | 'history';
const TABS: { value: Tab; label: ReactNode }[] = [
  { value: 'deposit', label: <><ArrowDownToLine className="h-4 w-4" /> Deposit</> },
  { value: 'withdraw', label: <><ArrowUpFromLine className="h-4 w-4" /> Withdraw</> },
  { value: 'history', label: <><History className="h-4 w-4" /> History</> },
];
const PRESETS = ['200', '500', '1000', '5000'];
const PAGE_SIZE = 10;

/**
 * Deposit / Withdraw / History. As a page the tab lives in the URL (?tab=); embedded in the terminal
 * overlay it is local state so switching tabs never leaves /trade.
 */
export function PaymentsView({ embedded = false, initialTab = 'deposit' }: { embedded?: boolean; initialTab?: Tab }) {
  const router = useRouter();
  const param = useSearchParams().get('tab');
  const [localTab, setLocalTab] = useState<Tab>(initialTab);
  const urlTab: Tab = param === 'withdraw' || param === 'history' ? param : 'deposit';
  const tab = embedded ? localTab : urlTab;
  const setTab = (t: Tab) => (embedded ? setLocalTab(t) : router.replace(t === 'deposit' ? '/app/payments' : `/app/payments?tab=${t}`, { scroll: false }));

  const { me } = useAuth();
  const { data, all } = useAccounts();
  const [methods, setMethods] = useState<PaymentMethodDto[] | null>(null);
  // bumps whenever a request is created, cancelled or decided, so lists refetch
  const [version, bump] = useReducer((x: number) => x + 1, 0);

  useEffect(() => {
    get<PaymentMethodDto[]>('/me/payments/methods')
      .then(setMethods)
      .catch(() => setMethods([]));
  }, []);
  // the back office decided on one of our requests (LiveNotices toasts it)
  useUserEvent<WsPaymentStatus>(WS_EVENTS.PAYMENT_STATUS, () => bump());

  const live = all.filter((a) => a.type === 'live');
  const kycDone = !!(me?.kyc.poi && me?.kyc.por);

  return (
    <>
      <PageHeader
        title="Deposit / Withdraw"
        sub="Requests are reviewed by our back office; your balance updates the moment one is approved."
        action={
          kycDone ? (
            <span className="inline-flex items-center gap-2 rounded-full border border-up/30 bg-up/10 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-up">
              <BadgeCheck className="h-3 w-3" /> Verified
            </span>
          ) : (
            <Link href="/app/documents" className="group inline-flex items-center gap-2 rounded-full border border-gold/40 bg-gold/10 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-gold">
              <Lock className="h-3 w-3" /> Verification pending <ArrowRight className="h-3 w-3 transition-transform duration-300 group-hover:translate-x-0.5" />
            </Link>
          )
        }
      />
      <SlidingTabs variant="underline" items={TABS} value={tab} onChange={setTab} className="mb-6" />

      {!data || methods === null ? (
        <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
          <Skeleton className="h-96 rounded-2xl" />
          <Skeleton className="h-64 rounded-2xl" />
        </div>
      ) : (
        <div key={tab} className="animate-page-in">
          {tab === 'deposit' &&
            (live.length === 0 ? <NoLiveAccount kycDone={kycDone} demo={data.demo} /> : <CashierDeposit accounts={all} methods={methods} onCreated={bump} onHistory={() => setTab('history')} />)}
          {tab === 'withdraw' &&
            (!kycDone ? <KycGate /> : live.length === 0 ? <NoLiveAccount kycDone demo={data.demo} /> : <WithdrawForm accounts={all} methods={methods} onCreated={bump} onHistory={() => setTab('history')} />)}
          {tab === 'history' && <HistoryList methods={methods} version={version} onChanged={bump} />}
        </div>
      )}
    </>
  );
}


// ---------------------------------------------------------------- gates

/** Shown when the client has no live account: the demo plates are not eligible for real money. */
function NoLiveAccount({ kycDone, demo }: { kycDone: boolean; demo: AccountDto[] }) {
  return (
    <section className="card corners overflow-hidden p-6 sm:p-8" style={{ '--corner': 'rgb(var(--brand-rgb) / 0.35)' } as React.CSSProperties}>
      <div className="grid items-center gap-8 lg:grid-cols-[1fr_340px]">
        <div>
          <div className="label !text-brand-300">Live account required</div>
          <h2 className="mt-2 font-display text-2xl font-bold tracking-tight sm:text-3xl">Real money moves on live accounts only</h2>
          <p className="mt-3 max-w-lg text-sm text-ink-300">
            {demo.length > 0 ? `Your demo account${demo.length > 1 ? 's' : ''} ${demo.map((a) => fmtLogin(a.loginCode)).join(', ')} run${demo.length > 1 ? '' : 's'} on virtual funds and cannot receive deposits or send withdrawals. ` : ''}
            {kycDone ? 'You are verified, so a live account takes a few seconds to open.' : 'Opening a live account takes two steps: verify your identity, then open the account.'}
          </p>
          <ol className="mt-6 grid gap-3 sm:grid-cols-2">
            <GateStep n={1} done={kycDone} title="Verify identity" hint="ID and proof of address" href="/app/documents" cta={kycDone ? 'View documents' : 'Upload documents'} icon={<FileCheck2 className="h-4 w-4" />} />
            <GateStep n={2} done={false} title="Open live account" hint="Choose leverage and currency" href="/app/accounts" cta="Go to accounts" icon={<Wallet className="h-4 w-4" />} locked={!kycDone} />
          </ol>
        </div>
        <div className="relative hidden overflow-hidden rounded-3xl border border-dashed border-white/10 p-6 lg:block">
          <div className="bg-dots pointer-events-none absolute inset-0" aria-hidden />
          <div className="label relative">Why</div>
          <ul className="relative mt-3 space-y-3 text-sm text-ink-300">
            {['Deposits are matched to a verified identity, as regulations require.', 'Withdrawals go only to a destination in your own name.', 'Demo balances are reset freely and never represent money.'].map((t) => (
              <li key={t} className="flex gap-2.5">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand-300" />
                {t}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

function GateStep({ n, done, locked, title, hint, href, cta, icon }: { n: number; done: boolean; locked?: boolean; title: string; hint: string; href: string; cta: string; icon: ReactNode }) {
  return (
    <li className={cn('flex flex-col gap-3 rounded-2xl border p-4 transition-colors duration-300', done ? 'border-up/25 bg-up/[0.05]' : locked ? 'border-dashed border-white/[0.08]' : 'border-brand-400/30 bg-brand-400/[0.05]')}>
      <div className="flex items-center gap-3">
        <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-xl font-mono text-xs font-semibold', done ? 'bg-up text-ink-950' : locked ? 'bg-white/[0.04] text-ink-500' : 'bg-brand-400/15 text-brand-300')}>{done ? <BadgeCheck className="h-4 w-4" /> : n}</span>
        <div className="min-w-0">
          <div className={cn('text-sm font-semibold', locked ? 'text-ink-400' : 'text-white')}>{title}</div>
          <div className="text-xs text-ink-500">{hint}</div>
        </div>
      </div>
      {locked ? (
        <span className="inline-flex items-center gap-1.5 text-xs text-ink-500">
          <Lock className="h-3 w-3" /> Unlocks after verification
        </span>
      ) : (
        <Link href={href} className={buttonClass(done ? 'ghost' : 'primary', 'sm', 'group self-start rounded-full')}>
          {icon} {cta} <ArrowRight className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-0.5" />
        </Link>
      )}
    </li>
  );
}

/** Withdrawals need identity and address approved. */
function KycGate() {
  return (
    <section className="card corners p-6 sm:p-8" style={{ '--corner': 'rgb(var(--gold-rgb) / 0.4)' } as React.CSSProperties}>
      <div className="flex flex-wrap items-center gap-6">
        <span className="relative flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gold/10 text-gold ring-1 ring-inset ring-gold/30">
          <span className="absolute inset-0 animate-pulse-ring rounded-2xl border border-gold/50" />
          <Lock className="h-7 w-7" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="label !text-gold">Verification required</div>
          <h2 className="mt-1 font-display text-2xl font-bold tracking-tight">Withdrawals unlock after identity and address checks</h2>
          <p className="mt-2 max-w-xl text-sm text-ink-300">We can only send money to the verified owner of the account. Upload your ID and a proof of address; most reviews finish within one business day.</p>
        </div>
        <Link href="/app/documents" className={buttonClass('primary', 'md', 'group rounded-full')}>
          <FileCheck2 className="h-4 w-4" /> Upload documents <ArrowRight className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-0.5" />
        </Link>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------- form bits

function StepTitle({ n, children, aside }: { n: number; children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h3 className="flex items-center gap-2.5 text-sm font-semibold text-ink-100">
        <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-brand-400/10 font-mono text-[11px] text-brand-300 ring-1 ring-inset ring-brand-400/20">{n}</span>
        {children}
      </h3>
      {aside}
    </div>
  );
}

function AmountField({ value, onChange, error, hint, presets = PRESETS }: { value: string; onChange: (v: string) => void; error?: string; hint?: ReactNode; presets?: string[] }) {
  return (
    <div>
      <Input
        label="Amount"
        name="amount"
        inputMode="decimal"
        autoComplete="off"
        placeholder="0.00"
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/[^\d.]/g, ''))}
        error={error}
        className="tabular font-mono text-base"
        right={<span className="font-mono text-xs text-ink-400">USD</span>}
      />
      {!error && hint && <div className="mt-1.5 text-xs text-ink-500">{hint}</div>}
      <div className="mt-2.5 flex flex-wrap gap-2">
        {presets.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => onChange(p)}
            className={cn(
              'tabular rounded-full border px-3 py-1 font-mono text-xs transition-colors duration-300',
              value === p ? 'border-brand-400/60 bg-brand-400/10 text-brand-300' : 'border-white/10 text-ink-300 hover:border-brand-400/40 hover:text-brand-300',
            )}
          >
            ${Number(p).toLocaleString('en-US')}
          </button>
        ))}
      </div>
    </div>
  );
}

function ErrorBanner({ error }: { error: FriendlyError | null }) {
  if (!error) return null;
  return (
    <Alert tone="danger">
      <div className="font-semibold">{error.title}</div>
      {error.body && <div className="mt-0.5 text-xs opacity-90">{error.body}</div>}
      {error.link && (
        <Link href={error.link.href} className="group mt-1.5 inline-flex items-center gap-1 text-xs font-medium">
          <span className="link-underline">{error.link.label}</span>
          <ArrowRight className="h-3 w-3 transition-transform duration-300 group-hover:translate-x-0.5" />
        </Link>
      )}
    </Alert>
  );
}

function SummaryRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-sm">
      <span className="text-ink-500">{label}</span>
      <span className="min-w-0 truncate text-right text-ink-100">{children}</span>
    </div>
  );
}

/** Confirmation after a request was accepted by the server. */
// ---------------------------------------------------------------- withdraw

function WithdrawForm({ accounts, methods, onCreated, onHistory }: { accounts: AccountDto[]; methods: PaymentMethodDto[]; onCreated: () => void; onHistory: () => void }) {
  const toast = useToast();
  const live = accounts.filter((a) => a.type === 'live' && a.status === 'enabled');
  const usable = methods.filter((m) => m.enabled && m.kinds.includes('withdraw'));
  const [accountId, setAccountId] = useState<string | null>(live[0]?.id ?? null);
  const [method, setMethod] = useState<string | null>(usable[0]?.id ?? null);
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [fieldErr, setFieldErr] = useState<Record<string, string>>({});
  const [error, setError] = useState<FriendlyError | null>(null);
  const [available, setAvailable] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<PaymentRequestDto | null>(null);

  const m = methods.find((x) => x.id === method);
  const account = accounts.find((a) => a.id === accountId);
  const Icon = methodIcon(method ?? '');

  // the server is the authority on what can leave; it tells us on a refused attempt
  useEffect(() => setAvailable(null), [accountId]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const parsed = withdrawRequestSchema.safeParse({ accountId: accountId ?? '', amount, method: method ?? '', reason: reason.trim() || undefined });
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      for (const i of parsed.error.issues) errs[i.path.join('.')] ??= i.message;
      if (errs.accountId) errs.accountId = 'Choose a live account';
      if (errs.method) errs.method = 'Choose a method';
      setFieldErr(errs);
      return;
    }
    setFieldErr({});
    setBusy(true);
    try {
      const req = await post<PaymentRequestDto>('/me/payments/withdraw', parsed.data);
      toast({ title: 'Withdrawal request sent', body: `${fmtMoney(req.amount)} ${req.currency} · #${shortId(req.id)}`, level: 'success' });
      setDone(req);
      onCreated();
    } catch (err) {
      const f = friendlyError(err);
      setError(f);
      const avail = availableFrom(err);
      if (avail !== null) {
        setAvailable(avail);
        setFieldErr({ amount: `Available: ${fmtMoney(avail)} USD` });
      } else if (f.code === 'amount_min' || f.code === 'amount_max') setFieldErr({ amount: f.body ?? f.title });
    } finally {
      setBusy(false);
    }
  };

  if (done)
    return (
      <RequestDone
        req={done}
        method={methods.find((x) => x.id === done.method)}
        onAgain={() => {
          setDone(null);
          setAmount('');
          setReason('');
        }}
        onHistory={onHistory}
      />
    );

  return (
    <form onSubmit={submit} noValidate className="grid gap-5 lg:grid-cols-[1fr_320px]">
      <div className="card min-w-0 space-y-7 p-5 sm:p-6">
        <section>
          <StepTitle n={1}>Withdraw from</StepTitle>
          <AccountPicker name="withdraw-account" accounts={live} value={accountId} onChange={setAccountId} />
          {fieldErr.accountId && <p className="animate-pop-in mt-1.5 text-xs text-down">{fieldErr.accountId}</p>}
        </section>
        <section>
          <StepTitle n={2}>Payout method</StepTitle>
          <MethodCards methods={methods} kind="withdraw" value={method} onChange={setMethod} />
          {fieldErr.method && <p className="animate-pop-in mt-1.5 text-xs text-down">{fieldErr.method}</p>}
        </section>
        <section>
          <StepTitle n={3}>Amount</StepTitle>
          <div className="grid gap-4 sm:grid-cols-2">
            <AmountField
              value={amount}
              onChange={setAmount}
              error={fieldErr.amount}
              hint={
                <>
                  Available balance for withdrawal: <span className="tabular font-mono text-ink-200">{fmtMoney(available ?? account?.balance ?? '0')} USD</span>. You can withdraw any amount up to this.
                </>
              }
            />
            <Input label="Reason (optional)" name="reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Taking profit" maxLength={200} />
          </div>
        </section>
      </div>

      <aside className="min-w-0 lg:sticky lg:top-24 lg:self-start">
        <div className="card p-5">
          <div className="label">Summary</div>
          <div className="mt-4 flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-down/10 text-down ring-1 ring-inset ring-down/25">
              <Icon className="h-5 w-5" />
            </span>
            <div className="tabular font-display text-2xl font-bold tracking-tight">{amount && !Number.isNaN(Number(amount)) ? fmtMoney(amount) : '0.00'} <span className="font-mono text-sm font-medium text-ink-400">USD</span></div>
          </div>
          <div className="mt-5 space-y-2.5 border-t border-white/[0.06] pt-4">
            <SummaryRow label="From account">{account ? <span className="tabular font-mono">{fmtLogin(account.loginCode)}</span> : '—'}</SummaryRow>
            <SummaryRow label="Method">{m?.label ?? '—'}</SummaryRow>
            <SummaryRow label="Processing">{m?.eta ?? '—'}</SummaryRow>
          </div>
          <div className="mt-5">
            <ErrorBanner error={error} />
          </div>
          <Button type="submit" size="lg" className="mt-4 w-full" loading={busy} disabled={!accountId || !method}>
            <ArrowUpFromLine className="h-4 w-4" /> Submit withdrawal request
          </Button>
          <p className="mt-3 text-center text-[11px] leading-relaxed text-ink-500">Pending withdrawals are counted against your available funds until decided. You can cancel while pending.</p>
        </div>
      </aside>
    </form>
  );
}

// ---------------------------------------------------------------- history

type KindFilter = 'all' | PaymentKind;
const KIND_TABS: { value: KindFilter; label: ReactNode }[] = [
  { value: 'all', label: 'All' },
  { value: 'deposit', label: <><ArrowDownToLine className="h-3.5 w-3.5" /> Deposits</> },
  { value: 'withdraw', label: <><ArrowUpFromLine className="h-3.5 w-3.5" /> Withdrawals</> },
];

function HistoryList({ methods, version, onChanged }: { methods: PaymentMethodDto[]; version: number; onChanged: () => void }) {
  const [kind, setKind] = useState<KindFilter>('all');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Paginated<PaymentRequestDto> | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const q = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
      if (kind !== 'all') q.set('kind', kind);
      setData(await get<Paginated<PaymentRequestDto>>(`/me/payments?${q}`));
      setError(null);
    } catch (e) {
      setError((e as Error).message);
      setData({ items: [], total: 0, page, limit: PAGE_SIZE });
    }
  }, [kind, page]);

  useEffect(() => {
    void load();
  }, [load, version]);

  const pages = useMemo(() => Math.max(1, Math.ceil((data?.total ?? 0) / PAGE_SIZE)), [data?.total]);
  const pending = data?.items.filter((p) => p.status === 'pending').length ?? 0;

  return (
    <section className="card p-5 sm:p-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <SlidingTabs
          items={KIND_TABS}
          value={kind}
          onChange={(k) => {
            setKind(k);
            setPage(1);
          }}
        />
        <span className="font-mono text-[11px] text-ink-400">
          {data ? (
            <>
              <span className="text-ink-100">{data.total}</span> request{data.total === 1 ? '' : 's'}
              {pending > 0 && <span className="text-gold"> · {pending} pending</span>}
            </>
          ) : (
            'loading'
          )}
        </span>
      </div>

      {data === null ? (
        <div className="space-y-2.5">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 rounded-2xl" />
          ))}
        </div>
      ) : data.items.length === 0 ? (
        <Empty icon={<Receipt className="h-6 w-6" />}>
          {error ? error : kind === 'all' ? 'No deposit or withdrawal requests yet.' : `No ${kind === 'deposit' ? 'deposit' : 'withdrawal'} requests yet.`}
          {!error && (
            <div className="mt-3">
              <Link href="/app/payments" className="group inline-flex items-center gap-1.5 text-sm font-medium text-brand-300">
                <span className="link-underline">Make a deposit</span>
                <ArrowRight className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-0.5" />
              </Link>
            </div>
          )}
        </Empty>
      ) : (
        <ul key={`${kind}-${page}-${data.items[0]?.id}`} className="space-y-2.5">
          {data.items.map((p, i) => (
            <PaymentRow
              key={p.id}
              p={p}
              index={i}
              methods={methods}
              onChanged={(u) => {
                setData((d) => (d ? { ...d, items: d.items.map((x) => (x.id === u.id ? u : x)) } : d));
                onChanged();
              }}
            />
          ))}
        </ul>
      )}

      {pages > 1 && (
        <div className="mt-4 flex items-center justify-between gap-4 border-t border-white/[0.05] pt-4">
          <span className="font-mono text-[11px] text-ink-400">
            page <span className="text-ink-100">{page}</span> of {pages}
          </span>
          <div className="flex items-center gap-2">
            <PageButton label="Previous page" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </PageButton>
            <PageButton label="Next page" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>
              <ChevronRight className="h-4 w-4" />
            </PageButton>
          </div>
        </div>
      )}
    </section>
  );
}

function PageButton({ label, disabled, onClick, children }: { label: string; disabled: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 text-ink-200 transition-colors duration-300 enabled:hover:border-brand-400/50 enabled:hover:bg-brand-400/10 enabled:hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
    >
      {children}
    </button>
  );
}
