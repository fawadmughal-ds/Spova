import type { Metadata } from 'next';
import Link from 'next/link';
import type { CSSProperties, ReactNode } from 'react';
import { ArrowDown, ArrowUpRight, ClipboardList, Moon, NotebookPen, Repeat, Target } from 'lucide-react';
import { buttonClass } from '@/lib/button';
import { cn } from '@/lib/utils';
import { Reveal, Spotlight } from '@/components/motion';
import { PageHero } from '@/components/marketing/page-hero';
import { CtaBand } from '@/components/marketing/cta-band';
import { ToolStrip } from '@/components/education/shared';
import { ChapterNav, type Chapter } from '@/components/education/chapter-nav';

export const metadata: Metadata = {
  title: 'Trading education',
  description: 'A plain-English guide to CFD trading: what a CFD is, going long and short, leverage and margin, the costs of a trade, setting goals and the risks.',
};

const CHAPTERS: Chapter[] = [
  { id: 'what-is-a-cfd', title: 'What a CFD is' },
  { id: 'long-and-short', title: 'Long and short' },
  { id: 'leverage-and-margin', title: 'Leverage and margin' },
  { id: 'costs', title: 'What a trade costs' },
  { id: 'goals', title: 'Setting goals' },
  { id: 'risks', title: 'The risks' },
];

const d = (ms: number) => ({ '--d': `${ms}ms` }) as CSSProperties;

function ChapterBlock({ n, id, title, children, figure }: { n: number; id: string; title: string; children: ReactNode; figure?: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-28 border-t border-white/[0.07] py-14 first:border-t-0 first:pt-0">
      <Reveal variant="stagger" step={90}>
        <span className="eyebrow">Chapter {String(n).padStart(2, '0')}</span>
        <h2 className="mt-4 font-display text-4xl font-bold leading-[1.02] tracking-tight sm:text-5xl">{title}</h2>
        <div className="edu-prose mt-6 max-w-2xl">{children}</div>
      </Reveal>
      {figure && (
        <Reveal variant="scale" delay={150} className="mt-9">
          {figure}
        </Reveal>
      )}
    </section>
  );
}

function Figure({ caption, children }: { caption: string; children: ReactNode }) {
  return (
    <figure className="card corners flex h-full flex-col overflow-hidden">
      <div className="relative flex-1 p-5 sm:p-7">
        <div className="bg-dots absolute inset-0 opacity-60" />
        <div className="relative h-full">{children}</div>
      </div>
      <figcaption className="label border-t border-white/[0.06] px-5 py-3">{caption}</figcaption>
    </figure>
  );
}

const LEVERAGES: [ratio: number, note: string][] = [
  [20, 'A 5% move against you equals the margin'],
  [100, 'A 1% move against you equals the margin'],
  [400, 'A 0.25% move against you equals the margin'],
];

const GOALS = [
  { icon: Target, title: 'Aim at the process', body: 'You cannot decide what the market pays you. You can decide to follow your plan on every trade. Make that the goal.' },
  { icon: ClipboardList, title: 'Fix the risk first', body: 'Choose the share of the account you will risk per trade and keep it the same in good weeks and bad ones.' },
  { icon: NotebookPen, title: 'Write it down', body: 'A journal entry per trade (the idea, the entry, the exit, what happened) turns experience into something you can learn from.' },
  { icon: Repeat, title: 'Review on a schedule', body: 'Look back weekly, not after every trade. Patterns in your own behaviour only show up across many decisions.' },
];

