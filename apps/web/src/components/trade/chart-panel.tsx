'use client';

import { useEffect, useRef, useState } from 'react';
import { CandlestickChart, Clock3 } from 'lucide-react';
import { CandlestickSeries, ColorType, CrosshairMode, LineStyle, createChart, type CandlestickData, type IChartApi, type IPriceLine, type ISeriesApi, type UTCTimestamp } from 'lightweight-charts';
import { TF_LABEL, TIMEFRAMES, WS_EVENTS, bucketStart, type CandleDto, type PositionDto, type Timeframe, type WsCandle } from '@spova/shared';
import { get } from '@/lib/api';
import { useSocket } from '@/lib/ws';
import { cn } from '@/lib/utils';
import { marketByCls } from '@/lib/markets';
import { Badge, Spinner } from '@/components/ui';
import { fmtPrice, spreadPoints, type SymbolSpec } from './format';
import { quoteStore, useQuote } from './quote-store';

const UP = '#15803d';
const DOWN = '#dc2626';

type Bar = CandlestickData<UTCTimestamp>;
const toBar = (c: CandleDto): Bar => ({ time: c.t as UTCTimestamp, open: Number(c.o), high: Number(c.h), low: Number(c.l), close: Number(c.c) });

/** Symbol name, live bid/ask, spread, % change and state badges above the chart. */
function SymbolStrip({ spec }: { spec: SymbolSpec }) {
  const q = useQuote(spec.id);
  const has = !!q && !!q.bid && !!q.ask;
  const closed = q?.open === false || !spec.isOpen;
  const mid = has ? (Number(q.bid) + Number(q.ask)) / 2 : null;
  const change = mid !== null && q?.ref ? ((mid - q.ref) / q.ref) * 100 : null;
  const meta = marketByCls(spec.assetClass);
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
      <div className="flex items-center gap-2">
        <span className="h-2 w-2 rotate-45" style={{ background: `rgb(${meta?.rgb ?? '15 23 42'})` }} />
        <span className="font-display text-base font-bold leading-none text-white">{spec.id}</span>
        <span className="hidden max-w-[160px] truncate text-[11px] text-ink-500 md:inline">{spec.name}</span>
      </div>
      {has ? (
        <div key={q.n} className={cn('tabular flex items-baseline gap-1.5 font-mono text-sm', q.dir === 'up' && 'animate-flash-up', q.dir === 'down' && 'animate-flash-down')}>
          <span className="text-down">{fmtPrice(q.bid, spec.digits)}</span>
          <span className="text-ink-500">/</span>
          <span className="text-up">{fmtPrice(q.ask, spec.digits)}</span>
          <span className="ml-1 text-[10px] text-ink-500">spread {spreadPoints(q.bid, q.ask, spec.digits)}</span>
        </div>
      ) : (
        <span className="font-mono text-sm text-ink-500">— / —</span>
      )}
      {change !== null && <span className={cn('tabular font-mono text-[11px]', change > 0 ? 'text-up' : change < 0 ? 'text-down' : 'text-ink-400')}>{`${change > 0 ? '+' : ''}${change.toFixed(2)}%`}</span>}
      {closed ? <Badge tone="neutral">Market closed</Badge> : !has || q.stale ? <Badge tone="warning">No live price</Badge> : null}
    </div>
  );
}

/**
 * Candlestick chart: REST history, then `candle` events (update or append the last bar) and `tick`
 * events (move the live bar's close/high/low). Price lines mark open positions on this symbol.
 */
