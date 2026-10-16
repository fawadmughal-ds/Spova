import Link from 'next/link';
import type { Metadata } from 'next';
import type { CSSProperties } from 'react';
import { ArrowLeft, ArrowRight, Check, Crown, FileCheck2, Gauge, Layers, LineChart, Percent, ShieldCheck, UserPlus, Wallet, Zap } from 'lucide-react';
import { BRAND, cn } from '@/lib/utils';
import { buttonClass } from '@/lib/button';
import { publicGet, type PublicRisk, type PublicSymbol } from '@/lib/server-api';
import { TIER_LINKS, tierHref, type TierSlug } from '@/lib/site-nav';
import { PERKS, TIER_FALLBACK, TIER_TINT, ownPerks, tierMoney, tierName } from '@/lib/tiers';
import { CountUp, Reveal, Spotlight, Tilt, Words } from '@/components/motion';
import { Logo } from '@/components/logo';
import { Pending } from '@/components/marketing/page-hero';
import { SectionHead } from '@/components/marketing/section-head';
import { CtaBand } from '@/components/marketing/cta-band';
import { TierCompare } from '@/components/marketing/tier-compare';

/** Per-tier voice. Numbers are never written here: they come from the risk config. */
const COPY: Record<TierSlug, { headline: string; lead: string; fit: string }> = {
  classic: {
    headline: 'Classic. *Start here.*',
    lead: 'The standard account: every instrument, the full web terminal and the same risk protections as the tiers above it.',
    fit: 'For a first live account, or for anyone who wants the essentials without a large opening deposit.',
  },
  silver: {
    headline: 'Silver. *Tighter pricing.*',
    lead: 'Everything in Classic, with a spread discount on every trade and a shorter queue when you need support.',
    fit: 'For traders who are in the market most weeks and want lower costs to show up in every position.',
  },
  gold: {
    headline: 'Gold. *A desk behind you.*',
    lead: 'A larger spread discount, trading signals and a dedicated account manager who knows your account.',
    fit: 'For active traders who want a named contact and sharper pricing across all six asset classes.',
  },
  platinum: {
    headline: 'Platinum. *Built for volume.*',
    lead: 'Deeper spread discounts, VPS hosting for round-the-clock strategies and premium market analysis.',
    fit: 'For professional-style trading where infrastructure and research matter as much as price.',
  },
  vip: {
    headline: 'VIP. *Shaped around you.*',
    lead: 'Our largest spread discount, a personal analyst and conditions agreed with you rather than read off a table.',
    fit: 'For the largest accounts, where terms are set in conversation.',
  },
};

const STEPS = [
  { icon: UserPlus, title: 'Register', body: 'Two minutes. Email, phone, a few details. Your demo account with $10,000 is ready instantly.' },
  { icon: FileCheck2, title: 'Verify', body: 'Upload ID and proof of address from your client area.' },
  { icon: LineChart, title: 'Fund & trade', body: '' },
];

export const tierMetadata = (tier: TierSlug): Metadata => {
  const title = `${tierName(tier)} account`;
  const description = `${COPY[tier].lead} Compare the ${tierName(tier)} account with the other ${BRAND} tiers.`;
  const image = `/images/tier-${tier}.jpg`;
  return {
    title,
    description,
    alternates: { canonical: tierHref(tier) },
    openGraph: { title: `${title} | ${BRAND}`, description, images: [{ url: image, width: 1024, height: 1024, alt: `${BRAND} ${tierName(tier)} account` }] },
    twitter: { card: 'summary_large_image', title: `${title} | ${BRAND}`, description, images: [image] },
  };
};

/** Signal bars: one more lit per tier. */
function Bars({ level, className }: { level: number; className?: string }) {
  return (
    <span className={cn('flex items-end gap-[3px]', className)} aria-hidden>
      {[0, 1, 2, 3, 4].map((b) => (
        <span key={b} style={{ height: `${36 + b * 16}%` }} className={cn('w-[3px] rounded-full', b <= level ? 'bg-[rgb(var(--c))]' : 'bg-white/15')} />
      ))}
    </span>
  );
}

