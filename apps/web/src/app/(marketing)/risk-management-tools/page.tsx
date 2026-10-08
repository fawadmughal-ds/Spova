import type { Metadata } from 'next';
import Link from 'next/link';
import type { CSSProperties } from 'react';
import { ArrowDown, ArrowUpRight, Gauge, OctagonX, Ruler, Scale, ShieldCheck, Target, type LucideIcon } from 'lucide-react';
import { buttonClass } from '@/lib/button';
import { publicGet, type PublicSymbol } from '@/lib/server-api';
import { Reveal, Spotlight } from '@/components/motion';
import { PageHero } from '@/components/marketing/page-hero';
import { SectionHead } from '@/components/marketing/section-head';
import { CtaBand } from '@/components/marketing/cta-band';
import { MarginCalculator } from '@/components/marketing/margin-calculator';
import { ToolStrip } from '@/components/education/shared';
import { PositionSizeCalculator } from '@/components/education/position-size-calculator';

export const metadata: Metadata = {
  title: 'Risk management tools',
  description: 'Stop loss, take profit, position sizing, risk/reward and margin level explained, with a position-size calculator and a margin calculator.',
};

const TOOLS: { icon: LucideIcon; title: string; body: string; note: string }[] = [
  { icon: OctagonX, title: 'Stop loss', body: 'An order that closes your position if the price moves against you to a level you chose. It turns an open-ended loss into a planned one.', note: 'Set it on the ticket or edit it later' },
  { icon: Target, title: 'Take profit', body: 'An order that closes your position once the price reaches your target, so a good trade is banked even when you are away from the screen.', note: 'Set it on the ticket or edit it later' },
  { icon: Ruler, title: 'Position sizing', body: 'Choosing the volume from the loss you can accept, not the other way round. The same stop costs ten times more at 1.00 lot than at 0.10.', note: 'Volumes from 0.01 lot' },
  { icon: Scale, title: 'Risk / reward', body: 'The distance to your stop compared with the distance to your target. It tells you how often you need to be right just to break even.', note: 'Check it before every entry' },
  { icon: Gauge, title: 'Margin level', body: 'Equity as a percentage of used margin. It is the single number that shows how much room the whole account has left.', note: 'Margin call 100% · stop-out 20%' },
  { icon: ShieldCheck, title: 'Negative balance protection', body: 'A floor under the account. Whatever the market does, you cannot lose more than the money in it.', note: 'On every account type' },
];

const ROUTINE = [
  ['Where am I wrong?', 'Pick the price at which the idea no longer holds. That is the stop, and it comes before the entry.'],
  ['What can I lose?', 'Decide the amount in account currency, as a small share of the balance.'],
  ['How big is that?', 'Divide the amount by the stop distance to get the volume. Use the calculator below.'],
  ['Is it worth it?', 'Compare the target with the stop. If the reward does not justify the risk, there is no trade.'],
];

/** Illustrative trade plan: entry, stop and target bands around a drawn path. Shapes only, not market data. */
function TradePlan() {
  return (
    <div className="relative mx-auto max-w-lg">
      <div className="absolute -inset-8 -z-10 rounded-[3rem] bg-brand-500/15 blur-3xl" />
      <div className="beam glass overflow-hidden rounded-3xl p-5 shadow-lift">
        <div className="flex items-center justify-between">
          <span className="label">Trade plan</span>
          <span className="label">Illustration · not market data</span>
        </div>
        <svg viewBox="0 0 440 280" className="mt-3 w-full" fill="none">
          <rect x="150" y="34" width="290" height="96" fill="rgb(var(--up-rgb) / 0.09)" className="grow-y" style={{ '--d': '700ms', transformOrigin: '50% 100%', transformBox: 'fill-box' } as CSSProperties} />
          <rect x="150" y="130" width="290" height="60" fill="rgb(var(--down-rgb) / 0.1)" className="grow-y" style={{ '--d': '700ms', transformOrigin: '50% 0%', transformBox: 'fill-box' } as CSSProperties} />
          {[
            [34, 'var(--color-up)', 'Take profit'],
            [130, 'var(--color-ink-100)', 'Entry'],
            [190, 'var(--color-down)', 'Stop loss'],
          ].map(([y, c, label]) => (
            <g key={label as string}>
              <path d={`M150 ${y} H440`} stroke={c as string} strokeWidth="1.25" strokeDasharray="4 5" className="animate-dash" />
              <rect x="352" y={(y as number) - 10} width="84" height="20" rx="6" fill={c as string} />
              <text x="394" y={(y as number) + 4} textAnchor="middle" className="fill-ink-950 font-mono text-[10px] font-bold uppercase">
                {label}
              </text>
            </g>
          ))}
          <path d="M0 214 C30 200 44 232 70 216 S112 150 150 130 S196 150 222 118 S262 104 286 84 S318 70 344 40" stroke="url(#plan-line)" strokeWidth="2.5" strokeLinecap="round" pathLength={1} className="draw" style={{ '--d': '300ms' } as CSSProperties} />
          <defs>
            <linearGradient id="plan-line" x1="0" x2="440" gradientUnits="userSpaceOnUse">
              <stop stopColor="var(--color-ink-400)" />
              <stop offset="0.35" stopColor="var(--color-ink-100)" />
              <stop offset="1" stopColor="var(--color-brand-400)" />
            </linearGradient>
          </defs>
          <circle cx="150" cy="130" r="5" fill="var(--color-white)" />
          <circle cx="150" cy="130" r="5" fill="none" stroke="var(--color-white)" className="origin-center animate-pulse-ring [transform-box:fill-box]" />
          {/* risk and reward brackets */}
          <path d="M168 130 V190 M162 190 H174" stroke="var(--color-down)" strokeWidth="1.5" />
          <text x="180" y="178" className="fill-down font-mono text-[11px] font-bold">1R</text>
          <path d="M168 34 V130 M162 34 H174" stroke="var(--color-up)" strokeWidth="1.5" />
          <text x="180" y="62" className="fill-up font-mono text-[11px] font-bold">1.6R</text>
        </svg>
      </div>
    </div>
  );
}

