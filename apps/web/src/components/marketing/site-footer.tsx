import Link from 'next/link';
import { ArrowUpRight, Facebook, Instagram } from 'lucide-react';
import { BRAND } from '@/lib/utils';
import { MARKET_LIST } from '@/lib/markets';
import { COMPANY_LINKS, EDUCATION_LINKS, TIER_LINKS, TRADING_LINKS, tierHref } from '@/lib/site-nav';
import { Wordmark } from '@/components/logo';
import { Reveal } from '@/components/motion';
import { NewsletterForm } from '@/components/marketing/newsletter-form';

const COLS: { title: string; links: [href: string, label: string][] }[] = [
  { title: 'Markets', links: MARKET_LIST.map((m) => [`/${m.slug}`, m.label]) },
  {
    title: 'Trading',
    links: [...TRADING_LINKS.map((l): [string, string] => [l.href, l.label]), ['/platform', 'Web terminal']],
  },
  { title: 'Accounts', links: TIER_LINKS.map((t) => [tierHref(t.tier), t.label]) },
  { title: 'Education', links: EDUCATION_LINKS.map((l) => [l.href, l.label]) },
  { title: 'Company', links: COMPANY_LINKS.map((l) => [l.href, l.label]) },
];

const SOCIALS: { label: string; href: string; icon: 'facebook' | 'instagram' | 'x' }[] = [
  { label: 'Facebook', href: 'https://www.facebook.com/zerventa', icon: 'facebook' },
  { label: 'Instagram', href: 'https://www.instagram.com/zerventa', icon: 'instagram' },
  { label: 'X', href: 'https://x.com/zerventa', icon: 'x' },
];

function XMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className} fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24h-6.656l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function SocialLinks({ className = '' }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      {SOCIALS.map((sLink) => (
        <a
          key={sLink.label}
          href={sLink.href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={sLink.label}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 text-ink-300 transition-colors hover:border-brand-400/50 hover:text-white"
        >
          {sLink.icon === 'facebook' ? <Facebook className="h-4 w-4" /> : sLink.icon === 'instagram' ? <Instagram className="h-4 w-4" /> : <XMark className="h-[15px] w-[15px]" />}
        </a>
      ))}
    </div>
  );
}

export function SiteFooter() {
  return (
    <footer className="relative overflow-hidden border-t border-white/[0.06] bg-ink-950">
      <div className="aurora-blob -bottom-64 left-1/2 h-[420px] w-[900px] -translate-x-1/2 bg-brand-500/10" />
      <div className="relative mx-auto max-w-7xl px-4 pt-16 sm:px-6">
        <Reveal variant="stagger" className="grid grid-cols-2 gap-x-6 gap-y-10 md:grid-cols-4 lg:grid-cols-[1.6fr_repeat(5,1fr)]">
          <div className="col-span-2 md:col-span-4 lg:col-span-1">
            <Link href="/" aria-label="Home">
              <Wordmark />
            </Link>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-ink-400">
              Multi-asset CFD broker. Trade 250+ instruments across Forex, Indices, Commodities, Shares, Crypto and Metals from one account.
            </p>
            <Link href="/register" className="group mt-6 inline-flex items-center gap-2 text-sm font-medium text-brand-300">
              <span className="link-underline">Open a free demo</span>
              <ArrowUpRight className="h-4 w-4 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
            </Link>
            <NewsletterForm className="mt-8 max-w-sm" />
            <SocialLinks className="mt-7" />
          </div>
          {COLS.map((c) => (
            <div key={c.title}>
              <h4 className="label">{c.title}</h4>
              <ul className="mt-4 space-y-2.5">
                {c.links.map(([href, label]) => (
                  <li key={href}>
                    <Link href={href} className="group inline-flex items-center gap-2 text-sm text-ink-300 transition-colors hover:text-white">
                      <span className="h-px w-0 bg-brand-400 transition-all duration-300 group-hover:w-3" />
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </Reveal>

        <div className="ruler mt-14" />
        <Reveal variant="fade" className="space-y-3 pt-8 text-xs leading-relaxed text-ink-500">
          <p>
            <strong className="text-ink-300">Risk warning:</strong> CFDs are complex instruments and come with a high risk of losing money rapidly due to leverage. You should consider whether
            you understand how CFDs work and whether you can afford to take the high risk of losing your money. Past performance is not a reliable indicator of future results.
          </p>
          <p>
            <strong className="text-ink-300">Regional Restrictions:</strong> {BRAND} does not offer its services to residents of the European Union, UAE, GCC countries or to any other jurisdiction where such distribution would be contrary to local laws and regulations.
          </p>
          <p className="font-mono text-[11px] uppercase tracking-[0.14em]">© {BRAND}. All rights reserved.</p>
        </Reveal>
      </div>

      {/* oversized hollow wordmark, half sunk below the fold of the page */}
      <Reveal variant="fade" delay={150} className="pointer-events-none relative mt-6 select-none overflow-hidden">
        <div aria-hidden className="text-outline -mb-[0.32em] [-webkit-text-stroke-color:rgb(var(--tint)/0.3)] text-center font-display text-[clamp(7rem,30vw,26rem)] font-extrabold leading-none tracking-tighter">
          {BRAND}
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-ink-950 via-ink-950/10 to-transparent" />
      </Reveal>
    </footer>
  );
}
