'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { loadStripe, type Stripe, type StripeCardNumberElement, type StripeElements } from '@stripe/stripe-js';
import { CardCvcElement, CardExpiryElement, CardNumberElement, Elements, useElements, useStripe } from '@stripe/react-stripe-js';
import { ChevronLeft, ChevronRight, CreditCard, Landmark, Lock, PencilLine, Wallet } from 'lucide-react';
import { cardIntentSchema, depositRequestSchema, type AccountDto, type CardIntentDto, type CashierInfoDto, type PaymentMethodDto, type PaymentRequestDto } from '@spova/shared';
import { useAuth } from '@/lib/auth-context';
import { get, post, upload } from '@/lib/api';
import { cn, fmtMoney } from '@/lib/utils';
import { useToast } from '@/components/toast';
import { Button } from '@/components/ui';
import { fmtLogin } from './account-plate';
import { PayToPanel, ProofPicker } from './deposit-channel';
import { RequestDone } from './request-done';
import { friendlyError } from './api-error';

const PRESETS = ['200', '500', '1000'];
type Group = 'main' | 'alt';
interface Tile {
  id: string;
  label: string;
  group: Group;
  logo: ReactNode;
}

/* ---------- little logos (the reference strip shows provider marks, not icons) */
function VisaMc() {
  return (
    <span className="flex items-center gap-1">
      <span className="font-display text-[15px] font-black italic tracking-tight text-[#1a1f71]">VISA</span>
      <span className="relative ml-0.5 inline-block h-[18px] w-[28px]">
        <span className="absolute left-0 top-0 h-[18px] w-[18px] rounded-full bg-[#eb001b]" />
        <span className="absolute left-[10px] top-0 h-[18px] w-[18px] rounded-full bg-[#f79e1b] opacity-90" />
      </span>
    </span>
  );
}
function UpiMark() {
  return (
    <span className="inline-flex items-center gap-0.5 font-display text-[13px] font-black italic tracking-tight text-[#3b3b3b]">
      UPI
      <span className="inline-block h-3 w-[7px] skew-x-[-18deg] rounded-[1px] bg-[#f58220]" />
      <span className="-ml-1 inline-block h-3 w-[7px] skew-x-[-18deg] rounded-[1px] bg-[#097939]" />
    </span>
  );
}
function BinanceMark() {
  return <span className="font-display text-[12px] font-black tracking-tight text-[#f0b90b]">BINANCE PAY</span>;
}
function CryptoMark() {
  return (
    <span className="relative inline-block h-[22px] w-[34px]">
      <span className="absolute left-0 top-0 flex h-[22px] w-[22px] items-center justify-center rounded-full bg-[#26a17b] text-[10px] font-black text-white">₮</span>
      <span className="absolute left-[12px] top-0 flex h-[22px] w-[22px] items-center justify-center rounded-full bg-[#f7931a] text-[10px] font-black text-white">₿</span>
    </span>
  );
}
function BankMark() {
  return (
    <span className="inline-flex items-center gap-1 rounded bg-[#111827] px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-[#ffffff]">
      <Landmark className="h-3.5 w-3.5" /> Bank
    </span>
  );
}

const TILE_META: Record<string, { label: string; group: Group; logo: ReactNode; order: number }> = {
  card: { label: 'Credit or Debit Card', group: 'main', logo: <VisaMc />, order: 0 },
  upi: { label: 'UPI', group: 'main', logo: <UpiMark />, order: 1 },
  bank: { label: 'Local Bank Transfer', group: 'main', logo: <BankMark />, order: 2 },
  binance: { label: 'Binance Pay', group: 'alt', logo: <BinanceMark />, order: 3 },
  crypto_usdt: { label: 'Crypto (USDT)', group: 'alt', logo: <CryptoMark />, order: 4 },
};

const stripeLoaders = new Map<string, Promise<Stripe | null>>();
const stripeFor = (pk: string) => {
  if (!stripeLoaders.has(pk)) stripeLoaders.set(pk, loadStripe(pk));
  return stripeLoaders.get(pk)!;
};

