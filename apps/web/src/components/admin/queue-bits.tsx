'use client';

import { forwardRef, useEffect, useState, type ReactNode, type TextareaHTMLAttributes } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import type { Paginated } from '@spova/shared';
import { get, ApiError } from '@/lib/api';
import { cn, fmtDate } from '@/lib/utils';
import { Skeleton } from '@/components/ui';
import { SlidingTabs } from '@/components/portal/sliding-tabs';

/** Small pieces shared by the three back-office queues (KYC, payments, tickets). */

// ---------------------------------------------------------------- data
/**
 * Paginated GET with filters. `params` with undefined values are dropped. Callers reset `page` themselves when a
 * filter changes (so a filter change is one request, not two). `setData` lets decision handlers patch rows locally.
 */
export function useQueue<T>(path: string, params: Record<string, string | undefined>, limit: number) {
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Paginated<T> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const key = JSON.stringify(params);

  useEffect(() => {
    let stale = false;
    setLoading(true);
    const qs = new URLSearchParams({ page: String(page), limit: String(limit) });
    for (const [k, v] of Object.entries(JSON.parse(key) as Record<string, string>)) if (v) qs.set(k, v);
    get<Paginated<T>>(`${path}?${qs}`)
      .then((d) => {
        if (stale) return;
        setData(d);
        setError(null);
      })
      .catch((e) => !stale && setError(e instanceof ApiError ? e.message : 'Could not load'))
      .finally(() => !stale && setLoading(false));
    return () => {
      stale = true;
    };
  }, [path, key, page, limit, version]);

  const pages = data ? Math.max(1, Math.ceil(data.total / limit)) : 1;
  return { data, setData, loading, error, page, setPage, pages, refresh: () => setVersion((v) => v + 1) };
}

// ---------------------------------------------------------------- form bits
export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
}

/** Multi-line twin of <Input> (ui.tsx has none). */
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea({ className, label, error, hint, id, ...props }, ref) {
  const tid = id ?? props.name;
  return (
    <label className="group/field block" htmlFor={tid}>
      {label && <span className="label mb-1.5 block transition-colors group-focus-within/field:text-brand-300">{label}</span>}
      <textarea
        ref={ref}
        id={tid}
        aria-invalid={!!error || undefined}
        className={cn(
          'block min-h-[88px] w-full resize-y rounded-xl border bg-white/[0.03] px-3.5 py-2.5 text-sm text-ink-100 placeholder:text-ink-500 transition-[border-color,box-shadow,background-color] duration-300 hover:bg-white/[0.05] focus:bg-ink-900 focus:outline-none focus:ring-4',
          error ? 'border-down/60 focus:border-down focus:ring-down/15' : 'border-white/10 hover:border-white/20 focus:border-brand-400/70 focus:ring-brand-400/15',
          className,
        )}
        {...props}
      />
      {error ? <span className="animate-pop-in mt-1.5 block text-xs text-down">{error}</span> : hint ? <span className="mt-1.5 block text-xs text-ink-500">{hint}</span> : null}
    </label>
  );
});

/** Status filter row. */
export function StatusTabs<T extends string>({ items, value, onChange, className }: { items: { value: T; label: ReactNode }[]; value: T; onChange: (v: T) => void; className?: string }) {
  return <SlidingTabs items={items} value={value} onChange={onChange} className={cn('min-w-0 max-w-full', className)} />;
}

