'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  Crosshair, Minus, MoveUpRight, Ruler, Spline, TrendingUp, Type as TypeIcon,
  GitFork, Magnet, Trash2, Search, X, LineChart as LineIcon, CandlestickChart,
  BarChart3, AreaChart, ZoomIn, ZoomOut, Maximize2, Minimize2, FunctionSquare, ChevronDown,
} from 'lucide-react';
import { TF_NAME, TIMEFRAMES, WS_EVENTS, bucketStart, type CandleDto, type OrderDto, type PositionDto, type Timeframe, type WsCandle } from '@spova/shared';
import { get } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Spinner } from '@/components/ui';
import { useSocket } from '@/lib/ws';
import { quoteStore } from '@/components/trade/quote-store';
import { useSettings } from '@/components/trade/settings';
import type { SymbolSpec } from '@/components/trade/format';

// klinecharts types are loaded dynamically (client-only); keep a minimal local shape
type KChart = {
  applyNewData: (d: KBar[]) => void;
  updateData: (d: KBar) => void;
  createIndicator: (name: string, stack?: boolean, pane?: { id: string }) => string | null;
  removeIndicator: (paneId: string, name?: string) => void;
  createOverlay: (o: string | { name: string }) => string | null;
  removeOverlay: (f?: unknown) => void;
  setStyles: (s: unknown) => void;
  setPriceVolumePrecision: (p: number, v: number) => void;
  resize: () => void;
  setPaneOptions: (o: unknown) => void;
  zoomAtCoordinate: (scale: number) => void;
  getDataList: () => KBar[];
};
type KBar = { timestamp: number; open: number; high: number; low: number; close: number; volume?: number };

// ---- drawing tools (klinecharts built-in overlays) ----
const TOOLS: { key: string; overlay: string | null; icon: typeof Minus; title: string }[] = [
  { key: 'cursor', overlay: null, icon: Crosshair, title: 'Cursor' },
  { key: 'h', overlay: 'horizontalStraightLine', icon: Minus, title: 'Horizontal line' },
  { key: 'v', overlay: 'verticalStraightLine', icon: Ruler, title: 'Vertical line' },
  { key: 'trend', overlay: 'segment', icon: TrendingUp, title: 'Trend line' },
  { key: 'ray', overlay: 'rayLine', icon: MoveUpRight, title: 'Ray' },
  { key: 'line', overlay: 'straightLine', icon: Spline, title: 'Extended line' },
  { key: 'channel', overlay: 'parallelStraightLine', icon: GitFork, title: 'Parallel channel' },
  { key: 'fib', overlay: 'fibonacciLine', icon: FunctionSquare, title: 'Fibonacci retracement' },
  { key: 'price', overlay: 'priceLine', icon: TypeIcon, title: 'Price line' },
];

// ---- indicators (klinecharts built-ins) with friendly names ----
type Ind = { key: string; name: string; main: boolean };
const INDICATORS: Ind[] = [
  { key: 'MA', name: 'Moving Average', main: true },
  { key: 'EMA', name: 'Exponential Moving Average', main: true },
  { key: 'SMA', name: 'Smoothed Moving Average', main: true },
  { key: 'BOLL', name: 'Bollinger Bands', main: true },
  { key: 'SAR', name: 'Parabolic SAR', main: true },
  { key: 'BBI', name: 'Bull and Bear Index', main: true },
  { key: 'VOL', name: 'Volume', main: false },
  { key: 'MACD', name: 'MACD', main: false },
  { key: 'KDJ', name: 'KDJ Stochastic', main: false },
  { key: 'RSI', name: 'Relative Strength Index', main: false },
  { key: 'CCI', name: 'Commodity Channel Index', main: false },
  { key: 'DMI', name: 'Directional Movement Index', main: false },
  { key: 'WR', name: 'Williams %R', main: false },
  { key: 'BIAS', name: 'Bias Ratio', main: false },
  { key: 'BRAR', name: 'BRAR Sentiment', main: false },
  { key: 'CR', name: 'CR Energy', main: false },
  { key: 'PSY', name: 'Psychological Line', main: false },
  { key: 'DMA', name: 'Different of Moving Average', main: false },
  { key: 'TRIX', name: 'TRIX Triple EMA', main: false },
  { key: 'OBV', name: 'On Balance Volume', main: false },
  { key: 'VR', name: 'Volume Ratio', main: false },
  { key: 'MTM', name: 'Momentum', main: false },
  { key: 'EMV', name: 'Ease of Movement', main: false },
  { key: 'ROC', name: 'Rate of Change', main: false },
  { key: 'PVT', name: 'Price Volume Trend', main: false },
  { key: 'AO', name: 'Awesome Oscillator', main: false },
];

