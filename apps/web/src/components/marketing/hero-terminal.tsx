'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { ArrowRight, TrendingDown, TrendingUp } from 'lucide-react';
import type { PublicSymbol } from '@/lib/server-api';
import { cn } from '@/lib/utils';
import { INDICATIVE_PRICE, marketByCls } from '@/lib/markets';
import { Tilt } from '@/components/motion';

const TIMEFRAMES = [
  { key: 'M1', vol: 1 },
  { key: 'M5', vol: 1.8 },
  { key: 'H1', vol: 3.2 },
];
const UP = '#16a34a';
const DOWN = '#dc2626';

interface Candle {
  o: number;
  h: number;
  l: number;
  c: number;
}

/** Self-driving candlestick chart (random walk) rendered on canvas. Pauses off screen. */
function SimChart({ base, vol, digits, onTick }: { base: number; vol: number; digits: number; onTick: (price: number, open: number) => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const cb = useRef(onTick);
  cb.current = onTick;

  useEffect(() => {
    const canvas = ref.current;
    const parent = canvas?.parentElement;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !parent || !ctx) return;

    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const font = getComputedStyle(canvas).fontFamily;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    let w = 0;
    let h = 0;
    const resize = () => {
      w = parent.clientWidth;
      h = parent.clientHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    const ro = new ResizeObserver(resize);
    ro.observe(parent);
    resize();

    let visible = true;
    const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting));
    io.observe(canvas);

    // mean-reverting random walk
    let p = base;
    let drift = 0;
    const next = () => {
      drift = drift * 0.9 + (Math.random() - 0.5) * vol * 0.6;
      p += drift + (Math.random() - 0.5) * vol + (base - p) * 0.002;
      return p;
    };
    const candles: Candle[] = [];
    for (let i = 0; i < 110; i++) {
      const o = p;
      let hi = o;
      let lo = o;
      for (let k = 0; k < 8; k++) {
        const v = next();
        hi = Math.max(hi, v);
        lo = Math.min(lo, v);
      }
      candles.push({ o, h: hi, l: lo, c: p });
    }
    const open = candles[candles.length - 40].o;
    let live: Candle = { o: p, h: p, l: p, c: p };
    let shown = p;
    let ticks = 0;
    let lastTick = 0;
    let slide = 0;
    let yMin = 0;
    let yMax = 0;
    let ranged = false;
    cb.current(p, open);

    let raf = 0;
    const frame = (t: number) => {
      raf = requestAnimationFrame(frame);
      if (!visible || w === 0) return;

      if (!still && t - lastTick > 150) {
        lastTick = t;
        const v = next();
        live.c = v;
        live.h = Math.max(live.h, v);
        live.l = Math.min(live.l, v);
        if (++ticks >= 14) {
          candles.push(live);
          candles.shift();
          live = { o: v, h: v, l: v, c: v };
          ticks = 0;
          slide = 1;
        }
        cb.current(v, open);
      }
      shown += (live.c - shown) * 0.2;
      slide *= 0.85;

      const padR = 66;
      const padT = 14;
      const padB = 12;
      const slot = 10;
      const plotW = w - padR;
      const plotH = h - padT - padB;
      const count = Math.min(candles.length, Math.max(8, Math.ceil(plotW / slot) + 1));
      const view = candles.slice(-count);

      let lo = live.l;
      let hi = live.h;
      for (const c of view) {
        lo = Math.min(lo, c.l);
        hi = Math.max(hi, c.h);
      }
      const pad = (hi - lo) * 0.14 || vol;
      lo -= pad;
      hi += pad;
      if (!ranged) {
        yMin = lo;
        yMax = hi;
        ranged = true;
      } else {
        yMin += (lo - yMin) * 0.08;
        yMax += (hi - yMax) * 0.08;
      }
      const y = (v: number) => padT + (1 - (v - yMin) / (yMax - yMin)) * plotH;
      const x = (i: number) => plotW - (count - i) * slot - slot / 2 + slide * slot;

      ctx.clearRect(0, 0, w, h);

      // grid + axis
      ctx.lineWidth = 1;
      ctx.font = `10px ${font}`;
      ctx.textBaseline = 'middle';
      for (let g = 0; g <= 4; g++) {
        const gy = Math.round(padT + (plotH * g) / 4) + 0.5;
        ctx.strokeStyle = 'rgba(15,23,42,0.07)';
        ctx.beginPath();
        ctx.moveTo(0, gy);
        ctx.lineTo(plotW, gy);
        ctx.stroke();
        ctx.fillStyle = 'rgba(67,79,103,0.8)';
        ctx.fillText((yMax - ((yMax - yMin) * g) / 4).toFixed(digits), plotW + 9, gy);
      }

      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, plotW, h);
      ctx.clip();

      // glow under the close line
      ctx.beginPath();
      view.forEach((c, i) => (i ? ctx.lineTo(x(i), y(c.c)) : ctx.moveTo(x(i), y(c.c))));
      ctx.lineTo(x(count), y(shown));
      ctx.lineTo(x(count), h);
      ctx.lineTo(x(0), h);
      ctx.closePath();
      const glow = ctx.createLinearGradient(0, padT, 0, h);
      glow.addColorStop(0, 'rgba(37,99,235,0.14)');
      glow.addColorStop(1, 'rgba(37,99,235,0)');
      ctx.fillStyle = glow;
      ctx.fill();

      const body = slot * 0.6;
      const candle = (c: Candle, px: number) => {
        ctx.strokeStyle = ctx.fillStyle = c.c >= c.o ? UP : DOWN;
        ctx.beginPath();
        ctx.moveTo(Math.round(px) + 0.5, y(c.h));
        ctx.lineTo(Math.round(px) + 0.5, y(c.l));
        ctx.stroke();
        ctx.fillRect(px - body / 2, y(Math.max(c.o, c.c)), body, Math.max(1.5, Math.abs(y(c.o) - y(c.c))));
      };
      view.forEach((c, i) => candle(c, x(i)));
      candle({ ...live, c: shown }, x(count));
      ctx.restore();

      // last price line, tag and pulsing head
      const py = y(shown);
      const up = shown >= live.o;
      const col = up ? UP : DOWN;
      ctx.setLineDash([3, 4]);
      ctx.strokeStyle = col;
      ctx.globalAlpha = 0.65;
      ctx.beginPath();
      ctx.moveTo(0, Math.round(py) + 0.5);
      ctx.lineTo(plotW, Math.round(py) + 0.5);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;

      ctx.fillStyle = col;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(plotW + 3, py - 9, padR - 6, 18, 5);
      else ctx.rect(plotW + 3, py - 9, padR - 6, 18);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = `700 10px ${font}`;
      ctx.fillText(shown.toFixed(digits), plotW + 9, py + 0.5);

      const head = x(count);
      if (head < plotW) {
        const pulse = (Math.sin(t / 260) + 1) / 2;
        ctx.beginPath();
        ctx.arc(head, py, 4 + pulse * 6, 0, Math.PI * 2);
        ctx.fillStyle = up ? 'rgba(22,163,74,0.2)' : 'rgba(220,38,38,0.2)';
        ctx.fill();
      }
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
    };
  }, [base, vol, digits]);

  return <canvas ref={ref} className="absolute inset-0 h-full w-full font-mono" aria-hidden />;
}

