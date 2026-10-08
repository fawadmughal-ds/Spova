import { ArrowUpRight } from 'lucide-react';
import { TRADING_LINKS } from '@/lib/site-nav';
import { Reveal, Spotlight } from '@/components/motion';
import { SectionHead } from '@/components/marketing/section-head';

/** Cross-links between the trading-information pages; the current page is left out. */
export function TradingRelated({ current, eyebrow = 'Keep reading' }: { current: string; eyebrow?: string }) {
  const links = TRADING_LINKS.filter((l) => l.href !== current);
  return (
    <section className="mx-auto max-w-7xl px-4 py-24 sm:px-6 sm:py-28">
      <SectionHead eyebrow={eyebrow} title="The rest of the *fine print*" sub="Costs, hours and contract details live on their own pages." />
      <Reveal variant="stagger" step={70} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {links.map((l) => (
          <Spotlight key={l.href} href={l.href} className="card card-hover group flex flex-col p-5">
            <span className="flex items-center justify-between">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/[0.05] text-ink-200 ring-1 ring-inset ring-white/10 transition-all duration-500 ease-spring group-hover:-rotate-6 group-hover:scale-110 group-hover:bg-brand-400/15 group-hover:text-brand-300 group-hover:ring-brand-400/30">
                <l.icon className="h-5 w-5" />
              </span>
              <ArrowUpRight className="h-4 w-4 text-ink-500 transition-all duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-white" />
            </span>
            <span className="mt-5 text-lg font-semibold">{l.label}</span>
            <span className="mt-1 text-sm text-ink-400">{l.blurb}</span>
          </Spotlight>
        ))}
      </Reveal>
    </section>
  );
}
