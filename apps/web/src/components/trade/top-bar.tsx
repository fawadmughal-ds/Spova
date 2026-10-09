'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Bell, BellOff, ChartNoAxesColumn, ChartPie, Check, ChevronDown, CircleUser, Compass, LayoutDashboard, LogOut, UserRound, Volume2, VolumeX, Wifi, WifiOff } from 'lucide-react';
import type { AccountDto, PositionDto } from '@spova/shared';
import { cn } from '@/lib/utils';
import { Logo, Wordmark } from '@/components/logo';
import { AnimatedNumber } from '@/components/motion';
import { fmtNum, type SymbolSpec } from './format';
import { useFloatingTotal } from './pnl';
import { Dropdown, ToggleRow } from './bits';
import { settingsStore, useSettings } from './settings';

export type TerminalView = 'trade' | 'analytics' | 'explore';
export interface NoticeItem {
  id: number;
  title: string;
  body?: string;
  level: 'info' | 'success' | 'warning' | 'danger';
  at: number;
}

const VIEWS: { value: TerminalView; label: string; icon: typeof Compass }[] = [
  { value: 'trade', label: 'Trade', icon: ChartNoAxesColumn },
  { value: 'analytics', label: 'Analytics', icon: ChartPie },
  { value: 'explore', label: 'Explore', icon: Compass },
];

function TypeTag({ type }: { type: AccountDto['type'] }) {
  return <span className={cn('rounded px-1.5 py-px text-[10px] font-bold uppercase leading-4 tracking-wide', type === 'live' ? 'bg-[var(--t-blue-deep)] text-white' : 'bg-[#1f6867] text-[#9ff0e5]')}>{type}</span>;
}

/** "DEMO 746181 ▾": the account chip with a dropdown of every account the user owns. */
function AccountChip({ accounts, account, onSelect }: { accounts: AccountDto[]; account: AccountDto | undefined; onSelect: (id: string) => void }) {
  if (!account) return <div className="skeleton h-8 w-32 rounded-md" />;
  return (
    <Dropdown
      title="Switch account"
      buttonClassName="flex h-9 items-center gap-2 rounded-md px-2 text-[14px] font-semibold text-white transition-colors hover:bg-white/[0.06]"
      button={(open) => (
        <>
          <TypeTag type={account.type} />
          <span>{account.loginCode}</span>
          <ChevronDown className={cn('h-3.5 w-3.5 text-[var(--t-muted)] transition-transform', open && 'rotate-180')} />
        </>
      )}
    >
      {(close) => (
        <div className="w-72">
          <div className="t-menu-label">Accounts</div>
          {accounts.map((a) => (
            <button
              key={a.id}
              type="button"
              role="menuitemradio"
              aria-checked={a.id === account.id}
              data-on={a.id === account.id}
              onClick={() => {
                onSelect(a.id);
                close();
              }}
              className="t-menu-item"
            >
              <TypeTag type={a.type} />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2 font-semibold text-white">
                  {a.loginCode}
                  <span className="text-[10px] font-medium uppercase tracking-wider text-[var(--t-muted)]">{a.tier}</span>
                </span>
                <span className="block text-[11px] text-[var(--t-muted)]">
                  {fmtNum(a.balance)} {a.currency} · 1:{a.leverage}
                  {a.status !== 'enabled' && <span className="text-[var(--t-alert)]"> · {a.status}</span>}
                </span>
              </span>
              {a.id === account.id && <Check className="text-[var(--t-blue)]" strokeWidth={3} />}
            </button>
          ))}
          <div className="mt-1 border-t border-[#3b434f] pt-1">
            <Link href="/app/accounts" className="t-menu-item">
              <LayoutDashboard /> Manage accounts
            </Link>
          </div>
        </div>
      )}
    </Dropdown>
  );
}

function Figure({ label, value, tone, suffix, decimals = 2 }: { label: string; value: string | number | null | undefined; tone?: 'up' | 'down' | 'warn'; suffix?: string; decimals?: number }) {
  return (
    <div className="flex items-baseline justify-between gap-4 px-2.5 py-1.5">
      <span className="text-[12px] text-[var(--t-muted)]">{label}</span>
      <span className={cn('text-[13px] font-semibold text-white', tone === 'up' && 't-pnl-up', tone === 'down' && 't-pnl-down', tone === 'warn' && 'text-[var(--t-alert)]')}>
        {value === null || value === undefined ? '—' : <AnimatedNumber value={value} duration={500} format={(n) => fmtNum(n, decimals)} />}
        {suffix && value !== null && value !== undefined ? <span className="ml-1 text-[11px] font-normal text-[var(--t-muted)]">{suffix}</span> : null}
      </span>
    </div>
  );
}

