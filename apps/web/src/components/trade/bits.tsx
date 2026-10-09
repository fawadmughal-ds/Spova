'use client';

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Calendar as CalendarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { SymbolSpec } from './format';

/** Closes on outside click / Esc. Returns [open, setOpen, ref, extraRef]; a click inside either ref keeps it open. */
export function useDismiss<T extends HTMLElement>() {
  const [open, setOpen] = useState(false);
  const ref = useRef<T>(null);
  const extra = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (ref.current?.contains(t) || extra.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);
  return [open, setOpen, ref, extra] as const;
}

/**
 * Button + anchored dropdown. `render(close)` draws the menu body.
 * The menu is portaled to <body> with fixed coordinates so toolbars with `overflow-x-auto`
 * (the chart toolbar on small screens) cannot clip it; it follows the button on resize/scroll.
 */
export function Dropdown({ button, buttonClassName, children, align = 'left', className, menuClassName, title, onOpenChange }: { button: (open: boolean) => ReactNode; /** classes of the trigger <button> itself */ buttonClassName?: string; children: (close: () => void) => ReactNode; align?: 'left' | 'right'; className?: string; menuClassName?: string; title?: string; onOpenChange?: (open: boolean) => void }) {
  const [open, setOpen, ref, menuRef] = useDismiss<HTMLDivElement>();
  const [pos, setPos] = useState<CSSProperties | null>(null);
  const onChange = useRef(onOpenChange);
  onChange.current = onOpenChange;
  useEffect(() => {
    onChange.current?.(open);
  }, [open]);
  useEffect(() => {
    if (!open) {
      setPos(null);
      return;
    }
    const place = () => {
      const r = ref.current?.getBoundingClientRect();
      if (!r) return;
      const top = r.bottom + 6;
      const style: CSSProperties = { position: 'fixed', top, maxHeight: `calc(100vh - ${top + 8}px)`, overflowY: 'auto' };
      if (align === 'right') style.right = Math.max(4, window.innerWidth - r.right);
      else style.left = Math.max(4, Math.min(r.left, window.innerWidth - 8 - 176));
      setPos(style);
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open, align, ref]);
  const menu =
    open && pos ? (
      <div ref={(el) => void (menuRef.current = el)} role="menu" style={pos} className={cn('t-menu', menuClassName)}>
        {children(() => setOpen(false))}
      </div>
    ) : null;
  return (
    <div ref={ref} className={cn('relative', className)}>
      <button type="button" title={title} aria-label={title} aria-haspopup="menu" aria-expanded={open} data-open={open} onClick={() => setOpen((v) => !v)} className={buttonClassName}>
        {button(open)}
      </button>
      {menu && createPortal(menu, document.body)}
    </div>
  );
}

/** Square tile with the symbol's first letter: white for most markets, black for crypto / shares, gold for metals (like the reference). */
export function SymbolTile({ spec, id, size = 26, className }: { spec?: SymbolSpec | null; id?: string; size?: number; className?: string }) {
  const sym = spec?.id ?? id ?? '?';
  const cls = spec?.assetClass;
  const style: CSSProperties = cls === 'crypto' || cls === 'stock' ? { background: '#0f1115', color: '#fff', boxShadow: 'inset 0 0 0 1px #3b434f' } : cls === 'metal' ? { background: '#e0a526', color: '#1c2128' } : cls === 'commodity' ? { background: '#1c2128', color: '#fff', boxShadow: 'inset 0 0 0 1px #3b434f' } : { background: '#f3f5f8', color: '#1c2128' };
  return (
    <span className={cn('t-tile', className)} style={{ ...style, width: size, height: size, fontSize: Math.round(size * 0.5) }} aria-hidden>
      {sym.charAt(0)}
    </span>
  );
}

/** Small count pill (blue, like the "Open Positions 8" badge). */
export function CountBadge({ n }: { n: number | undefined }) {
  if (!n) return null;
  return <span className="inline-flex h-[18px] min-w-[18px] items-center justify-center rounded bg-[var(--t-blue-deep)] px-1.5 text-[11px] font-semibold text-white">{n}</span>;
}

/** Switch row used by the settings / bell menus. */
export function ToggleRow({ label, checked, onChange, icon }: { label: ReactNode; checked: boolean; onChange: (v: boolean) => void; icon?: ReactNode }) {
  return (
    <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)} className="t-menu-item justify-between">
      <span className="flex items-center gap-2.5">
        {icon}
        {label}
      </span>
      <span className={cn('relative inline-flex h-[18px] w-8 shrink-0 items-center rounded-full transition-colors', checked ? 'bg-[var(--t-blue-deep)]' : 'bg-[#4b5868]')}>
        <span className={cn('absolute h-3.5 w-3.5 rounded-full bg-white transition-transform', checked ? 'translate-x-[16px]' : 'translate-x-[2px]')} />
      </span>
    </button>
  );
}

