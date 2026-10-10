'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ChartPie, ChevronLeft, ChevronRight, CirclePlus, TrendingDown, TrendingUp } from 'lucide-react';
import { ColorType, CrosshairMode, LineSeries, LineStyle, createChart, type UTCTimestamp } from 'lightweight-charts';
import type { AccountDto, LedgerEntryDto, Paginated, PositionDto } from '@spova/shared';
import { get } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Spinner } from '@/components/ui';
import { fmtNum, type SymbolSpec } from './format';
import { EmptyState, InfoTip } from './bits';
import { useSettings } from './settings';

type Period = '3m' | '1y' | 'all';
const PERIODS: { value: Period; label: string; days: number | null }[] = [
  { value: '3m', label: '3M', days: 91 },
  { value: '1y', label: '1Y', days: 365 },
  { value: 'all', label: 'ALL', days: null },
];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAY_MS = 86_400_000;
const cssVar = (el: HTMLElement, name: string, fallback: string) => getComputedStyle(el).getPropertyValue(name).trim() || fallback;

interface Closed {
  p: PositionDto;
  pnl: number;
  /** price move in the instrument's points (sign follows the P/L direction) */
  points: number | null;
  closeMs: number;
}

const toClosed = (history: PositionDto[], symbols: Map<string, SymbolSpec>): Closed[] =>
  history
    .filter((p) => p.closeAt)
    .map((p) => {
      const digits = symbols.get(p.symbol)?.digits;
      const open = Number(p.openPrice);
      const close = p.closePrice === null ? NaN : Number(p.closePrice);
      const points = digits === undefined || !Number.isFinite(close) ? null : (p.side === 'buy' ? close - open : open - close) * Math.pow(10, digits);
      return { p, pnl: Number(p.realizedPnl ?? 0), points, closeMs: new Date(p.closeAt!).getTime() };
    })
    .sort((a, b) => a.closeMs - b.closeMs);

/**
 * Balance at a moment: the balance after the last ledger entry before it. An account funded later than
 * `atMs` (or an "ALL" period) uses its first funding as the starting balance. Null when nothing was ever booked.
 */
function balanceAt(ledger: LedgerEntryDto[], atMs: number): number | null {
  if (ledger.length === 0) return null;
  let last: LedgerEntryDto | null = null;
  for (const e of ledger) {
    if (new Date(e.createdAt).getTime() <= atMs) last = e;
    else break;
  }
  const v = Number(last ? last.balanceAfter : ledger[0].balanceAfter);
  return Number.isFinite(v) && v > 0 ? v : null;
}
const roiOf = (pnl: number, base: number | null) => (base === null ? null : (pnl / base) * 100);
const fmtRoi = (v: number | null) => (v === null ? '—' : `${v.toFixed(2)}%`);
const toneOf = (v: number | null) => (v === null ? 'text-white' : v > 0 ? 't-pnl-up' : v < 0 ? 't-pnl-down' : 'text-white');

