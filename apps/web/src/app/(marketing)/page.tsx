import Link from 'next/link';
import { ArrowRight, BadgeCheck, Clock3, Globe2, Headset, ShieldCheck, Zap } from 'lucide-react';
import { BRAND } from '@/lib/utils';
import { publicGet, type PublicSymbol } from '@/lib/server-api';
import { InstrumentTabs } from '@/components/marketing/instrument-tabs';

const ADVANTAGES = [
  { icon: Zap, title: 'Fast execution', body: 'Market orders fill instantly at live bid/ask. No requotes, no dealing desk delays.' },
  { icon: ShieldCheck, title: 'Negative balance protection', body: 'You can never lose more than your account balance. Stop-out keeps you protected.' },
  { icon: Globe2, title: '250+ instruments', body: 'Forex majors and minors, indices, commodities, global shares, crypto and precious metals.' },
  { icon: Clock3, title: '24/5 markets, 24/7 crypto', body: 'Trade FX around the clock during the week and crypto every day of the year.' },
  { icon: BadgeCheck, title: 'Segregated funds', body: 'Client money is held separately from company funds. [PLACEHOLDER - confirm wording]' },
  { icon: Headset, title: 'Multilingual support', body: 'Real people, via chat, email and phone. Dedicated managers from Gold tier.' },
];

const STEPS = [
  { n: '01', title: 'Register', body: 'Two minutes. Email, phone, a few details. Your demo account with $10,000 is ready instantly.' },
  { n: '02', title: 'Verify', body: 'Upload ID and proof of address from your client area. Most reviews finish the same day.' },
  { n: '03', title: 'Fund & trade', body: 'Deposit from $150 and open your first position on the web terminal.' },
];

