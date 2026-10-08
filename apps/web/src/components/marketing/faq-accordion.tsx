'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Pending } from '@/components/marketing/page-hero';

/** One-open-at-a-time accordion. Panels animate their height with the grid-rows 0fr -> 1fr trick. `pending` shows a placeholder note under the answer. */
export function FaqAccordion({ items }: { items: { q: string; a: string; pending?: string }[] }) {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <ul className="space-y-3">
      {items.map((it, i) => {
        const on = open === i;
        return (
          <li key={it.q} className={cn('card overflow-hidden transition-[border-color,box-shadow,background-color] duration-500', on ? 'border-brand-400/35 shadow-[0_30px_80px_-50px_rgb(var(--brand-rgb)/0.7)]' : 'hover:border-white/15')}>
            <h3>
              <button onClick={() => setOpen(on ? null : i)} aria-expanded={on} aria-controls={`faq-${i}`} className="group flex w-full items-center gap-5 p-5 text-left sm:p-6">
                <span className={cn('tabular font-mono text-xs transition-colors duration-300', on ? 'text-brand-300' : 'text-ink-500')}>{String(i + 1).padStart(2, '0')}</span>
                <span className={cn('flex-1 font-display text-lg font-semibold tracking-tight transition-colors duration-300 sm:text-xl', on ? 'text-white' : 'text-ink-100 group-hover:text-white')}>{it.q}</span>
                <span
                  className={cn(
                    'flex h-9 w-9 shrink-0 items-center justify-center rounded-full border transition-all duration-500 ease-spring',
                    on ? 'rotate-[135deg] border-brand-400 bg-brand-400 text-ink-950' : 'border-white/15 text-ink-300 group-hover:border-brand-400/50 group-hover:text-brand-300',
                  )}
                >
                  <Plus className="h-4 w-4" />
                </span>
              </button>
            </h3>
            <div id={`faq-${i}`} role="region" className={cn('grid transition-[grid-template-rows] duration-500 ease-out-expo', on ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]')}>
              <div className="overflow-hidden">
                <div className={cn('pb-6 pl-[3.6rem] pr-6 transition-all duration-500 sm:pl-[4.1rem] sm:pr-20', on ? 'translate-y-0 opacity-100' : '-translate-y-2 opacity-0')}>
                  <p className="leading-relaxed text-ink-300">{it.a}</p>
                  {it.pending && <Pending className="mt-4">{it.pending}</Pending>}
                </div>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
