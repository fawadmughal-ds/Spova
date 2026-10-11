'use client';

import Link from 'next/link';
import { useLayoutEffect, useState, type CSSProperties, type ReactNode, type RefObject } from 'react';
import { Check, ChevronRight, CircleDollarSign, CircleHelp, CircleUser, CreditCard, FileText, IdCard, LayoutDashboard, LogOut, Wallet } from 'lucide-react';
import type { AccountDto, MeDto } from '@spova/shared';
import { cn, initials } from '@/lib/utils';
import { Logo } from '@/components/logo';
import { useDismiss } from './bits';
import { fmtNum } from './format';
import { LANGUAGES, flagEmoji, setLang, useLang, useT, type Lang } from './i18n';

/** Client-area modules that open as overlays over the terminal (the reference never leaves the chart). */
export type RailPanel = 'dashboard' | 'deposit' | 'accounts' | 'payments' | 'documents' | 'statement' | 'help' | 'profile';

/**
 * Client-area rail on the far left of the terminal: the white 88px column of the reference (Deposit,
 * Trading accounts, Payments, Documents, Statement, InvestiQ / user, Help, Logout, language). It sits
 * OUTSIDE the `.terminal` dark scope, so its colours come from the normal light theme.
 */
export function ClientRail({ accounts, account, onSelectAccount, me, onLogout, onOpen, className }: { accounts: AccountDto[]; account: AccountDto | undefined; onSelectAccount: (id: string) => void; me: MeDto | null; onLogout: () => void; /** opens a client-area module as an overlay over the terminal instead of leaving the page */ onOpen: (panel: RailPanel) => void; className?: string }) {
  const t = useT();
  const first = me?.profile?.firstName ?? '';
  const last = me?.profile?.lastName ?? '';
  const fullName = `${first} ${last}`.trim() || me?.email || '';
  // the reference clips the name to the rail width without an ellipsis ("Rohan Ta")
  const shortName = fullName.length > 8 ? fullName.slice(0, 8) : fullName;
  return (
    <nav className={cn('trail', className)} aria-label="Client area">
      <div className="trail-top">
        <AccountPill accounts={accounts} account={account} onSelect={onSelectAccount} onOpenAccounts={() => onOpen('accounts')} />
        <Link href="/trade" className="trail-brand" title="Web terminal">
          <Logo size={26} />
        </Link>
      </div>

      <ul className="trail-list">
        <li>
          <button type="button" onClick={() => onOpen('dashboard')} className="trail-item">
            <LayoutDashboard /> {t('dashboard')}
          </button>
        </li>
        <li>
          <button type="button" onClick={() => onOpen('deposit')} className="trail-item trail-item-deposit">
            <CircleDollarSign /> {t('deposit')}
          </button>
        </li>
        <li>
          <button type="button" onClick={() => onOpen('accounts')} className="trail-item">
            <Wallet /> {t('accounts')}
          </button>
        </li>
        <li>
          <button type="button" onClick={() => onOpen('payments')} className="trail-item">
            <CreditCard /> {t('payments')}
          </button>
        </li>
        <li>
          <button type="button" onClick={() => onOpen('documents')} className="trail-item">
            <IdCard /> {t('documents')}
          </button>
        </li>
        <li>
          <button type="button" onClick={() => onOpen('statement')} className="trail-item">
            <FileText /> {t('statement')}
          </button>
        </li>
      </ul>

      <ul className="trail-list trail-bottom">
        <li>
          <button type="button" onClick={() => onOpen('profile')} className="trail-item" title={fullName}>
            {first || last ? <span className="trail-avatar">{initials(first, last)}</span> : <CircleUser />}
            <span className="trail-name">{shortName || t('profile')}</span>
          </button>
        </li>
        <li>
          <button type="button" onClick={() => onOpen('help')} className="trail-item">
            <CircleHelp /> {t('help')}
          </button>
        </li>
        <li>
          <button type="button" onClick={onLogout} className="trail-item">
            <LogOut /> {t('logout')}
          </button>
        </li>
        <li className="mt-2">
          <LanguageItem />
        </li>
      </ul>
    </nav>
  );
}

