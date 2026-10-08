import type { Metadata } from 'next';
import type { CSSProperties } from 'react';
import { ArrowRight, BellRing, CalendarCheck2, CalendarX2, Clock3, Globe2 } from 'lucide-react';
import { buttonClass } from '@/lib/button';
import { marketByCls } from '@/lib/markets';
import { publicGet, type PublicHoliday, type PublicSession, type PublicSymbol } from '@/lib/server-api';
import { Reveal, Spotlight } from '@/components/motion';
import { PageHero } from '@/components/marketing/page-hero';
import { SectionHead } from '@/components/marketing/section-head';
import { CtaBand } from '@/components/marketing/cta-band';
import { HoursBoard, HoursTimeline } from '@/components/marketing/market-hours';
import { TradingRelated } from '@/components/marketing/trading-related';

export const metadata: Metadata = {
  title: 'Market holidays & trading hours',
  description: 'Weekly trading hours for every instrument in UTC, what is open right now, and upcoming market closures.',
};

const dateParts = (iso: string) => {
  const d = new Date(`${iso}T00:00:00Z`);
  return {
    day: d.toLocaleDateString('en-GB', { day: '2-digit', timeZone: 'UTC' }),
    month: d.toLocaleDateString('en-GB', { month: 'short', timeZone: 'UTC' }),
    weekday: d.toLocaleDateString('en-GB', { weekday: 'long', timeZone: 'UTC' }),
    year: d.getUTCFullYear(),
  };
};

