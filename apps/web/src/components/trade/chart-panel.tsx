'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AlarmClock, Bell, ChartArea, ChartCandlestick, ChartColumn, ChartLine, Check, Clock3, Cloud, Crosshair, Eye, Layers, Magnet, Maximize, Minimize2, Minus, PencilLine, Ruler, Save, Settings, Spline, Square, SquareFunction, Trash2, Type, Volume2, X, ZoomIn, ZoomOut } from 'lucide-react';
import {
  AreaSeries,
  BarSeries,
  CandlestickSeries,
  ColorType,
  CrosshairMode,
  HistogramSeries,
  LineSeries,
  LineStyle,
  TickMarkType,
  createChart,
  type IChartApi,
  type IPriceLine,
  type ISeriesApi,
  type MouseEventParams,
  type SeriesType,
  type Time,
  type UTCTimestamp,
} from 'lightweight-charts';
import { TF_NAME, TF_SECONDS, TIMEFRAMES, WS_EVENTS, bucketStart, type CandleDto, type PositionDto, type WsCandle } from '@spova/shared';
import { get } from '@/lib/api';
import { useSocket } from '@/lib/ws';
import { cn } from '@/lib/utils';
import { Spinner } from '@/components/ui';
import { fmtDuration, fmtLots, fmtNum, fmtPrice, fmtSignedNum, type SymbolSpec } from './format';
import { quoteStore, useQuote } from './quote-store';
import { livePnl, useFloatingTotal } from './pnl';
import { Dropdown, SymbolTile, ToggleRow } from './bits';
import { addAlert, pickTemplate, removeAlert, settingsStore, TEMPLATE_NAMES, templatesStore, useAlerts, useSettings, useTemplates, type ChartType } from './settings';

/** Chart colours come from the terminal theme tokens (see globals.css); refreshed when the theme switches. */
const P = { up: '#3fd0c0', down: '#f0556d', volUp: '#1f6867', volDown: '#893c4d', blue: '#2ac3ed', bg: '#20252c', muted: '#858c99', grid: 'rgba(255,255,255,0.045)', cross: 'rgba(186,195,210,0.4)', dimBg: '#4b5868', text2: '#9ea7b5', sl: '#c251bf', tp: '#80c251', alert: '#f5a524' };
function readPalette(el: HTMLElement) {
  const cs = getComputedStyle(el);
  const v = (name: string, fallback: string) => cs.getPropertyValue(name).trim() || fallback;
  P.up = v('--t-chart-up', P.up);
  P.down = v('--t-chart-down', P.down);
  P.volUp = v('--t-vol-up', P.volUp);
  P.volDown = v('--t-vol-down', P.volDown);
  P.blue = v('--t-blue', P.blue);
  P.bg = v('--t-bg', P.bg);
  P.muted = v('--t-muted', P.muted);
  P.grid = v('--t-chart-grid', P.grid);
  P.cross = v('--t-chart-cross', P.cross);
  P.dimBg = v('--t-dim-bg', P.dimBg);
  P.text2 = v('--t-text-2', P.text2);
  P.sl = v('--t-sl', P.sl);
  P.tp = v('--t-tp', P.tp);
  P.alert = v('--t-alert', P.alert);
}
const chartTheme = () => ({
  layout: { background: { type: ColorType.Solid, color: P.bg }, textColor: P.muted },
  grid: { vertLines: { color: P.grid }, horzLines: { color: P.grid } },
  crosshair: { vertLine: { color: P.cross, labelBackgroundColor: P.dimBg }, horzLine: { color: P.cross, labelBackgroundColor: P.dimBg } },
});
const seriesColors = (type: ChartType) =>
  type === 'line' ? { color: P.blue } : type === 'area' ? { lineColor: P.blue, topColor: hexAlpha(P.blue, 0.28), bottomColor: hexAlpha(P.blue, 0.02) } : type === 'bars' ? { upColor: P.up, downColor: P.down } : { upColor: P.up, downColor: P.down, wickUpColor: P.up, wickDownColor: P.down };
const hexAlpha = (hex: string, a: number) => (/^#[0-9a-f]{6}$/i.test(hex) ? `rgba(${parseInt(hex.slice(1, 3), 16)}, ${parseInt(hex.slice(3, 5), 16)}, ${parseInt(hex.slice(5, 7), 16)}, ${a})` : hex);

interface Bar {
  time: UTCTimestamp;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}
type Tool = 'crosshair' | 'measure' | 'hline';
type MainSeries = ISeriesApi<SeriesType>;

const toBar = (c: CandleDto): Bar => ({ time: c.t as UTCTimestamp, open: Number(c.o), high: Number(c.h), low: Number(c.l), close: Number(c.c), volume: Number(c.v ?? 0) });
/** OHLC bar icon (lucide only has column/candle charts): vertical bar, open tick left, close tick right. */
function OhlcBarsIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M8 3v18M5 9h3M8 15h3M16 5v16M13 11h3M16 17h3" />
    </svg>
  );
}

const mainData = (bars: Bar[], type: ChartType) => (type === 'line' || type === 'area' ? bars.map((b) => ({ time: b.time, value: b.close })) : bars.map(({ time, open, high, low, close }) => ({ time, open, high, low, close })));
const volPoint = (b: Bar) => ({ time: b.time, value: b.volume, color: b.close >= b.open ? P.volUp : P.volDown });

