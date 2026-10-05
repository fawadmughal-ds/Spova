'use client';

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { CheckCircle2, Info, TriangleAlert, X, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

type Level = 'info' | 'success' | 'warning' | 'danger';
interface Toast {
  id: number;
  title: string;
  body?: string;
  level: Level;
}

const Ctx = createContext<{ push: (t: Omit<Toast, 'id'>) => void } | null>(null);
let seq = 1;

const icons = { info: Info, success: CheckCircle2, warning: TriangleAlert, danger: XCircle };
const styles: Record<Level, string> = {
  info: 'border-sky-500/30 text-sky-200',
  success: 'border-up/30 text-up',
  warning: 'border-gold/30 text-gold',
  danger: 'border-down/30 text-down',
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const push = useCallback((t: Omit<Toast, 'id'>) => {
    const id = seq++;
    setItems((xs) => [...xs, { ...t, id }]);
    setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== id)), 6000);
  }, []);
  const value = useMemo(() => ({ push }), [push]);
  return (
    <Ctx.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed right-4 top-4 z-[100] flex w-[360px] max-w-[calc(100vw-2rem)] flex-col gap-2">
        {items.map((t) => {
          const Icon = icons[t.level];
          return (
            <div key={t.id} className={cn('pointer-events-auto flex items-start gap-3 rounded-xl border bg-ink-900/95 p-3 shadow-2xl backdrop-blur', styles[t.level])}>
              <Icon className="mt-0.5 h-4 w-4 shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-ink-100">{t.title}</div>
                {t.body && <div className="mt-0.5 text-xs text-ink-300">{t.body}</div>}
              </div>
              <button onClick={() => setItems((xs) => xs.filter((x) => x.id !== t.id))} className="text-ink-500 hover:text-ink-200">
                <X className="h-4 w-4" />
              </button>
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