/** Cumulative ROI % after every closed trade, teal line on a % axis with the 0% baseline. */
function RoiChart({ trades, base }: { trades: Closed[]; base: number | null }) {
  const { theme } = useSettings();
  const host = useRef<HTMLDivElement>(null);
  const points = useMemo(() => {
    if (base === null || trades.length === 0) return [];
    const out: { time: UTCTimestamp; value: number }[] = [];
    let cum = 0;
    let lastT = 0;
    const first = Math.floor(trades[0].closeMs / 1000) - 1;
    out.push({ time: first as UTCTimestamp, value: 0 });
    lastT = first;
    for (const t of trades) {
      cum += t.pnl;
      let time = Math.floor(t.closeMs / 1000);
      if (time <= lastT) time = lastT + 1; // closes can share a second; the series needs strictly increasing times
      lastT = time;
      out.push({ time: time as UTCTimestamp, value: (cum / base) * 100 });
    }
    return out;
  }, [trades, base]);
  useEffect(() => {
    const el = host.current;
    if (!el || points.length === 0) return;
    // dates when the series spans days, date + time when everything closed within three days
    const spanSec = points[points.length - 1].time - points[0].time;
    const fmtDate = (t: number) => {
      const d = new Date(t * 1000);
      const day = `${String(d.getUTCDate()).padStart(2, '0')} ${MONTHS[d.getUTCMonth()]}`;
      return spanSec < 3 * 86_400 ? `${day} ${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}` : `${day} ${d.getUTCFullYear()}`;
    };
    const c = createChart(el, {
      autoSize: false,
      width: el.clientWidth,
      height: el.clientHeight,
      layout: { background: { type: ColorType.Solid, color: cssVar(el, '--t-bg', '#20252c') }, textColor: cssVar(el, '--t-text-2', '#9ea7b5'), fontFamily: 'var(--ff-body), ui-sans-serif, system-ui, sans-serif', fontSize: 12, attributionLogo: false },
      grid: { vertLines: { visible: false }, horzLines: { color: cssVar(el, '--t-chart-grid', 'rgba(255,255,255,0.08)') } },
      crosshair: { mode: CrosshairMode.Magnet, vertLine: { color: cssVar(el, '--t-chart-cross', 'rgba(186,195,210,0.35)'), labelBackgroundColor: cssVar(el, '--t-dim-bg', '#4b5868'), style: LineStyle.Dashed }, horzLine: { color: cssVar(el, '--t-chart-cross', 'rgba(186,195,210,0.35)'), labelBackgroundColor: cssVar(el, '--t-dim-bg', '#4b5868'), style: LineStyle.Dashed } },
      leftPriceScale: { visible: true, borderVisible: false, scaleMargins: { top: 0.12, bottom: 0.12 } },
      rightPriceScale: { visible: false },
      timeScale: { borderVisible: false, timeVisible: false, fixLeftEdge: true, fixRightEdge: true, tickMarkFormatter: (t: number) => fmtDate(t) },
      handleScroll: false,
      handleScale: false,
      localization: { locale: 'en-GB', timeFormatter: (t: number) => fmtDate(t) },
    });
    const s = c.addSeries(LineSeries, { color: cssVar(el, '--t-chart-line', '#3fb6d8'), lineWidth: 2, priceLineVisible: false, lastValueVisible: false, crosshairMarkerRadius: 4, priceFormat: { type: 'custom', formatter: (v: number) => (Math.abs(v) < 0.005 ? '0%' : `${v.toFixed(2)}%`), minMove: 0.01 } });
    s.setData(points);
    s.createPriceLine({ price: 0, color: 'rgba(255,255,255,0.35)', lineWidth: 1, lineStyle: LineStyle.Solid, axisLabelVisible: false, title: '' });
    c.timeScale().fitContent();
    const ro = new ResizeObserver(() => {
      if (el.clientWidth > 0 && el.clientHeight > 0) {
        c.applyOptions({ width: el.clientWidth, height: el.clientHeight });
        c.timeScale().fitContent();
      }
    });
    ro.observe(el);
    return () => {
      ro.disconnect();
      c.remove();
    };
  }, [points, theme]);
  if (base === null) return <EmptyState title="No starting balance">ROI needs a funded account: deposit or credit first.</EmptyState>;
  if (points.length === 0) return <EmptyState title="No closed trades in this period" />;
  return <div ref={host} className="absolute inset-0" />;
}

function PerfCard({ icon, label, usd, points, tone, tip, children }: { icon: React.ReactNode; label: string; usd?: number | null; points?: number | null; tone: 'up' | 'down' | 'neutral'; tip?: string; children?: React.ReactNode }) {
  return (
    <div className="t-card flex items-start gap-3 !px-4 !py-[18px]">
      <span className={cn('mt-0.5 flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-[5px] [&>svg]:h-[15px] [&>svg]:w-[15px]', tone === 'down' ? 'bg-[rgb(239_85_109/0.18)] text-[var(--t-sell)]' : 'bg-[rgb(65_208_193/0.16)] text-[var(--t-up)]')}>{icon}</span>
      <span className="min-w-0 leading-tight">
        <span className="flex items-center gap-2 text-[13px] text-[var(--t-text-2)]">
          {label}
          {tip && <InfoTip text={tip} />}
        </span>
        {children ?? (
          <>
            <span className="mt-1.5 block text-[16px] font-semibold text-white">
              {usd === null || usd === undefined ? '—' : fmtNum(usd)}
              {usd !== null && usd !== undefined && <span className="ml-1 text-[10px] font-semibold text-[var(--t-text-2)]">USD</span>}
            </span>
            <span className="mt-1 block text-[16px] font-semibold text-white">
              {points === null || points === undefined ? '—' : fmtNum(points)}
              {points !== null && points !== undefined && <span className="ml-1 text-[10px] font-semibold text-[var(--t-text-2)]">POINTS</span>}
            </span>
          </>
        )}
      </span>
    </div>
  );
}

