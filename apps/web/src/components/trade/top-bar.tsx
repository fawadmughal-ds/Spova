'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Bell, BellOff, ChartNoAxesColumn, ChartPie, Check, ChevronDown, CircleUser, Compass, LayoutDashboard, LogOut, Moon, Sun, UserRound, Volume2, VolumeX, Wifi, WifiOff } from 'lucide-react';
import type { AccountDto, PositionDto } from '@spova/shared';
import { cn } from '@/lib/utils';
import { Logo, Wordmark } from '@/components/logo';
import { AnimatedNumber } from '@/components/motion';
import { fmtNum, type SymbolSpec } from './format';
import { useFloatingTotal } from './pnl';
import { Dropdown, ToggleRow } from './bits';
import { PROFIT_FIGURES, settingsStore, toggleProfitFigure, useProfitFigures, useSettings, type ProfitFigure } from './settings';
import { useT, type StringKey } from './i18n';

export type TerminalView = 'trade' | 'analytics' | 'explore';
export interface NoticeItem {
  id: number;
  title: string;
  body?: string;
  level: 'info' | 'success' | 'warning' | 'danger';
  at: number;
}

const VIEWS: { value: TerminalView; label: StringKey; icon: typeof Compass }[] = [
  { value: 'trade', label: 'trade', icon: ChartNoAxesColumn },
  { value: 'analytics', label: 'analytics', icon: ChartPie },
  { value: 'explore', label: 'explore', icon: Compass },
];

function TypeTag({ type }: { type: AccountDto['type'] }) {
  return <span className={cn('rounded px-1.5 py-px text-[10px] font-bold uppercase leading-4 tracking-wide', type === 'live' ? 'bg-[var(--t-blue-deep)] text-white' : 'bg-[var(--t-pos-bg)] text-[var(--t-pos-text)]')}>{type}</span>;
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
          <div className="mt-1 border-t border-[var(--t-raised-2)] pt-1">
            <Link href="/app/accounts" className="t-menu-item">
              <LayoutDashboard /> Manage accounts
            </Link>
          </div>
        </div>
      )}
    </Dropdown>
  );
}

/** Value of one account figure, formatted like the reference ("17 541 245.04 USD" / "664.11 %"). */
function figureValue(account: AccountDto | undefined, key: ProfitFigure): { value: number | null; suffix: string } {
  if (!account) return { value: null, suffix: '' };
  const num = (v: string | null) => (v === null || v === undefined || v === '' ? null : Number(v));
  switch (key) {
    case 'equity':
      return { value: num(account.equity), suffix: account.currency };
    case 'balance':
      return { value: num(account.balance), suffix: account.currency };
    case 'free':
      return { value: num(account.freeMargin), suffix: account.currency };
    case 'margin':
      return { value: num(account.usedMargin), suffix: account.currency };
    case 'level':
      return { value: num(account.marginLevel), suffix: '%' };
  }
}

function FigureValue({ value, suffix, className }: { value: number | null; suffix: string; className?: string }) {
  return (
    <span className={cn('whitespace-nowrap font-semibold text-[var(--t-blue)]', className)}>
      {value === null ? <span className="text-[var(--t-muted)]">—</span> : <AnimatedNumber value={value} duration={500} flash={false} format={(n) => fmtNum(n)} />}
      <span className="ml-1 text-[10px] font-medium">{suffix}</span>
    </span>
  );
}

/**
 * "Profit" block: live floating P/L of the open positions. The chevron opens the panel of account figures,
 * each with a checkbox; ticked figures are pinned inline next to the profit (persisted).
 */