/** "Profit" block: live floating P/L of the open positions, with the account figures behind the chevron. */
function ProfitBlock({ account, positions, symbols, compact }: { account: AccountDto | undefined; positions: PositionDto[]; symbols: Map<string, SymbolSpec>; compact?: boolean }) {
  const total = useFloatingTotal(positions, symbols);
  const level = account?.marginLevel === null || account?.marginLevel === undefined ? null : Number(account.marginLevel);
  const levelTone = level === null ? undefined : level <= 100 ? 'down' : level <= 200 ? 'warn' : 'up';
  const tone = total === null ? '' : total > 0 ? 't-pnl-up' : total < 0 ? 't-pnl-down' : 'text-white';
  return (
    <Dropdown
      title="Account figures"
      align={compact ? 'right' : 'left'}
      buttonClassName={cn('flex shrink-0 items-center whitespace-nowrap rounded-md px-1 py-0.5 transition-colors hover:bg-white/[0.04]', compact ? 'gap-1.5' : 'gap-3')}
      button={(open) => (
        <>
          <span className={cn('flex leading-none', compact ? 'items-baseline gap-1.5' : 'flex-col items-start')}>
            <span className={cn('text-[11px] font-medium text-[var(--t-muted)]', compact && 'hidden min-[420px]:inline')}>Profit</span>
            <span className={cn('font-semibold', compact ? 'text-[13px]' : 'mt-0.5 text-[15px]', tone)}>
              {total === null ? <span className="text-[var(--t-muted)]">—</span> : <AnimatedNumber value={total} duration={450} flash={false} format={(n) => fmtNum(n)} />}
              <span className="ml-1 text-[11px] font-medium text-[var(--t-muted)]">{account?.currency ?? 'USD'}</span>
            </span>
          </span>
          {!compact && <span className="h-7 w-px bg-[#3b434f]" />}
          <ChevronDown className={cn('h-4 w-4 shrink-0 text-[var(--t-text-2)] transition-transform', open && 'rotate-180')} />
        </>
      )}
    >
      {() => (
        <div className="w-64 py-1">
          {account ? (
            <>
              <Figure label="Balance" value={account.balance} />
              <Figure label="Equity" value={account.equity} />
              <Figure label="Margin" value={account.usedMargin} />
              <Figure label="Free margin" value={account.freeMargin} />
              <Figure label="Margin level" value={level === null ? null : account.marginLevel} suffix="%" tone={levelTone} />
              <Figure label="Credit" value={account.credit} />
              <div className="mt-1 border-t border-[#3b434f] px-2.5 pt-2 text-[11px] text-[var(--t-muted)]">
                Leverage 1:{account.leverage} · {account.tier} · {account.currency}
              </div>
            </>
          ) : (
            <div className="px-2.5 py-2 text-[12px] text-[var(--t-muted)]">No account selected.</div>
          )}
        </div>
      )}
    </Dropdown>
  );
}