/** "33 buys (22%) ———— 118 buys (78%)": profitable vs losing split with a teal / red proportional bar. */
function SplitRow({ noun, win, lose }: { noun: string; win: number; lose: number }) {
  const total = win + lose;
  const pct = (n: number) => (total ? Math.round((n / total) * 100) : 0);
  return (
    <div>
      <div className="flex items-baseline justify-between text-[15px] font-semibold text-white">
        <span>
          {win} {noun} <span className="font-normal text-[var(--t-text-2)]">({pct(win)}%)</span>
        </span>
        <span>
          {lose} {noun} <span className="font-normal text-[var(--t-text-2)]">({pct(lose)}%)</span>
        </span>
      </div>
      <div className="mt-2 flex h-[7px] gap-[3px]">
        {total === 0 ? <span className="h-full flex-1 rounded-full bg-[var(--t-raised-2)]" /> : (
          <>
            {win > 0 && <span className="h-full rounded-full bg-[var(--t-up)]" style={{ width: `${(win / total) * 100}%` }} />}
            {lose > 0 && <span className="h-full rounded-full bg-[var(--t-sell)]" style={{ width: `${(lose / total) * 100}%` }} />}
          </>
        )}
      </div>
      <div className="mt-1.5 flex justify-between text-[11px] text-[var(--t-text-2)]">
        <span className="rounded bg-[var(--t-raised)] px-1.5 py-px">Profitable {noun[0].toUpperCase() + noun.slice(1)}</span>
        <span className="rounded bg-[var(--t-raised)] px-1.5 py-px">Losing {noun[0].toUpperCase() + noun.slice(1)}</span>
      </div>
    </div>
  );
}

/** Teal / red donut (profitable vs losing days). */
function Donut({ win, lose, size = 230 }: { win: number; lose: number; size?: number }) {
  const total = win + lose;
  const r = 38;
  const c = 2 * Math.PI * r;
  const winLen = total ? (win / total) * c : 0;
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} className="shrink-0" role="img" aria-label={`${win} profitable days, ${lose} losing days`}>
      <circle cx="50" cy="50" r={r} fill="none" stroke={total ? 'var(--t-sell)' : 'var(--t-raised-2)'} strokeWidth="24" />
      {winLen > 0 && <circle cx="50" cy="50" r={r} fill="none" stroke="var(--t-up)" strokeWidth="24" strokeDasharray={`${winLen} ${c - winLen}`} strokeDashoffset={c / 4} />}
    </svg>
  );
}