export default function TradingEducationPage() {
  return (
    <>
      <PageHero
        eyebrow="Education — Trading education"
        title="CFD trading, *from the first pip*"
        lead="Six short chapters that take you from what a CFD actually is to the rules that close a position for you. No prior knowledge assumed, and no promises about results."
        actions={
          <>
            <a href="#what-is-a-cfd" className={buttonClass('primary', 'lg', 'group h-14 rounded-2xl px-7')}>
              Start reading <ArrowDown className="h-4 w-4 transition-transform duration-300 group-hover:translate-y-1" />
            </a>
            <Link href="/glossary" className={buttonClass('outline', 'lg', 'h-14 rounded-2xl px-7')}>
              Look up a term
            </Link>
          </>
        }
      >
        {/* contents card */}
        <div className="relative mx-auto max-w-md">
          <div className="absolute -inset-8 -z-10 rounded-[3rem] bg-brand-500/15 blur-3xl" />
          <div className="beam glass overflow-hidden rounded-3xl p-2 shadow-lift">
            <div className="flex items-center justify-between px-4 py-3">
              <span className="label">Contents</span>
              <span className="label">6 chapters · about 8 minutes</span>
            </div>
            <Reveal as="ol" variant="stagger" step={90} delay={500}>
              {CHAPTERS.map((c, n) => (
                <li key={c.id}>
                  <a href={`#${c.id}`} className="group flex items-center gap-4 rounded-2xl px-4 py-3.5 transition-colors duration-300 hover:bg-white/[0.06]">
                    <span className="text-outline font-display text-3xl font-extrabold leading-none transition-all duration-500 group-hover:[-webkit-text-stroke-color:rgb(var(--brand-rgb)/0.8)]">{String(n + 1).padStart(2, '0')}</span>
                    <span className="flex-1 font-medium text-ink-100 transition-colors group-hover:text-white">{c.title}</span>
                    <ArrowDown className="h-4 w-4 -translate-y-1 text-ink-600 opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:text-brand-300 group-hover:opacity-100" />
                  </a>
                </li>
              ))}
            </Reveal>
          </div>
        </div>
      </PageHero>

      <div className="border-t border-white/[0.06]">
        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-10 px-4 py-16 sm:px-6 sm:py-24 lg:grid-cols-[220px_1fr] lg:gap-16">
          <aside className="min-w-0 max-lg:sticky max-lg:top-[4.5rem] max-lg:z-20 max-lg:-mx-4 max-lg:bg-ink-950/90 max-lg:px-4 max-lg:py-3 max-lg:backdrop-blur lg:sticky lg:top-28 lg:self-start">
            <ChapterNav chapters={CHAPTERS} articleId="guide" />
          </aside>

          <article id="guide" className="min-w-0">
            <ChapterBlock
              n={1}
              id="what-is-a-cfd"
              title="What a CFD is"
              figure={
                <Figure caption="Worked example with made-up prices · 10 units">
                  <Reveal variant="none">
                    <svg viewBox="0 0 560 210" className="w-full" fill="none">
                      <path d="M40 150 H520" stroke="var(--color-ink-100)" strokeDasharray="4 6" className="animate-dash" />
                      <text x="40" y="170" className="fill-ink-200 font-mono text-[11px]">
                        OPEN · 100.00
                      </text>
                      {/* rising outcome */}
                      <path d="M130 150 C180 150 200 60 250 60" stroke="var(--color-up)" strokeWidth="2.5" strokeLinecap="round" pathLength={1} className="draw" style={d(300)} />
                      <path d="M250 60 H300" stroke="var(--color-up)" strokeDasharray="3 4" />
                      <path d="M276 60 V150 M270 60 H282 M270 150 H282" stroke="var(--color-up)" strokeWidth="1.5" />
                      <text x="312" y="64" className="fill-up font-mono text-[11px]">
                        CLOSE · 103.00
                      </text>
                      <text x="312" y="100" className="fill-white font-display text-[22px] font-bold">
                        +3.00 × 10 = +30
                      </text>
                      {/* falling outcome */}
                      <path d="M130 150 C180 150 200 190 250 190" stroke="var(--color-down)" strokeWidth="2.5" strokeLinecap="round" pathLength={1} className="draw" style={d(900)} />
                      <text x="312" y="194" className="fill-down font-mono text-[11px]">
                        CLOSE · 98.00 → −2.00 × 10 = −20
                      </text>
                      <circle cx="130" cy="150" r="5" fill="var(--color-white)" />
                      <circle cx="130" cy="150" r="5" stroke="var(--color-white)" className="origin-center animate-pulse-ring [transform-box:fill-box]" />
                    </svg>
                  </Reveal>
                </Figure>
              }
            >
              <p>
                CFD stands for <strong>contract for difference</strong>. It is an agreement between you and the provider to settle the change in an instrument’s price between the moment you open a
                position and the moment you close it.
              </p>
              <p>
                You never own the underlying asset. Buying a gold CFD does not put a bar in a vault, and buying a share CFD does not make you a shareholder. What you hold is exposure to the price: if it
                moves your way, the difference is added to your account; if it moves against you, the difference is taken from it.
              </p>
              <p>
                That one idea is why a single account can trade currencies, indices, commodities, shares, crypto and metals side by side. Each one is simply a price, and a contract on where it goes next.
              </p>
            </ChapterBlock>

            <ChapterBlock
              n={2}
              id="long-and-short"
              title="Long and short"
              figure={
                <div className="grid gap-4 sm:grid-cols-2">
                  {[
                    { name: 'Going long', rule: 'Buy first, sell later', color: 'var(--color-up)', path: 'M10 120 C50 124 70 96 104 92 S150 60 176 56 S214 28 250 20', a: [38, 119, 'BUY', -28], b: [232, 26, 'SELL', 10], text: 'You gain if the price rises and lose if it falls.' },
                    { name: 'Going short', rule: 'Sell first, buy back later', color: 'var(--color-down)', path: 'M10 22 C50 18 70 46 104 50 S150 84 176 88 S214 114 250 122', a: [38, 22, 'SELL', 10], b: [232, 116, 'BUY', -28], text: 'You gain if the price falls and lose if it rises.' },
                  ].map((s, n) => (
                    <Spotlight key={s.name} className="card card-hover overflow-hidden">
                      <Reveal variant="none" className="relative border-b border-white/[0.05] bg-ink-900/40 p-4">
                        <div className="bg-grid absolute inset-0 opacity-60" />
                        <svg viewBox="0 0 260 142" className="relative w-full" fill="none">
                          <path d={s.path} stroke={s.color} strokeWidth="2.5" strokeLinecap="round" pathLength={1} className="draw" style={d(250 + n * 250)} />
                          {[s.a, s.b].map(([x, y, label, dy]) => (
                            <g key={label as string}>
                              <circle cx={x as number} cy={y as number} r="5" fill="var(--color-paper)" stroke="var(--color-white)" strokeWidth="1.5" />
                              <rect x={(x as number) - 19} y={(y as number) + (dy as number)} width="38" height="18" rx="5" fill="var(--color-white)" />
                              <text x={x as number} y={(y as number) + (dy as number) + 13} textAnchor="middle" className="fill-ink-950 font-mono text-[9px] font-bold">
                                {label}
                              </text>
                            </g>
                          ))}
                        </svg>
                      </Reveal>
                      <div className="p-6">
                        <h3 className="text-xl font-bold">{s.name}</h3>
                        <p className="label mt-1.5" style={{ color: s.color }}>
                          {s.rule}
                        </p>
                        <p className="mt-3 text-sm leading-relaxed text-ink-400">{s.text}</p>
                      </div>
                    </Spotlight>
                  ))}
                </div>
              }
            >
              <p>
                Because a CFD is a contract on the price rather than the asset itself, you can open a position in either direction. If you expect the price to rise, you <strong>buy</strong> (go long). If
                you expect it to fall, you <strong>sell</strong> (go short) without needing to own anything first.
              </p>
              <p>
                Every quote has two prices. You buy at the higher one, the <strong>ask</strong>, and sell at the lower one, the <strong>bid</strong>. A long position opens at the ask and closes at the
                bid; a short position opens at the bid and closes at the ask.
              </p>
            </ChapterBlock>

            <ChapterBlock
              n={3}
              id="leverage-and-margin"
              title="Leverage and margin"
              figure={
                <Figure caption="Margin needed for a 100,000 position at three leverage settings">
                  <Reveal variant="none" className="space-y-5">
                    {LEVERAGES.map(([ratio, note], n) => {
                      const margin = 100_000 / ratio;
                      return (
                        <div key={ratio} className="grid items-center gap-x-5 gap-y-2 sm:grid-cols-[80px_1fr_auto]">
                          <span className="font-mono text-lg font-bold text-white">1:{ratio}</span>
                          <span className="relative h-9 overflow-hidden rounded-lg bg-white/[0.05]">
                            <span className="grow-x absolute inset-y-0 left-0 rounded-lg bg-gradient-to-r from-brand-500 to-brand-300" style={{ ...d(250 + n * 180), width: `${Math.max(1.2, (margin / 5000) * 100)}%` }} />
                            <span
                              className={cn('absolute inset-y-0 flex items-center font-mono text-[11px] font-semibold', ratio === 20 ? 'left-3 text-ink-950' : 'text-white')}
                              style={ratio === 20 ? undefined : { left: `calc(${Math.max(1.2, (margin / 5000) * 100)}% + 12px)` }}
                            >
                              ${margin.toLocaleString('en-US')} margin
                            </span>
                          </span>
                          <span className="text-xs text-ink-400 sm:w-56">{note}</span>
                        </div>
                      );
                    })}
                    <div className="border-t border-white/[0.06] pt-5">
                      <div className="flex items-baseline justify-between">
                        <span className="label">Margin level = equity ÷ used margin</span>
                        <span className="label hidden sm:block">What the platform watches</span>
                      </div>
                      <div className="relative mt-3 h-2.5 rounded-full bg-gradient-to-r from-down via-gold via-[30%] to-up">
                        <span className="absolute inset-y-[-4px] w-px bg-white" style={{ left: '14%' }} />
                        <span className="absolute inset-y-[-4px] w-px bg-white" style={{ left: '38%' }} />
                      </div>
                      <div className="relative mt-2 h-9 font-mono text-[10px] text-ink-300">
                        <span className="absolute -translate-x-1/2 text-center" style={{ left: '14%' }}>
                          20%
                          <br />
                          <span className="text-down">stop-out</span>
                        </span>
                        <span className="absolute -translate-x-1/2 text-center" style={{ left: '38%' }}>
                          100%
                          <br />
                          <span className="text-gold">margin call</span>
                        </span>
                      </div>
                    </div>
                  </Reveal>
                </Figure>
              }
            >
              <p>
                To open a position you do not pay its full value. You set aside a fraction of it as collateral, called <strong>margin</strong>, and the platform holds that amount for as long as the
                position is open. <strong>Leverage</strong> is the ratio between the two: at 1:100, a 100,000 position needs 1,000 of margin.
              </p>
              <p>
                Leverage does not change the size of the position or what each price move is worth. It changes how much of your own money sits behind it. The same move that would be a small ripple on an
                unleveraged holding is a large share of a thin margin, in both directions. On this platform leverage goes up to 1:400 on forex and is lower on other asset classes.
              </p>
              <p>
                The number to watch is <strong>margin level</strong>: your equity as a percentage of the margin in use. If it falls to <strong>100%</strong> you receive a margin call, a warning that
                there is no free margin left. If it falls to <strong>20%</strong>, the stop-out rule starts closing positions automatically, largest loss first, until the level recovers.
              </p>
              <p>
                <Link href="/risk-management-tools" className="group inline-flex items-center gap-1.5 font-medium text-brand-300">
                  <span className="link-underline">Try the numbers in the margin calculator</span>
                  <ArrowUpRight className="h-4 w-4 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                </Link>
              </p>
            </ChapterBlock>

            <ChapterBlock
              n={4}
              id="costs"
              title="What a trade costs"
              figure={
                <div className="grid gap-4 sm:grid-cols-2">
                  <Figure caption="The spread: paid once, when the position opens">
                    <Reveal variant="none">
                      <svg viewBox="0 0 260 150" className="w-full" fill="none">
                        <rect x="0" y="48" width="260" height="46" fill="rgb(var(--gold-rgb) / 0.1)" className="grow-y" style={{ ...d(500), transformBox: 'fill-box', transformOrigin: '50% 50%' }} />
                        <path d="M0 48 H260" stroke="var(--color-up)" strokeWidth="1.5" pathLength={1} className="draw" style={d(100)} />
                        <path d="M0 94 H260" stroke="var(--color-down)" strokeWidth="1.5" pathLength={1} className="draw" style={d(250)} />
                        <text x="6" y="38" className="fill-up font-mono text-[10px] uppercase tracking-widest">
                          Ask · you buy here
                        </text>
                        <text x="6" y="114" className="fill-down font-mono text-[10px] uppercase tracking-widest">
                          Bid · you sell here
                        </text>
                        <path d="M214 52 V90 M208 52 H220 M208 90 H220" stroke="var(--color-gold)" strokeWidth="1.5" />
                        <text x="204" y="75" textAnchor="end" className="fill-gold font-display text-[15px] font-bold">
                          spread
                        </text>
                      </svg>
                    </Reveal>
                  </Figure>
                  <Figure caption="Swap: applied each night a position stays open">
                    <div className="flex h-full flex-col justify-between gap-5">
                      <div className="flex items-center gap-2">
                        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].map((day, n) => (
                          <div key={day} className="flex-1 text-center">
                            <div className="relative mx-auto flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-iris">
                              <Moon className="animate-float h-4 w-4" style={{ animationDelay: `${n * -1.3}s` }} />
                            </div>
                            <div className="label mt-2 !text-[9px]">{day}</div>
                          </div>
                        ))}
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          ['Long', 'its own rate'],
                          ['Short', 'its own rate'],
                        ].map(([side, note]) => (
                          <div key={side} className="rounded-xl border border-white/[0.07] bg-white/[0.03] px-3 py-2.5">
                            <div className="text-sm font-semibold text-white">{side}</div>
                            <div className="label mt-0.5 !text-[9px]">{note} · charge or credit</div>
                          </div>
                        ))}
                      </div>
                      <Link href="/swap-fees" className="group inline-flex items-center gap-1.5 text-sm font-medium text-brand-300">
                        <span className="link-underline">See swap rates per instrument</span>
                        <ArrowUpRight className="h-4 w-4 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                      </Link>
                    </div>
                  </Figure>
                </div>
              }
            >
              <p>
                The first cost is the <strong>spread</strong>, the gap between the bid and the ask. A new position starts slightly negative by exactly that gap, because it opened at one price and would
                close at the other. The tighter the spread, the less the market has to move before the trade breaks even.
              </p>
              <p>
                The second is <strong>swap</strong>, an overnight financing adjustment applied to positions held past the daily rollover. It depends on the instrument and on whether you are long or
                short, and it can be a charge or a credit. A trade closed the same day has no swap at all.
              </p>
              <p>The live spread is visible on every quote and swap rates are listed per instrument, so you can know the cost of a trade before you place it.</p>
            </ChapterBlock>

            <ChapterBlock
              n={5}
              id="goals"
              title="Setting goals"
              figure={
                <Reveal variant="stagger" step={90} className="grid gap-4 sm:grid-cols-2">
                  {GOALS.map((g) => (
                    <Spotlight key={g.title} className="card card-hover group p-6">
                      <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-400/10 text-brand-300 ring-1 ring-inset ring-brand-400/25 transition-transform duration-500 ease-spring group-hover:-rotate-12 group-hover:scale-110">
                        <g.icon className="h-5 w-5" />
                      </span>
                      <h3 className="mt-5 text-lg font-bold">{g.title}</h3>
                      <p className="mt-2 text-sm leading-relaxed text-ink-400">{g.body}</p>
                    </Spotlight>
                  ))}
                </Reveal>
              }
            >
              <p>
                A goal like “make money” gives you nothing to act on. Useful trading goals are specific, within your control, and can be checked at the end of the week: how much you risk per trade, which
                markets and hours you trade, how many positions you hold at once, and when you stop for the day.
              </p>
              <p>
                Realistic goals also protect you from yourself. Most large losses come not from one bad idea but from abandoning the plan after a few of them: doubling the size, moving the stop, trading
                to win it back.
              </p>
            </ChapterBlock>

            <ChapterBlock n={6} id="risks" title="The risks">
              <p>
                CFDs are leveraged, and leverage magnifies losses exactly as much as gains. A position can lose value quickly, especially around scheduled news, at the market open, or in thinly traded
                hours when prices can jump from one level to another with nothing in between.
              </p>
              <p>
                A stop loss limits the damage, but in a gap it can be filled at a worse price than the one you set. Positions held overnight carry swap. And any trading approach, however careful, will
                have losing periods.
              </p>
              <p>
                Negative balance protection means you cannot lose more than the money in your account. It does not mean you cannot lose all of it. <strong>Only trade with money you can afford to lose</strong>,
                and practise on a demo account until the mechanics in this guide feel routine.
              </p>
              <div className="card mt-8 flex flex-col gap-3 border-dashed !border-gold/25 p-6 sm:flex-row sm:items-center sm:gap-6">
                <span className="label shrink-0 !text-gold">Risk warning</span>
                <p className="!mt-0 text-sm !leading-relaxed">
                  CFDs are complex instruments and come with a high risk of losing money rapidly due to leverage. Past performance is not a reliable indicator of future results. This guide is general
                  education, not investment advice.
                </p>
              </div>
            </ChapterBlock>
          </article>
        </div>
      </div>

      <ToolStrip current="/trading-education" />
      <CtaBand title="Now try it *with virtual funds*" body="Open a free demo with $10,000 virtual funds. Same terminal, same margin rules, no money at risk." />
    </>
  );
}
