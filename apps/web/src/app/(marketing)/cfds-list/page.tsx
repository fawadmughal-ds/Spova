import Link from 'next/link';
import type { Metadata } from 'next';
import type { CSSProperties } from 'react';
import { ArrowRight } from 'lucide-react';
import { buttonClass } from '@/lib/button';
import { MARKET_LIST, marketByCls } from '@/lib/markets';
import { publicGet, type PublicSymbol } from '@/lib/server-api';
import { CountUp, Reveal, Spotlight } from '@/components/motion';
import { PageHero } from '@/components/marketing/page-hero';
import { SectionHead } from '@/components/marketing/section-head';
import { CtaBand } from '@/components/marketing/cta-band';
import { CfdExplorer } from '@/components/marketing/cfd-explorer';
import { TradingRelated } from '@/components/marketing/trading-related';

export const metadata: Metadata = {
  title: 'CFD list',
  description: 'Every CFD you can trade, with contract size, lot limits and maximum leverage for each instrument.',
};

export default async function CfdListPage() {
  const symbols = await publicGet<PublicSymbol[]>('/market/symbols', []);
  const classes = MARKET_LIST.filter((m) => symbols.some((s) => s.assetClass === m.cls));
  const maxLev = symbols.reduce((a, s) => Math.max(a, s.leverageMax), 0);
  const minLot = symbols.reduce((a, s) => Math.min(a, Number(s.minLot ?? 0.01)), Infinity);
  // worked example uses a real row from the list
  const sample = symbols.find((s) => s.assetClass === 'forex') ?? symbols[0];
  const sampleSize = sample ? Number(sample.contractSize ?? 1) : 0;

  return (
    <>
      <PageHero
        eyebrow="Trading — CFD list"
        title="Every instrument, *one list*"
        lead="Contract size, lot limits and maximum leverage for everything on the platform. Search by ticker or name, or narrow it to one asset class."
        actions={
          <>
            <Link href="/register" className={buttonClass('primary', 'lg', 'group h-14 rounded-2xl px-7')}>
              Open free demo <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
            </Link>
            <a href="#list" className={buttonClass('outline', 'lg', 'h-14 rounded-2xl px-7')}>
              Jump to the list
            </a>
          </>
        }
      >
        {/* the board: one lit tile per listed instrument, coloured by asset class */}
        <div className="relative mx-auto max-w-lg">
          <div className="absolute -inset-8 -z-10 rounded-[3rem] bg-brand-500/10 blur-3xl" />
          <div className="glass corners rounded-3xl p-5 shadow-lift">
            <div className="flex items-center justify-between pb-4">
              <span className="label">Listed instruments</span>
              <span className="tabular font-mono text-xs text-ink-300">{symbols.length || '—'}</span>
            </div>
            <div className="grid grid-cols-5 gap-1.5 sm:grid-cols-6">
              {(symbols.length ? symbols : Array.from({ length: 24 }, () => null)).map((s, i) => (
                <span
                  key={s?.id ?? i}
                  title={s?.name}
                  style={{ '--c': (s && marketByCls(s.assetClass)?.rgb) || '71 85 105', '--dur': `${3.2 + (i % 5) * 0.7}s`, '--delay': `${-((i * 37) % 50) / 10}s` } as CSSProperties}
                  className="tile-glow flex aspect-square flex-col items-center justify-center rounded-lg border font-mono text-[9px] font-semibold leading-tight text-[rgb(var(--c))] transition-transform duration-300 ease-spring hover:z-10 hover:scale-125"
                >
                  {s &&
                    (/^[A-Z]{6}$/.test(s.id) ? (
                      <>
                        <span>{s.id.slice(0, 3)}</span>
                        <span className="opacity-60">{s.id.slice(3)}</span>
                      </>
                    ) : (
                      <span className="text-[8px]">{s.id}</span>
                    ))}
                </span>
              ))}
            </div>
            <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5 border-t border-white/[0.06] pt-4">
              {classes.map((m) => (
                <span key={m.cls} style={{ '--c': m.rgb } as CSSProperties} className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-ink-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-[rgb(var(--c))]" />
                  {m.label}
                </span>
              ))}
            </div>
          </div>
        </div>
      </PageHero>

      {/* key numbers, all computed from the list itself */}
      {symbols.length > 0 && (
        <div className="border-y border-white/[0.06] bg-ink-900/50">
          <Reveal as="dl" variant="stagger" className="mx-auto grid max-w-7xl grid-cols-2 gap-y-8 px-4 py-10 sm:px-6 md:grid-cols-4">
            {[
              { label: 'Instruments', node: <CountUp to={symbols.length} /> },
              { label: 'Asset classes', node: <CountUp to={classes.length} /> },
              { label: 'Smallest trade', node: <>{minLot} <span className="text-base text-ink-400">lots</span></> },
              { label: 'Highest leverage', node: <CountUp to={maxLev} prefix="1:" /> },
            ].map((s) => (
              <div key={s.label} className="border-l border-white/[0.07] pl-5 first:border-l-0 first:pl-0 max-md:odd:border-l-0 max-md:odd:pl-0">
                <dt className="tabular font-display text-4xl font-extrabold tracking-tighter">{s.node}</dt>
                <dd className="label mt-2">{s.label}</dd>
              </div>
            ))}
          </Reveal>
        </div>
      )}

      <section id="list" className="mx-auto max-w-7xl scroll-mt-24 px-4 py-20 sm:px-6 sm:py-24">
        <Reveal variant="fade">
          <CfdExplorer symbols={symbols} />
        </Reveal>
      </section>

      {/* how to read the columns */}
      <section className="relative border-y border-white/[0.06] bg-ink-900/40">
        <div className="bg-dots absolute inset-0 opacity-50" />
        <div className="relative mx-auto max-w-7xl px-4 py-24 sm:px-6 sm:py-28">
          <SectionHead eyebrow="Reading the table" title="What the *columns mean*" sub="Four numbers decide how big a position can be and how much margin it needs." />
          <Reveal variant="stagger" step={80} className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {[
              {
                n: '01',
                title: 'Contract size',
                body: 'How many units of the underlying one full lot represents.',
                eg: sample ? `1 lot of ${sample.id} = ${sampleSize.toLocaleString('en-US')} units` : null,
              },
              {
                n: '02',
                title: 'Min and max lot',
                body: 'The smallest and largest volume a single order can carry.',
                eg: sample ? `${sample.minLot ?? '0.01'} lots of ${sample.id} = ${(Number(sample.minLot ?? 0.01) * sampleSize).toLocaleString('en-US')} units` : null,
              },
              {
                n: '03',
                title: 'Lot step',
                body: 'The increment volume moves in between the minimum and the maximum.',
                eg: sample ? `${sample.minLot ?? '0.01'} → ${(Number(sample.minLot ?? 0.01) + Number(sample.lotStep ?? 0.01)).toFixed(2)} → ${(Number(sample.minLot ?? 0.01) + 2 * Number(sample.lotStep ?? 0.01)).toFixed(2)}` : null,
              },
              {
                n: '04',
                title: 'Max leverage',
                body: 'The most leverage the instrument allows. Your account leverage applies when it is lower.',
                eg: sample ? `1:${sample.leverageMax} on ${sample.id} = ${(100 / sample.leverageMax).toFixed(2)}% margin` : null,
              },
            ].map((t) => (
              <Spotlight key={t.n} className="card card-hover group relative overflow-hidden p-6">
                <span className="text-outline pointer-events-none absolute -right-1 -top-5 font-display text-[6rem] font-extrabold leading-none transition-all duration-700 group-hover:[-webkit-text-stroke-color:rgb(var(--brand-rgb)/0.45)]">{t.n}</span>
                <h3 className="relative text-lg font-semibold">{t.title}</h3>
                <p className="relative mt-2 text-sm leading-relaxed text-ink-400">{t.body}</p>
                {t.eg && <p className="tabular relative mt-5 rounded-lg bg-white/[0.04] px-3 py-2 font-mono text-[11px] text-brand-200">{t.eg}</p>}
              </Spotlight>
            ))}
          </Reveal>
        </div>
      </section>

      <TradingRelated current="/cfds-list" />
      <CtaBand title="Trade the list *on a demo*" />
    </>
  );
}
