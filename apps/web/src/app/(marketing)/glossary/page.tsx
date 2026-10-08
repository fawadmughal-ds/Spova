import type { Metadata } from 'next';
import { ArrowDown } from 'lucide-react';
import { buttonClass } from '@/lib/button';
import { PageHero } from '@/components/marketing/page-hero';
import { CtaBand } from '@/components/marketing/cta-band';
import { ToolStrip } from '@/components/education/shared';
import { TERMS } from '@/components/education/glossary-data';
import { GlossaryBrowser, TermFlash } from '@/components/education/glossary-browser';

export const metadata: Metadata = {
  title: 'Trading glossary',
  description: `${TERMS.length} trading terms explained in plain English, from ask price to volume. Search or browse A to Z.`,
};

export default function GlossaryPage() {
  return (
    <>
      <PageHero
        eyebrow="Education — Glossary"
        title="Trading terms, *in plain English*"
        lead={`${TERMS.length} words you will meet on charts, order tickets and statements, each explained in a sentence or two. Search for one, or browse from A to Z.`}
        actions={
          <a href="#browse" className={buttonClass('outline', 'lg', 'group h-14 rounded-2xl px-7')}>
            Browse the terms <ArrowDown className="h-4 w-4 transition-transform duration-300 group-hover:translate-y-1" />
          </a>
        }
      >
        <TermFlash />
      </PageHero>

      <section id="browse" className="relative scroll-mt-24 border-t border-white/[0.06]">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20">
          <GlossaryBrowser />
        </div>
      </section>

      <ToolStrip current="/glossary" />
      <CtaBand title="See the words *in action*" body="Open a free demo with $10,000 virtual funds and find every term on a live order ticket." secondary={{ href: '/trading-education', label: 'Read the guide' }} />
    </>
  );
}