const CHART_TYPES: { key: string; icon: typeof CandlestickChart; title: string }[] = [
  { key: 'candle_solid', icon: CandlestickChart, title: 'Candles' },
  { key: 'candle_stroke', icon: LineIcon, title: 'Hollow candles' },
  { key: 'ohlc', icon: BarChart3, title: 'Bars' },
  { key: 'area', icon: AreaChart, title: 'Area' },
];

const toBar = (c: CandleDto): KBar => ({ timestamp: c.t * 1000, open: +c.o, high: +c.h, low: +c.l, close: +c.c, volume: c.v ?? 0 });

function stylesFor(dark: boolean) {
  const grid = dark ? '#1b2436' : '#eef2f7';
  const text = dark ? '#8a93a6' : '#64748b';
  const axis = dark ? '#2a3550' : '#e2e8f0';
  const up = '#16c784';
  const down = '#ea3943';
  return {
    grid: { horizontal: { color: grid }, vertical: { color: grid } },
    candle: {
      bar: { upColor: up, downColor: down, noChangeColor: text, upBorderColor: up, downBorderColor: down, upWickColor: up, downWickColor: down },
      priceMark: { high: { color: text }, low: { color: text }, last: { line: { color: '#2563eb' }, text: { color: '#fff' } } },
      tooltip: { text: { color: text } },
    },
    indicator: { tooltip: { text: { color: text } } },
    xAxis: { axisLine: { color: axis }, tickText: { color: text }, tickLine: { color: axis } },
    yAxis: { axisLine: { color: axis }, tickText: { color: text }, tickLine: { color: axis } },
    crosshair: { horizontal: { line: { color: text }, text: { backgroundColor: '#2563eb' } }, vertical: { line: { color: text }, text: { backgroundColor: '#2563eb' } } },
    separator: { color: axis },
  };
}

