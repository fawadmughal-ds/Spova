'use client';

import Link from 'next/link';
import { useLayoutEffect, useState, type CSSProperties, type ReactNode, type RefObject } from 'react';
import { Check, ChevronRight, CircleDollarSign, CircleHelp, CircleUser, CreditCard, FileText, IdCard, Lightbulb, LogOut, Wallet } from 'lucide-react';
import type { AccountDto, MeDto } from '@spova/shared';
import { cn, initials } from '@/lib/utils';
import { Logo } from '@/components/logo';
import { useDismiss } from './bits';
import { fmtNum } from './format';

/**
 * Client-area rail on the far left of the terminal: the white 88px column of the reference (Deposit,
 * Trading accounts, Payments, Documents, Statement, InvestiQ / user, Help, Logout, language). It sits
 * OUTSIDE the `.terminal` dark scope, so its colours come from the normal light theme.
 */
export function ClientRail({ accounts, account, onSelectAccount, me, onLogout, className }: { accounts: AccountDto[]; account: AccountDto | undefined; onSelectAccount: (id: string) => void; me: MeDto | null; onLogout: () => void; className?: string }) {
  const first = me?.profile?.firstName ?? '';
  const last = me?.profile?.lastName ?? '';
  const fullName = `${first} ${last}`.trim() || me?.email || '';
  // the reference clips the name to the rail width without an ellipsis ("Rohan Ta")
  const shortName = fullName.length > 8 ? fullName.slice(0, 8) : fullName;
  return (
    <nav className={cn('trail', className)} aria-label="Client area">
      <div className="trail-top">
        <AccountPill accounts={accounts} account={account} onSelect={onSelectAccount} />
        <Link href="/app" className="trail-brand" title="Client area">
          <Logo size={26} />
        </Link>
      </div>

      <ul className="trail-list">
        <li>
          <Link href="/app/payments" className="trail-item trail-item-deposit">
            <CircleDollarSign /> Deposit
          </Link>
        </li>
        <li>
          <Link href="/app/accounts" className="trail-item">
            <Wallet /> Trading accounts
          </Link>
        </li>
        <li>
          <Link href="/app/payments?tab=history" className="trail-item">
            <CreditCard /> Payments
          </Link>
        </li>
        <li>
          <Link href="/app/documents" className="trail-item">
            <IdCard /> Documents
          </Link>
        </li>
        <li>
          <Link href={account ? `/app/accounts/${account.id}` : '/app/accounts'} className="trail-item">
            <FileText /> Statement
          </Link>
        </li>
        <li>
          <Link href="/app/investiq" className="trail-item">
            <Lightbulb /> InvestiQ
          </Link>
        </li>
      </ul>

      <ul className="trail-list trail-bottom">
        <li>
          <Link href="/app/profile" className="trail-item" title={fullName}>
            {first || last ? <span className="trail-avatar">{initials(first, last)}</span> : <CircleUser />}
            <span className="trail-name">{shortName || 'Profile'}</span>
          </Link>
        </li>
        <li>
          <Link href="/app/help" className="trail-item">
            <CircleHelp /> Help
          </Link>
        </li>
        <li>
          <button type="button" onClick={onLogout} className="trail-item">
            <LogOut /> Logout
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
function AccountPill({ accounts, account, onSelect }: { accounts: AccountDto[]; account: AccountDto | undefined; onSelect: (id: string) => void }) {
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
            <Link href="/app/accounts" className="trail-menu-item" onClick={() => setOpen(false)}>
              Open a new account
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

const LANGUAGES: { code: string; label: string; native: string; ready: boolean }[] = [
  { code: 'en', label: 'English', native: 'English', ready: true },
  { code: 'hi', label: 'Hindi', native: 'हिन्दी', ready: false },
  { code: 'ar', label: 'Arabic', native: 'العربية', ready: false },
  { code: 'es', label: 'Spanish', native: 'Español', ready: false },
];

/** Flag + "En": the language picker. Only English ships today; the others are listed as coming soon. */
function LanguageItem() {
  const [open, setOpen, ref] = useDismiss<HTMLDivElement>();
  const anchor = useAnchor(open, ref, 'right');
  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen((v) => !v)} aria-haspopup="menu" aria-expanded={open} className="trail-item" title="Language">
        <UkFlag /> En
      </button>
      {open && (
        <div role="menu" className="trail-menu w-52" style={anchor}>
          <div className="trail-menu-label">Language</div>
          {LANGUAGES.map((l) => (
            <button key={l.code} type="button" role="menuitemradio" aria-checked={l.code === 'en'} disabled={!l.ready} onClick={() => setOpen(false)} className="trail-menu-item">
              <span className="min-w-0 flex-1 text-left">
                <span className="block font-medium">{l.native}</span>
                {!l.ready && <span className="block text-[10px] uppercase tracking-wider text-[#6b778f]">Coming soon</span>}
              </span>
              {l.code === 'en' && <Check className="text-[#2563eb]" strokeWidth={3} />}
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
export function railLinks(account: AccountDto | undefined): { label: string; sub: string; href: string; icon: ReactNode }[] {
  return [
    { label: 'Deposit', sub: 'Fund the account', href: '/app/payments', icon: <CircleDollarSign /> },
    { label: 'Documents', sub: 'Verification (KYC)', href: '/app/documents', icon: <IdCard /> },
    { label: 'Statement', sub: 'Account history and ledger', href: account ? `/app/accounts/${account.id}` : '/app/accounts', icon: <FileText /> },
    { label: 'Help', sub: 'Support tickets', href: '/app/help', icon: <CircleHelp /> },
  ];
}