const sma = (bars: Bar[], n: number) => {
  const out: { time: UTCTimestamp; value: number }[] = [];
  let sum = 0;
  for (let i = 0; i < bars.length; i++) {
    sum += bars[i].close;
    if (i >= n) sum -= bars[i - n].close;
    if (i >= n - 1) out.push({ time: bars[i].time, value: sum / n });
  }
  return out;
};
const bollinger = (bars: Bar[], n = 20, k = 2) => {
  const upper: { time: UTCTimestamp; value: number }[] = [];
  const mid: { time: UTCTimestamp; value: number }[] = [];
  const lower: { time: UTCTimestamp; value: number }[] = [];
  for (let i = n - 1; i < bars.length; i++) {
    const win = bars.slice(i - n + 1, i + 1).map((b) => b.close);
    const m = win.reduce((a, b) => a + b, 0) / n;
    const sd = Math.sqrt(win.reduce((a, b) => a + (b - m) ** 2, 0) / n);
    upper.push({ time: bars[i].time, value: m + k * sd });
    mid.push({ time: bars[i].time, value: m });
    lower.push({ time: bars[i].time, value: m - k * sd });
  }
  return { upper, mid, lower };
};
const last = <T,>(xs: T[]) => xs[xs.length - 1];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** "6 Oct" on day boundaries, "16:00" inside a day (UTC), like the reference axis. */
const tickMarkFormatter = (time: Time, type: TickMarkType) => {
  const d = new Date((time as number) * 1000);
  if (type === TickMarkType.Year) return String(d.getUTCFullYear());
  if (type === TickMarkType.Month) return MONTHS[d.getUTCMonth()];
  if (type === TickMarkType.DayOfMonth) return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
  return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
};

