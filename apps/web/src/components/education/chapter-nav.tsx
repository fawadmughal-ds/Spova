'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

export interface Chapter {
  id: string;
  title: string;
}

/** Sticky chapter list for long-form guides: highlights the section in view and fills as the article is read. */
export function ChapterNav({ chapters, articleId }: { chapters: Chapter[]; articleId: string }) {
  const [active, setActive] = useState(chapters[0]?.id);
  const bar = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const els = chapters.map((c) => document.getElementById(c.id)).filter((e): e is HTMLElement => !!e);
    const io = new IntersectionObserver(
      (entries) => {
        const seen = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (seen) setActive(seen.target.id);
      },
      { rootMargin: '-25% 0px -60% 0px' },
    );
    els.forEach((e) => io.observe(e));

    const article = document.getElementById(articleId);
    let raf = 0;
    const update = () => {
      raf = 0;
      if (!article || !bar.current) return;
      const r = article.getBoundingClientRect();
      const p = Math.min(1, Math.max(0, (window.innerHeight * 0.4 - r.top) / r.height));
      bar.current.style.transform = `scaleY(${p})`;
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      io.disconnect();
      window.removeEventListener('scroll', onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [chapters, articleId]);

  return (
    <nav aria-label="Chapters" className="relative">
      <p className="label mb-4 hidden lg:block">In this guide</p>
      {/* desktop: vertical rail */}
      <div className="relative hidden pl-5 lg:block">
        <span className="absolute inset-y-1 left-0 w-px bg-white/10" />
        <span ref={bar} className="absolute inset-y-1 left-0 w-px origin-top bg-gradient-to-b from-brand-400 to-volt" style={{ transform: 'scaleY(0)' }} />
        <ol className="space-y-1">
          {chapters.map((c, n) => (
            <li key={c.id}>
              <a
                href={`#${c.id}`}
                aria-current={active === c.id ? 'true' : undefined}
                className={cn('group flex items-baseline gap-3 rounded-lg py-1.5 text-sm transition-all duration-300', active === c.id ? 'translate-x-1 text-white' : 'text-ink-400 hover:text-ink-100')}
              >
                <span className={cn('font-mono text-[10px] transition-colors', active === c.id ? 'text-brand-300' : 'text-ink-600')}>{String(n + 1).padStart(2, '0')}</span>
                {c.title}
              </a>
            </li>
          ))}
        </ol>
      </div>
      {/* mobile: chips */}
      <ol className="flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] lg:hidden">
        {chapters.map((c, n) => (
          <li key={c.id} className="shrink-0">
            <a
              href={`#${c.id}`}
              className={cn('flex items-center gap-2 rounded-full px-3.5 py-2 text-xs transition-colors duration-300', active === c.id ? 'bg-white text-ink-950' : 'bg-white/[0.06] text-ink-300')}
            >
              <span className="font-mono text-[10px] opacity-60">{String(n + 1).padStart(2, '0')}</span>
              {c.title}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