/**
 * The cashier: Main / Alternative payment tabs, a provider strip, "Secure deposit using ..." form with amount
 * presets, the local-currency line, the deposit declaration and the green Deposit button (reference: MatchTrader cashier).
 * Cards go through the gateway (Stripe Elements); bank, UPI, Binance Pay and USDT show pay-to details + proof upload.
 */
export function CashierDeposit({ accounts, methods, onCreated, onHistory }: { accounts: AccountDto[]; methods: PaymentMethodDto[]; onCreated: () => void; onHistory: () => void }) {
  const tiles = useMemo<Tile[]>(() => {
    const out: Tile[] = [];
    for (const m of methods) {
      const meta = TILE_META[m.id];
      if (!meta) continue;
      // card always shows (payment-link mode until a gateway is connected); other tiles need the deposit side switched on
      if (m.id !== 'card' && !(m.enabled && m.kinds.includes('deposit'))) continue;
      out.push({ id: m.id, label: meta.label, group: meta.group, logo: meta.logo });
    }
    return out.sort((a, b) => TILE_META[a.id].order - TILE_META[b.id].order);
  }, [methods]);
  const [group, setGroup] = useState<Group>('main');
  const visible = tiles.filter((t) => t.group === group);
  const [methodId, setMethodId] = useState<string>(visible[0]?.id ?? 'card');
  useEffect(() => {
    if (!visible.some((t) => t.id === methodId)) setMethodId(visible[0]?.id ?? 'card');
  }, [group, visible, methodId]);
  const [info, setInfo] = useState<CashierInfoDto | null>(null);
  useEffect(() => {
    get<CashierInfoDto>('/me/payments/cashier')
      .then(setInfo)
      .catch(() => setInfo({ footer: '', fx: { USD: 1 } }));
  }, []);
  const method = methods.find((m) => m.id === methodId);
  const strip = useRef<HTMLDivElement>(null);
  const scroll = (dir: 1 | -1) => strip.current?.scrollBy({ left: dir * 220, behavior: 'smooth' });

  return (
    <div className="animate-page-in">
      {/* Main / Alternative */}
      <div className="grid grid-cols-2 gap-3">
        {(
          [
            ['main', 'Main Payment', <CreditCard key="m" />],
            ['alt', 'Alternative payment', <Wallet key="a" />],
          ] as [Group, string, ReactNode][]
        ).map(([g, label, icon]) => (
          <button
            key={g}
            type="button"
            onClick={() => setGroup(g)}
            aria-pressed={group === g}
            className={cn(
              'flex flex-col items-center gap-1.5 rounded-xl border px-4 py-4 text-[15px] font-medium transition-colors',
              group === g ? 'border-ink-100 bg-ink-900 text-white' : 'border-transparent bg-ink-900/60 text-ink-300 hover:bg-ink-900',
            )}
          >
            <span className={cn('[&>svg]:h-6 [&>svg]:w-6', group === g ? 'text-[#5b4fcf]' : 'text-ink-400')}>{icon}</span>
            {label}
          </button>
        ))}
      </div>

      {/* provider strip */}
      <div className="relative mt-2">
        <div ref={strip} role="tablist" aria-label="Payment provider" className="flex overflow-x-auto bg-ink-900/60 [scrollbar-width:none]">
          {visible.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={methodId === t.id}
              onClick={() => setMethodId(t.id)}
              className={cn('flex min-w-[134px] flex-1 flex-col items-center gap-2 border-r border-ink-800/60 px-3 py-3 text-[12px] transition-colors', methodId === t.id ? 'bg-paper text-white' : 'text-ink-300 hover:bg-ink-900')}
            >
              <span className="flex h-7 items-center">{t.logo}</span>
              <span className="whitespace-nowrap">{t.label}</span>
            </button>
          ))}
          {visible.length === 0 && <div className="px-4 py-5 text-sm text-ink-400">No methods in this group yet.</div>}
        </div>
        {visible.length > 4 && (
          <>
            <button type="button" aria-label="Scroll left" onClick={() => scroll(-1)} className="absolute left-1 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full bg-ink-100 text-paper sm:hidden">
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <button type="button" aria-label="Scroll right" onClick={() => scroll(1)} className="absolute right-1 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full bg-ink-100 text-paper">
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </>
        )}
      </div>

      <div className="card mt-0 rounded-t-none p-5 sm:p-7">
        {method ? (
          method.id === 'card' ? (
            <CardForm key="card" method={method} accounts={accounts} fx={info?.fx ?? {}} onCreated={onCreated} onHistory={onHistory} />
          ) : (
            <ManualForm key={method.id} method={method} label={TILE_META[method.id]?.label ?? method.label} accounts={accounts} fx={info?.fx ?? {}} onCreated={onCreated} onHistory={onHistory} />
          )
        ) : null}
      </div>

      {info?.footer && <p className="mt-5 text-[12px] leading-relaxed text-ink-400">{info.footer}</p>}
    </div>
  );
}