// ---------------------------------------------------------------- table bits
export function ClientCell({ user, link = true, country }: { user: { id: string; email: string; firstName: string | null; lastName: string | null }; link?: boolean; country?: string | null }) {
  const name = user.firstName || user.lastName ? `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() : null;
  const inner = (
    <>
      <div className="flex items-center gap-1.5 font-medium text-white">
        <span className="truncate">{name ?? '—'}</span>
        {country && <span className="shrink-0 rounded bg-white/[0.06] px-1 font-mono text-[10px] text-ink-400">{country}</span>}
      </div>
      <div className="truncate text-xs text-ink-400">{user.email}</div>
    </>
  );
  return link ? (
    <Link href={`/admin/clients/${user.id}`} onClick={(e) => e.stopPropagation()} className="block min-w-0 max-w-[220px] hover:text-brand-300">
      {inner}
    </Link>
  ) : (
    <div className="min-w-0 max-w-[220px]">{inner}</div>
  );
}

export const fmtBytes = (n: number) => (n < 1024 ? `${n} B` : n < 1024 * 1024 ? `${(n / 1024).toFixed(0)} KB` : `${(n / (1024 * 1024)).toFixed(1)} MB`);

const ago = (iso: string) => {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 45) return 'just now';
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  if (s < 86400 * 7) return `${Math.round(s / 86400)} d ago`;
  return fmtDate(iso, false);
};

/** Relative time that refreshes once a minute; the exact timestamp sits in the tooltip. Renders after mount so SSR and client agree. */
export function TimeAgo({ iso, className }: { iso: string; className?: string }) {
  const [, tick] = useState(0);
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
    const t = setInterval(() => tick((n) => n + 1), 60_000);
    return () => clearInterval(t);
  }, []);
  return (
    <time dateTime={iso} title={fmtDate(iso)} className={cn('whitespace-nowrap', className)}>
      {mounted ? ago(iso) : fmtDate(iso)}
    </time>
  );
}

export function TableSkeleton({ rows = 6, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="space-y-2.5 py-1" role="status" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-3.5" style={{ opacity: 1 - i * 0.13 }}>
          {Array.from({ length: cols }, (_, c) => (
            <Skeleton key={c} className={cn('h-4', c === 0 ? 'w-40' : c === cols - 1 ? 'w-20' : 'flex-1', c > 2 && 'hidden sm:block')} />
          ))}
        </div>
      ))}
    </div>
  );
}

/** Previous / next with a progress strip, same look as the ledger table. */
export function Pager({ page, pages, total, noun, onPage }: { page: number; pages: number; total: number; noun: string; onPage: (p: number) => void }) {
  if (pages <= 1) return null;
  return (
    <div className="mt-4 flex items-center justify-between gap-4 border-t border-white/[0.05] pt-4">
      <span className="font-mono text-[11px] text-ink-400">
        <span className="text-ink-100">{total}</span> {noun}
      </span>
      <div className="flex items-center gap-3">
        <PageButton label="Previous page" disabled={page <= 1} onClick={() => onPage(page - 1)}>
          <ChevronLeft className="h-4 w-4 transition-transform duration-300 group-hover:-translate-x-0.5" />
        </PageButton>
        <span className="tabular font-mono text-xs text-ink-200">
          <span key={page} className="animate-pop-in inline-block text-white">
            {page}
          </span>
          <span className="text-ink-500"> / {pages}</span>
        </span>
        <span className="hidden h-1 w-24 overflow-hidden rounded-full bg-white/[0.08] sm:block">
          <span className="block h-full rounded-full bg-gradient-to-r from-brand-500 to-brand-300 transition-[width] duration-500 ease-out-expo" style={{ width: `${(page / pages) * 100}%` }} />
        </span>
        <PageButton label="Next page" disabled={page >= pages} onClick={() => onPage(page + 1)}>
          <ChevronRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5" />
        </PageButton>
      </div>
    </div>
  );
}

function PageButton({ label, disabled, onClick, children }: { label: string; disabled: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="group flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 text-ink-200 transition-colors duration-300 enabled:hover:border-brand-400/50 enabled:hover:bg-brand-400/10 enabled:hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
    >
      {children}
    </button>
  );
}

// ---------------------------------------------------------------- side panel
/** True once mounted and the query matches; false during SSR and the first client render (no hydration mismatch). */
function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const update = () => setMatches(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, [query]);
  return matches;
}

/**
 * Detail pane for a selected row. `split` renders it inline as the second grid column from `xl` up (sticky); below that,
 * and always without `split` (compact mode on the client page), it is a right-hand drawer. The drawer is portalled to
 * <body>: the shell's animated <main> is a containing block for position:fixed, so an in-tree drawer would be clipped to it.
 */
export function SidePanel({ open, onClose, split = true, placeholder, children }: { open: boolean; onClose: () => void; split?: boolean; placeholder?: ReactNode; children: ReactNode }) {
  const wide = useMediaQuery('(min-width: 1280px)');
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const drawer = !(split && wide);

  useEffect(() => {
    if (!open || !drawer) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, drawer, onClose]);

  if (!drawer) {
    return (
      <aside className="admin-pane sticky top-24 flex max-h-[calc(100vh-7rem)] flex-col self-start overflow-y-auto rounded-2xl border border-white/[0.08] bg-paper">
        {open ? children : <div className="flex flex-1">{placeholder}</div>}
      </aside>
    );
  }
  if (!mounted) return null;
  return createPortal(
    <div className={cn('fixed inset-0 z-50 overflow-hidden', !open && 'pointer-events-none')} aria-hidden={!open}>
      <div onClick={onClose} className={cn('absolute inset-0 bg-ink-950/60 backdrop-blur-sm transition-opacity duration-500', open ? 'opacity-100' : 'opacity-0')} />
      <aside
        className={cn(
          'admin-pane absolute inset-y-0 right-0 flex w-full max-w-[480px] flex-col overflow-y-auto border-l border-white/[0.08] bg-ink-950 shadow-lift transition-transform duration-500 ease-out-expo',
          open ? 'translate-x-0' : 'translate-x-full',
        )}
      >
        {open && children}
      </aside>
    </div>,
    document.body,
  );
}

export function PanelHeader({ title, sub, onClose, children }: { title: ReactNode; sub?: ReactNode; onClose: () => void; children?: ReactNode }) {
  return (
    <header className="sticky top-0 z-10 flex items-start gap-3 border-b border-white/[0.06] bg-paper/90 px-5 py-4 backdrop-blur-xl">
      <div className="min-w-0 flex-1">
        <h3 className="truncate font-display text-base font-semibold text-white">{title}</h3>
        {sub && <div className="mt-0.5 text-xs text-ink-400">{sub}</div>}
        {children}
      </div>
      <button type="button" onClick={onClose} aria-label="Close" className="-mr-1 rounded-lg p-1.5 text-ink-500 transition-colors hover:bg-white/[0.06] hover:text-white">
        <X className="h-4 w-4" />
      </button>
    </header>
  );
}
