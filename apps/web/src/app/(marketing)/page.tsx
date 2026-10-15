import Link from 'next/link';
import Image from 'next/image';
import type { CSSProperties } from 'react';
import { ArrowRight, ArrowUpRight, FileCheck2, LineChart, UserPlus } from 'lucide-react';
import { BRAND, cn, fmtMoney } from '@/lib/utils';
import { buttonClass } from '@/lib/button';
import { MARKET_LIST, marketByCls } from '@/lib/markets';
import { publicGet, type PublicRisk, type PublicSymbol } from '@/lib/server-api';
import { CountUp, Marquee, Reveal, Spotlight, Words } from '@/components/motion';
import { SectionHead } from '@/components/marketing/section-head';
import { HeroTerminal } from '@/components/marketing/hero-terminal';
import { InstrumentTabs } from '@/components/marketing/instrument-tabs';
import { Advantages } from '@/components/marketing/advantages';
import { MarginCalculator } from '@/components/marketing/margin-calculator';

const STEPS = [
  { n: '01', icon: UserPlus, title: 'Register', body: 'Two minutes. Email, phone, a few details. Your demo account with $10,000 is ready instantly.' },
  { n: '02', icon: FileCheck2, title: 'Verify', body: 'Upload ID and proof of address from your client area. Most reviews finish the same day.' },
  { n: '03', icon: LineChart, title: 'Fund & trade', body: 'Deposit from $200 and open your first position on the web terminal.' },
];

