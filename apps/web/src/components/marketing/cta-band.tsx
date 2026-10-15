import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight } from 'lucide-react';
import { buttonClass } from '@/lib/button';
import { Reveal, Words } from '@/components/motion';

/** Closing band for marketing sub-pages. Picks up the page accent from `--c` when one is set. */
export function CtaBand({
  title = 'Ready *when you are*',
  body = 'Open a free demo with $10,000 virtual funds. No card required.',
  primary = { href: '/register', label: 'Open free demo' },
  secondary = { href: '/trading-account', label: 'Compare accounts' },
}: {
  title?: string;
  body?: string;
  primary?: { href: string; label: string };
  secondary?: { href: string; label: string } | null;
}) {
  return (
    <section className="mx-auto max-w-7xl px-4 pb-24 pt-4 sm:px-6 sm:pb-32">
      <Reveal variant="scale">
        <div className="beam noise relative overflow-hidden rounded-3xl border border-white/[0.08] bg-ink-900 p-8 sm:p-14">
          <Image src="/images/cta-bg.jpg" alt="" fill sizes="(max-width: 1280px) 100vw, 1280px" className="pointer-events-none absolute inset-0 object-cover opacity-25" />
          <div className="absolute inset-0 bg-gradient-to-r from-ink-900 via-ink-900/80 to-ink-900/30" />
          <div className="aurora-blob -left-24 -top-44 h-[380px] w-[620px] bg-[rgb(var(--c,var(--brand-rgb))/0.22)]" />
          <div className="bg-dots absolute inset-0 opacity-60" />
          <Reveal variant="none" className="relative flex flex-wrap items-end justify-between gap-8">
            <div className="max-w-xl">
              <h2 className="font-display text-4xl font-extrabold leading-[0.98] tracking-tighter sm:text-6xl">
                <Words text={title} />
              </h2>
              <p className="mt-5 text-lg text-ink-300">{body}</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href={primary.href} className={buttonClass('primary', 'lg', 'group h-14 rounded-2xl px-7')}>
                {primary.label} <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
              </Link>
              {secondary && (
                <Link href={secondary.href} className={buttonClass('secondary', 'lg', 'h-14 rounded-2xl px-7')}>
                  {secondary.label}
                </Link>
              )}
            </div>
          </Reveal>
        </div>
      </Reveal>
    </section>
  );
}