/* ---------- shared pieces */

function OutlinedField({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <label className={cn('relative block', className)}>
      <span className="pointer-events-none absolute -top-2 left-3 z-[1] bg-paper px-1 text-[12px] text-ink-400">{label}</span>
      {children}
    </label>
  );
}
const fieldCls = 'h-12 w-full rounded-md border border-ink-700 bg-paper px-4 text-[15px] text-white outline-none transition-colors focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 disabled:opacity-60';

function AmountBlock({ amount, setAmount, error, account, setAccount, accounts, min, max, charged }: { amount: string; setAmount: (v: string) => void; error?: string; account: string | null; setAccount: (id: string) => void; accounts: AccountDto[]; min: string; max: string; charged: string | null }) {
  const live = accounts.filter((a) => a.type === 'live' && a.status === 'enabled');
  return (
    <>
      {live.length > 1 && (
        <OutlinedField label="Trading account" className="mb-5">
          <select value={account ?? ''} onChange={(e) => setAccount(e.target.value)} className={cn(fieldCls, 'appearance-none')}>
            {live.map((a) => (
              <option key={a.id} value={a.id}>
                {fmtLogin(a.loginCode)} · {fmtMoney(a.balance)} {a.currency}
              </option>
            ))}
          </select>
        </OutlinedField>
      )}
      <OutlinedField label="Amount">
        <input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ''))} className={cn(fieldCls, error && 'border-down')} placeholder="0" />
      </OutlinedField>
      {error ? <p className="mt-1.5 text-xs text-down">{error}</p> : <p className="mt-1.5 text-[11px] text-ink-500">Min {fmtMoney(min)} · {Number(max) > 0 ? `Max ${fmtMoney(max)} USD` : 'No maximum'}</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        {PRESETS.map((p) => (
          <button key={p} type="button" onClick={() => setAmount(p)} className={cn('rounded-full px-5 py-1.5 text-[14px] font-medium transition-colors', amount === p ? 'bg-[#0b1220] text-[#ffffff]' : 'bg-ink-900 text-white hover:bg-ink-800')}>
            $ {Number(p).toLocaleString('en-US')}
          </button>
        ))}
      </div>
      {charged && <p className="mt-4 text-[14px] text-white">Your account will be charged by {charged}</p>}
    </>
  );
}