function BellMenu({ notices }: { notices: NoticeItem[] }) {
  const s = useSettings();
  const [seen, setSeen] = useState(0);
  const unread = notices.filter((n) => n.at > seen).length;
  return (
    <Dropdown
      title="Notifications"
      align="right"
      onOpenChange={(open) => open && setSeen(Date.now())}
      buttonClassName="t-top-btn relative"
      button={() => (
        <>
          {s.sounds ? <Bell /> : <BellOff />}
          {unread > 0 && <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--t-sell)] px-1 text-[9px] font-bold text-white">{unread}</span>}
        </>
      )}
    >
      {() => (
        <div className="w-80">
          <ToggleRow label="Sounds" icon={s.sounds ? <Volume2 /> : <VolumeX />} checked={s.sounds} onChange={(v) => settingsStore.patch({ sounds: v })} />
          <div className="my-1 border-t border-[#3b434f]" />
          <div className="t-menu-label">Recent</div>
          {notices.length === 0 ? (
            <div className="px-2.5 pb-2 pt-1 text-[12px] text-[var(--t-muted)]">Nothing yet. Fills, closes, margin notices and alerts show up here.</div>
          ) : (
            <ul className="max-h-72 overflow-y-auto">
              {notices.slice(0, 20).map((n) => (
                <li key={n.id} className="flex gap-2.5 px-2.5 py-2 text-[12px]">
                  <span className={cn('mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full', n.level === 'success' ? 'bg-[var(--t-up)]' : n.level === 'danger' ? 'bg-[var(--t-sell)]' : n.level === 'warning' ? 'bg-[var(--t-alert)]' : 'bg-[var(--t-blue)]')} />
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium text-white">{n.title}</span>
                    {n.body && <span className="block text-[var(--t-muted)]">{n.body}</span>}
                    <span className="block text-[10px] text-[var(--t-dim)]">{new Date(n.at).toISOString().slice(11, 19)} UTC</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Dropdown>
  );
}

function UserMenu({ email, onLogout }: { email: string | undefined; onLogout: () => void }) {
  return (
    <Dropdown
      title="Account menu"
      align="right"
      buttonClassName="t-top-btn"
      button={() => <CircleUser />}
    >
      {(close) => (
        <div className="w-56">
          {email && <div className="truncate px-2.5 pb-1 pt-2 text-[11px] text-[var(--t-muted)]">{email}</div>}
          <Link href="/app/profile" className="t-menu-item" onClick={close}>
            <UserRound /> Profile
          </Link>
          <Link href="/app" className="t-menu-item" onClick={close}>
            <LayoutDashboard /> Client area
          </Link>
          <div className="my-1 border-t border-[#3b434f]" />
          <button type="button" className="t-menu-item" onClick={onLogout}>
            <LogOut /> Log out
          </button>
        </div>
      )}
    </Dropdown>
  );
}

export function TopBar({
  accounts,
  account,
  onSelectAccount,
  connected,
  view,
  onView,
  positions,
  symbols,
  notices,
  email,
  onLogout,
}: {
  accounts: AccountDto[];
  account: AccountDto | undefined;
  onSelectAccount: (id: string) => void;
  connected: boolean;
  view: TerminalView;
  onView: (v: TerminalView) => void;
  positions: PositionDto[];
  symbols: Map<string, SymbolSpec>;
  notices: NoticeItem[];
  email: string | undefined;
  onLogout: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  return (
    <header className="relative z-40 flex h-[52px] shrink-0 items-center gap-1.5 px-2 sm:gap-3 sm:px-4 lg:h-[56px]">
      {/* logo */}
      <Link href="/app" className="flex shrink-0 items-center text-white" title="Client area">
        <Wordmark size={24} className="hidden sm:inline-flex [&>span]:text-[17px]" />
        <Logo size={26} className="sm:hidden" />
      </Link>
      <div className="hidden w-px self-stretch lg:block" />

      <div className="lg:ml-10">
        <AccountChip accounts={accounts} account={account} onSelect={onSelectAccount} />
      </div>

      {/* Trade / Analytics / Explore */}
      <div role="tablist" aria-label="Terminal view" className="t-bar ml-2 hidden !h-[40px] rounded-lg !px-1 lg:flex">
        {VIEWS.map((v) => (
          <button key={v.value} type="button" role="tab" aria-selected={view === v.value} data-on={view === v.value} onClick={() => onView(v.value)} className="t-tab !h-8">
            <v.icon /> {v.label}
          </button>
        ))}
      </div>

      <div className="flex-1" />

      <div className="hidden lg:block">
        <ProfitBlock account={account} positions={positions} symbols={symbols} />
      </div>
      <div className="lg:hidden">
        <ProfitBlock account={account} positions={positions} symbols={symbols} compact />
      </div>

      <div className="flex-1" />

      <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
        <span className={cn('t-top-btn hidden sm:inline-flex', connected ? 'text-[#2ad4a6]' : 'text-[var(--t-alert)]')} title={connected ? 'Connected to the price stream' : 'Reconnecting…'} aria-live="polite">
          {mounted && connected ? <Wifi /> : <WifiOff />}
        </span>
        <BellMenu notices={notices} />
        <UserMenu email={email} onLogout={onLogout} />
      </div>
    </header>
  );
}
