import Link from 'next/link';
import type { Metadata } from 'next';
import type { CSSProperties } from 'react';
import { ArrowRight, Check, Crown } from 'lucide-react';
import { publicGet, type PublicRisk } from '@/lib/server-api';
import { cn } from '@/lib/utils';
import { buttonClass } from '@/lib/button';
import { CountUp, Reveal, Spotlight, Words } from '@/components/motion';
import { SectionHead } from '@/components/marketing/section-head';
import { CtaBand } from '@/components/marketing/cta-band';
import { TierCompare } from '@/components/marketing/tier-compare';
import { tierHref } from '@/lib/site-nav';
import { PERKS, TIER_FALLBACK as FALLBACK, TIER_TINT as TINT, tierName } from '@/lib/tiers';

export const metadata: Metadata = { title: 'Trading accounts' };

export default async function TiersPage() {
  const fetched = await publicGet<PublicRisk[]>('/market/risk-config', []);
  const tiers = fetched.length ? fetched : FALLBACK;

  return (
    <>
      {/* ============================== HERO ============================== */}
      <section className="noise relative overflow-hidden pt-32 sm:pt-40">
        <div className="bg-grid absolute inset-0" />
        <div className="aurora-blob -top-48 left-1/2 h-[500px] w-[820px] -translate-x-1/2 bg-brand-500/15" />
        <div className="aurora-blob right-[-10%] top-56 h-[380px] w-[460px] bg-gold/10 [animation-delay:-8s]" />

        <Reveal variant="none" className="relative mx-auto max-w-7xl px-4 pb-14 text-center sm:px-6">
          <Reveal variant="fade">
            <span className="eyebrow">Accounts</span>
          </Reveal>
          <h1 className="mx-auto mt-6 max-w-4xl font-display text-5xl font-extrabold leading-[0.95] tracking-tighter sm:text-7xl">
            <Words text="Pick the account *that fits*" delay={150} />
          </h1>
          <Reveal delay={550}>
            <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-ink-300">
              Five tiers, one platform. Conditions improve as your balance grows. Every tier includes negative balance protection and the same instruments.
            </p>
          </Reveal>

          {/* the ladder: jump links that climb */}
          <Reveal variant="stagger" step={90} delay={700} className="mx-auto mt-12 flex max-w-3xl items-end justify-center gap-1.5 sm:gap-2.5">
            {tiers.map((t, i) => (
              <a
                key={t.tier}
                href={`#${t.tier}`}
                style={{ '--c': TINT[t.tier] ?? TINT.classic, height: `${44 + i * 14}px` } as CSSProperties}
                className="group relative flex flex-1 items-end justify-center rounded-t-xl border border-b-0 border-[rgb(var(--c)/0.3)] bg-gradient-to-b from-[rgb(var(--c)/0.2)] to-transparent pb-2 font-mono text-[9px] font-semibold uppercase tracking-normal text-[rgb(var(--c))] sm:tracking-[0.12em] transition-all duration-500 ease-out-expo hover:from-[rgb(var(--c)/0.45)] sm:text-[11px]"
              >
                <span className="transition-transform duration-500 ease-spring group-hover:-translate-y-1">{tierName(t.tier)}</span>
              </a>
            ))}
          </Reveal>
          <div className="ruler mx-auto max-w-4xl" />
        </Reveal>
      </section>

      {/* ============================== TIER CARDS ============================== */}
      <section className="mx-auto max-w-7xl px-4 pb-24 pt-10 sm:px-6 sm:pb-28">
        <Reveal variant="stagger" step={110} className="grid items-end gap-5 md:grid-cols-2 lg:grid-cols-5 lg:gap-3 xl:gap-4">
          {tiers.map((t, i) => {
            const hot = t.tier === 'gold';
            const vip = t.tier === 'vip';
            return (
              <div
                key={t.tier}
                id={t.tier}
                style={{ '--c': TINT[t.tier] ?? TINT.classic, '--spot': TINT[t.tier] ?? TINT.classic, '--lift': `${i * 14}px` } as CSSProperties}
                className={cn('relative scroll-mt-28 rounded-[1.25rem] lg:mb-[var(--lift)]', hot && 'beam', vip && 'max-lg:md:col-span-2')}
              >
                {hot && (
                  <span className="absolute -top-3 left-6 z-10 rounded-full bg-gradient-to-b from-brand-300 to-brand-500 px-3 py-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-ink-950 shadow-glow">Popular</span>
                )}
                <Spotlight
                  className={cn(
                    'card card-hover group flex h-full flex-col overflow-hidden p-6 hover:!border-[rgb(var(--c)/0.5)] lg:p-5 xl:p-6',
                    hot && 'border-transparent bg-gradient-to-b from-brand-400/[0.12] to-white/[0.02] shadow-[0_30px_90px_-40px_rgb(var(--brand-rgb)/0.6)]',
                    vip && 'border-gold/35 bg-gradient-to-b from-gold/[0.14] via-gold/[0.03] to-white/[0.02] shadow-[0_30px_90px_-40px_rgb(var(--gold-rgb)/0.55)]',
                  )}
                >
                  {vip && <span className="animate-sweep pointer-events-none absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-gold/15 to-transparent" />}
                  <div className="flex items-center justify-between">
                    <h3 className="flex items-center gap-2 font-display text-2xl font-bold tracking-tight">
                      {tierName(t.tier)}
                      {vip && <Crown className="h-5 w-5 text-gold transition-transform duration-500 ease-spring group-hover:-rotate-12 group-hover:scale-125" />}
                    </h3>
                    {/* level meter: one more pip per tier */}
                    <span className="flex items-end gap-[3px]" aria-label={`Tier ${i + 1} of ${tiers.length}`}>
                      {tiers.map((_, k) => (
                        <span
                          key={k}
                          className={cn('grow-y w-1 rounded-full', k <= i ? 'bg-[rgb(var(--c))]' : 'bg-white/10')}
                          style={{ height: `${8 + k * 3}px`, '--d': `${500 + i * 110 + k * 60}ms` } as CSSProperties}
                        />
                      ))}
                    </span>
                  </div>

                  <div className="tabular mt-6 font-display text-4xl font-extrabold tracking-tighter lg:text-[2rem] xl:text-4xl">
                    <CountUp to={Number(t.minDeposit)} prefix="$" duration={1400 + i * 200} />
                  </div>
                  <div className="label mt-1">min deposit</div>

                  <dl className="mt-6 space-y-2.5 border-t border-white/[0.07] pt-5 text-sm">
                    {[
                      ['Max leverage', `1:${t.maxLeverage}`],
                      ['Margin call', `${Number(t.marginCallPct)}%`],
                      ['Stop out', `${Number(t.stopOutPct)}%`],
                      ['Spread discount', `${Number(t.spreadDiscountPct)}%`],
                    ].map(([k, v]) => (
                      <div key={k} className="flex items-baseline justify-between gap-2">
                        <dt className="text-ink-400">{k}</dt>
                        <dd className={cn('tabular font-mono', k === 'Spread discount' && Number(t.spreadDiscountPct) > 0 && 'font-semibold text-[rgb(var(--c))]')}>{v}</dd>
                      </div>
                    ))}
                  </dl>

                  <ul className="mt-5 flex-1 space-y-2.5 border-t border-white/[0.07] pt-5 text-sm">
                    {PERKS[t.tier]?.map((p) => (
                      <li key={p} className="flex items-start gap-2 text-ink-200">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-[rgb(var(--c))]" /> {p}
                      </li>
                    ))}
                  </ul>

                  <Link
                    href="/register"
                    className={cn(
                      'group/b mt-7',
                      hot
                        ? buttonClass('primary', 'md', 'w-full')
                        : vip
                          ? 'btn btn-shine inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-[#cf8a14] to-[#a5670b] text-sm font-semibold text-ink-950 shadow-[0_12px_40px_-12px_rgb(var(--gold-rgb)/0.7)] hover:!shadow-[0_18px_50px_-12px_rgb(var(--gold-rgb)/0.8)]'
                          : buttonClass('outline', 'md', 'w-full hover:!border-[rgb(var(--c)/0.6)] hover:!bg-[rgb(var(--c)/0.06)]'),
                    )}
                  >
                    Open account <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover/b:translate-x-1" />
                  </Link>
                  <Link href={tierHref(t.tier)} className="group/m mt-3 inline-flex items-center justify-center gap-1.5 text-xs font-medium text-ink-300 transition-colors hover:text-[rgb(var(--c))]">
                    <span className="link-underline">Learn more about {tierName(t.tier)}</span>
                    <ArrowRight className="h-3 w-3 transition-transform duration-300 group-hover/m:translate-x-0.5" />
                  </Link>
                </Spotlight>
              </div>
            );
          })}
        </Reveal>
        <Reveal variant="fade" delay={300}>
          <p className="mt-10 text-center text-xs text-ink-500">Tier is assigned by the broker based on net deposits. Demo accounts use Classic conditions.</p>
        </Reveal>
      </section>

      {/* ============================== COMPARISON ============================== */}
      <section className="relative border-y border-white/[0.06] bg-ink-900/40">
        <div className="bg-dots absolute inset-0 opacity-50" />
        <div className="relative mx-auto max-w-7xl px-4 py-24 sm:px-6 sm:py-28">
          <SectionHead eyebrow="Side by side" title="Every tier, *every detail*" sub="The same numbers as the cards above, lined up so the differences are easy to spot." />
          <TierCompare tiers={tiers} />
        </div>
      </section>

      <div className="pt-24 sm:pt-28">
        <CtaBand title="Start on Classic *conditions, free*" body="Demo accounts use Classic conditions with $10,000 virtual funds. No card required." secondary={{ href: '/platform', label: 'See the platform' }} />
      </div>
    </>
  );
}
