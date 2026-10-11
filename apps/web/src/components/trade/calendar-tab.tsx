'use client';

import { useEffect, useMemo, useState } from 'react';
import { Binoculars, CalendarX2 } from 'lucide-react';
import type { CalendarEventDto } from '@spova/shared';
import { get } from '@/lib/api';
import { cn } from '@/lib/utils';
import { EmptyState } from './bits';
import { flagEmoji, useT } from './i18n';

const REFRESH_MS = 15 * 60 * 1000;
const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
const hhmm = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });

/** Economic calendar of the week, grouped by local day, with a high-impact filter. Data: /market/calendar (cached public feed). */
export function CalendarTab({ className }: { className?: string }) {
  const t = useT();
  const [events, setEvents] = useState<CalendarEventDto[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [onlyHigh, setOnlyHigh] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    let alive = true;
    const load = () =>
      get<CalendarEventDto[]>('/market/calendar')
        .then((e) => alive && (setEvents(e), setFailed(false)))
        .catch(() => alive && (setFailed(true), setEvents((x) => x ?? [])));
    void load();
    const id = setInterval(() => {
      void load();
      setNow(Date.now());
    }, REFRESH_MS);
    const tick = setInterval(() => setNow(Date.now()), 60_000);
    return () => {
      alive = false;
      clearInterval(id);
      clearInterval(tick);
    };
  }, []);

  const groups = useMemo(() => {
    if (!events) return [];
    const today = new Date(now);
    const tomorrow = new Date(now + 86_400_000);
    const cutoff = now - 3 * 3600_000; // keep the last three hours so a just-released figure stays visible
    const list = events.filter((e) => new Date(e.at).getTime() >= cutoff && (!onlyHigh || e.impact === 3));
    const map = new Map<string, { label: string; items: CalendarEventDto[] }>();
    for (const e of list) {
      const d = new Date(e.at);
      const k = dayKey(d);
      if (!map.has(k)) {
        const rel = k === dayKey(today) ? t('today') : k === dayKey(tomorrow) ? t('tomorrow') : null;
        const date = d.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' });
        map.set(k, { label: rel ? `${rel} · ${date}` : date, items: [] });
      }
      map.get(k)!.items.push(e);
    }
    return [...map.values()];
  }, [events, onlyHigh, now, t]);

  return (
    <div className={cn('flex h-full flex-col', className)}>
      <div className="flex items-center gap-1.5 border-b border-[var(--t-line)] px-3 py-2">
        <button type="button" data-on={!onlyHigh} onClick={() => setOnlyHigh(false)} className="t-chip">
          {t('all')}
        </button>
        <button type="button" data-on={onlyHigh} onClick={() => setOnlyHigh(true)} className="t-chip">
          <span className="mr-1 inline-block h-2 w-2 rounded-full bg-[var(--t-sell)]" /> {t('highImpact')}
        </button>
      </div>
      {events === null ? (
        <ul className="animate-pulse space-y-2 p-3">
          {[0, 1, 2, 3, 4].map((i) => (
            <li key={i} className="h-10 rounded-md bg-[var(--t-raised)]" />
          ))}
        </ul>
      ) : failed && events.length === 0 ? (
        <EmptyState icon={<CalendarX2 />} title={t('calendarDown')} />
      ) : groups.length === 0 ? (
        <div className="flex h-full min-h-[220px] flex-col items-center justify-center gap-5 p-6 text-center">
          <span className="flex h-[150px] w-[150px] items-center justify-center rounded-full bg-[var(--t-blue)]/15 text-[var(--t-blue)]">
            <Binoculars className="h-16 w-16" strokeWidth={1.6} />
          </span>
          <div className="text-[20px] font-semibold text-[var(--t-text)]">No calendar events</div>
          <div className="-mt-3 text-[12px] text-[var(--t-muted)]">{t('noEvents')}</div>
        </div>
      ) : (
        <ul className="min-h-0 flex-1 overflow-y-auto">
          {groups.map((g) => (
            <li key={g.label}>
              <div className="sticky top-0 z-[1] bg-[var(--t-bg)] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--t-muted)]">{g.label}</div>
              <ul>
                {g.items.map((e) => (
                  <EventRow key={e.id} e={e} past={new Date(e.at).getTime() < now} holiday={t('holiday')} />
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function EventRow({ e, past, holiday }: { e: CalendarEventDto; past: boolean; holiday: string }) {
  return (
    <li className={cn('flex items-center gap-3 border-b border-[var(--t-line)] px-3 py-2.5', past && 'opacity-60')}>
      <span className="flex h-[22px] w-[26px] shrink-0 items-center justify-center rounded-sm bg-[var(--t-raised)] text-[15px] leading-none" aria-label={e.country} title={e.currency || e.country}>
        {flagEmoji(e.country)}
      </span>
      <span className="min-w-0 flex-1 leading-tight">
        <span className="flex items-baseline gap-2 text-[13px] font-semibold text-white">
          <span className="tabular shrink-0 font-mono text-[12px] text-[var(--t-text-2)]">{hhmm(e.at)}</span>
          <span className="truncate">{e.title}</span>
          {e.currency && <span className="shrink-0 text-[10px] font-bold text-[var(--t-muted)]">{e.currency}</span>}
        </span>
        {e.impact === 0 ? (
          <span className="mt-0.5 block text-[11px] text-[var(--t-muted)]">{holiday}</span>
        ) : (
          <span className="mt-0.5 flex gap-3 text-[11px] text-[var(--t-muted)]">
            <span>
              Act: <span className={cn(e.actual && 'text-white')}>{e.actual ?? '-'}</span>
            </span>
            <span>Prev: {e.previous ?? '-'}</span>
            <span>Fcst: {e.forecast ?? '-'}</span>
          </span>
        )}
      </span>
      <span className="flex h-8 w-8 shrink-0 items-end justify-center gap-[2px] rounded-md bg-[var(--t-raised)] pb-2" aria-label={`Impact ${e.impact} of 3`}>
        {[1, 2, 3].map((n) => (
          <span key={n} className={cn('w-[3px] rounded-sm', n === 1 ? 'h-[6px]' : n === 2 ? 'h-[9px]' : 'h-[12px]', n <= e.impact ? (e.impact === 3 ? 'bg-[var(--t-sell)]' : e.impact === 2 ? 'bg-[var(--t-alert)]' : 'bg-[var(--t-alert)]/70') : 'bg-[#4b5868]')} />
        ))}
      </span>
    </li>
  );
}