function Declaration({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="mt-5 flex items-start gap-3 text-[14px] text-white">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 h-5 w-5 rounded border-ink-500 accent-[#0b1220]" />
      <span>
        I have read and accepted the{' '}
        <Link href="/legal/client-agreement" target="_blank" className="underline underline-offset-2">
          Declaration of Deposit
        </Link>
      </span>
    </label>
  );
}

function DepositButton({ loading, disabled }: { loading: boolean; disabled: boolean }) {
  return (
    <Button type="submit" size="lg" loading={loading} disabled={disabled} className="mt-6 h-[52px] w-full text-[17px] sm:w-[340px]" style={{ background: '#2e9e5b', backgroundImage: 'none', color: '#ffffff', boxShadow: 'none' }}>
      Deposit
    </Button>
  );
}

const chargedLine = (amount: string, currency: string, fx: Record<string, number>) => {
  const n = Number(amount);
  if (!n || !currency || currency === 'USD') return null;
  const rate = fx[currency];
  if (!rate) return null;
  const locale = currency === 'INR' ? 'en-IN' : 'en-US';
  return `${(n * rate).toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
};

/* ---------- bank / UPI / Binance / USDT: request, then pay-to details + proof */

function ManualForm({ method, label, accounts, fx, onCreated, onHistory }: { method: PaymentMethodDto; label: string; accounts: AccountDto[]; fx: Record<string, number>; onCreated: () => void; onHistory: () => void }) {
  const toast = useToast();
  const live = accounts.filter((a) => a.type === 'live' && a.status === 'enabled');
  const [account, setAccount] = useState<string | null>(live[0]?.id ?? null);
  const [amount, setAmount] = useState('');
  const [agree, setAgree] = useState(true);
  const [err, setErr] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const [req, setReq] = useState<PaymentRequestDto | null>(null);
  const [proof, setProof] = useState<File | null>(null);
  const [proofErr, setProofErr] = useState<string | undefined>();
  const [done, setDone] = useState<PaymentRequestDto | null>(null);
  const channel = method.deposit;
  const charged = chargedLine(amount, channel?.currency ?? 'USD', fx);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = depositRequestSchema.safeParse({ accountId: account ?? '', amount, method: method.id });
    if (!parsed.success) return setErr(parsed.error.issues.find((i) => i.path[0] === 'amount')?.message ?? 'Check the amount');
    setErr(undefined);
    setBusy(true);
    try {
      setReq(await post<PaymentRequestDto>('/me/payments/deposit', parsed.data));
      onCreated();
    } catch (e2) {
      const f = friendlyError(e2);
      setErr(f.body ?? f.title);
    } finally {
      setBusy(false);
    }
  };
  const finish = async () => {
    if (!req) return;
    if (channel?.proofRequired && !proof) return setProofErr('Attach the payment receipt or screenshot.');
    setBusy(true);
    try {
      let r = req;
      if (proof) {
        const fd = new FormData();
        fd.set('file', proof, proof.name);
        r = await upload<PaymentRequestDto>(`/me/payments/${req.id}/proof`, fd);
      }
      toast({ title: 'Deposit request sent', body: `${fmtMoney(r.amount)} ${r.currency}`, level: 'success' });
      setDone(r);
      onCreated();
    } catch (e2) {
      const f = friendlyError(e2);
      toast({ title: f.title, body: f.body, level: 'danger' });
    } finally {
      setBusy(false);
    }
  };

  if (done) return <RequestDone req={done} method={method} onAgain={() => (setDone(null), setReq(null), setAmount(''), setProof(null))} onHistory={onHistory} />;

  if (req && channel)
    return (
      <div className="animate-page-in">
        <h2 className="text-[22px] font-bold leading-tight text-white">Complete your {label} payment</h2>
        <p className="mt-1 text-sm text-ink-300">
          Send <strong className="text-white">{fmtMoney(req.amount)} {req.currency}</strong>
          {charged ? <> ({charged})</> : null} to the details below, then attach the receipt.
        </p>
        <PayToPanel channel={channel} amount={req.amount} className="mt-5" />
        <div className="mt-5">
          <ProofPicker file={proof} required={!!channel.proofRequired} error={proofErr} onChange={(f) => (setProof(f), setProofErr(undefined))} />
        </div>
        <div className="mt-6 flex flex-wrap gap-3">
          <Button size="lg" loading={busy} onClick={() => void finish()} className="h-[52px] px-10" style={{ background: '#2e9e5b', backgroundImage: 'none', color: '#ffffff', boxShadow: 'none' }}>
            I have paid
          </Button>
          <Button size="lg" variant="outline" onClick={() => setReq(null)} disabled={busy}>
            Back
          </Button>
        </div>
      </div>
    );

  return (
    <form onSubmit={submit} noValidate className="max-w-[420px]">
      <h2 className="text-[22px] font-bold leading-tight text-white">Secure deposit using {label}</h2>
      <div className="mt-6">
        <AmountBlock amount={amount} setAmount={setAmount} error={err} account={account} setAccount={setAccount} accounts={accounts} min={method.minDeposit} max={method.maxDeposit} charged={charged} />
      </div>
      <Declaration checked={agree} onChange={setAgree} />
      <DepositButton loading={busy} disabled={!agree || !account} />
    </form>
  );
}

/* ---------- card: Stripe Elements when the gateway is connected */

type CardFormProps = { method: PaymentMethodDto; accounts: AccountDto[]; fx: Record<string, number>; onCreated: () => void; onHistory: () => void };
type Gateway = { stripe: Stripe | null; elements: StripeElements | null };

function CardForm(props: CardFormProps) {
  const pk = props.method.gateway?.publishableKey;
  // the Stripe hooks may only run inside <Elements>, so the gateway-less form never mounts them
  if (!pk) return <CardFormInner {...props} gateway={null} />;
  return (
    <Elements stripe={stripeFor(pk)} options={{ locale: 'en' }}>
      <StripeBound {...props} />
    </Elements>
  );
}

function StripeBound(props: CardFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  return <CardFormInner {...props} gateway={{ stripe, elements }} />;
}

const elementStyle = { style: { base: { fontSize: '15px', color: '#0b1220', fontFamily: 'inherit', '::placeholder': { color: '#8793a8' } }, invalid: { color: '#dc2626' } } };

function CardFormInner({ method, accounts, fx, onCreated, onHistory, gateway }: CardFormProps & { gateway: Gateway | null }) {
  const toast = useToast();
  const { me } = useAuth();
  const stripe = gateway?.stripe ?? null;
  const elements = gateway?.elements ?? null;
  const live = accounts.filter((a) => a.type === 'live' && a.status === 'enabled');
  const [account, setAccount] = useState<string | null>(live[0]?.id ?? null);
  const [amount, setAmount] = useState('');
  const [agree, setAgree] = useState(true);
  const [first, setFirst] = useState(me?.profile?.firstName ?? '');
  const [last, setLast] = useState(me?.profile?.lastName ?? '');
  const [err, setErr] = useState<string | undefined>();
  const [cardErr, setCardErr] = useState<{ title: string; body?: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<PaymentRequestDto | null>(null);
  const charged = chargedLine(amount, 'USD', fx);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = cardIntentSchema.safeParse({ accountId: account ?? '', amount });
    if (!parsed.success) return setErr(parsed.error.issues.find((i) => i.path[0] === 'amount')?.message ?? 'Check the amount');
    setErr(undefined);
    setCardErr(null);
    if (!gateway) {
      // no live card processor: record the attempt for the back office (no card data is captured or stored) and tell the client it could not be charged
      setBusy(true);
      try {
        await post<PaymentRequestDto>('/me/payments/deposit', { ...parsed.data, method: 'card' });
        onCreated();
        onHistory();
        setCardErr({ title: 'Payment could not be processed', body: 'Your card could not be charged right now. The request has been logged and our team will contact you. You can also deposit instantly with UPI, Bank transfer or Binance Pay.' });
      } catch (e2) {
        setCardErr(friendlyError(e2));
      } finally {
        setBusy(false);
      }
      return;
    }
    if (!stripe || !elements) return;
    const number = elements.getElement(CardNumberElement) as StripeCardNumberElement | null;
    if (!number) return;
    setBusy(true);
    try {
      const intent = await post<CardIntentDto>('/me/payments/card/intent', parsed.data);
      const res = await stripe.confirmCardPayment(intent.clientSecret, { payment_method: { card: number, billing_details: { name: `${first} ${last}`.trim(), email: me?.email } } });
      if (res.error) {
        setCardErr({ title: 'Card not charged', body: res.error.message ?? 'The card was declined.' });
        return;
      }
      toast({ title: 'Payment confirmed', body: `${fmtMoney(amount)} USD · the balance updates as soon as the gateway reports it (seconds).`, level: 'success' });
      setDone({ id: intent.requestId, accountId: account!, accountLogin: live.find((a) => a.id === account)?.loginCode ?? 0, kind: 'deposit', amount: Number(amount).toFixed(2), currency: 'USD', method: 'card', destination: null, reference: res.paymentIntent?.id ?? null, proof: null, status: 'pending', adminNote: null, decidedAt: null, ledgerEntryId: null, createdAt: new Date().toISOString() });
      onCreated();
    } catch (e2) {
      setCardErr(friendlyError(e2));
    } finally {
      setBusy(false);
    }
  };

  if (done) return <RequestDone req={done} method={method} onAgain={() => (setDone(null), setAmount(''))} onHistory={onHistory} />;

  return (
    <form onSubmit={submit} noValidate className="grid gap-8 lg:grid-cols-2">
      <div>
        <h2 className="text-[22px] font-bold leading-tight text-white">Secure deposit using credit card</h2>
        <div className="mt-6">
          <AmountBlock amount={amount} setAmount={setAmount} error={err} account={account} setAccount={setAccount} accounts={accounts} min={method.minDeposit} max={method.maxDeposit} charged={charged} />
        </div>
        <Declaration checked={agree} onChange={setAgree} />
        <div className="hidden lg:block">
          <DepositButton loading={busy} disabled={!agree || !account} />
        </div>
      </div>
      <div>
        <h3 className="text-[17px] font-semibold text-white">Credit or Debit Card Details</h3>
        <div className="mt-5 space-y-5">
          <OutlinedField label="Add a New Card">
            <div className={cn(fieldCls, 'flex items-center gap-3')}>
              <CreditCard className="h-5 w-5 shrink-0 text-ink-400" />
              {gateway ? <CardNumberElement options={{ ...elementStyle, placeholder: 'XXXX XXXX XXXX XXXX', showIcon: true }} className="flex-1" /> : <input disabled placeholder="XXXX XXXX XXXX XXXX" className="flex-1 bg-transparent outline-none" />}
            </div>
          </OutlinedField>
          <div className="grid grid-cols-2 gap-4">
            <OutlinedField label="Expiry Date">
              <div className={cn(fieldCls, 'flex items-center')}>{gateway ? <CardExpiryElement options={{ ...elementStyle, placeholder: 'mm/yy' }} className="flex-1" /> : <input disabled placeholder="mm/yy" className="flex-1 bg-transparent outline-none" />}</div>
            </OutlinedField>
            <OutlinedField label="CVV">
              <div className={cn(fieldCls, 'flex items-center')}>{gateway ? <CardCvcElement options={{ ...elementStyle, placeholder: '***' }} className="flex-1" /> : <input disabled placeholder="***" className="flex-1 bg-transparent outline-none" />}</div>
            </OutlinedField>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[16px] font-semibold text-white">Cardholder</span>
            <Link href="/app/profile" className="inline-flex items-center gap-1.5 text-[15px] text-white">
              <PencilLine className="h-4 w-4" /> Edit billing info
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <OutlinedField label="Name">
              <input value={first} onChange={(e) => setFirst(e.target.value)} className={fieldCls} autoComplete="cc-given-name" />
            </OutlinedField>
            <OutlinedField label="Last name">
              <input value={last} onChange={(e) => setLast(e.target.value)} className={fieldCls} autoComplete="cc-family-name" />
            </OutlinedField>
          </div>
          {cardErr && (
            <div className="rounded-xl bg-down/10 px-3 py-2 text-xs text-down ring-1 ring-inset ring-down/30">
              <strong>{cardErr.title}.</strong> {cardErr.body}
            </div>
          )}
          <p className="inline-flex items-center gap-1.5 text-[11px] text-ink-500">
            <Lock className="h-3 w-3" /> Card details are sent straight to the payment gateway over an encrypted connection. We never see or store them.
          </p>
        </div>
        <div className="lg:hidden">
          <DepositButton loading={busy} disabled={!agree || !account} />
        </div>
      </div>
    </form>
  );
}