function ProfitBlock({ account, positions, symbols, compact }: { account: AccountDto | undefined; positions: PositionDto[]; symbols: Map<string, SymbolSpec>; compact?: boolean }) {
  const t = useT();
  const total = useFloatingTotal(positions, symbols);
  const { shown } = useProfitFigures();
  const tone = total === null ? '' : total > 0 ? 't-pnl-up' : total < 0 ? 't-pnl-down' : 'text-white';
  const pinned = PROFIT_FIGURES.filter((f) => shown.includes(f.key));
  return (
    <div className={cn('flex shrink-0 items-center whitespace-nowrap', compact ? 'gap-1.5' : 'gap-3')}>
      <span className={cn('flex leading-none', compact ? 'items-baseline gap-1.5' : 'flex-col items-start')}>
        <span className={cn('text-[11px] font-medium text-[var(--t-muted)]', compact && 'hidden min-[420px]:inline')}>{t('profit')}</span>
        <span className={cn('font-semibold', compact ? 'text-[13px]' : 'mt-0.5 text-[15px]', tone)}>
          {total === null ? <span className="text-[var(--t-muted)]">—</span> : <AnimatedNumber value={total} duration={450} flash={false} format={(n) => fmtNum(n)} />}
          <span className="ml-1 text-[11px] font-medium text-[var(--t-muted)]">{account?.currency ?? 'USD'}</span>
        </span>
      </span>
      {!compact &&
        pinned.map((f) => {
          const v = figureValue(account, f.key);
          return (
            <span key={f.key} className="flex flex-col items-start border-l border-[var(--t-raised-2)] pl-3 leading-none">
              <span className="text-[11px] font-medium text-[var(--t-muted)]">{f.label}</span>
              <FigureValue value={v.value} suffix={v.suffix} className="mt-0.5 text-[15px]" />
            </span>
          );
        })}
      <Dropdown
        title="Account figures"
        align="right"
        buttonClassName="t-top-btn !h-9 !w-9 !rounded-md"
        menuClassName="!p-0"
        button={(open) => <ChevronDown className={cn('transition-transform', open && 'rotate-180')} />}
      >
        {() => (
          <div className="w-60 py-2">
            {account ? (
              PROFIT_FIGURES.map((f) => {
                const v = figureValue(account, f.key);
                const on = shown.includes(f.key);
                return (
                  <label key={f.key} className="flex h-12 cursor-pointer items-center gap-3 px-4 text-[13px] hover:bg-white/[0.04]">
                    <input type="checkbox" className="t-check" checked={on} onChange={() => toggleProfitFigure(f.key)} aria-label={`Show ${f.label} in the top bar`} />
                    <span className="font-medium text-white">{f.label}</span>
                    <FigureValue value={v.value} suffix={v.suffix} className="text-[12px]" />
                  </label>
                );
              })
            ) : (
              <div className="px-4 py-2 text-[12px] text-[var(--t-muted)]">No account selected.</div>
            )}
          </div>
        )}
      </Dropdown>
    </div>
  );
}

export function BellMenu({ notices }: { notices: NoticeItem[] }) {
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
          <div className="my-1 border-t border-[var(--t-raised-2)]" />
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
          <div className="my-1 border-t border-[var(--t-raised-2)]" />
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
  const { theme } = useSettings();
  const t = useT();
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
            <v.icon /> {t(v.label)}
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
        <span className={cn('t-top-btn hidden sm:inline-flex', connected ? 'text-[var(--t-ok)]' : 'text-[var(--t-alert)]')} title={connected ? 'Connected to the price stream' : 'Reconnecting…'} aria-live="polite">
          {mounted && connected ? <Wifi /> : <WifiOff />}
        </span>
        <Link href="/app" className="t-top-btn !w-auto gap-1.5 !px-2.5 text-[12px] font-semibold" title={t('dashboard')}>
          <LayoutDashboard /> <span className="hidden md:inline">{t('dashboard')}</span>
        </Link>
        <button type="button" onClick={() => settingsStore.patch({ theme: theme === 'dark' ? 'light' : 'dark' })} className="t-top-btn" title={theme === 'dark' ? 'Switch to the light theme' : 'Switch to the dark theme'} aria-pressed={theme === 'dark'}>
          {theme === 'dark' ? <Sun /> : <Moon />}
        </button>
        <BellMenu notices={notices} />
        <UserMenu email={email} onLogout={onLogout} />
      </div>
    </header>
  );
}