export default async function RiskManagementToolsPage() {
  const symbols = await publicGet<PublicSymbol[]>('/market/symbols', []);

  return (
    <>
      <PageHero
        eyebrow="Education — Risk management"
        title="Protect the account *before the trade*"
        lead="Nobody controls where the price goes next. What you do control is how much a wrong idea costs. These are the tools for that, and two calculators to put numbers on them."
        actions={
          <>
            <a href="#position-size" className={buttonClass('primary', 'lg', 'group h-14 rounded-2xl px-7')}>
              Size a position <ArrowDown className="h-4 w-4 transition-transform duration-300 group-hover:translate-y-1" />
            </a>
            <Link href="/trading-education" className={buttonClass('outline', 'lg', 'h-14 rounded-2xl px-7')}>
              Read the guide
            </Link>
          </>
        }
      >
        <TradePlan />
      </PageHero>

      <section className="relative border-y border-white/[0.06] bg-ink-900/40">
        <div className="bg-dots absolute inset-0 opacity-50" />
        <div className="relative mx-auto max-w-7xl px-4 py-24 sm:px-6 sm:py-28">
          <SectionHead eyebrow="01 — The toolkit" title="Six tools, *one job*" sub="Each one answers a different question about the same thing: how much can this cost me?" />
          <Reveal variant="stagger" step={80} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {TOOLS.map((t, i) => (
              <Spotlight key={t.title} className="card card-hover corners group flex flex-col overflow-hidden p-7">
                <div className="flex items-start justify-between">
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-400/10 text-brand-300 ring-1 ring-inset ring-brand-400/25 transition-transform duration-500 ease-spring group-hover:-rotate-12 group-hover:scale-110">
                    <t.icon className="h-6 w-6" />
                  </span>
                  <span className="text-outline font-display text-6xl font-extrabold leading-none">0{i + 1}</span>
                </div>
                <h3 className="mt-8 text-xl font-bold">{t.title}</h3>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-ink-400">{t.body}</p>
                <span className="label mt-6 border-t border-white/[0.06] pt-4 !text-brand-300">{t.note}</span>
              </Spotlight>
            ))}
          </Reveal>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-24 sm:px-6 sm:py-28">
        <SectionHead eyebrow="02 — Before every order" title="Four questions, *in this order*" />
        <Reveal variant="stagger" step={120} className="border-t border-white/[0.08]">
          {ROUTINE.map(([q, a], i) => (
            <div key={q} className="group relative grid items-center gap-3 overflow-hidden border-b border-white/[0.08] py-8 transition-[padding] duration-500 ease-out-expo hover:px-4 md:grid-cols-[110px_1fr_1.3fr] sm:hover:px-6">
              <span className="absolute inset-0 -z-10 origin-left scale-x-0 bg-gradient-to-r from-brand-400/[0.09] to-transparent transition-transform duration-700 ease-out-expo group-hover:scale-x-100" />
              <span className="text-outline font-display text-6xl font-extrabold leading-none transition-all duration-500 group-hover:[-webkit-text-stroke-color:rgb(var(--brand-rgb)/0.7)]">0{i + 1}</span>
              <h3 className="font-display text-3xl font-bold tracking-tight">{q}</h3>
              <p className="text-sm leading-relaxed text-ink-400">{a}</p>
            </div>
          ))}
        </Reveal>
      </section>

      <section id="position-size" className="relative scroll-mt-24 border-y border-white/[0.06] bg-ink-900/40">
        <div className="relative mx-auto max-w-7xl px-4 py-24 sm:px-6 sm:py-28">
          <SectionHead
            eyebrow="03 — Position size"
            title="Start from the loss, *end at the lots*"
            sub="Set the share of the account you are prepared to lose and how far away the stop is. The volume follows, along with what a losing streak at that risk would do."
          />
          <Reveal variant="scale">
            <PositionSizeCalculator />
          </Reveal>
        </div>
      </section>

      {symbols.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 py-24 sm:px-6 sm:py-28">
          <SectionHead
            eyebrow="04 — Margin"
            title="Then check the *room you have left*"
            sub="A position ties up margin. See how much, and where the 100% margin call and 20% stop-out sit for the account size."
            action={
              <Link href="/trading-account" className="group hidden items-center gap-2 text-sm font-medium text-brand-300 sm:inline-flex">
                <span className="link-underline">Margin rules by account</span>
                <ArrowUpRight className="h-4 w-4 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
              </Link>
            }
          />
          <Reveal variant="scale">
            <MarginCalculator symbols={symbols} />
          </Reveal>
        </section>
      )}

      <section className="mx-auto max-w-7xl px-4 pb-8 sm:px-6">
        <Reveal>
          <div className="card flex flex-col gap-3 border-dashed !border-gold/25 p-7 sm:flex-row sm:items-center sm:gap-6">
            <span className="label shrink-0 !text-gold">Risk warning</span>
            <p className="text-sm leading-relaxed text-ink-300">
              These tools limit risk; they do not remove it. In a fast market or across a price gap, a stop loss can be filled at a worse price than the one you set. CFDs are leveraged products and can
              lose money rapidly.
            </p>
          </div>
        </Reveal>
      </section>

      <ToolStrip current="/risk-management-tools" />
      <CtaBand title="Rehearse it *on a demo*" body="Open a free demo with $10,000 virtual funds and practise placing stops and targets on every order." />
    </>
  );
}