export default async function HomePage() {
  const [symbols, risk] = await Promise.all([publicGet<PublicSymbol[]>('/market/symbols', []), publicGet<PublicRisk[]>('/market/risk-config', [])]);
  const all = symbols.length ? symbols : FALLBACK;
  const featured = all.filter((s) => s.featured).slice(0, 5);
  const tiers = risk.length ? risk : TIER_FALLBACK;

  return (
    <>
      {/* ============================== HERO ============================== */}
      <section className="noise relative overflow-hidden pt-32 sm:pt-40">
        <Image src="/images/hero-home.jpg" alt="" fill priority sizes="100vw" className="pointer-events-none absolute inset-0 object-cover opacity-[0.12] [mask-image:linear-gradient(to_bottom,black,transparent_85%)]" />
        <div className="bg-grid absolute inset-0" />
        <div className="aurora-blob -top-48 left-[4%] h-[540px] w-[640px] bg-brand-500/20" />
        <div className="aurora-blob right-[-12%] top-24 h-[460px] w-[560px] bg-iris/20 [animation-delay:-9s]" />

        <div className="relative mx-auto grid max-w-7xl items-center gap-16 px-4 pb-24 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:gap-10 lg:pb-32">
          <Reveal variant="none">
            <Reveal variant="fade">
              <Link href="/register" className="group inline-flex items-center gap-2.5 rounded-full border border-brand-400/25 bg-brand-400/[0.07] py-1 pl-3 pr-1 text-xs font-medium text-brand-200 transition-colors hover:border-brand-400/50">
                <span className="live-dot text-brand-400" />
                Demo accounts open now
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-400/20 transition-transform duration-300 group-hover:translate-x-0.5">
                  <ArrowRight className="h-3 w-3" />
                </span>
              </Link>
            </Reveal>

            <h1 className="mt-7 font-display text-[3.1rem] font-extrabold leading-[0.94] tracking-tighter sm:text-7xl xl:text-[5.4rem]">
              <Words text="Trade the world's markets *from one account*" delay={150} />
            </h1>

            <Reveal delay={650}>
              <p className="mt-7 max-w-xl text-lg leading-relaxed text-ink-300">
                Forex, indices, commodities, shares, crypto and metals as CFDs. Tight spreads, leverage up to 1:400 and a web terminal that works on any device.
              </p>
            </Reveal>

            <Reveal delay={800} className="mt-9 flex flex-wrap items-center gap-3">
              <Link href="/register" className={buttonClass('primary', 'lg', 'group h-14 rounded-2xl px-7')}>
                Open free demo <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
              </Link>
              <Link href="/trading-account" className={buttonClass('outline', 'lg', 'h-14 rounded-2xl px-7')}>
                Compare accounts
              </Link>
            </Reveal>

            <Reveal as="dl" variant="stagger" delay={950} className="mt-12 grid max-w-xl grid-cols-2 gap-y-6 border-t border-white/[0.07] pt-8 sm:grid-cols-4">
              {[
                { label: 'Max leverage', node: <CountUp to={400} prefix="1:" /> },
                { label: 'Spreads from', node: <>0.0<span className="ml-1 text-base text-ink-400">pips</span></> },
                { label: 'Min deposit', node: <CountUp to={200} prefix="$" /> },
                { label: 'Instruments', node: <CountUp to={250} suffix="+" /> },
              ].map((s) => (
                <div key={s.label} className="border-l border-white/[0.07] pl-4 first:border-l-0 first:pl-0 max-sm:odd:border-l-0 max-sm:odd:pl-0">
                  <dt className="tabular font-display text-3xl font-bold tracking-tight">{s.node}</dt>
                  <dd className="label mt-1.5">{s.label}</dd>
                </div>
              ))}
            </Reveal>
          </Reveal>

          <Reveal variant="scale" delay={350} className="relative mx-auto w-full max-w-xl lg:max-w-none">
            <HeroTerminal symbols={featured.length ? featured : all.slice(0, 5)} />
          </Reveal>
        </div>

        {/* symbol tape */}
        <div className="relative border-y border-white/[0.06] bg-ink-900/50 py-3.5 backdrop-blur">
          <Marquee duration={70}>
            {all.map((s) => (
              <span key={s.id} style={{ '--c': marketByCls(s.assetClass)?.rgb ?? '15 23 42' } as CSSProperties} className="mx-5 inline-flex items-center gap-2.5 font-mono text-xs">
                <span className="h-1.5 w-1.5 rotate-45 bg-[rgb(var(--c))]" />
                <span className="font-semibold text-ink-100">{s.id}</span>
                <span className="tabular text-ink-500">{s.quote ? s.quote.bid : `1:${s.leverageMax}`}</span>
              </span>
            ))}
          </Marquee>
        </div>
      </section>

      {/* ============================== MARKETS ============================== */}
      <section className="mx-auto max-w-7xl px-4 py-24 sm:px-6 sm:py-32">
        <SectionHead
          eyebrow="01 — Markets"
          title="Six asset classes. *One login.*"
          sub="Everything you need in one place. Contract specs are published per instrument."
          action={
            <Link href="/forex" className="group hidden items-center gap-2 text-sm font-medium text-brand-300 sm:inline-flex">
              <span className="link-underline">All instruments</span>
              <ArrowUpRight className="h-4 w-4 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
            </Link>
          }
        />
        <Reveal variant="scale">
          <InstrumentTabs symbols={all} />
        </Reveal>

        <Reveal variant="stagger" step={60} className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
          {MARKET_LIST.map((m) => (
            <Spotlight
              key={m.slug}
              href={`/${m.slug}`}
              style={{ '--c': m.rgb, '--spot': m.rgb } as CSSProperties}
              className="card card-hover group block overflow-hidden p-4 hover:!border-[rgb(var(--c)/0.4)]"
            >
              <m.icon className="h-5 w-5 text-[rgb(var(--c))] transition-transform duration-500 ease-spring group-hover:-rotate-12 group-hover:scale-125" />
              <div className="mt-4 text-sm font-semibold">{m.label}</div>
              <div className="label mt-1">up to {m.leverage}</div>
            </Spotlight>
          ))}
        </Reveal>
      </section>

      {/* ============================== SHOWCASE ============================== */}
      <section className="mx-auto max-w-7xl px-4 py-24 sm:px-6 sm:py-32">
        <SectionHead eyebrow="01b — Everything in one account" title="A full trading desk, *in your browser*" sub="Markets, signals, tools and education — wherever you are, on any device." />
        <Reveal variant="stagger" step={80} className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {[
            { img: 'hero-markets', title: '250+ markets', body: 'Forex, indices, commodities, shares, crypto and metals as CFDs.', href: '/cfds-list' },
            { img: 'hero-signals', title: 'Trading signals', body: 'Actionable ideas and alerts to time your entries and exits.', href: '/signals' },
            { img: 'hero-tools', title: 'Risk tools', body: 'Margin, pip and swap calculators to size every position.', href: '/risk-management-tools' },
            { img: 'hero-accounts', title: 'Account tiers', body: 'From Classic to VIP — tighter spreads as you grow.', href: '/trading-account' },
            { img: 'hero-education', title: 'Education', body: 'Guides, eBooks and daily videos to sharpen your edge.', href: '/education' },
            { img: 'hero-partner', title: 'Partner with us', body: 'Earn by introducing clients to the Zerventa platform.', href: '/become-a-partner' },
          ].map((c) => (
            <Link key={c.img} href={c.href} className="card card-hover group overflow-hidden">
              <div className="relative aspect-[4/3] overflow-hidden border-b border-white/[0.05]">
                <Image src={`/images/${c.img}.jpg`} alt={c.title} fill sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw" className="object-cover transition-transform duration-500 group-hover:scale-[1.04]" />
              </div>
              <div className="p-6">
                <h3 className="text-lg font-semibold text-white">{c.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-400">{c.body}</p>
              </div>
            </Link>
          ))}
        </Reveal>
      </section>

      {/* ============================== LIFESTYLE ============================== */}
      <section className="relative overflow-hidden border-y border-white/[0.06] bg-ink-900/40">
        <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-4 py-20 sm:px-6 lg:grid-cols-2 lg:py-28">
          <Reveal variant="scale" className="relative overflow-hidden rounded-3xl border border-white/10 shadow-lift">
            <Image src="/images/trader-lifestyle.jpg" alt="Trade from anywhere on the Zerventa web terminal" width={1376} height={768} className="w-full object-cover" />
          </Reveal>
          <Reveal>
            <span className="eyebrow">Trade anywhere</span>
            <h2 className="mt-5 font-display text-4xl font-extrabold leading-[1.02] tracking-tighter sm:text-5xl">
              <Words text="Your markets, *in your pocket*" />
            </h2>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-ink-300">
              The {BRAND} web terminal runs in any browser — desktop or phone. Open positions, manage risk and track your account without installing anything.
            </p>
            <div className="mt-8">
              <Link href="/register" className={buttonClass('primary', 'lg', 'group h-13 rounded-2xl px-7')}>
                Open free demo <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ============================== TRUST ============================== */}
      <section className="mx-auto max-w-7xl px-4 pt-20 sm:px-6 sm:pt-28">
        <Reveal variant="stagger" step={80} className="grid gap-5 sm:grid-cols-3">
          {[
            { img: 'feat-security', title: 'Your funds, protected', body: 'Negative-balance protection on every account — you never owe more than your balance.' },
            { img: 'feat-speed', title: 'Instant execution', body: 'Market orders fill at live bid/ask. No requotes, no dealing-desk delays.' },
            { img: 'feat-support', title: 'Real human support', body: 'Chat, email and phone — with a dedicated manager from Gold tier.' },
          ].map((c) => (
            <div key={c.img} className="card flex items-center gap-4 p-5">
              <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-2xl border border-white/10">
                <Image src={`/images/${c.img}.jpg`} alt="" fill sizes="64px" className="object-cover" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">{c.title}</h3>
                <p className="mt-1 text-xs leading-relaxed text-ink-400">{c.body}</p>
              </div>
            </div>
          ))}
        </Reveal>
      </section>

      {/* ============================== WHY ============================== */}
      <section className="relative border-y border-white/[0.06] bg-ink-900/40">
        <div className="bg-dots absolute inset-0 opacity-50" />
        <div className="relative mx-auto max-w-7xl px-4 py-24 sm:px-6 sm:py-32">
          <SectionHead eyebrow={`02 — Why ${BRAND}`} title="Built for the trade, *not the hype*" sub="Six things we think a broker should simply get right." />
          <Advantages symbols={all} />
        </div>
      </section>

      {/* ============================== CALCULATOR ============================== */}
      <section className="mx-auto max-w-7xl px-4 py-24 sm:px-6 sm:py-32">
        <SectionHead
          eyebrow="03 — Margin"
          title="Know your margin *before you click*"
          sub="Pick an instrument, size and leverage. See what the position ties up and where the 100% margin call and 20% stop-out sit."
        />
        <Reveal variant="scale">
          <MarginCalculator symbols={all} />
        </Reveal>
      </section>

      {/* ============================== TIERS ============================== */}
      <section className="relative overflow-hidden border-y border-white/[0.06] bg-ink-900/40">
        <div className="relative mx-auto max-w-7xl px-4 py-24 sm:px-6 sm:py-32">
          <SectionHead
            eyebrow="04 — Accounts"
            title="Five tiers, *one platform*"
            sub="Conditions improve as your balance grows. Every tier includes negative balance protection and the same instruments."
            action={
              <Link href="/trading-account" className={buttonClass('outline', 'md', 'group rounded-full')}>
                Compare in detail <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
              </Link>
            }
          />
          <Reveal variant="stagger" step={100} className="grid grid-cols-2 items-end gap-3 md:grid-cols-5">
            {tiers.map((t, i) => (
              <Link
                key={t.tier}
                href={`/trading-account#${t.tier}`}
                style={{ '--d': `${300 + i * 100}ms` } as CSSProperties}
                className={cn('group relative block', i === tiers.length - 1 && 'max-md:col-span-2')}
              >
                <div className="flex items-baseline justify-between px-1 pb-3">
                  <span className="font-display text-xl font-bold capitalize">{t.tier}</span>
                  <span className="label whitespace-nowrap">{Number(t.spreadDiscountPct) > 0 ? `-${Number(t.spreadDiscountPct)}% spread` : 'standard'}</span>
                </div>
                <div
                  className={cn(
                    'grow-y card relative h-28 overflow-hidden rounded-b-none border-b-0 transition-colors md:h-[var(--h)] duration-500 group-hover:border-brand-400/40',
                    i === tiers.length - 1 && 'border-gold/30 group-hover:border-gold/60',
                  )}
                  style={{ '--h': `${104 + i * 34}px` } as CSSProperties}
                >
                  <div className={cn('absolute inset-0 bg-gradient-to-b to-transparent opacity-60 transition-opacity duration-500 group-hover:opacity-100', i === tiers.length - 1 ? 'from-gold/20' : 'from-brand-400/15')} />
                  <div className="relative p-4">
                    <div className="tabular font-mono text-lg font-semibold">${fmtMoney(t.minDeposit).replace('.00', '')}</div>
                    <div className="label mt-0.5">min deposit</div>
                  </div>
                  <span className="text-outline pointer-events-none absolute -bottom-3 left-3 font-display text-7xl font-extrabold leading-none opacity-0 transition-opacity duration-700 md:opacity-100" style={{ display: i === 0 ? 'none' : undefined }}>
                    0{i + 1}
                  </span>
                  <ArrowUpRight className="absolute bottom-3 right-3 h-4 w-4 text-ink-500 transition-all duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-white" />
                </div>
              </Link>
            ))}
          </Reveal>
          <div className="ruler" />
        </div>
      </section>

      {/* ============================== STEPS ============================== */}
      <section className="mx-auto max-w-7xl px-4 py-24 sm:px-6 sm:py-32">
        <SectionHead eyebrow="05 — Get started" title="Start in *three steps*" align="center" className="mb-28" />
        <Reveal variant="none" className="relative">
          <div className="absolute left-[16.6%] right-[16.6%] top-7 hidden h-0.5 rounded-full bg-white/[0.08] md:block">
            <div className="grow-x h-full bg-gradient-to-r from-brand-500 via-brand-300 to-volt [animation-duration:2.2s]" />
          </div>
          <Reveal variant="stagger" step={220} className="grid gap-20 md:grid-cols-3 md:gap-6">
            {STEPS.map((s) => (
              <div key={s.n} className="group relative isolate text-center">
                <div className="relative mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-ink-900 text-brand-300 shadow-lift transition-all duration-500 ease-spring group-hover:-translate-y-1 group-hover:border-brand-400/50 group-hover:bg-brand-400 group-hover:text-ink-950">
                  <s.icon className="h-6 w-6" />
                </div>
                <div className="text-outline pointer-events-none absolute -top-10 left-1/2 -z-10 -translate-x-1/2 font-display text-[6.5rem] font-extrabold leading-none md:-top-14 md:text-[9rem] transition-all duration-700 group-hover:[-webkit-text-stroke-color:rgb(var(--brand-rgb)/0.35)]">
                  {s.n}
                </div>
                <h3 className="mt-8 text-2xl font-bold">{s.title}</h3>
                <p className="mx-auto mt-3 max-w-xs text-sm leading-relaxed text-ink-400">{s.body}</p>
              </div>
            ))}
          </Reveal>
        </Reveal>
      </section>

      {/* ============================== BIG TYPE ============================== */}
      <div className="select-none border-y border-white/[0.06] py-6" aria-hidden>
        <Marquee duration={45} pauseOnHover={false}>
          {MARKET_LIST.map((m) => (
            <span key={m.slug} className="flex items-center font-display text-6xl font-extrabold tracking-tighter sm:text-8xl">
              <span className="text-outline px-6 transition-colors duration-500 hover:text-white">{m.label}</span>
              <m.icon className="h-8 w-8 text-brand-400 sm:h-12 sm:w-12" />
            </span>
          ))}
        </Marquee>
      </div>

      {/* ============================== CTA ============================== */}
      <section className="mx-auto max-w-7xl px-4 py-24 sm:px-6 sm:py-32">
        <Reveal variant="scale">
          <div className="beam noise relative overflow-hidden rounded-3xl border border-white/[0.08] bg-ink-900 px-6 py-20 text-center sm:py-28">
            <div className="aurora-blob -top-40 left-1/2 h-[420px] w-[720px] -translate-x-1/2 bg-brand-500/25" />
            <div className="bg-horizon absolute inset-x-[-20%] bottom-[-10%] top-1/2" />
            <Reveal variant="none" className="relative">
              <span className="eyebrow">Free demo</span>
              <h2 className="mx-auto mt-6 max-w-3xl font-display text-5xl font-extrabold leading-[0.95] tracking-tighter sm:text-7xl">
                <Words text="Ready *when you are*" />
              </h2>
              <p className="mx-auto mt-6 max-w-lg text-lg text-ink-300">
                Open a free demo with <CountUp to={10000} prefix="$" className="font-semibold text-white" /> virtual funds. No card required.
              </p>
              <div className="mt-10 flex flex-wrap justify-center gap-3">
                <Link href="/register" className={buttonClass('primary', 'lg', 'group h-14 rounded-2xl px-8')}>
                  Create account <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
                </Link>
                <Link href="/platform" className={buttonClass('secondary', 'lg', 'h-14 rounded-2xl px-8')}>
                  See the platform
                </Link>
              </div>
            </Reveal>
          </div>
        </Reveal>
      </section>
    </>
  );
}

const FALLBACK: PublicSymbol[] = [
  { id: 'EURUSD', name: 'Euro vs US Dollar', assetClass: 'forex', digits: 5, leverageMax: 400, spreadMarkup: '0', contractSize: '100000', featured: true, quote: null },
  { id: 'XAUUSD', name: 'Gold', assetClass: 'metal', digits: 2, leverageMax: 200, spreadMarkup: '0', contractSize: '100', featured: true, quote: null },
  { id: 'BTCUSD', name: 'Bitcoin', assetClass: 'crypto', digits: 2, leverageMax: 5, spreadMarkup: '0', contractSize: '1', featured: true, quote: null },
  { id: 'US500', name: 'S&P 500', assetClass: 'index', digits: 2, leverageMax: 200, spreadMarkup: '0', contractSize: '1', featured: true, quote: null },
];

const TIER_FALLBACK: PublicRisk[] = ['classic', 'silver', 'gold', 'platinum', 'vip'].map((tier, i) => ({
  tier,
  marginCallPct: '100',
  stopOutPct: '20',
  defaultLeverage: 100,
  maxLeverage: 400,
  minDeposit: ['200', '5000', '25000', '50000', '100000'][i],
  spreadDiscountPct: String(i * 10),
}));