export default async function MarketHolidaysPage() {
  const [symbols, sessions, holidays] = await Promise.all([
    publicGet<PublicSymbol[]>('/market/symbols', []),
    publicGet<PublicSession[]>('/market/sessions', []),
    publicGet<PublicHoliday[]>('/market/holidays', []),
  ]);
  const byId = new Map(symbols.map((s) => [s.id, s]));
  // closures grouped by day, in date order
  const days = [...new Set(holidays.map((h) => h.date))].sort().map((date) => ({ date, ids: holidays.filter((h) => h.date === date).map((h) => h.symbolId) }));

  return (
    <>
      <PageHero
        eyebrow="Trading — Hours & holidays"
        title="When every market *is open*"
        lead="Trading hours for each instrument in UTC, a live view of what is open right now, and any closures coming up."
        actions={
          <>
            <a href="#hours" className={buttonClass('primary', 'lg', 'group h-14 rounded-2xl px-7')}>
              Weekly hours <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
            </a>
            <a href="#closures" className={buttonClass('outline', 'lg', 'h-14 rounded-2xl px-7')}>
              Upcoming closures
            </a>
          </>
        }
      >
        <HoursBoard symbols={symbols} sessions={sessions} />
      </PageHero>

      {/* ============================== WEEK ============================== */}
      <section id="hours" className="mx-auto max-w-7xl scroll-mt-24 px-4 py-24 sm:px-6 sm:py-28">
        <SectionHead
          eyebrow="01 — Trading hours"
          title="The week, *hour by hour*"
          sub="Each bar is a window when orders can be placed. Instruments that keep the same hours share a row."
          action={
            <span className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-400">
              <Globe2 className="h-3.5 w-3.5" /> All times UTC
            </span>
          }
        />
        <Reveal variant="fade">
          <HoursTimeline symbols={symbols} sessions={sessions} />
        </Reveal>

        <Reveal variant="stagger" step={80} className="mt-4 grid gap-4 md:grid-cols-3">
          {[
            { icon: Clock3, title: 'Outside the bars', body: 'The instrument is closed. Open positions stay open, but new market orders are not accepted until the next window.' },
            { icon: BellRing, title: 'Around the open', body: 'Prices can restart away from the previous close, so stops and limits may fill at the first available price.' },
            { icon: CalendarCheck2, title: 'Your local time', body: 'Everything here is UTC. Daylight-saving changes move the hours on your own clock, not on the platform.' },
          ].map((t) => (
            <Spotlight key={t.title} className="card card-hover group p-5">
              <t.icon className="h-5 w-5 text-brand-400 transition-transform duration-500 ease-spring group-hover:-rotate-12 group-hover:scale-125" />
              <h3 className="mt-4 font-semibold">{t.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-ink-400">{t.body}</p>
            </Spotlight>
          ))}
        </Reveal>
      </section>

      {/* ============================== CLOSURES ============================== */}
      <section id="closures" className="relative scroll-mt-24 border-y border-white/[0.06] bg-ink-900/40">
        <div className="bg-dots absolute inset-0 opacity-50" />
        <div className="relative mx-auto max-w-7xl px-4 py-24 sm:px-6 sm:py-28">
          <SectionHead eyebrow="02 — Holidays" title="Upcoming *closures*" sub="Full-day closures on top of the normal weekly hours, listed from today onwards." />

          {days.length === 0 ? (
            <Reveal variant="scale" className="card corners relative overflow-hidden px-6 py-16 text-center sm:py-20">
              {/* a blank month: nothing is marked */}
              <div className="mx-auto grid w-fit grid-cols-7 gap-1.5" aria-hidden>
                {Array.from({ length: 28 }, (_, i) => (
                  <span key={i} style={{ '--d': `${i * 25}ms` } as CSSProperties} className="grow-y h-6 w-6 rounded-md bg-white/[0.05] sm:h-7 sm:w-7" />
                ))}
              </div>
              <span className="relative mx-auto -mt-[5.2rem] flex h-16 w-16 items-center justify-center rounded-2xl border border-up/40 bg-ink-900 text-up shadow-[0_0_40px_-8px_rgb(var(--up-rgb)/0.7)] sm:-mt-24">
                <span className="absolute inset-0 animate-pulse-ring rounded-2xl border border-up/40" />
                <CalendarCheck2 className="h-7 w-7" />
              </span>
              <h3 className="mt-12 text-2xl font-bold sm:mt-14">No closures scheduled</h3>
              <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-ink-400">
                Every instrument is on its normal weekly hours. When an exchange holiday closes a market, the date and the instruments affected are listed here ahead of time.
              </p>
            </Reveal>
          ) : (
            <Reveal variant="stagger" step={70} className="grid gap-4 lg:grid-cols-2">
              {days.map(({ date, ids }) => {
                const p = dateParts(date);
                return (
                  <div key={date} className="card card-hover flex gap-5 p-5">
                    <div className="flex h-20 w-20 shrink-0 flex-col items-center justify-center rounded-2xl border border-gold/30 bg-gold/[0.08] text-gold">
                      <span className="label !text-gold/80">{p.month}</span>
                      <span className="tabular font-display text-3xl font-extrabold leading-none">{p.day}</span>
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 font-semibold">
                        <CalendarX2 className="h-4 w-4 text-gold" />
                        {p.weekday}, {p.year}
                      </div>
                      <p className="label mt-1">
                        Closed all day · {ids.length} {ids.length === 1 ? 'instrument' : 'instruments'}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {ids.map((id) => (
                          <span
                            key={id}
                            title={byId.get(id)?.name}
                            style={{ '--c': marketByCls(byId.get(id)?.assetClass ?? '')?.rgb ?? '15 23 42' } as CSSProperties}
                            className="rounded-md bg-[rgb(var(--c)/0.1)] px-2 py-1 font-mono text-[11px] text-[rgb(var(--c))] ring-1 ring-inset ring-[rgb(var(--c)/0.2)]"
                          >
                            {id}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </Reveal>
          )}
        </div>
      </section>

      <TradingRelated current="/market-holidays" />
      <CtaBand
        title="Check the hours *in the terminal*"
        body="Open a free demo with $10,000 virtual funds. No card required."
        secondary={{ href: '/cfds-list', label: 'Full CFD list' }}
      />
    </>
  );
}
