import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Reveal, Words } from '@/components/motion';

/** Section opener used across marketing pages: mono eyebrow, word-reveal title (*accent* supported), optional lead. */
export function SectionHead({
  eyebrow,
  title,
  sub,
  align = 'left',
  action,
  className,
}: {
  eyebrow: string;
  title: string;
  sub?: ReactNode;
  align?: 'left' | 'center';
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('mb-12 flex flex-wrap items-end justify-between gap-6', align === 'center' && 'justify-center text-center', className)}>
      <Reveal variant="stagger" className={cn('max-w-3xl', align === 'center' && 'mx-auto')}>
        <span className="eyebrow">{eyebrow}</span>
        <h2 className="mt-5 font-display text-4xl font-bold leading-[1.02] tracking-tight sm:text-5xl">
          <Words text={title} delay={120} />
        </h2>
        {sub && <p className={cn('mt-5 text-lg leading-relaxed text-ink-300', align === 'center' && 'mx-auto max-w-xl')}>{sub}</p>}
      </Reveal>
      {action && (
        <Reveal variant="fade" delay={300}>
          {action}
        </Reveal>
      )}
    </div>
  );
}