/** Account analytics: ROI over the period, trade performance, trade summary, daily performance, monthly ROI. */
export function AnalyticsView({ account, history, loadHistory, symbols, ledgerVersion, className }: { account: AccountDto; history: PositionDto[] | null; loadHistory: () => Promise<void>; symbols: Map<string, SymbolSpec>; ledgerVersion: number; className?: string }) {
  const [ledger, setLedger] = useState<LedgerEntryDto[] | null>(null);
  const [period, setPeriod] = useState<Period>('3m');
  const [year, setYear] = useState(() => new Date().getUTCFullYear());
  useEffect(() => {
    if (history === null) void loadHistory();
  }, [history, loadHistory]);
  useEffect(() => {
    let alive = true;
    // whole ledger, oldest first (pages of 100; a retail account rarely has more than a few hundred rows)
    (async () => {
      const all: LedgerEntryDto[] = [];
      for (let page = 1; page <= 10; page++) {
        const r = await get<Paginated<LedgerEntryDto>>(`/me/accounts/${account.id}/ledger?page=${page}&limit=100`);
        all.push(...r.items);
        if (r.items.length < 100 || all.length >= r.total) break;
      }
      if (alive) setLedger(all.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()));
    })().catch(() => alive && setLedger([]));
    return () => {
      alive = false;
    };
  }, [account.id, ledgerVersion]);

  const closed = useMemo(() => (history ? toClosed(history, symbols) : null), [history, symbols]);
  const stats = useMemo(() => {
    if (!closed || !ledger) return null;
    const now = Date.now();
    const days = PERIODS.find((p) => p.value === period)!.days;
    const startMs = days === null ? 0 : now - days * DAY_MS;
    const trades = closed.filter((t) => t.closeMs >= startMs);
    const base = balanceAt(ledger, days === null ? 0 : startMs);
    const total = trades.reduce((s, t) => s + t.pnl, 0);
    const wins = trades.filter((t) => t.pnl > 0);
    const losses = trades.filter((t) => t.pnl < 0);
    const avg = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null);
    const avgPoints = (xs: Closed[]) => avg(xs.map((t) => t.points).filter((x): x is number => x !== null));
    const grossProfit = wins.reduce((s, t) => s + t.pnl, 0);
    const grossLoss = -losses.reduce((s, t) => s + t.pnl, 0);
    const buys = trades.filter((t) => t.p.side === 'buy');
    const sells = trades.filter((t) => t.p.side === 'sell');
    const byDay = new Map<string, number>();
    trades.forEach((t) => {
      const k = new Date(t.closeMs).toISOString().slice(0, 10);
      byDay.set(k, (byDay.get(k) ?? 0) + t.pnl);
    });
    const dayPnls = Array.from(byDay.values());
    const months = MONTHS.map((_, m) => {
      const start = Date.UTC(year, m, 1);
      const end = Date.UTC(year, m + 1, 1);
      const xs = closed.filter((t) => t.closeMs >= start && t.closeMs < end);
      if (xs.length === 0) return null;
      return roiOf(
        xs.reduce((s, t) => s + t.pnl, 0),
        balanceAt(ledger, start),
      );
    });
    const years = closed.length ? Array.from(new Set(closed.map((t) => new Date(t.closeMs).getUTCFullYear()))).sort() : [year];
    return {
      trades,
      base,
      total,
      roi: roiOf(total, base),
      avgWin: avg(wins.map((t) => t.pnl)),
      avgWinPts: avgPoints(wins),
      avgLoss: avg(losses.map((t) => t.pnl)),
      avgLossPts: avgPoints(losses),
      profitFactor: grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : null,
      buyWin: buys.filter((t) => t.pnl > 0).length,
      buyLose: buys.filter((t) => t.pnl <= 0).length,
      sellWin: sells.filter((t) => t.pnl > 0).length,
      sellLose: sells.filter((t) => t.pnl <= 0).length,
      days: dayPnls.length,
      dayWin: dayPnls.filter((v) => v > 0).length,
      dayLose: dayPnls.filter((v) => v <= 0).length,
      months,
      years,
    };
  }, [closed, ledger, period, year]);

  if (!closed || !ledger || !stats)
    return (
      <div className={cn('t-panel items-center justify-center', className)}>
        <Spinner />
      </div>
    );
  if (closed.length === 0)
    return (
      <div className={cn('t-panel', className)}>
        <EmptyState icon={<ChartPie />} title="No closed trades yet">
          ROI, trade performance and the daily / monthly breakdown appear once the first position is closed on {account.type.toUpperCase()} {account.loginCode}.
        </EmptyState>
      </div>
    );
  const pf = stats.profitFactor === null ? '—' : stats.profitFactor === Infinity ? '∞' : stats.profitFactor.toFixed(2);
  const pct = (n: number) => (stats.days ? Math.round((n / stats.days) * 100) : 0);
  const yearIdx = stats.years.indexOf(year);
  const maxRoi = Math.max(0.0001, ...stats.months.map((v) => (v === null ? 0 : Math.abs(v))));
  return (
    <div className={cn('flex min-h-0 flex-col gap-[18px] overflow-y-auto pr-px', className)}>
      <div className="grid shrink-0 gap-[18px] lg:grid-cols-[minmax(0,1fr)_340px]">
        {/* ROI */}
        <section className="t-panel min-h-[440px] !p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-[22px] font-semibold text-white">
                ROI: <span className={toneOf(stats.roi)}>{fmtRoi(stats.roi)}</span>
                <InfoTip text="Return on investment = total realised P/L of the period ÷ the balance at the start of the period (the first funding when the account was funded inside the period)." />
              </div>
              <div className={cn('mt-1 text-[15px] font-medium', toneOf(stats.total))}>
                {fmtNum(stats.total)} {account.currency}
              </div>
            </div>
            <div role="tablist" aria-label="Period" className="t-seg">
              {PERIODS.map((p) => (
                <button key={p.value} type="button" role="tab" aria-selected={period === p.value} data-on={period === p.value} onClick={() => setPeriod(p.value)}>
                  {p.label}
                </button>
              ))}
            </div>
          </div>
          <div className="relative mt-4 min-h-[300px] flex-1">
            <RoiChart trades={stats.trades} base={stats.base} />
          </div>
        </section>

        {/* Trade performance */}
        <section className="t-panel !p-6">
          <h2 className="t-h2">Trade performance</h2>
          <div className="mt-6 flex flex-col gap-3">
            <PerfCard icon={<TrendingUp />} label="Average Win" usd={stats.avgWin} points={stats.avgWinPts} tone="up" />
            <PerfCard icon={<TrendingDown />} label="Average Loss" usd={stats.avgLoss} points={stats.avgLossPts} tone="down" />
            <PerfCard icon={<CirclePlus />} label="Profit Factor" tone="neutral" tip="Gross profit ÷ gross loss of the period. Above 1 means the winners outweigh the losers.">
              <span className="mt-1.5 block text-[16px] font-semibold text-white">{pf}</span>
            </PerfCard>
          </div>
        </section>
      </div>

      <div className="grid shrink-0 gap-[18px] lg:grid-cols-2">
        {/* Trade summary */}
        <section className="t-panel !p-6">
          <h2 className="t-h2">Trade summary</h2>
          <div className="mt-5 text-[15px] text-[var(--t-text-2)]">
            Total trades: <span className="font-semibold text-white">{stats.trades.length}</span>
          </div>
          <div className="mt-5 flex flex-col gap-6">
            <SplitRow noun="buys" win={stats.buyWin} lose={stats.buyLose} />
            <SplitRow noun="sells" win={stats.sellWin} lose={stats.sellLose} />
          </div>
        </section>

        {/* Daily performance */}
        <section className="t-panel !p-6">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div className="min-w-0">
              <h2 className="t-h2">Daily performance</h2>
              <div className="mt-5 text-[15px] text-[var(--t-text-2)]">
                Total days: <span className="font-semibold text-white">{stats.days}</span>
              </div>
              <div className="mt-3 flex items-baseline gap-2 text-[15px]">
                <span className="rounded bg-[var(--t-raised)] px-1.5 py-px text-[11px] text-[var(--t-text-2)]">Profitable Days</span>
                <span className="font-semibold t-pnl-up">{stats.dayWin} days</span>
                <span className="text-[var(--t-text-2)]">({pct(stats.dayWin)}%)</span>
              </div>
              <div className="mt-2 flex items-baseline gap-2 text-[15px]">
                <span className="rounded bg-[var(--t-raised)] px-1.5 py-px text-[11px] text-[var(--t-text-2)]">Losing Days</span>
                <span className="font-semibold t-pnl-down">{stats.dayLose} days</span>
                <span className="text-[var(--t-text-2)]">({pct(stats.dayLose)}%)</span>
              </div>
            </div>
            <Donut win={stats.dayWin} lose={stats.dayLose} size={236} />
          </div>
        </section>
      </div>

      {/* Monthly ROI */}
      <section className="t-panel shrink-0 !p-6">
        <div className="flex items-center justify-between gap-3">
          <h2 className="t-h2">Monthly ROI</h2>
          <div className="flex items-center gap-1">
            <button type="button" onClick={() => setYear(stats.years[yearIdx - 1] ?? year - 1)} disabled={yearIdx <= 0} aria-label="Previous year" className="t-top-btn !h-7 !w-7 !rounded-md disabled:opacity-40">
              <ChevronLeft className="!h-4 !w-4" />
            </button>
            <span className="w-12 text-center text-[13px] font-semibold text-white">{year}</span>
            <button type="button" onClick={() => setYear(stats.years[yearIdx + 1] ?? year + 1)} disabled={yearIdx === -1 || yearIdx >= stats.years.length - 1} aria-label="Next year" className="t-top-btn !h-7 !w-7 !rounded-md disabled:opacity-40">
              <ChevronRight className="!h-4 !w-4" />
            </button>
          </div>
        </div>
        <div className="mt-5 grid grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-12">
          {stats.months.map((v, i) => (
            <div key={i} className="t-card flex flex-col items-center !px-2 !py-3">
              <div className="flex h-16 w-full items-end justify-center">
                <span className={cn('w-5 rounded-t-sm', v === null ? 'bg-[var(--t-raised-2)]' : v >= 0 ? 'bg-[var(--t-up)]' : 'bg-[var(--t-sell)]')} style={{ height: v === null ? 2 : Math.max(3, (Math.abs(v) / maxRoi) * 60) }} />
              </div>
              <span className={cn('mt-2 text-[13px] font-semibold', toneOf(v))}>{fmtRoi(v)}</span>
              <span className="text-[11px] text-[var(--t-muted)]">{MONTHS[i]}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
