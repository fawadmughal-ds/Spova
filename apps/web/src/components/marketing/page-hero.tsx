import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Reveal, Words } from '@/components/motion';

/** Standard opener for marketing sub-pages. `children` fills the right-hand illustration slot; set `--c` on a wrapper to recolour. */
export function PageHero({ eyebrow, title, lead, actions, children, wide }: { eyebrow: string; title: string; lead?: ReactNode; actions?: ReactNode; children?: ReactNode; wide?: boolean }) {
  return (
    <section className="noise relative overflow-hidden pt-32 sm:pt-40">
      <div className="bg-grid absolute inset-0" />
      <div className="aurora-blob -top-44 left-[6%] h-[520px] w-[640px] bg-brand-500/15" />
      <div className="aurora-blob right-[-12%] top-40 h-[420px] w-[520px] bg-iris/15 [animation-delay:-9s]" />
      <div className={cn('relative mx-auto grid max-w-7xl items-center gap-12 px-4 pb-20 sm:px-6 lg:pb-28', children && 'lg:grid-cols-[1.05fr_1fr]')}>
        <Reveal variant="none" className={cn(!children && !wide && 'max-w-3xl')}>
          <Reveal variant="fade">
            <span className="eyebrow">{eyebrow}</span>
          </Reveal>
          <h1 className={cn('mt-6 font-display font-extrabold tracking-tighter', wide ? 'text-4xl leading-[1.04] sm:text-6xl lg:text-7xl' : 'text-5xl leading-[0.95] sm:text-7xl')}>
            <Words text={title} delay={150} />
          </h1>
          {lead && (
            <Reveal delay={550}>
              <div className="mt-7 max-w-xl text-lg leading-relaxed text-ink-300">{lead}</div>
            </Reveal>
          )}
          {actions && (
            <Reveal delay={700} className="mt-9 flex flex-wrap items-center gap-3">
              {actions}
            </Reveal>
          )}
        </Reveal>
        {children && (
          <Reveal variant="scale" delay={300} className="relative">
            {children}
          </Reveal>
        )}
      </div>
    </section>
  );
}

/** Marks copy the client still has to supply; the marker text itself is kept verbatim. */
export function Pending({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={cn('inline-flex items-start gap-2 rounded-lg border border-dashed border-gold/40 bg-gold/[0.06] px-3 py-1.5 font-mono text-[11px] leading-relaxed text-gold', className)}>
      <span className="live-dot mt-1.5 !h-1.5 !w-1.5 shrink-0" />
      {children}
    </span>
  );
}