/** Centered modal with a dark scrim; closes on scrim click / Esc. */
export function Modal({ onClose, children, className, label }: { onClose: () => void; children: ReactNode; className?: string; label: string }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/55 p-0 sm:items-center sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal aria-label={label} className={cn('animate-pop-in max-h-[92dvh] w-full overflow-hidden rounded-t-xl border border-[#3b434f] bg-[#262c35] shadow-lift sm:max-w-md sm:rounded-xl', className)}>
        {children}
      </div>
    </div>
  );
}

export function EmptyState({ icon, title, children, className }: { icon?: ReactNode; title: string; children?: ReactNode; className?: string }) {
  return (
    <div className={cn('flex h-full min-h-[120px] flex-col items-center justify-center gap-1.5 p-6 text-center', className)}>
      {icon && <span className="mb-1 text-[var(--t-dim)] [&>svg]:h-6 [&>svg]:w-6">{icon}</span>}
      <div className="text-[13px] font-medium text-[var(--t-text-2)]">{title}</div>
      {children && <div className="max-w-sm text-[12px] leading-relaxed text-[var(--t-muted)]">{children}</div>}
    </div>
  );
}

/** Red / teal split bar with the two percentages ("49% ——— 51%"), used for market sentiment. */
export function SplitBar({ sellPct, buyPct, className, labels = true }: { sellPct: number; buyPct: number; className?: string; labels?: boolean }) {
  return (
    <span className={cn('flex items-center gap-2', className)}>
      {labels && <span className="w-9 shrink-0 text-right text-[12px] font-semibold text-[var(--t-sell)]">{Math.round(sellPct)}%</span>}
      <span className="flex h-[5px] min-w-0 flex-1 gap-[3px]">
        <span className="h-full rounded-full bg-[var(--t-sell)]" style={{ width: `${sellPct}%` }} />
        <span className="h-full rounded-full bg-[var(--t-up)]" style={{ width: `${buyPct}%` }} />
      </span>
      {labels && <span className="w-9 shrink-0 text-[12px] font-semibold text-[var(--t-up)]">{Math.round(buyPct)}%</span>}
    </span>
  );
}

/** Small round "i" with a hover / focus tooltip (title + explanation). */
export function InfoTip({ text, className }: { text: string; className?: string }) {
  return (
    <span className={cn('group/tip relative inline-flex', className)}>
      <button type="button" aria-label={text} className="inline-flex h-[18px] w-[18px] items-center justify-center rounded-full bg-[#4b5868] text-[11px] font-bold leading-none text-white">
        i
      </button>
      <span role="tooltip" className="pointer-events-none absolute left-1/2 top-[calc(100%+8px)] z-30 w-64 -translate-x-1/2 rounded-md border border-[#3b434f] bg-[#2a313b] px-3 py-2 text-left text-[11.5px] font-normal leading-relaxed text-[var(--t-text-2)] opacity-0 shadow-lift transition-opacity group-hover/tip:opacity-100 group-focus-within/tip:opacity-100">
        {text}
      </span>
    </span>
  );
}

/** Shared "no calendar feed" state used by the Calendar tab and the Explore "Upcoming Events" card. */