function Clock() {
  const [now, setNow] = useState<string>('--:--:--');
  useEffect(() => {
    const tick = () => setNow(new Date().toISOString().slice(11, 19));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <span className="hidden items-center gap-1.5 whitespace-nowrap text-[13px] text-[var(--t-text-2)] xl:inline-flex">
      <Clock3 className="h-3.5 w-3.5 text-[var(--t-muted)]" /> {now} (UTC +0)
    </span>
  );
}

function ToolbarBtn({ icon, title, on, onClick, disabled, className }: { icon: ReactNode; title: string; on?: boolean; onClick?: () => void; disabled?: boolean; className?: string }) {
  return (
    <button type="button" title={title} aria-label={title} aria-pressed={on} data-on={on} disabled={disabled} onClick={onClick} className={cn('t-icon-btn', className)}>
      {icon}
    </button>
  );
}

function SymbolPnlBadge({ spec, positions }: { spec: SymbolSpec; positions: PositionDto[] }) {
  const symbols = useMemo(() => new Map([[spec.id, spec]]), [spec]);
  const total = useFloatingTotal(positions, symbols, (p) => p.symbol === spec.id);
  if (total === null) return null;
  return <span className={cn('rounded px-1.5 py-0.5 text-[12px] font-semibold', total >= 0 ? 'bg-[var(--t-pos-bg)] text-[var(--t-pos-text)]' : 'bg-[var(--t-neg-bg)] text-[var(--t-neg-text)]')}>{fmtNum(total)}</span>;
}

/** Alert menu: one-shot price alerts for this symbol (localStorage). */
function AlertMenu({ spec }: { spec: SymbolSpec }) {
  const alerts = useAlerts();
  const q = useQuote(spec.id);
  const mine = alerts.items.filter((a) => a.symbol === spec.id);
  const [price, setPrice] = useState('');
  const valid = /^\d{1,12}(\.\d{1,6})?$/.test(price) && Number(price) > 0;
  const seedPrice = () => {
    if (!price && q?.bid && q?.ask) setPrice(((Number(q.bid) + Number(q.ask)) / 2).toFixed(spec.digits));
  };
  return (
    <Dropdown title="Price alerts" align="right" onOpenChange={(o) => o && seedPrice()} buttonClassName={cn('t-icon-btn relative', mine.length > 0 && '!text-[var(--t-alert)]')} button={() => <>{mine.length ? <Bell /> : <AlarmClock />}{mine.length > 0 && <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-[var(--t-alert)]" />}</>}>
      {() => (
        <div className="w-64">
          <div className="t-menu-label">Alert on {spec.id}</div>
          <form
            className="flex items-center gap-1.5 px-2 pb-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (!valid) return;
              addAlert(spec.id, Number(price).toFixed(spec.digits));
              setPrice('');
            }}
          >
            <input value={price} onChange={(e) => setPrice(e.target.value.replace(/[^\d.]/g, ''))} inputMode="decimal" placeholder="Price" aria-label="Alert price" className="t-input !h-8 flex-1" />
            <button type="submit" disabled={!valid} className="t-btn t-btn-blue !h-8 !px-3">
              Add
            </button>
          </form>
          {mine.length === 0 ? (
            <div className="px-2.5 pb-2 text-[11px] text-[var(--t-muted)]">Fires once when the mid price crosses the level: a toast plus a sound.</div>
          ) : (
            <ul className="max-h-48 overflow-y-auto">
              {mine.map((a) => (
                <li key={a.id} className="flex items-center gap-2 px-2.5 py-1.5 text-[12px]">
                  <span className="h-2 w-2 rounded-full bg-[var(--t-alert)]" />
                  <span className="flex-1 font-medium text-white">{fmtPrice(a.price, spec.digits)}</span>
                  <button type="button" onClick={() => removeAlert(a.id)} aria-label="Remove alert" className="t-icon-btn !h-6 !w-6">
                    <X className="!h-3.5 !w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Dropdown>
  );
}

function TemplateMenu() {
  const t = useTemplates();
  const s = useSettings();
  return (
    <Dropdown
      title="Chart templates"
      align="right"
      buttonClassName="t-icon-btn !w-auto gap-1.5 !px-2 text-[13px] font-medium"
      button={(open) => (
        <>
          <Cloud /> <span className="hidden 2xl:inline">{t.active}</span>
          <svg width="10" height="10" viewBox="0 0 10 10" className={cn('transition-transform', open && 'rotate-180')} aria-hidden>
            <path d="M2 3.5l3 3 3-3" fill="none" stroke="currentColor" strokeWidth="1.5" />
          </svg>
        </>
      )}
    >
      {(close) => (
        <div className="w-60">
          <div className="t-menu-label">Templates</div>
          {TEMPLATE_NAMES.map((name) => {
            const saved = t.saved[name];
            return (
              <div key={name} className="flex items-center gap-1">
                <button
                  type="button"
                  data-on={t.active === name}
                  disabled={!saved}
                  title={saved ? `Load ${name}` : 'Empty slot'}
                  onClick={() => {
                    if (!saved) return;
                    settingsStore.patch(saved);
                    templatesStore.patch({ active: name });
                    close();
                  }}
                  className="t-menu-item flex-1"
                >
                  <Cloud /> {name}
                  {saved && <span className="ml-auto text-[10px] text-[var(--t-muted)]">{TF_NAME[saved.tf]} · {saved.chartType}</span>}
                </button>
                <button
                  type="button"
                  title={`Save current chart as ${name}`}
                  onClick={() => {
                    templatesStore.set({ active: name, saved: { ...templatesStore.get().saved, [name]: pickTemplate(s) } });
                  }}
                  className="t-icon-btn !h-7 !w-7"
                >
                  <Save className="!h-3.5 !w-3.5" />
                </button>
              </div>
            );
          })}
          <div className="mt-1 border-t border-[var(--t-raised-2)] pt-1">
            <button type="button" className="t-menu-item" onClick={() => settingsStore.patch({ chartType: 'candles', ma20: false, ma50: false, bollinger: false, showVolume: true, showPositionLines: true })}>
              <Trash2 /> Reset chart settings
            </button>
          </div>
        </div>
      )}
    </Dropdown>
  );
}

export interface ChartPanelProps {
  spec: SymbolSpec;
  positions: PositionDto[];
  className?: string;
  /** rendered under the chart (mobile: pinned SELL/BUY strip) */
  footer?: ReactNode;
}

/**
 * Candles / bars / line from REST history, kept live by `candle` events and raw ticks. Overlays: volume,
 * MA 20/50, Bollinger, open positions (dashed, live P/L in the label), SL/TP, price alerts, user lines.
 */
export function ChartPanel({ spec, positions, className, footer }: ChartPanelProps) {
  const settings = useSettings();
  const { tf, chartType, ma20, ma50, bollinger: bb, showVolume, showPositionLines, theme } = settings;
  const alerts = useAlerts();
  const { socket } = useSocket();
  const section = useRef<HTMLElement>(null);
  const host = useRef<HTMLDivElement>(null);
  const chart = useRef<IChartApi | null>(null);
  const main = useRef<MainSeries | null>(null);
  const vol = useRef<ISeriesApi<'Histogram'> | null>(null);
  const ind = useRef<{ ma20?: ISeriesApi<'Line'>; ma50?: ISeriesApi<'Line'>; bbU?: ISeriesApi<'Line'>; bbM?: ISeriesApi<'Line'>; bbL?: ISeriesApi<'Line'> }>({});
  const bars = useRef<Bar[]>([]);
  /** true while history is being fetched: live pushes are dropped so a tick never lands on stale series data */
  const loading = useRef(false);
  const lines = useRef<IPriceLine[]>([]);
  const drawn = useRef<IPriceLine[]>([]);
  const [drawnCount, setDrawnCount] = useState(0);
  const [state, setState] = useState<'loading' | 'empty' | 'ready' | 'error'>('loading');
  const [hover, setHover] = useState<Bar | null>(null);
  const [offLive, setOffLive] = useState(false);
  const [tool, setTool] = useState<Tool>('crosshair');
  const toolRef = useRef<Tool>('crosshair');
  toolRef.current = tool;
  const [measure, setMeasure] = useState<{ a?: { time: number; price: number }; b?: { time: number; price: number } }>({});
  const measureLines = useRef<IPriceLine[]>([]);
  const [full, setFull] = useState(false);
  const [dataVersion, setDataVersion] = useState(0);

  // ------------------------------------------------------------ chart instance
  useEffect(() => {
    const el = host.current;
    if (!el) return;
    readPalette(el);
    const c = createChart(el, {
      autoSize: false,
      width: el.clientWidth,
      height: el.clientHeight,
      layout: { background: { type: ColorType.Solid, color: P.bg }, textColor: P.muted, fontFamily: 'var(--ff-body), ui-sans-serif, system-ui, sans-serif', fontSize: 11, attributionLogo: false },
      grid: { vertLines: { color: P.grid }, horzLines: { color: P.grid } },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: P.cross, labelBackgroundColor: P.dimBg, width: 1, style: LineStyle.Dashed },
        horzLine: { color: P.cross, labelBackgroundColor: P.dimBg, width: 1, style: LineStyle.Dashed },
      },
      rightPriceScale: { borderColor: 'rgba(255,255,255,0.08)', scaleMargins: { top: 0.08, bottom: 0.22 } },
      timeScale: { borderColor: 'rgba(255,255,255,0.08)', timeVisible: true, secondsVisible: false, rightOffset: 6, barSpacing: 7, rightBarStaysOnScroll: true, shiftVisibleRangeOnNewBar: true, tickMarkFormatter },
      handleScroll: true,
      handleScale: true,
      localization: { locale: 'en-GB' },
    });
    chart.current = c;
    const onRange = () => setOffLive(c.timeScale().scrollPosition() < -2);
    c.timeScale().subscribeVisibleLogicalRangeChange(onRange);
    const ro = new ResizeObserver(() => {
      if (el.clientWidth > 0 && el.clientHeight > 0) c.applyOptions({ width: el.clientWidth, height: el.clientHeight });
    });
    ro.observe(el);
    const onMove = (p: MouseEventParams) => {
      const s = main.current;
      if (!s || !p.time) {
        setHover(null);
        return;
      }
      const t = p.time as number;
      const b = bars.current.find((x) => x.time === t);
      setHover(b ?? null);
    };
    c.subscribeCrosshairMove(onMove);
    return () => {
      c.unsubscribeCrosshairMove(onMove);
      ro.disconnect();
      c.timeScale().unsubscribeVisibleLogicalRangeChange(onRange);
      c.remove();
      chart.current = null;
      main.current = null;
      vol.current = null;
      ind.current = {};
    };
  }, []);

  // ------------------------------------------------------------ main series (symbol / chart type)
  useEffect(() => {
    const c = chart.current;
    if (!c) return;
    if (main.current) c.removeSeries(main.current);
    lines.current = [];
    drawn.current = [];
    setDrawnCount(0);
    const priceFormat = { type: 'price' as const, precision: spec.digits, minMove: Math.pow(10, -spec.digits) };
    const common = { priceFormat, priceLineColor: P.blue, priceLineWidth: 1 as const, priceLineStyle: LineStyle.Solid, lastValueVisible: true };
    let s: MainSeries;
    if (chartType === 'line') s = c.addSeries(LineSeries, { ...common, color: P.blue, lineWidth: 2, crosshairMarkerVisible: true });
    else if (chartType === 'area') s = c.addSeries(AreaSeries, { ...common, lineColor: P.blue, lineWidth: 2, topColor: hexAlpha(P.blue, 0.28), bottomColor: hexAlpha(P.blue, 0.02), crosshairMarkerVisible: true });
    else if (chartType === 'bars') s = c.addSeries(BarSeries, { ...common, upColor: P.up, downColor: P.down, thinBars: false });
    else s = c.addSeries(CandlestickSeries, { ...common, upColor: P.up, downColor: P.down, borderVisible: false, wickUpColor: P.up, wickDownColor: P.down });
    main.current = s;
    if (bars.current.length) s.setData(mainData(bars.current, chartType) as never);
    setDataVersion((v) => v + 1);
  }, [spec.id, spec.digits, chartType]);

  // ------------------------------------------------------------ history
  useEffect(() => {
    const c = chart.current;
    if (!c) return;
    bars.current = [];
    loading.current = true;
    main.current?.setData([]);
    vol.current?.setData([]);
    Object.values(ind.current).forEach((x) => x?.setData([]));
    setState('loading');
    setHover(null);
    setMeasure({});
    let alive = true;
    get<CandleDto[]>(`/market/candles/${spec.id}?tf=${tf}&limit=500`)
      .then((rows) => {
        if (!alive) return;
        loading.current = false;
        bars.current = rows.map(toBar);
        main.current?.setData(mainData(bars.current, settingsStore.get().chartType) as never);
        setState(bars.current.length ? 'ready' : 'empty');
        setDataVersion((v) => v + 1);
        c.timeScale().fitContent();
        c.timeScale().applyOptions({ rightOffset: 6 });
      })
      .catch(() => {
        if (!alive) return;
        loading.current = false;
        setState('error');
      });
    return () => {
      alive = false;
    };
  }, [spec.id, tf]);

  // ------------------------------------------------------------ volume + indicators follow the data
  useEffect(() => {
    const c = chart.current;
    if (!c) return;
    const data = bars.current;
    if (showVolume) {
      if (!vol.current) {
        vol.current = c.addSeries(HistogramSeries, { priceFormat: { type: 'volume' }, priceScaleId: 'vol', lastValueVisible: false, priceLineVisible: false });
        c.priceScale('vol').applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });
      }
      vol.current.setData(data.map(volPoint));
    } else if (vol.current) {
      c.removeSeries(vol.current);
      vol.current = null;
    }
    const want = (key: keyof typeof ind.current, on: boolean, color: string, width: 1 | 2 = 1) => {
      if (on && !ind.current[key]) ind.current[key] = c.addSeries(LineSeries, { color, lineWidth: width, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false });
      if (!on && ind.current[key]) {
        c.removeSeries(ind.current[key]!);
        delete ind.current[key];
      }
    };
    want('ma20', ma20, '#f5a524');
    want('ma50', ma50, '#c251bf');
    want('bbU', bb, 'rgba(42,195,237,0.7)');
    want('bbM', bb, 'rgba(42,195,237,0.35)');
    want('bbL', bb, 'rgba(42,195,237,0.7)');
    ind.current.ma20?.setData(sma(data, 20));
    ind.current.ma50?.setData(sma(data, 50));
    if (bb) {
      const b = bollinger(data);
      ind.current.bbU?.setData(b.upper);
      ind.current.bbM?.setData(b.mid);
      ind.current.bbL?.setData(b.lower);
    }
  }, [showVolume, ma20, ma50, bb, dataVersion]);

  // ------------------------------------------------------------ theme
  useEffect(() => {
    const el = host.current;
    const c = chart.current;
    if (!el || !c) return;
    readPalette(el);
    c.applyOptions(chartTheme());
    main.current?.applyOptions(seriesColors(chartType) as never);
    vol.current?.setData(bars.current.map(volPoint));
  }, [theme, chartType]);

  // ------------------------------------------------------------ live bars
  useEffect(() => {
    const push = (bar: Bar) => {
      const s = main.current;
      if (!s || loading.current) return;
      const data = bars.current;
      const prev = last(data);
      if (prev && bar.time < prev.time) return;
      const newBar = !prev || prev.time !== bar.time;
      if (!newBar) data[data.length - 1] = bar;
      else data.push(bar);
      const ts = chart.current?.timeScale();
      const wasLive = ts ? ts.scrollPosition() >= -1 : false;
      s.update((['line', 'area'].includes(settingsStore.get().chartType) ? { time: bar.time, value: bar.close } : { time: bar.time, open: bar.open, high: bar.high, low: bar.low, close: bar.close }) as never);
      vol.current?.update(volPoint(bar));
      const n = data.length;
      if (ind.current.ma20 && n >= 20) ind.current.ma20.update(last(sma(data.slice(n - 20), 20)));
      if (ind.current.ma50 && n >= 50) ind.current.ma50.update(last(sma(data.slice(n - 50), 50)));
      if (ind.current.bbU && n >= 20) {
        const b = bollinger(data.slice(n - 20));
        ind.current.bbU.update(last(b.upper));
        ind.current.bbM?.update(last(b.mid));
        ind.current.bbL?.update(last(b.lower));
      }
      if (newBar && wasLive && ts) ts.scrollToRealTime();
      setState((st) => (st === 'empty' || st === 'loading' ? 'ready' : st));
      setHover((h) => (h && h.time === bar.time ? bar : h));
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
      const prev = last(bars.current);
      if (prev && prev.time === t) push({ ...prev, high: Math.max(prev.high, mid), low: Math.min(prev.low, mid), close: mid });
      else if (!prev || t > prev.time) push({ time: t, open: mid, high: mid, low: mid, close: mid, volume: 0 });
    });
    socket?.on(WS_EVENTS.CANDLE, onCandle);
    return () => {
      unsubTick();
      socket?.off(WS_EVENTS.CANDLE, onCandle);
    };
  }, [socket, spec.id, tf]);

  // ------------------------------------------------------------ position / SL / TP / alert lines
  const mine = useMemo(() => positions.filter((p) => p.symbol === spec.id && p.status === 'open'), [positions, spec.id]);
  const myAlerts = useMemo(() => alerts.items.filter((a) => a.symbol === spec.id), [alerts.items, spec.id]);
  const posLineRefs = useRef<{ p: PositionDto; line: IPriceLine }[]>([]);
  useEffect(() => {
    const s = main.current;
    if (!s) return;
    lines.current.forEach((l) => s.removePriceLine(l));
    lines.current = [];
    posLineRefs.current = [];
    if (showPositionLines) {
      mine.forEach((p) => {
        const line = s.createPriceLine({ price: Number(p.openPrice), color: p.side === 'buy' ? P.up : P.down, lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: `${p.side === 'buy' ? 'Buy' : 'Sell'} ${fmtLots(p.lots)}` });
        lines.current.push(line);
        posLineRefs.current.push({ p, line });
        if (p.sl) lines.current.push(s.createPriceLine({ price: Number(p.sl), color: P.sl, lineWidth: 2, lineStyle: LineStyle.Solid, axisLabelVisible: true, title: 'SL' }));
        if (p.tp) lines.current.push(s.createPriceLine({ price: Number(p.tp), color: P.tp, lineWidth: 2, lineStyle: LineStyle.Solid, axisLabelVisible: true, title: 'TP' }));
      });
    }
    myAlerts.forEach((a) => lines.current.push(s.createPriceLine({ price: Number(a.price), color: P.alert, lineWidth: 1, lineStyle: LineStyle.Dotted, axisLabelVisible: true, title: 'Alert' })));
  }, [mine, myAlerts, showPositionLines, dataVersion]);
  // live P/L inside the position label, once a second
  useEffect(() => {
    if (!posLineRefs.current.length) return;
    const tick = () => {
      const q = quoteStore.get(spec.id);
      posLineRefs.current.forEach(({ p, line }) => {
        const { pnl } = livePnl(p, spec, q);
        line.applyOptions({ title: `${p.side === 'buy' ? 'Buy' : 'Sell'} ${fmtLots(p.lots)}  ${pnl === null ? '' : `${fmtSignedNum(pnl)} USD`}` });
      });
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [spec, mine, showPositionLines, dataVersion]);

  // ------------------------------------------------------------ tools: horizontal line + measure
  useEffect(() => {
    const c = chart.current;
    if (!c) return;
    const onClick = (p: MouseEventParams) => {
      const s = main.current;
      if (!s || !p.point) return;
      const price = s.coordinateToPrice(p.point.y);
      if (price === null) return;
      const t = toolRef.current;
      if (t === 'hline') {
        const line = s.createPriceLine({ price, color: P.text2, lineWidth: 1, lineStyle: LineStyle.Solid, axisLabelVisible: true, title: '' });
        drawn.current.push(line);
        setDrawnCount(drawn.current.length);
        setTool('crosshair');
      } else if (t === 'measure') {
        const time = (p.time as number | undefined) ?? last(bars.current)?.time ?? 0;
        setMeasure((m) => {
          if (!m.a || m.b) return { a: { time, price } };
          setTool('crosshair'); // second point placed: back to the crosshair, the readout stays until cleared
          return { a: m.a, b: { time, price } };
        });
      }
    };
    c.subscribeClick(onClick);
    return () => c.unsubscribeClick(onClick);
  }, []);
  useEffect(() => {
    const s = main.current;
    if (!s) return;
    measureLines.current.forEach((l) => s.removePriceLine(l));
    measureLines.current = [];
    [measure.a, measure.b].forEach((pt) => {
      if (pt) measureLines.current.push(s.createPriceLine({ price: pt.price, color: 'rgba(42,195,237,0.8)', lineWidth: 1, lineStyle: LineStyle.Dotted, axisLabelVisible: true, title: '' }));
    });
  }, [measure, dataVersion]);
  const clearDrawings = () => {
    const s = main.current;
    if (s) drawn.current.forEach((l) => s.removePriceLine(l));
    drawn.current = [];
    setDrawnCount(0);
    setMeasure({});
    setTool('crosshair');
  };

  // ------------------------------------------------------------ toolbar actions
  const zoom = (dir: 1 | -1) => {
    const ts = chart.current?.timeScale();
    if (!ts) return;
    const bs = ts.options().barSpacing;
    const following = ts.scrollPosition() >= -1;
    ts.applyOptions({ barSpacing: Math.min(60, Math.max(1.5, dir > 0 ? bs * 1.35 : bs / 1.35)) });
    // zooming must not detach the chart from the live edge
    if (following) ts.scrollToRealTime();
  };
  const goLive = () => chart.current?.timeScale().scrollToRealTime();
  const toggleFull = useCallback(() => {
    const el = section.current;
    if (!el) return;
    if (document.fullscreenElement) void document.exitFullscreen();
    else void el.requestFullscreen?.();
  }, []);
  useEffect(() => {
    const on = () => setFull(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', on);
    return () => document.removeEventListener('fullscreenchange', on);
  }, []);
  const snapshot = () => {
    const c = chart.current;
    if (!c) return;
    const canvas = c.takeScreenshot();
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${spec.id}-${TF_NAME[tf]}-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    });
  };

  const shown = hover ?? last(bars.current) ?? null;
  const d = spec.digits;
  const measureInfo = measure.a && measure.b ? { dp: measure.b.price - measure.a.price, pct: ((measure.b.price - measure.a.price) / measure.a.price) * 100, bars: Math.round(Math.abs(measure.b.time - measure.a.time) / TF_SECONDS[tf]), ms: Math.abs(measure.b.time - measure.a.time) * 1000 } : null;
  const soon = 'Coming soon';

  return (
    <section ref={section} className={cn('t-panel', full && 'bg-[var(--t-bg)]', className)} aria-label="Chart">
      <div className="t-bar !gap-1 overflow-x-auto !pl-3 [scrollbar-width:none]">
        <SymbolTile spec={spec} size={22} />
        <span className="ml-1 text-[15px] font-semibold text-white">{spec.id}</span>
        <span className="ml-1">
          <SymbolPnlBadge spec={spec} positions={positions} />
        </span>
        <div className="flex-1" />
        <Dropdown title="Time interval" buttonClassName="t-icon-btn !w-auto !px-2 text-[14px] font-semibold" button={() => TF_NAME[tf]}>
          {(close) => (
            <div className="w-36">
              <div className="t-menu-head">Time interval</div>
              {TIMEFRAMES.map((t) => (
                <button
                  key={t}
                  type="button"
                  data-on={t === tf}
                  onClick={() => {
                    settingsStore.patch({ tf: t });
                    close();
                  }}
                  className="t-menu-item"
                >
                  {TF_NAME[t]}
                  {t === tf && <Check className="ml-auto text-[var(--t-blue)]" strokeWidth={3} />}
                </button>
              ))}
            </div>
          )}
        </Dropdown>
        <Dropdown title="Chart type" buttonClassName="t-icon-btn" menuClassName="!min-w-0" button={() => (chartType === 'line' ? <ChartLine /> : chartType === 'area' ? <ChartArea /> : chartType === 'bars' ? <OhlcBarsIcon /> : <ChartCandlestick />)}>
          {(close) => (
            <div className="w-32">
              <div className="t-menu-head">Chart type</div>
              {(
                [
                  ['candles', 'Candles', <ChartCandlestick key="c" />],
                  ['bars', 'Bars', <OhlcBarsIcon key="b" />],
                  ['line', 'Line', <ChartLine key="l" />],
                  ['area', 'Area', <ChartArea key="a" />],
                ] as [ChartType, string, ReactNode][]
              ).map(([v, label, icon]) => (
                <button
                  key={v}
                  type="button"
                  data-on={chartType === v}
                  onClick={() => {
                    settingsStore.patch({ chartType: v });
                    close();
                  }}
                  className={cn('t-menu-item', chartType === v && 'font-semibold')}
                >
                  {icon} {label}
                </button>
              ))}
            </div>
          )}
        </Dropdown>
        <span className="mx-1 h-5 w-px bg-[var(--t-line-strong)]" />
        <ToolbarBtn icon={<ZoomIn />} title="Zoom in" onClick={() => zoom(1)} />
        <ToolbarBtn icon={<ZoomOut />} title="Zoom out" onClick={() => zoom(-1)} />
        <ToolbarBtn icon={full ? <Minimize2 /> : <Maximize />} title={full ? 'Exit full screen' : 'Full screen'} onClick={toggleFull} on={full} />
        {offLive && (
          <button type="button" onClick={goLive} title="Jump to the latest price" className="animate-pop-in ml-1 inline-flex h-7 items-center gap-1.5 rounded-md bg-[var(--t-blue-deep)] px-2.5 text-[11px] font-semibold text-white hover:brightness-110">
            <span className="live-dot !h-1.5 !w-1.5" /> Live
          </button>
        )}
        <span className="mx-1 h-5 w-px bg-[var(--t-line-strong)]" />
        <Dropdown title="Indicators" buttonClassName={cn('t-icon-btn', (ma20 || ma50 || bb) && '!text-[var(--t-blue)]')} button={() => <SquareFunction />}>
          {() => (
            <div className="w-52">
              <div className="t-menu-label">Indicators</div>
              <ToggleRow label="MA 20" icon={<Spline className="text-[#f5a524]" />} checked={ma20} onChange={(v) => settingsStore.patch({ ma20: v })} />
              <ToggleRow label="MA 50" icon={<Spline className="text-[#c251bf]" />} checked={ma50} onChange={(v) => settingsStore.patch({ ma50: v })} />
              <ToggleRow label="Bollinger (20, 2)" icon={<Spline className="text-[var(--t-blue)]" />} checked={bb} onChange={(v) => settingsStore.patch({ bollinger: v })} />
            </div>
          )}
        </Dropdown>
        <AlertMenu spec={spec} />
        <ToolbarBtn icon={<Square />} title="Save chart image" onClick={snapshot} />
        <span className="mx-1 h-5 w-px bg-[var(--t-line-strong)]" />
        <TemplateMenu />
        <Dropdown title="Layers" align="right" buttonClassName="t-icon-btn" button={() => <Layers />}>
          {() => (
            <div className="w-56">
              <div className="t-menu-label">Layers</div>
              <ToggleRow label="Position lines" icon={<Eye />} checked={showPositionLines} onChange={(v) => settingsStore.patch({ showPositionLines: v })} />
              <ToggleRow label="Volume" icon={<ChartColumn />} checked={showVolume} onChange={(v) => settingsStore.patch({ showVolume: v })} />
              <button type="button" className="t-menu-item" disabled={drawnCount === 0 && !measure.a} onClick={clearDrawings}>
                <Trash2 /> Clear drawings {drawnCount > 0 && <span className="ml-auto text-[11px] text-[var(--t-muted)]">{drawnCount}</span>}
              </button>
            </div>
          )}
        </Dropdown>
        <Dropdown title="Settings" align="right" buttonClassName="t-icon-btn" button={() => <Settings />}>
          {() => (
            <div className="w-60">
              <div className="t-menu-label">Chart</div>
              <ToggleRow label="Show volume" icon={<ChartColumn />} checked={showVolume} onChange={(v) => settingsStore.patch({ showVolume: v })} />
              <ToggleRow label="Show position lines" icon={<Eye />} checked={showPositionLines} onChange={(v) => settingsStore.patch({ showPositionLines: v })} />
              <div className="t-menu-label">Trading</div>
              <ToggleRow label="Confirm orders" icon={<Check />} checked={settings.confirmOrders} onChange={(v) => settingsStore.patch({ confirmOrders: v })} />
              <ToggleRow label="Sounds" icon={<Volume2 />} checked={settings.sounds} onChange={(v) => settingsStore.patch({ sounds: v })} />
            </div>
          )}
        </Dropdown>
        <span className="mx-1 hidden h-5 w-px bg-[var(--t-line-strong)] xl:block" />
        <Clock />
      </div>

      <div className="relative flex min-h-0 flex-1">
        {/* drawing strip */}
        <div className="flex w-[46px] shrink-0 flex-col items-center gap-1.5 border-r border-[var(--t-line)] py-3">
          <ToolbarBtn icon={<Crosshair />} title="Crosshair" on={tool === 'crosshair'} onClick={() => setTool('crosshair')} className="!text-[var(--t-blue)] data-[on=true]:!bg-[var(--t-raised)]" />
          <ToolbarBtn icon={<Ruler />} title="Measure (click two points)" on={tool === 'measure'} onClick={() => setTool(tool === 'measure' ? 'crosshair' : 'measure')} className="data-[on=true]:!bg-[var(--t-raised)]" />
          <ToolbarBtn icon={<span className="block h-[18px] w-px bg-current" />} title={`Vertical line · ${soon}`} disabled />
          <ToolbarBtn icon={<Minus />} title="Horizontal line (click the chart)" on={tool === 'hline'} onClick={() => setTool(tool === 'hline' ? 'crosshair' : 'hline')} className="data-[on=true]:!bg-[var(--t-raised)]" />
          <ToolbarBtn icon={<PencilLine />} title={`Pencil · ${soon}`} disabled />
          <ToolbarBtn icon={<Type />} title={`Text · ${soon}`} disabled />
          <ToolbarBtn icon={<Magnet />} title={`Magnet · ${soon}`} disabled />
          {(drawnCount > 0 || measure.a) && <ToolbarBtn icon={<Trash2 />} title="Clear drawings" onClick={clearDrawings} className="mt-auto !text-[var(--t-sell)]" />}
        </div>

        <div className="relative min-h-0 min-w-0 flex-1">
          <div ref={host} className={cn('absolute inset-0', tool !== 'crosshair' && 'cursor-crosshair')} />
          {/* OHLC readout */}
          <div className="pointer-events-none absolute left-2 top-2 z-10 flex flex-wrap items-center gap-x-2 text-[12px] text-[var(--t-text-2)]">
            {shown ? (
              <>
                <span className="text-[var(--t-muted)]">O</span>
                <span className={shown.close >= shown.open ? 't-pnl-up' : 't-pnl-down'}>{fmtPrice(shown.open, d)}</span>
                <span className="text-[var(--t-muted)]">H</span>
                <span className={shown.close >= shown.open ? 't-pnl-up' : 't-pnl-down'}>{fmtPrice(shown.high, d)}</span>
                <span className="text-[var(--t-muted)]">L</span>
                <span className={shown.close >= shown.open ? 't-pnl-up' : 't-pnl-down'}>{fmtPrice(shown.low, d)}</span>
                <span className="text-[var(--t-muted)]">C</span>
                <span className={shown.close >= shown.open ? 't-pnl-up' : 't-pnl-down'}>{fmtPrice(shown.close, d)}</span>
                <span className="hidden text-[var(--t-muted)] sm:inline">V</span>
                <span className={cn('hidden sm:inline', shown.close >= shown.open ? 't-pnl-up' : 't-pnl-down')}>{fmtNum(shown.volume, 0)}</span>
              </>
            ) : (
              <span className="text-[var(--t-muted)]">
                {spec.id} · {TF_NAME[tf]}
              </span>
            )}
          </div>
          {measureInfo && (
            <div className="pointer-events-none absolute left-2 top-8 z-10 rounded-md border border-[var(--t-blue-deep)] bg-[var(--t-panel)]/95 px-2.5 py-1.5 text-[12px]">
              <span className={measureInfo.dp >= 0 ? 't-pnl-up' : 't-pnl-down'}>
                {fmtSignedNum(measureInfo.dp, d)} ({fmtSignedNum(measureInfo.pct)}%)
              </span>
              <span className="text-[var(--t-muted)]">
                {' '}
                · {measureInfo.bars} bars · {fmtDuration(measureInfo.ms)}
              </span>
            </div>
          )}
          {tool === 'measure' && !measureInfo && <div className="pointer-events-none absolute left-2 top-8 z-10 rounded-md bg-[var(--t-panel)]/95 px-2.5 py-1 text-[11px] text-[var(--t-muted)]">{measure.a ? 'Click the second point' : 'Click the first point'}</div>}
          {tool === 'hline' && <div className="pointer-events-none absolute left-2 top-8 z-10 rounded-md bg-[var(--t-panel)]/95 px-2.5 py-1 text-[11px] text-[var(--t-muted)]">Click where the line should go</div>}
          {state === 'loading' && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-[var(--t-bg)]/60">
              <Spinner />
            </div>
          )}
          {state === 'empty' && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="rounded-lg border border-dashed border-[var(--t-raised-2)] px-6 py-4 text-center">
                <div className="text-[13px] font-medium text-[var(--t-text-2)]">Waiting for the first ticks</div>
                <div className="text-[11px] text-[var(--t-muted)]">No {TF_NAME[tf]} history for {spec.id} yet. Bars build as prices arrive.</div>
              </div>
            </div>
          )}
          {state === 'error' && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="rounded-lg border border-[var(--t-sell)]/40 px-6 py-4 text-center">
                <div className="text-[13px] font-medium text-[var(--t-text-2)]">Could not load the chart</div>
                <div className="text-[11px] text-[var(--t-muted)]">Check your connection; live bars will still appear.</div>
              </div>
            </div>
          )}
        </div>
      </div>
      {footer}
    </section>
  );
}