export function ChartPanel({ spec, tf, onTf, positions, className }: { spec: SymbolSpec; tf: Timeframe; onTf: (tf: Timeframe) => void; positions: PositionDto[]; className?: string }) {
  const host = useRef<HTMLDivElement>(null);
  const chart = useRef<IChartApi | null>(null);
  const series = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const last = useRef<Bar | null>(null);
  const lines = useRef<IPriceLine[]>([]);
  const [state, setState] = useState<'loading' | 'empty' | 'ready' | 'error'>('loading');
  const [bars, setBars] = useState(0);
  const { socket } = useSocket();

  // chart lifecycle: one instance per mount, resized with its container
  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const c = createChart(el, {
      autoSize: false,
      width: el.clientWidth,
      height: el.clientHeight,
      layout: { background: { type: ColorType.Solid, color: '#ffffff' }, textColor: '#6b778f', fontFamily: 'var(--ff-mono), ui-monospace, monospace', fontSize: 11, attributionLogo: false },
      grid: { vertLines: { color: 'rgba(15, 23, 42, 0.05)' }, horzLines: { color: 'rgba(15, 23, 42, 0.05)' } },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: 'rgba(37, 99, 235, 0.45)', labelBackgroundColor: '#2563eb', width: 1, style: LineStyle.Dashed },
        horzLine: { color: 'rgba(37, 99, 235, 0.45)', labelBackgroundColor: '#2563eb', width: 1, style: LineStyle.Dashed },
      },
      rightPriceScale: { borderColor: 'rgba(15, 23, 42, 0.1)', scaleMargins: { top: 0.08, bottom: 0.08 } },
      timeScale: { borderColor: 'rgba(15, 23, 42, 0.1)', timeVisible: true, secondsVisible: false, rightOffset: 4, barSpacing: 8 },
      handleScroll: true,
      handleScale: true,
      localization: { locale: 'en-GB' },
    });
    chart.current = c;
    const ro = new ResizeObserver(() => {
      if (el.clientWidth > 0 && el.clientHeight > 0) c.applyOptions({ width: el.clientWidth, height: el.clientHeight });
    });
    ro.observe(el);
    return () => {
      ro.disconnect();
      c.remove();
      chart.current = null;
      series.current = null;
    };
  }, []);

  // one series per symbol (price precision is per instrument) + history for the timeframe
  useEffect(() => {
    const c = chart.current;
    if (!c) return;
    if (series.current) c.removeSeries(series.current);
    lines.current = [];
    last.current = null;
    const s = c.addSeries(CandlestickSeries, {
      upColor: UP,
      downColor: DOWN,
      borderVisible: false,
      wickUpColor: UP,
      wickDownColor: DOWN,
      priceFormat: { type: 'price', precision: spec.digits, minMove: Math.pow(10, -spec.digits) },
      priceLineColor: '#2563eb',
      priceLineStyle: LineStyle.Dotted,
    });
    series.current = s;
    setState('loading');
    setBars(0);
    let alive = true;
    get<CandleDto[]>(`/market/candles/${spec.id}?tf=${tf}&limit=500`)
      .then((rows) => {
        if (!alive || series.current !== s) return;
        const data = rows.map(toBar);
        s.setData(data);
        last.current = data[data.length - 1] ?? null;
        setBars(data.length);
        setState(data.length ? 'ready' : 'empty');
        c.timeScale().fitContent();
      })
      .catch(() => alive && setState('error'));
    return () => {
      alive = false;
    };
  }, [spec.id, spec.digits, tf]);

  // previous daily close -> base of the % change in the watchlist / strip
  useEffect(() => {
    let alive = true;
    get<CandleDto[]>(`/market/candles/${spec.id}?tf=d1&limit=2`)
      .then((rows) => {
        if (!alive || rows.length === 0) return;
        const ref = rows.length >= 2 ? Number(rows[rows.length - 2].c) : Number(rows[0].o);
        if (Number.isFinite(ref) && ref > 0) quoteStore.setRef(spec.id, ref);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [spec.id]);

  // live bars from the worker and from raw ticks
  useEffect(() => {
    const push = (bar: Bar) => {
      const s = series.current;
      if (!s) return;
      const prev = last.current;
      if (prev && bar.time < prev.time) return; // out of order: ignore
      s.update(bar);
      last.current = bar;
      setBars((n) => (prev && prev.time === bar.time ? n : n + 1));
      setState((st) => (st === 'empty' || st === 'loading' ? 'ready' : st));
    };
    const onCandle = (c: WsCandle) => {
      if (c.s !== spec.id || c.tf !== tf) return;
      push(toBar(c));
    };
    const unsubTick = quoteStore.subscribe(spec.id, () => {
      const q = quoteStore.get(spec.id);
      if (!q || !q.bid || !q.ask || q.stale) return;
      const mid = (Number(q.bid) + Number(q.ask)) / 2;
      const t = bucketStart(q.ts, tf) as UTCTimestamp;
      const prev = last.current;
      if (prev && prev.time === t) push({ time: t, open: prev.open, high: Math.max(prev.high, mid), low: Math.min(prev.low, mid), close: mid });
      else if (!prev || t > prev.time) push({ time: t, open: mid, high: mid, low: mid, close: mid });
    });
    socket?.on(WS_EVENTS.CANDLE, onCandle);
    return () => {
      unsubTick();
      socket?.off(WS_EVENTS.CANDLE, onCandle);
    };
  }, [socket, spec.id, tf]);

  // entry / SL / TP lines for open positions on this symbol
  useEffect(() => {
    const s = series.current;
    if (!s) return;
    lines.current.forEach((l) => s.removePriceLine(l));
    lines.current = [];
    positions
      .filter((p) => p.symbol === spec.id && p.status === 'open')
      .forEach((p) => {
        const color = p.side === 'buy' ? UP : DOWN;
        const title = `${p.side === 'buy' ? 'Buy' : 'Sell'} ${p.lots}`;
        lines.current.push(s.createPriceLine({ price: Number(p.openPrice), color, lineWidth: 1, lineStyle: LineStyle.Solid, axisLabelVisible: true, title }));
        if (p.sl) lines.current.push(s.createPriceLine({ price: Number(p.sl), color: DOWN, lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: 'SL' }));
        if (p.tp) lines.current.push(s.createPriceLine({ price: Number(p.tp), color: UP, lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: 'TP' }));
      });
  }, [positions, spec.id, tf, state]);

  return (
    <section className={cn('flex min-h-0 min-w-0 flex-col bg-paper', className)}>
      <div className="flex min-h-11 shrink-0 flex-wrap items-center justify-between gap-x-4 gap-y-1.5 border-b border-white/[0.06] px-3 py-1.5 sm:px-4">
        <SymbolStrip spec={spec} />
        <div role="tablist" aria-label="Timeframe" className="flex rounded-lg border border-white/[0.08] bg-white/[0.03] p-0.5">
          {TIMEFRAMES.map((t) => (
            <button
              key={t}
              role="tab"
              aria-selected={t === tf}
              onClick={() => onTf(t)}
              className={cn('rounded-md px-2 py-1 font-mono text-[11px] transition-colors duration-200', t === tf ? 'bg-brand-400/10 text-brand-300 ring-1 ring-inset ring-brand-400/30' : 'text-ink-500 hover:text-ink-100')}
            >
              {TF_LABEL[t]}
            </button>
          ))}
        </div>
      </div>
      <div className="relative min-h-0 flex-1">
        <div ref={host} className="absolute inset-0" />
        {state === 'loading' && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-paper/60">
            <Spinner />
          </div>
        )}
        {state === 'empty' && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="bg-dots flex flex-col items-center gap-2 rounded-2xl border border-dashed border-white/10 bg-paper/80 px-8 py-6 text-center">
              <Clock3 className="h-5 w-5 text-ink-500" />
              <div className="text-sm font-semibold text-ink-200">Waiting for the first ticks</div>
              <div className="text-xs text-ink-500">No {TF_LABEL[tf]} history for {spec.id} yet. Bars will build as prices arrive.</div>
            </div>
          </div>
        )}
        {state === 'error' && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="flex flex-col items-center gap-2 rounded-2xl border border-down/20 bg-down/[0.04] px-8 py-6 text-center">
              <CandlestickChart className="h-5 w-5 text-down" />
              <div className="text-sm font-semibold text-ink-200">Could not load the chart</div>
              <div className="text-xs text-ink-500">Check your connection; live bars will still appear.</div>
            </div>
          </div>
        )}
        <div className="pointer-events-none absolute bottom-7 left-3 font-mono text-[10px] text-ink-500">
          {spec.id} · {TF_LABEL[tf]} · {bars} bars
        </div>
      </div>
    </section>
  );
}
