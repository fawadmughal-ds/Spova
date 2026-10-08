'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

/** Sticky table of contents with scroll-spy: the marker follows the section currently being read. */
export function PolicyToc({ items }: { items: { id: string; label: string }[] }) {
  const [active, setActive] = useState(items[0]?.id ?? '');
  const links = useRef<Record<string, HTMLAnchorElement | null>>({});
  const [pill, setPill] = useState({ top: 0, left: 0, width: 0, height: 0 });

  useEffect(() => {
    const sections = items.map((i) => document.getElementById(i.id)).filter((el): el is HTMLElement => !!el);
    const onScroll = () => {
      // the active section is the last one whose top has passed a line a third of the way down the viewport
      const line = window.innerHeight * 0.33;
      let current = sections[0]?.id ?? '';
      for (const s of sections) if (s.getBoundingClientRect().top <= line) current = s.id;
      setActive(current);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, [items]);

  useLayoutEffect(() => {
    const el = links.current[active];
    if (!el) return;
    setPill({ top: el.offsetTop, left: el.offsetLeft, width: el.offsetWidth, height: el.offsetHeight });
    // keep the active chip in view on the horizontal (mobile) strip
    el.parentElement?.scrollTo({ left: el.offsetLeft - 16, behavior: 'smooth' });
  }, [active]);

  const index = Math.max(0, items.findIndex((i) => i.id === active));

  return (
    <nav aria-label="On this page">
      <div className="mb-3 hidden items-center justify-between px-1 lg:flex">
        <span className="label">On this page</span>
        <span className="tabular font-mono text-[10px] text-ink-500">
          {String(index + 1).padStart(2, '0')} / {String(items.length).padStart(2, '0')}
        </span>
      </div>
      <div className="relative flex gap-1 overflow-x-auto [scrollbar-width:none] lg:flex-col lg:overflow-visible">
        <span aria-hidden className="absolute rounded-xl bg-brand-400/[0.1] ring-1 ring-inset ring-brand-400/30 transition-all duration-500 ease-out-expo" style={pill} />
        {items.map((it, i) => (
          <a
            key={it.id}
            href={`#${it.id}`}
            ref={(el) => {
              links.current[it.id] = el;
            }}
            aria-current={it.id === active ? 'true' : undefined}
            className={cn('relative flex shrink-0 items-center gap-3 whitespace-nowrap rounded-xl px-3 py-2.5 text-sm transition-colors duration-300', it.id === active ? 'text-white' : 'text-ink-400 hover:text-white')}
          >
            <span className={cn('tabular font-mono text-[10px] transition-colors', it.id === active ? 'text-brand-300' : 'text-ink-600')}>{String(i + 1).padStart(2, '0')}</span>
            {it.label}
          </a>
        ))}
      </div>
      <div className="mt-4 hidden h-0.5 overflow-hidden rounded-full bg-white/[0.07] lg:block">
        <div className="h-full origin-left rounded-full bg-gradient-to-r from-brand-500 to-volt transition-transform duration-500 ease-out-expo" style={{ transform: `scaleX(${(index + 1) / items.length})` }} />
      </div>
    </nav>
  );
}