/** Fixed-position style for a menu next to its trigger (the rail clips overflow, so menus cannot sit inside it). */
function useAnchor(open: boolean, ref: RefObject<HTMLElement | null>, side: 'below' | 'right'): CSSProperties {
  const [style, setStyle] = useState<CSSProperties>({});
  useLayoutEffect(() => {
    if (!open || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    setStyle(side === 'below' ? { position: 'fixed', left: r.left, top: r.bottom + 6 } : { position: 'fixed', left: r.right + 6, bottom: Math.max(8, window.innerHeight - r.bottom) });
  }, [open, ref, side]);
  return style;
}

/** "Demo ›" / "Live ›" pill: opens the list of the user's accounts to switch between them. */
function AccountPill({ accounts, account, onSelect, onOpenAccounts }: { accounts: AccountDto[]; account: AccountDto | undefined; onSelect: (id: string) => void; onOpenAccounts: () => void }) {
  const [open, setOpen, ref] = useDismiss<HTMLDivElement>();
  const anchor = useAnchor(open, ref, 'below');
  const label = account ? (account.type === 'live' ? 'Live' : 'Demo') : '…';
  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen((v) => !v)} aria-haspopup="menu" aria-expanded={open} title="Switch account" className="trail-pill">
        {label} <ChevronRight strokeWidth={3} />
      </button>
      {open && (
        <div role="menu" className="trail-menu w-64" style={anchor}>
          <div className="trail-menu-label">Trading accounts</div>
          {accounts.length === 0 && <div className="px-3 py-2 text-xs text-[#55617a]">No accounts yet.</div>}
          {accounts.map((a) => (
            <button
              key={a.id}
              type="button"
              role="menuitemradio"
              aria-checked={a.id === account?.id}
              onClick={() => {
                onSelect(a.id);
                setOpen(false);
              }}
              className="trail-menu-item"
            >
              <span className={cn('rounded px-1.5 py-px text-[10px] font-bold uppercase tracking-wide', a.type === 'live' ? 'bg-[#2563eb] text-white' : 'bg-[#15803d]/15 text-[#15803d]')}>{a.type}</span>
              <span className="min-w-0 flex-1 text-left">
                <span className="block font-semibold text-[#141b2c]">{a.loginCode}</span>
                <span className="block text-[11px] text-[#55617a]">
                  {fmtNum(a.balance)} {a.currency}
                </span>
              </span>
              {a.id === account?.id && <Check className="text-[#2563eb]" strokeWidth={3} />}
            </button>
          ))}
          <div className="mt-1 border-t border-[#e2e7f0] pt-1">
            <button
              type="button"
              className="trail-menu-item"
              onClick={() => {
                setOpen(false);
                onOpenAccounts();
              }}
            >
              Open a new account
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Flag + code: the language picker. The choice is kept in localStorage and applied to the terminal chrome. */
function LanguageItem() {
  const [open, setOpen, ref] = useDismiss<HTMLDivElement>();
  const anchor = useAnchor(open, ref, 'right');
  const lang = useLang();
  const t = useT();
  const current = LANGUAGES.find((l) => l.code === lang) ?? LANGUAGES[0];
  const label = lang.charAt(0).toUpperCase() + lang.slice(1);
  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen((v) => !v)} aria-haspopup="menu" aria-expanded={open} className="trail-item" title={t('language')}>
        {lang === 'en' ? <UkFlag /> : <span className="text-[20px] leading-none">{flagEmoji(current.flag)}</span>} {label}
      </button>
      {open && (
        <div role="menu" className="trail-menu w-56" style={anchor}>
          <div className="trail-menu-label">{t('language')}</div>
          {LANGUAGES.map((l) => (
            <button
              key={l.code}
              type="button"
              role="menuitemradio"
              aria-checked={l.code === lang}
              onClick={() => {
                setLang(l.code as Lang);
                setOpen(false);
              }}
              className="trail-menu-item"
            >
              <span className="w-6 text-center text-[18px] leading-none">{flagEmoji(l.flag)}</span>
              <span className="min-w-0 flex-1 text-left font-medium">{l.native}</span>
              {l.code === lang && <Check className="text-[#2563eb]" strokeWidth={3} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Simplified Union Jack (the "En" flag of the reference). */
function UkFlag() {
  return (
    <svg viewBox="0 0 60 36" className="!h-[18px] !w-[24px] rounded-[3px]" aria-hidden>
      <rect width="60" height="36" fill="#1f3a93" />
      <path d="M0 0 L60 36 M60 0 L0 36" stroke="#fff" strokeWidth="7" />
      <path d="M0 0 L60 36 M60 0 L0 36" stroke="#d1213b" strokeWidth="2.5" />
      <path d="M30 0 V36 M0 18 H60" stroke="#fff" strokeWidth="11" />
      <path d="M30 0 V36 M0 18 H60" stroke="#d1213b" strokeWidth="6" />
    </svg>
  );
}

/** Links of the rail for the mobile "More" sheet (the rail itself is desktop-only). */
export function railLinks(t: (k: 'dashboard' | 'deposit' | 'accounts' | 'payments' | 'documents' | 'statement' | 'help' | 'profile') => string): { label: string; sub: string; panel: RailPanel; icon: ReactNode }[] {
  return [
    { label: t('dashboard'), sub: 'Balances, verification, recent activity', panel: 'dashboard', icon: <LayoutDashboard /> },
    { label: t('deposit'), sub: 'Fund the account', panel: 'deposit', icon: <CircleDollarSign /> },
    { label: t('accounts'), sub: 'Demo and live accounts', panel: 'accounts', icon: <Wallet /> },
    { label: t('payments'), sub: 'Deposit and withdrawal history', panel: 'payments', icon: <CreditCard /> },
    { label: t('documents'), sub: 'Verification (KYC)', panel: 'documents', icon: <IdCard /> },
    { label: t('statement'), sub: 'Account history and ledger', panel: 'statement', icon: <FileText /> },
    { label: t('profile'), sub: 'Personal details and password', panel: 'profile', icon: <CircleUser /> },
    { label: t('help'), sub: 'Support tickets', panel: 'help', icon: <CircleHelp /> },
  ];
}
