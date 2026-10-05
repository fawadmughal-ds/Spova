import Link from 'next/link';
import { BRAND } from '@/lib/utils';
import { Logo } from '@/components/logo';

const COLS = [
  { title: 'Markets', links: ['/forex', '/indices', '/commodities', '/shares', '/cryptocurrencies', '/metals'], labels: ['Forex', 'Indices', 'Commodities', 'Shares', 'Cryptocurrencies', 'Metals'] },
  { title: 'Accounts', links: ['/trading-account', '/trading-account#classic', '/trading-account#gold', '/trading-account#vip'], labels: ['Compare accounts', 'Classic', 'Gold', 'VIP'] },
  { title: 'Company', links: ['/about-us', '/contact-us', '/faq', '/legal'], labels: ['About us', 'Contact', 'FAQ', 'Legal documents'] },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-white/5 bg-ink-950">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
        <div className="grid gap-10 md:grid-cols-5">
          <div className="md:col-span-2">
            <div className="flex items-center gap-2">
              <Logo />
              <span className="text-lg font-bold">{BRAND}</span>
            </div>
            <p className="mt-4 max-w-sm text-sm text-ink-400">
              Multi-asset CFD broker. Trade 250+ instruments across Forex, Indices, Commodities, Shares, Crypto and Metals from one account.
            </p>
          </div>
          {COLS.map((c) => (
            <div key={c.title}>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-ink-300">{c.title}</h4>
              <ul className="mt-4 space-y-2">
                {c.links.map((href, i) => (
                  <li key={href}>
                    <Link href={href} className="text-sm text-ink-400 hover:text-white">
                      {c.labels[i]}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 space-y-3 border-t border-white/5 pt-8 text-xs leading-relaxed text-ink-500">
          <p>
            <strong className="text-ink-300">Risk warning:</strong> CFDs are complex instruments and come with a high risk of losing money rapidly due to leverage. You should consider whether
            you understand how CFDs work and whether you can afford to take the high risk of losing your money. Past performance is not a reliable indicator of future results.
          </p>
          <p>
            {BRAND} does not offer services to residents of certain jurisdictions, including the United States. Regulatory and legal entity details will be published here once confirmed. [PLACEHOLDER]
          </p>
          <p>© {new Date().getFullYear()} {BRAND}. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
