'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { CheckCircle2, Info, TriangleAlert, X, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

type Level = 'info' | 'success' | 'warning' | 'danger';
interface Toast {
  id: number;
  title: string;
  body?: string;
  level: Level;
  leaving?: boolean;
}

const LIFE_MS = 6000;
const EXIT_MS = 340;

const Ctx = createContext<{ push: (t: Omit<Toast, 'id'>) => void } | null>(null);
let seq = 1;

const icons = { info: Info, success: CheckCircle2, warning: TriangleAlert, danger: XCircle };
/** level colour as an "r g b" triplet; drives icon chip, edge glow and timer bar */
const tints: Record<Level, string> = {
  info: '2 132 199',
  success: '21 128 61',
  warning: '173 108 7',
  danger: '220 38 38',
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>());

  const later = useCallback((fn: () => void, ms: number) => {
    const t = setTimeout(() => {
      timers.current.delete(t);
      fn();
    }, ms);
    timers.current.add(t);
  }, []);
  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach(clearTimeout);
  }, []);

  /** Plays the exit animation, then drops the toast. */
  const dismiss = useCallback(
    (id: number) => {
      setItems((xs) => xs.map((x) => (x.id === id ? { ...x, leaving: true } : x)));
      later(() => setItems((xs) => xs.filter((x) => x.id !== id)), EXIT_MS);
    },
    [later],
  );

  const push = useCallback(
    (t: Omit<Toast, 'id'>) => {
      const id = seq++;
      setItems((xs) => [...xs, { ...t, id }]);
      later(() => dismiss(id), LIFE_MS);
    },
    [later, dismiss],
  );

  const value = useMemo(() => ({ push }), [push]);
  return (
    <Ctx.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed right-4 top-4 z-[100] flex w-[380px] max-w-[calc(100vw-2rem)] flex-col gap-2.5" aria-live="polite">
        {items.map((t) => {
          const Icon = icons[t.level];
          return (
            <div
              key={t.id}
              role="status"
              data-leaving={t.leaving ? 'true' : undefined}
              style={{ '--tint': tints[t.level], '--life': `${LIFE_MS}ms` } as CSSProperties}
              className="toast glass pointer-events-auto relative flex items-start gap-3 overflow-hidden rounded-2xl p-3.5 shadow-lift"
            >
              <span className="pointer-events-none absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-[rgb(var(--tint)/0.14)] to-transparent" />
              <span className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[rgb(var(--tint)/0.14)] text-[rgb(var(--tint))] ring-1 ring-inset ring-[rgb(var(--tint)/0.3)]">
                <Icon className="animate-pop-in h-4 w-4 [animation-delay:150ms]" />
              </span>
              <div className="relative min-w-0 flex-1 pt-0.5">
                <div className="text-sm font-semibold text-white">{t.title}</div>
                {t.body && <div className="mt-0.5 text-xs leading-relaxed text-ink-300">{t.body}</div>}
              </div>
              <button onClick={() => dismiss(t.id)} aria-label="Dismiss" className="relative rounded-md p-1 text-ink-500 transition-colors hover:bg-white/[0.06] hover:text-white">
                <X className="h-3.5 w-3.5" />
              </button>
              <span className="toast-timer absolute inset-x-0 bottom-0 h-0.5 bg-[rgb(var(--tint))]" />
            </div>
          );
        })}
      </div>
    </Ctx.Provider>
  );
}

export function useToast() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useToast outside ToastProvider');
  return v.push;
}