/** Hero showpiece: a miniature of the web terminal driven by a simulated feed. */
export function HeroTerminal({ symbols }: { symbols: PublicSymbol[] }) {
  const [active, setActive] = useState(0);
  const [tf, setTf] = useState(0);
  const [tick, setTick] = useState<{ price: number; open: number } | null>(null);
  const sym = symbols[active] ?? symbols[0];

  const base = sym.quote ? Number(sym.quote.bid) : (INDICATIVE_PRICE[sym.id] ?? 100);
  const vol = base * 0.00011 * TIMEFRAMES[tf].vol;
  const spread = Math.max(Number(sym.spreadMarkup) || 0, base * 0.00004);

  const price = tick?.price ?? base;
  const change = tick ? ((tick.price - tick.open) / tick.open) * 100 : 0;
  const rising = change >= 0;
  // toy position so the floating P/L card breathes with the chart
  const pnl = tick ? ((tick.price - tick.open) / (base * 0.00011)) * 4.2 : 0;

  return (
    <div className="relative lg:[transform:perspective(1600px)_rotateY(-7deg)_rotateX(2deg)]">
      <div className="absolute -inset-10 -z-10 rounded-[3rem] bg-brand-500/15 blur-3xl" />
      <Tilt max={5}>
        <div className="beam glass overflow-hidden rounded-3xl shadow-lift">
          {/* window chrome */}
          <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
            <div className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-down/70" />
              <span className="h-2.5 w-2.5 rounded-full bg-gold/70" />
              <span className="h-2.5 w-2.5 rounded-full bg-up/70" />
              <span className="label ml-3 hidden sm:block">WebTrader</span>
            </div>
            <span className="inline-flex items-center gap-2 rounded-full bg-white/[0.06] px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-300">
              <span className="live-dot text-gold" /> Simulated preview
            </span>
          </div>

          <div className="grid sm:grid-cols-[172px_1fr]">
            {/* watchlist */}
            <ul className="hidden border-r border-white/[0.06] p-2 sm:block">
              {symbols.map((s, i) => {
                const m = marketByCls(s.assetClass);
                return (
                  <li key={s.id}>
                    <button
                      onClick={() => {
                        setActive(i);
                        setTick(null);
                      }}
                      className={cn(
                        'group relative flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left transition-colors duration-300',
                        i === active ? 'bg-white/[0.07]' : 'hover:bg-white/[0.04]',
                      )}
                    >
                      {i === active && <span className="absolute inset-y-2.5 left-0 w-0.5 rounded-full bg-brand-400 shadow-[0_0_10px_rgb(var(--brand-rgb))]" />}
                      <span>
                        <span className={cn('block text-[13px] font-semibold', i === active ? 'text-white' : 'text-ink-200')}>{s.id}</span>
                        <span className="block text-[10px] text-ink-500">{m?.label ?? s.assetClass}</span>
                      </span>
                      <span className="tabular font-mono text-[10px] text-ink-400">1:{s.leverageMax}</span>
                    </button>
                  </li>
                );
              })}
            </ul>

            <div className="min-w-0">
              <div className="flex flex-wrap items-end justify-between gap-3 px-4 pt-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-display text-lg font-bold">{sym.id}</span>
                    <span className="text-xs text-ink-500">{sym.name}</span>
                  </div>
                  <div className="mt-0.5 flex items-baseline gap-2.5">
                    <span className="tabular font-mono text-2xl font-semibold tracking-tight">{price.toFixed(sym.digits)}</span>
                    <span className={cn('tabular inline-flex items-center gap-1 font-mono text-xs transition-colors duration-500', rising ? 'text-up' : 'text-down')}>
                      {rising ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                      {rising ? '+' : ''}
                      {change.toFixed(2)}%
                    </span>
                  </div>
                </div>
                <div className="flex rounded-lg bg-white/[0.05] p-0.5">
                  {TIMEFRAMES.map((t, i) => (
                    <button
                      key={t.key}
                      onClick={() => {
                        setTf(i);
                        setTick(null);
                      }}
                      className={cn('rounded-md px-2.5 py-1 font-mono text-[10px] transition-colors duration-300', i === tf ? 'bg-white/10 text-white' : 'text-ink-400 hover:text-ink-200')}
                    >
                      {t.key}
                    </button>
                  ))}
                </div>
              </div>

              <div className="relative mt-2 h-56 sm:h-64">
                <SimChart key={`${sym.id}-${tf}`} base={base} vol={vol} digits={sym.digits} onTick={(p, o) => setTick({ price: p, open: o })} />
              </div>

              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 border-t border-white/[0.06] p-3" aria-hidden>
                <div className="rounded-xl bg-down/10 px-3 py-2 ring-1 ring-inset ring-down/25">
                  <div className="label !text-down/80">Sell</div>
                  <div className="tabular font-mono text-sm font-semibold text-down">{(price - spread / 2).toFixed(sym.digits)}</div>
                </div>
                <div className="rounded-lg bg-white/[0.05] px-2.5 py-2 text-center">
                  <div className="label">Lots</div>
                  <div className="tabular font-mono text-sm">0.10</div>
                </div>
                <div className="rounded-xl bg-up/10 px-3 py-2 text-right ring-1 ring-inset ring-up/25">
                  <div className="label !text-up/80">Buy</div>
                  <div className="tabular font-mono text-sm font-semibold text-up">{(price + spread / 2).toFixed(sym.digits)}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Tilt>

      {/* floating position card */}
      <div className="animate-float absolute -right-3 -top-14 hidden sm:block lg:-right-6">
        <div className="glass rounded-2xl px-4 py-3 shadow-lift">
          <div className="label">Open P/L · demo</div>
          <div className={cn('tabular mt-1 font-mono text-lg font-semibold transition-colors duration-500', pnl >= 0 ? 'text-up' : 'text-down')}>
            {pnl >= 0 ? '+' : '-'}${Math.abs(pnl).toFixed(2)}
          </div>
        </div>
      </div>

      {/* floating CTA */}
      <Link
        href="/register"
        className="animate-float-slow glass group absolute -bottom-6 left-4 hidden items-center gap-3 rounded-2xl py-2.5 pl-3 pr-4 shadow-lift transition-colors hover:border-brand-400/40 sm:flex lg:-left-10"
      >
        <span className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-brand-400/15 text-brand-300">
          <span className="absolute inset-0 animate-pulse-ring rounded-xl bg-brand-400/30" />
          <ArrowRight className="relative h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5" />
        </span>
        <span>
          <span className="block text-sm font-semibold">Try it with $10,000</span>
          <span className="block text-[11px] text-ink-400">virtual funds, no card</span>
        </span>
      </Link>
    </div>
  );
}
