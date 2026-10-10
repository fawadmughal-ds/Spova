'use client';

import { useState, type ReactNode } from 'react';
import { Check, ChevronDown, ChevronRight, LayoutGrid, Landmark } from 'lucide-react';
import type { AccountDto, PositionDto } from '@spova/shared';
import { cn } from '@/lib/utils';
import { Logo } from '@/components/logo';
import { AnimatedNumber } from '@/components/motion';
import { Dropdown } from './bits';
import { fmtNum, type SymbolSpec } from './format';
import { useFloatingTotal } from './pnl';
import { useT } from './i18n';

/**
 * Phone layout pieces of the terminal "Trade" tab (reference: the MatchTrader mobile client area):
 * white header with the account pill, equity and a deposit button; a promo banner; the Profit / Equity strip.
 */
export function MobileHeader({ accounts, account, onSelectAccount, onDeposit, onMenu, bell, className }: { accounts: AccountDto[]; account: AccountDto | undefined; onSelectAccount: (id: string) => void; onDeposit: () => void; onMenu: () => void; bell?: ReactNode; className?: string }) {
  const t = useT();
  return (
    <header className={cn('light-scope flex h-[64px] shrink-0 items-center gap-3 bg-paper px-4 text-white shadow-[0_1px_0_#e3e8ef]', className)}>
      <Logo size={30} />
      <Dropdown
        title="Switch account"
        buttonClassName="inline-flex h-8 items-center gap-1 rounded-md bg-brand-500 px-3 text-[14px] font-semibold text-[#ffffff]"
        button={() => (
          <>
            {account ? (account.type === 'live' ? 'Live' : 'Demo') : '…'} <ChevronRight className="h-4 w-4" strokeWidth={3} />
          </>
        )}
      >
        {(close) => (
          <div className="light-scope w-64 p-1">
            <div className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-ink-400">Trading accounts</div>
            {accounts.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => {
                  onSelectAccount(a.id);
                  close();
                }}
                className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left hover:bg-ink-900"
              >
                <span className={cn('rounded px-1.5 py-px text-[10px] font-bold uppercase tracking-wide', a.type === 'live' ? 'bg-brand-500 text-[#ffffff]' : 'bg-up/15 text-up')}>{a.type}</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-white">{a.loginCode}</span>
                  <span className="block text-[11px] text-ink-400">
                    {fmtNum(a.balance)} {a.currency}
                  </span>
                </span>
                {a.id === account?.id && <Check className="h-4 w-4 text-brand-500" strokeWidth={3} />}
              </button>
            ))}
          </div>
        )}
      </Dropdown>
      <div className="min-w-0 flex-1 text-center leading-tight">
        <div className="truncate text-[20px] font-bold tracking-tight text-white">{account ? `$${fmtNum(account.equity)}` : '—'}</div>
        <div className="text-[13px] text-ink-400">Equity</div>
      </div>
      <button type="button" onClick={onDeposit} aria-label={t('deposit')} className="flex h-10 w-10 items-center justify-center text-up">
        <Landmark className="h-6 w-6" />
      </button>
      {bell && <span className="[&_.t-top-btn]:!border-transparent [&_.t-top-btn]:!bg-ink-900 [&_.t-top-btn]:!text-ink-300">{bell}</span>}
      <button type="button" onClick={onMenu} aria-label={t('more')} className="flex h-10 w-10 items-center justify-center text-ink-300">
        <LayoutGrid className="h-6 w-6" />
      </button>
    </header>
  );
}