export function KLineChart({ spec, positions, orders, className, footer }: { spec: SymbolSpec; positions?: PositionDto[]; orders?: OrderDto[]; className?: string; footer?: ReactNode }) {
  const { theme } = useSettings();
  const dark = theme !== 'light';
  const holder = useRef<HTMLDivElement>(null);
  const chartRef = useRef<KChart | null>(null);
  const kcRef = useRef<typeof import('klinecharts') | null>(null);
  const barsRef = useRef<KBar[]>([]);
  const posOverlays = useRef<string[]>([]);
  const { socket } = useSocket();

  const [tf, setTf] = useState<Timeframe>('h1');
  const [chartType, setChartType] = useState('candle_solid');
  const [tool, setTool] = useState('cursor');
  const [indPanel, setIndPanel] = useState(false);
  const [search, setSearch] = useState('');
  const [active, setActive] = useState<Record<string, string>>({}); // indicator key -> paneId
  const [loading, setLoading] = useState(true);
  const [fs, setFs] = useState(false);
  const [ready, setReady] = useState(false);

  // init chart once
  useEffect(() => {
    let disposed = false;
    let ro: ResizeObserver | null = null;
    void (async () => {
      const kc = await import('klinecharts');
      if (disposed || !holder.current) return;
      kcRef.current = kc;
      const chart = kc.init(holder.current, { styles: stylesFor(dark) as never }) as unknown as KChart;
      chartRef.current = chart;
      chart.setPriceVolumePrecision(spec.digits ?? 2, 0);
      try { chart.setPaneOptions({ id: 'candle_pane', gap: { top: 0.22, bottom: 0.1 } }); } catch { /* older api */ }
      setReady(true);
      ro = new ResizeObserver(() => chart.resize());
      ro.observe(holder.current);
    })();
    return () => {
      disposed = true;
      setReady(false);
      ro?.disconnect();
      if (holder.current && kcRef.current) kcRef.current.dispose(holder.current);
      chartRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // theme + precision updates
  useEffect(() => {
    chartRef.current?.setStyles(stylesFor(dark) as never);
  }, [dark]);
  useEffect(() => {
    chartRef.current?.setPriceVolumePrecision(spec.digits ?? 2, 0);
  }, [spec.digits]);

  // load history on symbol / timeframe change (waits for the chart to finish its async init -> `ready`)
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart || !ready) return;
    let alive = true;
    setLoading(true);
    // fewer bars on phones keeps the canvas light and scrolling smooth
    const limit = typeof window !== 'undefined' && window.innerWidth < 1024 ? 220 : 500;
    get<CandleDto[]>(`/market/candles/${spec.id}?tf=${tf}&limit=${limit}`)
      .then((rows) => {
        if (!alive) return;
        barsRef.current = rows.map(toBar);
        chart.applyNewData(barsRef.current);
        setLoading(false);
      })
      .catch(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [spec.id, tf, ready]);

  // live last-candle updates from quote ticks
  useEffect(() => {
    const unsub = quoteStore.subscribe(spec.id, () => {
      const chart = chartRef.current;
      const q = quoteStore.get(spec.id);
      if (!chart || !q || !q.bid || !q.ask || q.stale) return;
      const mid = (Number(q.bid) + Number(q.ask)) / 2;
      const t = bucketStart(q.ts, tf) * 1000;
      const list = barsRef.current;
      const prev = list[list.length - 1];
      let bar: KBar;
      if (prev && prev.timestamp === t) bar = { ...prev, high: Math.max(prev.high, mid), low: Math.min(prev.low, mid), close: mid };
      else if (!prev || t > prev.timestamp) bar = { timestamp: t, open: mid, high: mid, low: mid, close: mid, volume: 0 };
      else return;
      if (prev && prev.timestamp === t) list[list.length - 1] = bar;
      else list.push(bar);
      chart.updateData(bar);
    });
    return unsub;
  }, [spec.id, tf]);

  // authoritative candle closes over the socket
  useEffect(() => {
    if (!socket) return;
    const onCandle = (c: WsCandle) => {
      if (c.s !== spec.id || c.tf !== tf) return;
      const bar = toBar(c);
      const list = barsRef.current;
      const prev = list[list.length - 1];
      if (prev && prev.timestamp === bar.timestamp) list[list.length - 1] = bar;
      else if (!prev || bar.timestamp > prev.timestamp) list.push(bar);
      chartRef.current?.updateData(bar);
    };
    socket.on(WS_EVENTS.CANDLE, onCandle);
    return () => {
      socket.off(WS_EVENTS.CANDLE, onCandle);
    };
  }, [socket, spec.id, tf]);

  // open-position entry lines (+ TP/SL) for this symbol, drawn as locked horizontal lines on the chart
  const mine = (positions ?? []).filter((p) => p.symbol === spec.id);
  const myOrders = (orders ?? []).filter((o) => o.symbol === spec.id && o.price);
  const mineKey = mine.map((p) => `${p.id}:${p.openPrice}:${p.sl ?? ''}:${p.tp ?? ''}`).join('|') + '#' + myOrders.map((o) => `${o.id}:${o.price}:${o.side}`).join('|');
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    for (const id of posOverlays.current) chart.removeOverlay(id);
    posOverlays.current = [];
    for (const p of mine) {
      const color = p.side === 'buy' ? '#16c784' : '#ea3943';
      const entry = chart.createOverlay({ name: 'priceLine', id: `pos-${p.id}`, points: [{ value: Number(p.openPrice) }], lock: true, styles: { line: { color, style: 'solid', size: 1 }, text: { color } } } as unknown as string);
      if (typeof entry === 'string') posOverlays.current.push(entry);
      if (p.tp) { const o = chart.createOverlay({ name: 'priceLine', id: `tp-${p.id}`, points: [{ value: Number(p.tp) }], lock: true, styles: { line: { color: '#16c784', style: 'dashed', size: 1 }, text: { color: '#16c784' } } } as unknown as string); if (typeof o === 'string') posOverlays.current.push(o); }
      if (p.sl) { const o = chart.createOverlay({ name: 'priceLine', id: `sl-${p.id}`, points: [{ value: Number(p.sl) }], lock: true, styles: { line: { color: '#ea3943', style: 'dashed', size: 1 }, text: { color: '#ea3943' } } } as unknown as string); if (typeof o === 'string') posOverlays.current.push(o); }
    }
    for (const o of myOrders) {
      const color = o.side === 'buy' ? '#2563eb' : '#f59e0b';
      const ov = chart.createOverlay({ name: 'priceLine', id: `ord-${o.id}`, points: [{ value: Number(o.price) }], lock: true, styles: { line: { color, style: 'dashed', size: 1 }, text: { color } } } as unknown as string);
      if (typeof ov === 'string') posOverlays.current.push(ov);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spec.id, mineKey, loading]);

  const pickTool = (t: (typeof TOOLS)[number]) => {
    setTool(t.key);
    if (t.overlay) chartRef.current?.createOverlay({ name: t.overlay });
  };

  const toggleIndicator = (ind: Ind) => {
    const chart = chartRef.current;
    if (!chart) return;
    if (active[ind.key]) {
      chart.removeIndicator(active[ind.key], ind.key);
      setActive((a) => {
        const n = { ...a };
        delete n[ind.key];
        return n;
      });
    } else {
      const paneId = chart.createIndicator(ind.key, ind.main, ind.main ? { id: 'candle_pane' } : undefined);
      if (paneId) setActive((a) => ({ ...a, [ind.key]: paneId }));
    }
  };

  const applyType = (t: string) => {
    setChartType(t);
    chartRef.current?.setStyles({ candle: { type: t } } as never);
  };

  const clearDrawings = () => chartRef.current?.removeOverlay();

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? INDICATORS.filter((i) => i.name.toLowerCase().includes(q) || i.key.toLowerCase().includes(q)) : INDICATORS;
  }, [search]);

  return (
    <section className={cn('t-panel overflow-hidden', fs && 'fixed inset-0 z-[70] rounded-none', className)} aria-label={`${spec.id} chart`}>
      {/* top toolbar */}
      <div className="t-bar flex-wrap gap-1">
        <div className="flex items-center gap-0.5">
          {(['m5', 'm15', 'm30', 'h1', 'h4', 'd1', 'w1'] as Timeframe[]).map((t) => (
            <button key={t} type="button" onClick={() => setTf(t)} data-on={tf === t} className="t-tab !h-7 !px-2 !text-[12px]">
              {TF_NAME[t]}
            </button>
          ))}
          <TfMore current={tf} onPick={setTf} />
        </div>
        <div className="mx-1 h-5 w-px bg-[var(--t-line)]" />
        <button type="button" onClick={() => setIndPanel((v) => !v)} data-on={indPanel} className="t-icon-btn" title="Indicators">
          <FunctionSquare />
        </button>
        <div className="flex items-center gap-0.5">
          {CHART_TYPES.map((c) => (
            <button key={c.key} type="button" onClick={() => applyType(c.key)} data-on={chartType === c.key} className="t-icon-btn" title={c.title}>
              <c.icon />
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-0.5">
          <button type="button" onClick={() => chartRef.current?.zoomAtCoordinate(1.3)} className="t-icon-btn" title="Zoom in"><ZoomIn /></button>
          <button type="button" onClick={() => chartRef.current?.zoomAtCoordinate(0.7)} className="t-icon-btn" title="Zoom out"><ZoomOut /></button>
          <button type="button" onClick={() => setFs((v) => !v)} className="t-icon-btn" title="Fullscreen">{fs ? <Minimize2 /> : <Maximize2 />}</button>
        </div>
      </div>

      <div className="relative flex min-h-0 flex-1">
        {/* left drawing toolbar */}
        <div className="flex w-10 shrink-0 flex-col items-center gap-0.5 border-r border-[var(--t-line)] py-1.5">
          {TOOLS.map((t) => (
            <button key={t.key} type="button" onClick={() => pickTool(t)} data-on={tool === t.key} className="t-icon-btn !h-8 !w-8" title={t.title}>
              <t.icon />
            </button>
          ))}
          <div className="my-0.5 h-px w-5 bg-[var(--t-line)]" />
          <button type="button" onClick={clearDrawings} className="t-icon-btn !h-8 !w-8 text-[var(--t-sell)]" title="Remove all drawings">
            <Trash2 />
          </button>
        </div>

        {/* chart canvas */}
        <div className="relative min-w-0 flex-1">
          <div ref={holder} className="absolute inset-0" />
          {loading && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-[var(--t-bg)]/40">
              <Spinner />
            </div>
          )}
        </div>

        {/* indicator panel */}
        {indPanel && (
          <div className="absolute right-0 top-0 z-20 flex h-full w-[300px] max-w-[85%] flex-col border-l border-[var(--t-line)] bg-[var(--t-raised)] shadow-xl">
            <div className="flex items-center justify-between px-3 py-2.5">
              <span className="text-[13px] font-semibold text-white">Add Indicator</span>
              <button type="button" onClick={() => setIndPanel(false)} className="t-icon-btn !h-7 !w-7"><X /></button>
            </div>
            <div className="px-3 pb-2">
              <div className="flex items-center gap-2 rounded-lg bg-[var(--t-bg)] px-2.5 py-1.5">
                <Search className="h-3.5 w-3.5 text-[var(--t-muted)]" />
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search" className="w-full bg-transparent text-[13px] text-white outline-none placeholder:text-[var(--t-muted)]" />
                {search && <button type="button" onClick={() => setSearch('')}><X className="h-3.5 w-3.5 text-[var(--t-muted)]" /></button>}
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-1.5 pb-2">
              <div className="px-1.5 py-1 text-[11px] uppercase tracking-wider text-[var(--t-muted)]">Indicator name</div>
              {filtered.map((ind) => (
                <button key={ind.key} type="button" onClick={() => toggleIndicator(ind)} className={cn('flex w-full items-center justify-between rounded-md px-2.5 py-2 text-left text-[13px] hover:bg-white/[0.05]', active[ind.key] ? 'text-[var(--t-blue)]' : 'text-[var(--t-text)]')}>
                  <span>{ind.name}</span>
                  {active[ind.key] && <span className="text-[11px]">✓</span>}
                </button>
              ))}
              {filtered.length === 0 && <div className="px-2.5 py-3 text-[12px] text-[var(--t-muted)]">No indicator found.</div>}
            </div>
          </div>
        )}
      </div>
      {footer}
    </section>
  );
}

function TfMore({ current, onPick }: { current: Timeframe; onPick: (t: Timeframe) => void }) {
  const [open, setOpen] = useState(false);
  const extra = TIMEFRAMES.filter((t) => !['m5', 'm15', 'm30', 'h1', 'h4', 'd1', 'w1'].includes(t));
  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen((v) => !v)} data-on={extra.includes(current)} className="t-tab !h-7 !px-1.5 !text-[12px]">
        {extra.includes(current) ? TF_NAME[current] : ''}
        <ChevronDown className="h-3 w-3" />
      </button>
      {open && (
        <div className="absolute left-0 top-8 z-30 rounded-lg border border-[var(--t-raised-2)] bg-[var(--t-menu)] p-1 shadow-xl">
          {extra.map((t) => (
            <button key={t} type="button" onClick={() => { onPick(t); setOpen(false); }} className="block w-full rounded px-4 py-1.5 text-left text-[12px] text-[var(--t-text)] hover:bg-white/[0.06]">
              {TF_NAME[t]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
