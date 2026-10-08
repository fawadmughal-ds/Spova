'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Check, ChevronDown, FlaskConical, ShieldCheck } from 'lucide-react';
import type { AccountDto } from '@spova/shared';
import { BRAND, cn, fmtMoney } from '@/lib/utils';
import { Logo } from '@/components/logo';
import { AnimatedNumber } from '@/components/motion';
import { Badge } from '@/components/ui';
import { fmtLogin } from '@/components/portal/account-plate';

function UtcClock() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <span className="tabular hidden items-center gap-2 font-mono text-[11px] text-ink-400 md:inline-flex">
      UTC {now ? now.toISOString().slice(11, 19) : '--:--:--'}
    </span>
  );
}

/** Dropdown over the user's accounts (live first). Closes on outside click and Esc. */
function AccountSelect({ accounts, account, onSelect }: { accounts: AccountDto[]; account: AccountDto | undefined; onSelect: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (!account) return <div className="skeleton h-8 w-40 rounded-lg" />;
  const live = account.type === 'live';
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex h-8 items-center gap-2 rounded-lg border border-white/10 bg-paper px-2.5 text-left text-xs transition-colors hover:border-brand-400/40"
      >
        <span className={cn('h-1.5 w-1.5 rounded-full', live ? 'bg-up' : 'bg-sky-500')} />
        <span className="label !text-current">{account.type}</span>
        <span className="tabular font-mono text-[13px] text-white">{fmtLogin(account.loginCode)}</span>
        <ChevronDown className={cn('h-3.5 w-3.5 text-ink-500 transition-transform duration-300', open && 'rotate-180')} />
      </button>
      {open && (
        <ul role="listbox" className="animate-pop-in absolute left-0 top-full z-50 mt-1.5 w-72 overflow-hidden rounded-xl border border-white/10 bg-paper p-1 shadow-lift">
          {accounts.map((a) => {
            const on = a.id === account.id;
            return (
              <li key={a.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={on}
                  onClick={() => {
                    onSelect(a.id);
                    setOpen(false);
                  }}
                  className={cn('flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left text-xs transition-colors hover:bg-white/[0.04]', on && 'bg-brand-400/[0.07]')}
                >
                  <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', a.type === 'live' ? 'bg-up/10 text-up' : 'bg-sky-400/10 text-sky-700')}>
                    {a.type === 'live' ? <ShieldCheck className="h-4 w-4" /> : <FlaskConical className="h-4 w-4" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="label !text-current">{a.type}</span>
                      <span className="tabular font-mono text-[13px] text-white">{fmtLogin(a.loginCode)}</span>
                      <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-500">{a.tier}</span>
                    </span>
                    <span className="tabular mt-0.5 block font-mono text-[11px] text-ink-400">
                      {fmtMoney(a.balance, a.currency)} · 1:{a.leverage}
                      {a.status !== 'enabled' && <span className="text-gold"> · {a.status}</span>}
                    </span>
                  </span>
                  {on && <Check className="h-3.5 w-3.5 text-brand-400" strokeWidth={3} />}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function Figure({ label, value, tone, suffix }: { label: string; value: string | null | undefined; tone?: 'up' | 'down' | 'warn'; suffix?: string }) {
  return (
    <div className="min-w-0">
      <div className="label truncate !text-[9px]">{label}</div>
      <div className={cn('tabular font-mono text-[13px] font-semibold leading-tight text-ink-100', tone === 'up' && 'text-up', tone === 'down' && 'text-down', tone === 'warn' && 'text-gold')}>
        <AnimatedNumber value={value} duration={500} />
        {suffix && value ? <span className="ml-0.5 text-[10px] font-normal text-ink-400">{suffix}</span> : null}
      </div>
    </div>
  );
}

/** Account figures (balance, equity, free margin, margin level), live from WS snapshots. */
export function AccountFigures({ account, className }: { account: AccountDto | undefined; className?: string }) {
  if (!account) {
    return (
      <div className={cn('grid grid-cols-4 gap-4', className)}>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="skeleton h-8 rounded-md" />
        ))}
      </div>
    );
  }
  const level = account.marginLevel === null ? null : Number(account.marginLevel);
  const levelTone = level === null ? undefined : level <= 100 ? 'down' : level <= 200 ? 'warn' : 'up';
  const pnl = Number(account.equity) - Number(account.balance) - Number(account.credit);
  return (
    <div className={cn('grid grid-cols-4 gap-x-4 gap-y-1 sm:grid-cols-5', className)}>
      <Figure label="Balance" value={account.balance} />
      <Figure label="Equity" value={account.equity} />
      <Figure label="Free margin" value={account.freeMargin} />
      <Figure label="Margin level" value={level === null ? null : account.marginLevel} tone={levelTone} suffix="%" />
      <div className="hidden min-w-0 sm:block">
        <div className="label truncate !text-[9px]">Floating P/L</div>
        <div className={cn('tabular font-mono text-[13px] font-semibold leading-tight', pnl > 0 ? 'text-up' : pnl < 0 ? 'text-down' : 'text-ink-300')}>
          <AnimatedNumber value={pnl} duration={500} format={(n) => `${n > 0 ? '+' : ''}${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} />
        </div>
      </div>
    </div>
  );
}

export function TerminalHeader({
  accounts,
  account,
  onSelect,
  connected,
}: {
  accounts: AccountDto[];
  account: AccountDto | undefined;
  onSelect: (id: string) => void;
  connected: boolean;
}) {
  return (
    <header className="animate-page-in relative z-30 shrink-0 border-b border-white/[0.07] bg-paper">
      <div className="flex h-12 items-center gap-3 px-3 sm:px-4">
        <Link href="/app" className="group flex shrink-0 items-center gap-1.5 text-xs text-ink-400 transition-colors hover:text-white">
          <ArrowLeft className="h-3.5 w-3.5 transition-transform duration-300 group-hover:-translate-x-0.5" /> <span className="hidden sm:inline">Client area</span>
        </Link>
        <span className="h-5 w-px bg-white/10" />
        <div className="group/logo flex shrink-0 items-center gap-2">
          <Logo size={20} />
          <span className="hidden font-display text-sm font-bold md:inline">{BRAND} WebTrader</span>
        </div>
        <span className="hidden h-5 w-px bg-white/10 sm:block" />
        <AccountSelect accounts={accounts} account={account} onSelect={onSelect} />
        {account && (
          <span className="hidden items-center gap-1.5 lg:flex">
            <Badge tone="brand">{account.tier}</Badge>
            <span className="tabular font-mono text-[11px] text-ink-400">1:{account.leverage}</span>
          </span>
        )}

        <div className="hidden min-w-0 flex-1 px-4 lg:block xl:px-8">
          <AccountFigures account={account} className="mx-auto max-w-3xl" />
        </div>
        <div className="flex-1 lg:hidden" />

        <UtcClock />
        <span
          title={connected ? 'Connected to the price stream' : 'Reconnecting…'}
          className={cn(
            'inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 font-mono text-[10px] uppercase tracking-[0.14em] transition-colors duration-500',
            connected ? 'border-up/30 bg-up/10 text-up' : 'border-gold/30 bg-gold/10 text-gold',
          )}
        >
          <span className={cn('live-dot !h-1.5 !w-1.5', !connected && 'animate-pulse after:hidden')} />
          <span className="hidden sm:inline">{connected ? 'Live' : 'Offline'}</span>
        </span>
      </div>
      {/* account bar on small screens */}
      <div className="border-t border-white/[0.06] px-3 py-1.5 lg:hidden">
        <AccountFigures account={account} />
      </div>
    </header>
  );
}