/** "Deposit your account to start trading" card with a small chart-on-a-laptop illustration. */
export function DepositBanner({ onClick, className }: { onClick: () => void; className?: string }) {
  return (
    <button type="button" onClick={onClick} className={cn('light-scope relative flex w-full items-center overflow-hidden rounded-2xl bg-gradient-to-r from-brand-500 to-brand-600 px-5 py-5 text-left text-[#ffffff]', className)}>
      <span className="relative z-[1] max-w-[58%] text-[20px] font-semibold leading-snug">Deposit your account to start trading</span>
      <ChevronRight className="relative z-[1] ml-3 h-6 w-6 shrink-0" strokeWidth={2.5} />
      <svg viewBox="0 0 200 130" className="absolute -right-2 bottom-0 h-[118px] w-auto" aria-hidden>
        <path d="M30 130 L140 40 L200 130 Z" fill="rgba(255,255,255,0.16)" />
        <rect x="52" y="22" width="118" height="78" rx="6" fill="#0b1220" />
        <rect x="58" y="28" width="106" height="66" rx="3" fill="#161c28" />
        <polyline points="62,80 74,70 84,74 96,58 108,64 120,46 132,52 146,38 158,44" fill="none" stroke="#f5a524" strokeWidth="2" />
        <polyline points="62,86 76,78 88,82 100,68 112,74 126,58 140,62 158,50" fill="none" stroke="#2ac3ed" strokeWidth="2" />
        <rect x="36" y="100" width="150" height="8" rx="3" fill="#1c2128" />
        <rect x="46" y="108" width="130" height="4" rx="2" fill="#2d343e" />
      </svg>
    </button>
  );
}

/** Profit / Equity strip with the chevron that reveals the rest of the account figures. */
export function MobileStats({ account, positions, symbols, onSearch, className }: { account: AccountDto | undefined; positions: PositionDto[]; symbols: Map<string, SymbolSpec>; onSearch?: () => void; className?: string }) {
  const t = useT();
  const total = useFloatingTotal(positions, symbols);
  const [open, setOpen] = useState(false);
  const cur = account?.currency ?? 'USD';
  const tone = total === null ? 'text-[var(--t-text)]' : total > 0 ? 't-pnl-up' : total < 0 ? 't-pnl-down' : 'text-[var(--t-text)]';
  const Cell = ({ label, children, className: c }: { label: string; children: ReactNode; className?: string }) => (
    <div className={cn('min-w-0 flex-1 px-4 py-2.5 leading-tight', c)}>
      <div className="text-[12px] font-medium text-[var(--t-muted)]">{label}</div>
      <div className="mt-0.5 truncate text-[19px] font-semibold">{children}</div>
    </div>
  );
  return (
    <div className={cn('shrink-0 rounded-xl bg-[var(--t-panel)] ring-1 ring-inset ring-[var(--t-line)]', className)}>
      <div className="flex items-center divide-x divide-[var(--t-line)]">
        <Cell label={t('profit')}>
          <span className={tone}>{total === null ? '—' : <AnimatedNumber value={total} duration={450} flash={false} format={(n) => fmtNum(n)} />}</span>
          <span className="ml-1 text-[11px] font-medium text-[var(--t-muted)]">{cur}</span>
        </Cell>
        <Cell label="Equity">
          <span className="t-pnl-up">{account ? fmtNum(account.equity) : '—'}</span>
          <span className="ml-1 text-[11px] font-medium text-[var(--t-muted)]">{cur}</span>
        </Cell>
        <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-label="More figures" className="flex h-12 w-12 shrink-0 items-center justify-center text-[var(--t-text-2)]">
          <ChevronDown className={cn('h-5 w-5 transition-transform', open && 'rotate-180')} />
        </button>
        {onSearch && (
          <button type="button" onClick={onSearch} aria-label="Search instruments" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-r-xl bg-[var(--t-raised)] text-[var(--t-text-2)]">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
          </button>
        )}
      </div>
      {open && account && (
        <div className="animate-page-in grid grid-cols-2 gap-x-4 gap-y-2 border-t border-[var(--t-line)] px-4 py-3 text-[13px]">
          {(
            [
              ['Balance', fmtNum(account.balance)],
              ['Credit', fmtNum(account.credit)],
              ['Used margin', fmtNum(account.usedMargin)],
              ['Free margin', fmtNum(account.freeMargin)],
              ['Margin level', account.marginLevel === null || account.marginLevel === undefined ? '—' : `${fmtNum(account.marginLevel)}%`],
              ['Leverage', `1:${account.leverage}`],
            ] as [string, string][]
          ).map(([k, v]) => (
            <div key={k} className="flex items-baseline justify-between gap-3">
              <span className="text-[var(--t-muted)]">{k}</span>
              <span className="font-semibold text-[var(--t-text)]">{v}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
