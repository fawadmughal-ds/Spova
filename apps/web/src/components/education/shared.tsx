import Link from 'next/link';
import type { ReactNode } from 'react';
import { ArrowRight, ArrowUpRight, Lock, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { buttonClass } from '@/lib/button';
import { EDUCATION_LINKS } from '@/lib/site-nav';
import { Reveal, Spotlight } from '@/components/motion';
import { PageHero, Pending } from '@/components/marketing/page-hero';
import { SectionHead } from '@/components/marketing/section-head';
import { CtaBand } from '@/components/marketing/cta-band';

/** Tools whose content comes from an external feed that is not connected yet. */
export const FEED_TOOLS = ['/economic-calendar', '/signals', '/ebooks', '/daily-market-videos', '/latest-market-news'];

/** Frame for a non-functional mock: tagged, dimmed and hidden from assistive tech. */
export function PreviewFrame({ children, className, note = 'Sample layout · no real data' }: { children: ReactNode; className?: string; note?: string }) {
  return (
    <div className={cn('card overflow-hidden', className)}>
      <div className="flex items-center justify-between gap-3 border-b border-white/[0.06] px-5 py-3">
        <span className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-300">
          <span className="live-dot text-gold" /> Preview
        </span>
        <span className="label truncate">{note}</span>
      </div>
      <div className="relative">
        <div className="bg-dots absolute inset-0 opacity-70" />
        <div className="edu-mock relative p-5 sm:p-6" aria-hidden>
          {children}
        </div>
      </div>
    </div>
  );
}

/** Placeholder bar used inside mocks where real text or numbers would go. */
export function Bar({ w = 'w-full', className }: { w?: string; className?: string }) {
  return <span className={cn('block h-2 rounded-full bg-white/[0.09]', w, className)} />;
}

/** "Where to next" strip shared by every education page. */
export function ToolStrip({ current }: { current: string }) {
  const links = EDUCATION_LINKS.filter((l) => l.href !== current);
  return (
    <section className="mx-auto max-w-7xl px-4 py-24 sm:px-6 sm:py-28">
      <SectionHead eyebrow="Keep learning" title="More in the *education center*" />
      <Reveal variant="stagger" step={50} className="grid gap-px overflow-hidden rounded-3xl border border-white/[0.07] bg-white/[0.07] sm:grid-cols-2 lg:grid-cols-3">
        {links.map((l) => {
          const pending = FEED_TOOLS.includes(l.href);
          return (
            <Spotlight key={l.href} href={l.href} className="group flex items-center gap-4 bg-ink-950 p-5 transition-colors duration-500 hover:bg-ink-900">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/[0.05] text-ink-300 ring-1 ring-inset ring-white/10 transition-all duration-500 ease-spring group-hover:-rotate-6 group-hover:scale-110 group-hover:bg-brand-400/15 group-hover:text-brand-300 group-hover:ring-brand-400/30">
                <l.icon className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2 text-sm font-semibold text-white">
                  {l.label}
                  {pending && <span className="h-1.5 w-1.5 rounded-full bg-gold" title="In preparation" />}
                </span>
                <span className="block truncate text-xs text-ink-400">{l.blurb}</span>
              </span>
              <ArrowUpRight className="h-4 w-4 shrink-0 text-ink-600 transition-all duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-brand-300" />
            </Spotlight>
          );
        })}
      </Reveal>
    </section>
  );
}

export interface FeedPoint {
  icon: LucideIcon;
  title: string;
  body: string;
}

/** Page scaffold for the five feed-driven tools. The preview is the only thing that differs structurally. */
export function FeedPage({
  href,
  eyebrow,
  title,
  lead,
  preview,
  previewNote,
  pointsTitle,
  points,
  gateBody,
}: {
  href: string;
  eyebrow: string;
  title: string;
  lead: string;
  preview: ReactNode;
  previewNote?: string;
  pointsTitle: string;
  points: FeedPoint[];
  gateBody: string;
}) {
  return (
    <>
      <PageHero
        eyebrow={eyebrow}
        title={title}
        lead={
          <>
            <p>{lead}</p>
            <Pending className="mt-5">[PLACEHOLDER - content feed / provider to be connected]</Pending>
          </>
        }
        actions={
          <>
            <Link href="/register" className={buttonClass('primary', 'lg', 'group h-14 rounded-2xl px-7')}>
              Open account <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
            </Link>
            <Link href="/login" className={buttonClass('outline', 'lg', 'h-14 rounded-2xl px-7')}>
              Log in
            </Link>
          </>
        }
      >
        <PreviewFrame note={previewNote}>{preview}</PreviewFrame>
      </PageHero>

      <section className="relative border-y border-white/[0.06] bg-ink-900/40">
        <div className="relative mx-auto max-w-7xl px-4 py-24 sm:px-6 sm:py-28">
          <SectionHead eyebrow="01 — What to expect" title={pointsTitle} />
          <Reveal variant="stagger" step={110} className="grid gap-4 md:grid-cols-3">
            {points.map((p, i) => (
              <Spotlight key={p.title} className="card card-hover corners group overflow-hidden p-7">
                <div className="flex items-start justify-between">
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-400/10 text-brand-300 ring-1 ring-inset ring-brand-400/25 transition-transform duration-500 ease-spring group-hover:-rotate-12 group-hover:scale-110">
                    <p.icon className="h-6 w-6" />
                  </span>
                  <span className="text-outline font-display text-6xl font-extrabold leading-none">0{i + 1}</span>
                </div>
                <h3 className="mt-8 text-xl font-bold">{p.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-400">{p.body}</p>
              </Spotlight>
            ))}
          </Reveal>

          <Reveal variant="scale" delay={150} className="mt-4">
            <div className="card grid items-center gap-6 overflow-hidden border-dashed !border-gold/25 p-7 md:grid-cols-[auto_1fr_auto]">
              <span className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-gold/10 text-gold ring-1 ring-inset ring-gold/30">
                <span className="absolute inset-0 animate-pulse-ring rounded-2xl border border-gold/40" />
                <Lock className="h-6 w-6" />
              </span>
              <div>
                <h3 className="text-lg font-semibold">Reserved for clients, once it is live</h3>
                <p className="mt-1 max-w-2xl text-sm leading-relaxed text-ink-400">{gateBody}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link href="/login" className={buttonClass('secondary', 'md', 'rounded-full')}>
                  Log in
                </Link>
                <Link href="/register" className={buttonClass('outline', 'md', 'group rounded-full')}>
                  Open account <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
                </Link>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      <ToolStrip current={href} />
      <CtaBand title="Practise *while you wait*" secondary={{ href: '/education', label: 'Education center' }} />
    </>
  );
}
