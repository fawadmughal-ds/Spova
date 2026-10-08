'use client';

import { useEffect, useRef } from 'react';

const UP = '#16a34a';
const DOWN = '#dc2626';

interface Bar {
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
}

/** Placeholder chart for the terminal preview: random-walk candles, a moving average and volume. Simulated, not market data. */
export function SimChart({ base = 1.0842, digits = 5 }: { base?: number; digits?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const parent = canvas?.parentElement;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !parent || !ctx) return;

    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const font = getComputedStyle(canvas).fontFamily;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const vol = base * 0.00013;
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

    let p = base;
    let drift = 0;
    const next = () => {
      drift = drift * 0.9 + (Math.random() - 0.5) * vol * 0.6;
      p += drift + (Math.random() - 0.5) * vol + (base - p) * 0.002;
      return p;
    };
    const bars: Bar[] = [];
    for (let i = 0; i < 260; i++) {
      const o = p;
      let hi = o;
      let lo = o;
      for (let k = 0; k < 8; k++) {
        const v = next();
        hi = Math.max(hi, v);
        lo = Math.min(lo, v);
      }
      bars.push({ o, h: hi, l: lo, c: p, v: 0.3 + Math.random() * 0.7 });
    }
    let live: Bar = { o: p, h: p, l: p, c: p, v: 0.1 };
    let shown = p;
    let ticks = 0;
    let lastTick = 0;
    let slide = 0;
    let yMin = 0;
    let yMax = 0;
    let ranged = false;

    let raf = 0;
    const frame = (t: number) => {
      raf = requestAnimationFrame(frame);
      if (w === 0 || document.hidden) return;

      if (!still && t - lastTick > 170) {
        lastTick = t;
        const v = next();
        live.c = v;
        live.h = Math.max(live.h, v);
        live.l = Math.min(live.l, v);
        live.v = Math.min(1, live.v + Math.random() * 0.08);
        if (++ticks >= 14) {
          bars.push(live);
          bars.shift();
          live = { o: v, h: v, l: v, c: v, v: 0.1 };
          ticks = 0;
          slide = 1;
        }
      }
      shown += (live.c - shown) * 0.2;
      slide *= 0.85;

      const padR = 70;
      const padT = 18;
      const volH = Math.min(90, h * 0.16);
      const slot = 12;
      const plotW = w - padR;
      const plotH = h - padT - volH - 16;
      const count = Math.min(bars.length, Math.ceil(plotW / slot) + 1);
      const view = bars.slice(-count);

      let lo = live.l;
      let hi = live.h;
      for (const b of view) {
        lo = Math.min(lo, b.l);
        hi = Math.max(hi, b.h);
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
      ctx.lineWidth = 1;
      ctx.font = `10px ${font}`;
      ctx.textBaseline = 'middle';
      for (let g = 0; g <= 6; g++) {
        const gy = Math.round(padT + (plotH * g) / 6) + 0.5;
        ctx.strokeStyle = 'rgba(15,23,42,0.07)';
        ctx.beginPath();
        ctx.moveTo(0, gy);
        ctx.lineTo(plotW, gy);
        ctx.stroke();
        ctx.fillStyle = 'rgba(67,79,103,0.8)';
        ctx.fillText((yMax - ((yMax - yMin) * g) / 6).toFixed(digits), plotW + 10, gy);
      }
      for (let gx = plotW % 96; gx < plotW; gx += 96) {
        ctx.strokeStyle = 'rgba(15,23,42,0.045)';
        ctx.beginPath();
        ctx.moveTo(Math.round(gx) + 0.5, 0);
        ctx.lineTo(Math.round(gx) + 0.5, h);
        ctx.stroke();
      }

      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, plotW, h);
      ctx.clip();

      const body = slot * 0.62;
      const all = [...view, { ...live, c: shown }];
      all.forEach((b, i) => {
        const px = x(i);
        const up = b.c >= b.o;
        // volume
        ctx.fillStyle = up ? 'rgba(22,163,74,0.22)' : 'rgba(220,38,38,0.22)';
        ctx.fillRect(px - body / 2, h - b.v * volH, body, b.v * volH);
        // candle
        ctx.strokeStyle = ctx.fillStyle = up ? UP : DOWN;
        ctx.beginPath();
        ctx.moveTo(Math.round(px) + 0.5, y(b.h));
        ctx.lineTo(Math.round(px) + 0.5, y(b.l));
        ctx.stroke();
        ctx.fillRect(px - body / 2, y(Math.max(b.o, b.c)), body, Math.max(1.5, Math.abs(y(b.o) - y(b.c))));
      });

      // 12-bar moving average
      ctx.beginPath();
      let started = false;
      for (let i = 11; i < all.length; i++) {
        let sum = 0;
        for (let k = i - 11; k <= i; k++) sum += all[k].c;
        const px = x(i);
        const py = y(sum / 12);
        if (started) ctx.lineTo(px, py);
        else {
          ctx.moveTo(px, py);
          started = true;
        }
      }
      ctx.strokeStyle = 'rgba(37,99,235,0.7)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.lineWidth = 1;
      ctx.restore();

      const py = y(shown);
      const col = shown >= live.o ? UP : DOWN;
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
      if (ctx.roundRect) ctx.roundRect(plotW + 4, py - 9, padR - 8, 18, 5);
      else ctx.rect(plotW + 4, py - 9, padR - 8, 18);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = `700 10px ${font}`;
      ctx.fillText(shown.toFixed(digits), plotW + 10, py + 0.5);
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [base, digits]);

  return <canvas ref={ref} className="absolute inset-0 h-full w-full font-mono" aria-hidden />;
}