export default async function HomePage() {
  const symbols = await publicGet<PublicSymbol[]>('/market/symbols', []);

  return (
    <>
      {/* HERO */}
      <section className="relative overflow-hidden">
        <div className="bg-grid absolute inset-0" />
        <div className="absolute -top-40 left-1/2 h-[520px] w-[820px] -translate-x-1/2 rounded-full bg-brand-500/15 blur-3xl" />
        <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-4 py-20 sm:px-6 lg:grid-cols-2 lg:py-28">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-brand-500/30 bg-brand-500/10 px-3 py-1 text-xs font-medium text-brand-300">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand-400" /> Demo accounts open now
            </span>
            <h1 className="mt-5 text-4xl font-bold leading-[1.1] tracking-tight sm:text-5xl lg:text-6xl">
              Trade the world&apos;s markets <span className="bg-gradient-to-r from-brand-300 to-brand-500 bg-clip-text text-transparent">from one account</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg text-ink-300">
              Forex, indices, commodities, shares, crypto and metals as CFDs. Tight spreads, leverage up to 1:400 and a web terminal that works on any device.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/register" className="inline-flex h-12 items-center gap-2 rounded-xl bg-brand-500 px-6 font-semibold text-ink-950 shadow-glow hover:bg-brand-400">
                Open free demo <ArrowRight className="h-4 w-4" />
              </Link>
              <Link href="/trading-account" className="inline-flex h-12 items-center rounded-xl border border-white/15 px-6 text-ink-100 hover:border-white/30">
                Compare accounts
              </Link>
            </div>
            <dl className="mt-10 grid grid-cols-3 gap-6 border-t border-white/5 pt-8">
              {[
                ['1:400', 'Max leverage'],
                ['0.0 pips', 'Spreads from'],
                ['$150', 'Min deposit'],
              ].map(([v, l]) => (
                <div key={l}>
                  <dt className="text-2xl font-bold tabular">{v}</dt>
                  <dd className="text-xs uppercase tracking-wider text-ink-400">{l}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="relative">
            <div className="card relative overflow-hidden p-1 shadow-2xl">
              <div className="rounded-[18px] bg-ink-900 p-4">
                <div className="flex items-center justify-between text-xs text-ink-400">
                  <span>Live watchlist</span>
                  <span className="rounded bg-white/5 px-2 py-0.5">DEMO FEED</span>
                </div>
                <ul className="mt-3 divide-y divide-white/5">
                  {(symbols.filter((s) => s.featured).slice(0, 6).length ? symbols.filter((s) => s.featured).slice(0, 6) : FALLBACK).map((s) => (
                    <li key={s.id} className="flex items-center justify-between py-2.5">
                      <div>
                        <div className="text-sm font-semibold">{s.id}</div>
                        <div className="text-[11px] text-ink-500">{s.name}</div>
                      </div>
                      <div className="text-right tabular">
                        <div className="text-sm">{s.quote ? s.quote.bid : '—'}</div>
                        <div className="text-[11px] text-ink-500">1:{s.leverageMax}</div>
                      </div>
                    </li>
                  ))}
                </ul>
                <Link href="/register" className="mt-3 block rounded-xl bg-white/5 py-2 text-center text-xs text-ink-200 hover:bg-white/10">
                  Open the terminal
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* INSTRUMENTS */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <div className="mb-8 flex items-end justify-between">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Markets</h2>
            <p className="mt-2 text-ink-400">Everything you need in one place. Contract specs are published per instrument.</p>
          </div>
          <Link href="/forex" className="hidden text-sm text-brand-300 hover:text-brand-200 sm:block">
            All instruments →
          </Link>
        </div>
        <InstrumentTabs symbols={symbols} />
      </section>

      {/* ADVANTAGES */}
      <section className="border-y border-white/5 bg-ink-900/40">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
          <h2 className="text-3xl font-bold tracking-tight">Why {BRAND}</h2>
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {ADVANTAGES.map((a) => (
              <div key={a.title} className="card p-6">
                <a.icon className="h-6 w-6 text-brand-400" />
                <h3 className="mt-4 font-semibold">{a.title}</h3>
                <p className="mt-2 text-sm text-ink-400">{a.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* STEPS */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <h2 className="text-3xl font-bold tracking-tight">Start in three steps</h2>
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {STEPS.map((s) => (
            <div key={s.n} className="relative pl-14">
              <div className="absolute left-0 top-0 text-3xl font-bold text-brand-500/40">{s.n}</div>
              <h3 className="font-semibold">{s.title}</h3>
              <p className="mt-2 text-sm text-ink-400">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-7xl px-4 pb-20 sm:px-6">
        <div className="card relative overflow-hidden p-10 text-center">
          <div className="absolute inset-0 bg-gradient-to-r from-brand-500/10 via-transparent to-brand-500/10" />
          <h2 className="relative text-3xl font-bold tracking-tight">Ready when you are</h2>
          <p className="relative mx-auto mt-3 max-w-lg text-ink-300">Open a free demo with $10,000 virtual funds. No card required.</p>
          <Link href="/register" className="relative mt-6 inline-flex h-12 items-center gap-2 rounded-xl bg-brand-500 px-6 font-semibold text-ink-950 shadow-glow hover:bg-brand-400">
            Create account <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </>
  );
}

const FALLBACK: PublicSymbol[] = [
  { id: 'EURUSD', name: 'Euro vs US Dollar', assetClass: 'forex', digits: 5, leverageMax: 400, spreadMarkup: '0', featured: true, quote: null },
  { id: 'XAUUSD', name: 'Gold', assetClass: 'metal', digits: 2, leverageMax: 200, spreadMarkup: '0', featured: true, quote: null },
  { id: 'BTCUSD', name: 'Bitcoin', assetClass: 'crypto', digits: 2, leverageMax: 5, spreadMarkup: '0', featured: true, quote: null },
  { id: 'US500', name: 'S&P 500', assetClass: 'index', digits: 2, leverageMax: 200, spreadMarkup: '0', featured: true, quote: null },
];
