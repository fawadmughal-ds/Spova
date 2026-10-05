import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { ArrowRight } from 'lucide-react';
import { publicGet, type PublicSymbol } from '@/lib/server-api';

const MARKETS: Record<string, { cls: string; title: string; intro: string; bullets: string[] }> = {
  forex: {
    cls: 'forex',
    title: 'Forex trading',
    intro: 'Trade 40+ currency pairs including majors, minors and exotics with leverage up to 1:400 and spreads from 0.0 pips. The FX market runs 24 hours a day, five days a week.',
    bullets: ['Majors, minors and exotics', 'Leverage up to 1:400', 'Micro lots from 0.01', 'No requotes on market orders'],
  },
  indices: {
    cls: 'index',
    title: 'Indices trading',
    intro: 'Speculate on the direction of entire stock markets: S&P 500, Nasdaq 100, Dow Jones, DAX 40, FTSE 100 and more, long or short, from one account.',
    bullets: ['US, European and Asian indices', 'Leverage up to 1:200', 'Trade cash indices during exchange hours', 'Hedge your equity portfolio'],
  },
  commodities: {
    cls: 'commodity',
    title: 'Commodities trading',
    intro: 'Energy and agricultural CFDs including WTI and Brent crude oil and natural gas. Go long or short with no physical delivery.',
    bullets: ['Crude oil (WTI, Brent)', 'Natural gas', 'Leverage up to 1:100', 'Transparent expiry calendar'],
  },
  shares: {
    cls: 'stock',
    title: 'Share CFDs',
    intro: 'Trade the biggest names on Wall Street as CFDs: Apple, Tesla, Amazon, NVIDIA and more. Fractional exposure, long and short.',
    bullets: ['US blue-chip shares', 'Leverage up to 1:5', 'Dividend adjustments', 'Exchange hours'],
  },
  cryptocurrencies: {
    cls: 'crypto',
    title: 'Crypto CFDs',
    intro: 'Bitcoin, Ethereum, Solana, XRP and Litecoin against the US dollar. Trade 24/7 without wallets, exchanges or custody risk.',
    bullets: ['24/7 trading', 'Leverage up to 1:5', 'No wallet needed', 'Live Binance pricing'],
  },
  metals: {
    cls: 'metal',
    title: 'Precious metals',
    intro: 'Gold and silver against the US dollar. The classic safe-haven trade with leverage up to 1:200.',
    bullets: ['XAUUSD, XAGUSD', 'Leverage up to 1:200', 'Tight spreads', 'Trade during FX hours'],
  },
};

// Simple content pages (copy to be replaced by client-approved text in Phase 4).
const CONTENT: Record<string, { title: string; paragraphs: string[] }> = {
  platform: {
    title: 'Web trading platform',
    paragraphs: [
      'Our browser-based terminal runs on any device with no download. Real-time charts with six timeframes, one-click market orders, pending limit and stop orders, and live P/L on every open position.',
      'Set stop-loss and take-profit on the ticket or edit them later from the positions table. Margin requirements are previewed before you confirm.',
      'Demo and live accounts share the same terminal, so what you practise is exactly what you trade.',
    ],
  },
  education: {
    title: 'Education',
    paragraphs: [
      'From your first pip to position sizing and risk management: short written lessons, glossary and a weekly market outlook. [PLACEHOLDER - content to be provided]',
    ],
  },
  'about-us': {
    title: 'About us',
    paragraphs: [
      'We are a multi-asset CFD broker focused on fair pricing, straightforward account conditions and fast support. [PLACEHOLDER - company copy, entity and regulatory statements to be supplied by the client]',
    ],
  },
  'contact-us': {
    title: 'Contact us',
    paragraphs: ['Support: support@[domain] - 24/5 live chat from the client area. [PLACEHOLDER - phone numbers and office address]'],
  },
  faq: {
    title: 'Frequently asked questions',
    paragraphs: [
      'How do I open an account? Register online, verify your identity and address, then fund your account.',
      'What is the minimum deposit? $150 on the Classic account.',
      'How long do withdrawals take? Requests are reviewed within one business day; bank transfers may take 2-5 days to arrive.',
      'Is there negative balance protection? Yes, on all account types.',
    ],
  },
  legal: {
    title: 'Legal documents',
    paragraphs: ['Client Agreement, Risk Disclosure, Privacy Policy, Order Execution Policy, Complaints Procedure. [PLACEHOLDER - PDFs to be supplied]'],
  },
};

export function generateStaticParams() {
  return [...Object.keys(MARKETS), ...Object.keys(CONTENT)].map((market) => ({ market }));
}

export async function generateMetadata({ params }: { params: Promise<{ market: string }> }): Promise<Metadata> {
  const { market } = await params;
  const m = MARKETS[market];
  if (m) return { title: m.title, description: m.intro };
  const c = CONTENT[market];
  return c ? { title: c.title } : {};
}

export default async function MarketPage({ params }: { params: Promise<{ market: string }> }) {
  const { market } = await params;
  const c = CONTENT[market];
  if (c) {
    return (
      <section className="mx-auto max-w-3xl px-4 py-20 sm:px-6">
        <h1 className="text-4xl font-bold tracking-tight">{c.title}</h1>
        <div className="mt-8 space-y-5 text-ink-300">
          {c.paragraphs.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>
      </section>
    );
  }
  const m = MARKETS[market];
  if (!m) notFound();

  const symbols = await publicGet<PublicSymbol[]>(`/market/symbols?class=${m.cls}`, []);

  return (
    <>
      <section className="relative overflow-hidden border-b border-white/5">
        <div className="bg-grid absolute inset-0" />
        <div className="relative mx-auto max-w-7xl px-4 py-20 sm:px-6">
          <p className="text-xs font-semibold uppercase tracking-widest text-brand-400">Markets</p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">{m.title}</h1>
          <p className="mt-5 max-w-2xl text-lg text-ink-300">{m.intro}</p>
          <ul className="mt-8 grid max-w-2xl gap-3 sm:grid-cols-2">
            {m.bullets.map((b) => (
              <li key={b} className="flex items-center gap-2 text-sm text-ink-200">
                <span className="h-1.5 w-1.5 rounded-full bg-brand-400" /> {b}
              </li>
            ))}
          </ul>
          <Link href="/register" className="mt-10 inline-flex h-12 items-center gap-2 rounded-xl bg-brand-500 px-6 font-semibold text-ink-950 shadow-glow hover:bg-brand-400">
            Start trading <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <h2 className="text-2xl font-bold">Instruments</h2>
        <div className="card mt-6 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-[11px] uppercase tracking-wider text-ink-500">
              <tr>
                <th className="px-5 py-3 font-medium">Symbol</th>
                <th className="px-5 py-3 font-medium">Description</th>
                <th className="px-5 py-3 font-medium">Digits</th>
                <th className="px-5 py-3 font-medium">Max leverage</th>
                <th className="px-5 py-3 font-medium">Bid / Ask</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {symbols.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-ink-500">
                    Instrument list unavailable right now.
                  </td>
                </tr>
              )}
              {symbols.map((s) => (
                <tr key={s.id}>
                  <td className="px-5 py-3 font-semibold">{s.id}</td>
                  <td className="px-5 py-3 text-ink-300">{s.name}</td>
                  <td className="tabular px-5 py-3">{s.digits}</td>
                  <td className="tabular px-5 py-3">1:{s.leverageMax}</td>
                  <td className="tabular px-5 py-3">{s.quote ? `${s.quote.bid} / ${s.quote.ask}` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