/** Detail page for one account tier. Tinted with the tier colour; the hero card gets heavier as tiers climb. */
export async function TierPage({ tier }: { tier: TierSlug }) {
  const [risk, symbols] = await Promise.all([publicGet<PublicRisk[]>('/market/risk-config', []), publicGet<PublicSymbol[]>('/market/symbols', [])]);
  const tiers = risk.length ? risk : TIER_FALLBACK;
  const idx = Math.max(0, tiers.findIndex((t) => t.tier === tier));
  const t = tiers[idx];
  const meta = TIER_LINKS.find((l) => l.tier === tier)!;
  const copy = COPY[tier];
  const vip = tier === 'vip';
  const prev = tiers[idx - 1];
  const next = tiers[idx + 1];
  const discount = Number(t.spreadDiscountPct);
  const inherited = tiers.slice(0, idx).flatMap((x) => ownPerks(x.tier));
  const own = ownPerks(tier);
  const call = Number(t.marginCallPct);
  const stop = Number(t.stopOutPct);

  const features = [
    { icon: Wallet, label: 'Min deposit', node: <CountUp to={Number(t.minDeposit)} prefix="$" />, note: 'Net deposits decide your tier' },
    { icon: Percent, label: 'Spread discount', node: discount > 0 ? <CountUp to={discount} suffix="%" /> : <>Standard</>, note: discount > 0 ? 'Applied to every instrument' : 'Standard spreads on every instrument' },
    { icon: Zap, label: 'Max leverage', node: <CountUp to={t.maxLeverage} prefix="1:" />, note: 'Per-instrument caps apply' },
    { icon: Gauge, label: 'Default leverage', node: <CountUp to={t.defaultLeverage} prefix="1:" />, note: 'Set when the account opens' },
    { icon: ShieldCheck, label: 'Margin call / stop-out', node: <>{call}% / {stop}%</>, note: 'Negative balance protection included' },
    ...(symbols.length ? [{ icon: Layers, label: 'Instruments', node: <CountUp to={symbols.length} />, note: 'Same list on every tier' }] : []),
  ];

  return (
    <div className="tint" style={{ '--c': TIER_TINT[tier], '--spot': TIER_TINT[tier] } as CSSProperties}>
      {/* ============================== HERO ============================== */}
      <section className="noise relative overflow-hidden pt-32 sm:pt-40">
        <div className="bg-grid absolute inset-0" />
        <div className="aurora-blob -top-44 left-[4%] h-[520px] w-[640px] bg-[rgb(var(--c)/0.16)]" />
        <div className="aurora-blob right-[-10%] top-40 h-[420px] w-[520px] bg-iris/15 [animation-delay:-9s]" />

        <div className="relative mx-auto grid max-w-7xl items-center gap-14 px-4 pb-16 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:pb-24">
          <Reveal variant="none">
            <Reveal variant="fade" className="flex items-center gap-3">
              <Link href="/trading-account" className="label inline-flex items-center gap-1.5 transition-colors hover:text-white">
                <ArrowLeft className="h-3 w-3" /> Accounts
              </Link>
              <span className="eyebrow">{meta.level}</span>
            </Reveal>
            <h1 className="mt-6 font-display text-5xl font-extrabold leading-[0.95] tracking-tighter sm:text-7xl">
              <Words text={copy.headline} delay={150} />
            </h1>
            <Reveal delay={550}>
              <p className="mt-7 max-w-xl text-lg leading-relaxed text-ink-300">{copy.lead}</p>
            </Reveal>
            <Reveal delay={700} className="mt-9 flex flex-wrap items-center gap-3">
              <Link
                href="/register"
                className={
                  vip
                    ? 'btn btn-shine group inline-flex h-14 items-center justify-center gap-2 rounded-2xl bg-gradient-to-b from-[#cf8a14] to-[#a5670b] px-7 font-semibold text-ink-950 shadow-[0_12px_40px_-12px_rgb(var(--gold-rgb)/0.7)] hover:!shadow-[0_18px_50px_-12px_rgb(var(--gold-rgb)/0.8)]'
                    : buttonClass('primary', 'lg', 'group h-14 rounded-2xl px-7')
                }
              >
                Open {tierName(tier)} account <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
              </Link>
              <a href="#compare" className={buttonClass('outline', 'lg', 'h-14 rounded-2xl px-7')}>
                Compare tiers
              </a>
            </Reveal>
          </Reveal>

          {/* the account as an object: a card whose finish follows the tier, beside the five-rung ladder */}
          <Reveal variant="scale" delay={300} className="relative mx-auto grid w-full max-w-lg grid-cols-[auto_1fr] items-center gap-5 sm:gap-7">
            <Reveal variant="none" as="ol" className="relative flex flex-col-reverse gap-3.5 py-2">
              <span className="absolute bottom-3 left-[5px] top-3 w-px bg-white/10" />
              <span className="grow-y absolute bottom-3 left-[5px] w-px bg-gradient-to-t from-[rgb(var(--c)/0.2)] to-[rgb(var(--c))]" style={{ height: `calc((100% - 24px) * ${idx / Math.max(1, tiers.length - 1)})` }} />
              {tiers.map((x, i) => (
                <li key={x.tier} className="relative flex items-center gap-3">
                  <span className={cn('relative h-[11px] w-[11px] rounded-full border', i === idx ? 'border-[rgb(var(--c))] bg-[rgb(var(--c))]' : i < idx ? 'border-[rgb(var(--c)/0.6)] bg-ink-950' : 'border-white/20 bg-ink-950')}>
                    {i === idx && <span className="absolute inset-0 animate-pulse-ring rounded-full bg-[rgb(var(--c))]" />}
                  </span>
                  <Link href={tierHref(x.tier)} className={cn('font-mono text-[10px] uppercase tracking-[0.16em] transition-colors hover:text-white', i === idx ? 'font-semibold text-[rgb(var(--c))]' : 'text-ink-500')}>
                    {tierName(x.tier)}
                  </Link>
                </li>
              ))}
            </Reveal>

            <Tilt max={9}>
              <div
                className={cn('relative min-h-[220px] overflow-hidden rounded-3xl border p-5 shadow-lift sm:aspect-[1.586] sm:min-h-0 sm:p-7', vip ? 'border-gold/45' : 'border-[rgb(var(--c)/0.3)]', tier === 'gold' && 'beam')}
                style={{
                  background: `linear-gradient(135deg, rgb(var(--c) / ${0.1 + idx * 0.05}), rgb(var(--paper-rgb) / 0.92) 46%, rgb(var(--c) / ${0.06 + idx * 0.04}))`,
                  boxShadow: `0 40px 110px -45px rgb(var(--c) / ${0.35 + idx * 0.1}), inset 0 1px 0 rgb(var(--tint) / 0.08)`,
                }}
              >
                <div className="bg-dots absolute inset-0 opacity-50" />
                {/* one more guilloche ring per tier */}
                {tiers.slice(0, idx + 1).map((x, i) => (
                  <span
                    key={x.tier}
                    className="animate-spin-slow absolute -right-16 -top-16 rounded-full border border-dashed border-[rgb(var(--c)/0.28)]"
                    style={{ width: 150 + i * 46, height: 150 + i * 46, marginRight: -i * 23, marginTop: -i * 23, animationDirection: i % 2 ? 'reverse' : 'normal', animationDuration: `${30 + i * 8}s` }}
                  />
                ))}
                {idx >= 3 && <span className="animate-sweep pointer-events-none absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-[rgb(var(--c)/0.16)] to-transparent" />}

                <div className="relative flex h-full min-h-[180px] flex-col justify-between gap-5 sm:min-h-0">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <Logo size={22} />
                      <span className="font-display text-sm font-bold">{BRAND}</span>
                    </span>
                    <Bars level={idx} className="h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 font-display text-4xl font-extrabold tracking-tighter sm:text-5xl">
                      {tierName(tier)}
                      {vip && <Crown className="h-7 w-7 text-gold" />}
                    </div>
                    <div className="label mt-1 !text-[rgb(var(--c)/0.85)]">{meta.level} account</div>
                  </div>
                  <div className="flex items-end justify-between gap-3">
                    <div>
                      <div className="label">Opens from</div>
                      <div className="tabular font-mono text-xl font-semibold">
                        <CountUp to={Number(t.minDeposit)} prefix="$" />
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="label">Discount</div>
                      <div className="tabular font-mono text-xl font-semibold text-[rgb(var(--c))]">{discount > 0 ? `${discount}%` : '—'}</div>
                    </div>
                  </div>
                </div>
              </div>
            </Tilt>
          </Reveal>
        </div>

        {/* tier switcher */}
        <div className="relative border-y border-white/[0.06] bg-ink-900/50 backdrop-blur">
          <Reveal variant="stagger" step={60} delay={500} as="ul" className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-4 py-2 [scrollbar-width:none] sm:px-6">
            {TIER_LINKS.map((l, i) => (
              <li key={l.tier} className="flex-1" style={{ '--c': TIER_TINT[l.tier] } as CSSProperties}>
                <Link
                  href={tierHref(l.tier)}
                  aria-current={l.tier === tier ? 'page' : undefined}
                  className={cn(
                    'group flex items-center justify-center gap-2.5 whitespace-nowrap rounded-xl px-4 py-3 text-sm transition-colors duration-300',
                    l.tier === tier ? 'bg-[rgb(var(--c)/0.12)] font-semibold text-white ring-1 ring-inset ring-[rgb(var(--c)/0.35)]' : 'text-ink-400 hover:bg-white/[0.05] hover:text-white',
                  )}
                >
                  <Bars level={i} className="h-3.5" />
                  {l.label}
                  <span className="label hidden transition-colors group-hover:text-ink-200 lg:inline">{l.level}</span>
                </Link>
              </li>
            ))}
          </Reveal>
        </div>
      </section>

      {/* ============================== FEATURES ============================== */}
      <section className="mx-auto max-w-7xl px-4 py-24 sm:px-6 sm:py-28">
        <SectionHead eyebrow={`01 — ${tierName(tier)} features`} title="The numbers, *up front*" sub={copy.fit} />
        <Reveal variant="stagger" step={70} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <Spotlight key={f.label} className="card card-hover corners group overflow-hidden p-6 hover:!border-[rgb(var(--c)/0.4)]">
              <div className="flex items-center justify-between">
                <span className="label">{f.label}</span>
                <f.icon className="h-4 w-4 text-ink-500 transition-all duration-500 ease-spring group-hover:-rotate-12 group-hover:scale-125 group-hover:text-[rgb(var(--c))]" />
              </div>
              <div className="tabular mt-4 font-display text-4xl font-extrabold tracking-tighter">{f.node}</div>
              <p className="mt-2 text-sm text-ink-400">{f.note}</p>
            </Spotlight>
          ))}
        </Reveal>

        {/* perks: what carries over from the tiers below, and what this tier adds */}
        <Reveal variant="none" className="card mt-4 grid overflow-hidden md:grid-cols-[1fr_1.1fr]">
          <div className="p-6 sm:p-8">
            <div className="label">{idx === 0 ? 'Included from day one' : `New at ${tierName(tier)}`}</div>
            <ul className="mt-5 space-y-3">
              {[...(discount > 0 ? [`${discount}% spread discount`] : []), ...own].map((p, i) => (
                <li key={p} className="row-in flex items-center gap-3 text-lg font-medium" style={{ '--i': i + 2 } as CSSProperties}>
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[rgb(var(--c)/0.16)] text-[rgb(var(--c))]">
                    <Check className="h-4 w-4" />
                  </span>
                  {p}
                </li>
              ))}
            </ul>
          </div>
          <div className="border-t border-white/[0.06] bg-ink-900/50 p-6 sm:p-8 md:border-l md:border-t-0">
            <div className="label">{idx === 0 ? 'On every tier' : `Carried over from ${tiers.slice(0, idx).map((x) => tierName(x.tier)).join(', ')}`}</div>
            <div className="mt-5 flex flex-wrap gap-2">
              {['Negative balance protection', ...inherited].map((p, i) => (
                <span key={p} className="row-in inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-3.5 py-1.5 text-sm text-ink-200" style={{ '--i': i + 3 } as CSSProperties}>
                  <Check className="h-3.5 w-3.5 text-ink-400" /> {p}
                </span>
              ))}
            </div>
          </div>
        </Reveal>
      </section>

      {/* ============================== CONDITIONS ============================== */}
      <section className="relative border-y border-white/[0.06] bg-ink-900/40">
        <div className="bg-dots absolute inset-0 opacity-50" />
        <div className="relative mx-auto grid max-w-7xl gap-12 px-4 py-24 sm:px-6 sm:py-28 lg:grid-cols-[1fr_1.1fr]">
          <div>
            <SectionHead eyebrow="02 — Trading conditions" title="How a *trade is handled*" className="mb-8" />
            <Reveal variant="stagger" step={70} as="dl" className="divide-y divide-white/[0.06] border-y border-white/[0.06]">
              {[
                ['Execution', 'Instant, at the live bid / ask'],
                ['Products', 'CFDs across six asset classes'],
                ['Account currency', 'USD'],
                ['Minimum trade size', '0.01 lots'],
                ['Platform', 'Web terminal, any device'],
                ['Tier assignment', 'By net deposits'],
              ].map(([k, v]) => (
                <div key={k} className="flex items-baseline justify-between gap-6 py-4">
                  <dt className="text-sm text-ink-400">{k}</dt>
                  <dd className="text-right font-medium text-white">{v}</dd>
                </div>
              ))}
            </Reveal>
            <Reveal variant="fade" delay={300}>
              <p className="mt-5 text-xs leading-relaxed text-ink-500">Account conditions can change. The figures on this page are read from the live platform configuration.</p>
            </Reveal>
          </div>

          {/* margin meter: where the two thresholds sit */}
          <Reveal variant="none" className="card corners self-center p-6 sm:p-8">
            <div className="flex items-baseline justify-between">
              <span className="label">Margin level</span>
              <span className="font-mono text-xs text-ink-400">equity ÷ used margin</span>
            </div>
            <div className="relative mt-10">
              <div className="h-3 overflow-hidden rounded-full bg-white/[0.06]">
                <div className="grow-x h-full rounded-full bg-gradient-to-r from-down via-gold via-[32%] to-up [animation-duration:1.8s]" />
              </div>
              {[
                { at: 12, pct: stop, label: 'Stop-out', tone: 'text-down' },
                { at: 38, pct: call, label: 'Margin call', tone: 'text-gold' },
              ].map((m) => (
                <div key={m.label} className="absolute -top-7 bottom-0 -translate-x-1/2" style={{ left: `${m.at}%` }}>
                  <div className={cn('tabular whitespace-nowrap text-center font-mono text-xs font-semibold', m.tone)}>{m.pct}%</div>
                  <div className="mx-auto mt-1 h-[calc(100%-1.25rem)] w-px bg-ink-950" />
                </div>
              ))}
            </div>
            <div className="mt-8 grid gap-5 sm:grid-cols-2">
              <div>
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <span className="h-2 w-2 rounded-full bg-gold" /> Margin call at {call}%
                </div>
                <p className="mt-1.5 text-sm leading-relaxed text-ink-400">You get a notice that equity has fallen to the margin your positions are using. Nothing is closed yet.</p>
              </div>
              <div>
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <span className="h-2 w-2 rounded-full bg-down" /> Stop-out at {stop}%
                </div>
                <p className="mt-1.5 text-sm leading-relaxed text-ink-400">Positions are closed automatically, largest loss first, until the level is back above the threshold.</p>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ============================== COMPARE ============================== */}
      <section id="compare" className="mx-auto max-w-7xl scroll-mt-24 px-4 py-24 sm:px-6 sm:py-28">
        <SectionHead eyebrow="03 — Compare" title={`${tierName(tier)} *next to the rest*`} sub="The highlighted column is this account. Tier names link to their own pages." />
        <TierCompare tiers={tiers} highlight={tier} />

        <Reveal variant="stagger" className="mt-4 grid gap-4 sm:grid-cols-2">
          {[prev, next].map((x, k) =>
            x ? (
              <Spotlight
                key={x.tier}
                href={tierHref(x.tier)}
                style={{ '--c': TIER_TINT[x.tier], '--spot': TIER_TINT[x.tier] } as CSSProperties}
                className={cn('card card-hover group flex items-center justify-between gap-4 p-5 hover:!border-[rgb(var(--c)/0.4)]', k === 1 && !prev && 'sm:col-start-2')}
              >
                <span>
                  <span className="label">{k === 0 ? 'One step down' : 'One step up'}</span>
                  <span className="mt-1 block font-display text-2xl font-bold tracking-tight">{tierName(x.tier)}</span>
                  <span className="tabular mt-0.5 block font-mono text-xs text-ink-400">from ${tierMoney(x.minDeposit)}</span>
                </span>
                <span className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 text-ink-300 transition-all duration-500 ease-spring group-hover:border-[rgb(var(--c)/0.5)] group-hover:bg-[rgb(var(--c)/0.12)] group-hover:text-[rgb(var(--c))]">
                  {k === 0 ? <ArrowLeft className="h-4 w-4" /> : <ArrowRight className="h-4 w-4" />}
                </span>
              </Spotlight>
            ) : (
              <span key={k} className="hidden sm:block" />
            ),
          )}
        </Reveal>
      </section>

      {/* ============================== STEPS ============================== */}
      <section className="relative border-t border-white/[0.06] bg-ink-900/40">
        <div className="mx-auto max-w-7xl px-4 py-24 sm:px-6 sm:py-28">
          <SectionHead eyebrow="04 — Get started" title="Three steps to *a funded account*" />
          <Reveal variant="stagger" step={140} className="grid gap-4 md:grid-cols-3">
            {STEPS.map((s, i) => (
              <div key={s.title} className="card card-hover group relative overflow-hidden p-6">
                <span className="text-outline pointer-events-none absolute -right-2 -top-6 font-display text-[7rem] font-extrabold leading-none transition-all duration-700 group-hover:[-webkit-text-stroke-color:rgb(var(--c)/0.5)]">0{i + 1}</span>
                <span className="relative flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-ink-900 text-[rgb(var(--c))] transition-all duration-500 ease-spring group-hover:-translate-y-1 group-hover:border-[rgb(var(--c)/0.5)]">
                  <s.icon className="h-5 w-5" />
                </span>
                <h3 className="relative mt-6 text-xl font-bold">{s.title}</h3>
                <p className="relative mt-2 text-sm leading-relaxed text-ink-400">
                  {s.body || `Reach $${tierMoney(t.minDeposit)} in net deposits for ${tierName(tier)} conditions and open your first position on the web terminal.`}
                </p>
              </div>
            ))}
          </Reveal>
        </div>
      </section>

      <div className="pt-24 sm:pt-28">
        <CtaBand
          title={`Try it first *on a demo*`}
          body="Demo accounts use Classic conditions with $10,000 virtual funds. No card required."
          secondary={{ href: '/trading-account', label: 'All accounts' }}
        />
      </div>
    </div>
  );
}
