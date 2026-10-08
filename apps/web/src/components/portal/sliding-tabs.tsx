'use client';

import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** Segmented control whose highlight glides to the selected item. `underline` draws a glowing bar instead of a pill. */
export function SlidingTabs<T extends string>({
  items,
  value,
  onChange,
  variant = 'pill',
  className,
}: {
  items: { value: T; label: ReactNode }[];
  value: T;
  onChange: (v: T) => void;
  variant?: 'pill' | 'underline';
  className?: string;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [box, setBox] = useState<{ left: number; width: number } | null>(null);

  useLayoutEffect(() => {
    const place = () => {
      const el = refs.current[value];
      setBox(el ? { left: el.offsetLeft, width: el.offsetWidth } : null);
    };
    place();
    // labels resize when fonts load or live values change
    const ro = new ResizeObserver(place);
    if (wrap.current) ro.observe(wrap.current);
    return () => ro.disconnect();
  }, [value, items.length]);

  return (
    <div
      ref={wrap}
      role="tablist"
      className={cn('relative flex max-w-full overflow-x-auto [scrollbar-width:none]', variant === 'pill' ? 'gap-1 rounded-2xl border border-white/[0.07] bg-white/[0.03] p-1' : 'gap-1 border-b border-white/[0.07]', className)}
    >
      {box && (
        <span
          aria-hidden
          style={{ left: box.left, width: box.width }}
          className={cn(
            'pointer-events-none absolute transition-[left,width] duration-500 ease-out-expo',
            variant === 'pill'
              ? 'inset-y-1 rounded-xl bg-white/[0.08] shadow-[inset_0_1px_0_rgb(var(--tint)/0.08)] ring-1 ring-inset ring-brand-400/30'
              : 'bottom-0 h-0.5 rounded-full bg-gradient-to-r from-brand-500 to-brand-300 shadow-[0_0_12px_rgb(var(--brand-rgb)/0.8)]',
          )}
        />
      )}
      {items.map((it) => (
        <button
          key={it.value}
          ref={(el) => {
            refs.current[it.value] = el;
          }}
          role="tab"
          aria-selected={it.value === value}
          onClick={() => onChange(it.value)}
          className={cn(
            'relative flex shrink-0 items-center gap-2 whitespace-nowrap text-sm transition-colors duration-300',
            variant === 'pill' ? 'rounded-xl px-3.5 py-2' : 'px-4 py-3',
            it.value === value ? 'text-white' : 'text-ink-400 hover:text-ink-100',
          )}
        >
          {it.label}
        </button>
      ))}
    </div>
  );
}
