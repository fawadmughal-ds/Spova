'use client';

import { useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MARKET_LIST } from '@/lib/markets';
import type { PublicSymbol } from '@/lib/server-api';

/** Asset-class switcher. The whole panel re-tints to the class colour and rows cascade in on every change. */
export function InstrumentTabs({ symbols }: { symbols: PublicSymbol[] }) {
  const [active, setActive] = useState(0);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const [pill, setPill] = useState({ left: 0, width: 0 });
  const market = MARKET_LIST[active];
  const rows = symbols.filter((s) => s.assetClass === market.cls).slice(0, 7);
  const total = symbols.filter((s) => s.assetClass === market.cls).length;
  const live = symbols.some((s) => s.quote);

  useLayoutEffect(() => {
    const place = () => {
      const el = tabs.current[active];
      if (el) setPill({ left: el.offsetLeft, width: el.offsetWidth });
    };
    place();
    window.addEventListener('resize', place);
    return () => window.removeEventListener('resize', place);
  }, [active]);

  return (
    <div className="card overflow-hidden transition-[box-shadow] duration-700" style={{ '--c': market.rgb, boxShadow: `0 40px 120px -60px rgb(${market.rgb} / 0.5)` } as CSSProperties}>
      <div className="flex items-center justify-between gap-4 border-b border-white/[0.06] p-2">
        <div className="relative flex overflow-x-auto [scrollbar-width:none]">
          <span
            className="absolute inset-y-0 rounded-xl bg-[rgb(var(--c)/0.14)] ring-1 ring-inset ring-[rgb(var(--c)/0.35)] transition-all duration-500 ease-out-expo"
            style={{ left: pill.left, width: pill.width }}
          />
          {MARKET_LIST.map((m, i) => (
            <button
              key={m.slug}
              ref={(el) => {
                tabs.current[i] = el;
              }}
              onClick={() => setActive(i)}
              className={cn('relative flex items-center gap-2 whitespace-nowrap rounded-xl px-4 py-2.5 text-sm transition-colors duration-300', i === active ? 'text-white' : 'text-ink-400 hover:text-ink-100')}
            >
              <m.icon className={cn('h-4 w-4 transition-colors duration-300', i === active && 'text-[rgb(var(--c))]')} />
              {m.label}
            </button>
          ))}
        </div>
        <span className="mr-3 hidden items-center gap-2 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-400 md:inline-flex">
          <span className={cn('live-dot', live ? 'text-up' : 'text-ink-500')} />
          {live ? 'Live quotes' : 'Quotes offline'}
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="text-left">
            <tr>
              {['Instrument', 'Bid', 'Ask', 'Min lot', 'Max leverage', ''].map((h, i) => (
                <th key={i} className="label px-5 py-3 font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody key={market.slug}>
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-5 py-12 text-center text-ink-500">
                  Instruments will appear once the price feed is connected.
                </td>
              </tr>
            )}
            {rows.map((s, i) => (
              <tr key={s.id} className="animate-page-in group border-t border-white/[0.05] transition-colors duration-300 hover:bg-[rgb(var(--c)/0.05)]" style={{ animationDelay: `${i * 55}ms` }}>
                <td className="px-5 py-3">
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[rgb(var(--c)/0.1)] font-mono text-[10px] font-bold text-[rgb(var(--c))] ring-1 ring-inset ring-[rgb(var(--c)/0.2)] transition-transform duration-500 ease-spring group-hover:scale-110 group-hover:-rotate-6">
                      {s.id.slice(0, 3)}
                    </span>
                    <span>
                      <span className="block font-semibold text-white">{s.id}</span>
                      <span className="block text-xs text-ink-500">{s.name}</span>
                    </span>
                  </div>
                </td>
                <td className={cn('tabular px-5 py-3 font-mono', s.quote ? 'text-down/90' : 'text-ink-600')}>{s.quote?.bid ?? '—'}</td>
                <td className={cn('tabular px-5 py-3 font-mono', s.quote ? 'text-up/90' : 'text-ink-600')}>{s.quote?.ask ?? '—'}</td>
                <td className="tabular px-5 py-3 font-mono text-ink-300">{s.minLot ?? '0.01'}</td>
                <td className="px-5 py-3">
                  <span className="tabular rounded-md bg-white/[0.05] px-2 py-1 font-mono text-xs text-ink-100">1:{s.leverageMax}</span>
                </td>
                <td className="px-5 py-3 text-right">
                  <Link
                    href="/register"
                    className="inline-flex items-center gap-1.5 rounded-lg bg-white/[0.05] px-3 py-1.5 text-xs font-medium text-ink-200 transition-all duration-300 hover:bg-[rgb(var(--c))] hover:text-ink-950 group-hover:bg-white/10"
                  >
                    Trade <ArrowRight className="h-3 w-3 transition-transform duration-300 group-hover:translate-x-0.5" />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between border-t border-white/[0.06] px-5 py-3.5">
        <span className="text-xs text-ink-500">
          {total > rows.length ? `Showing ${rows.length} of ${total}` : `${total} instruments`} · {market.hours}
        </span>
        <Link href={`/${market.slug}`} className="group inline-flex items-center gap-1.5 text-sm font-medium text-[rgb(var(--c))]">
          <span className="link-underline">All {market.label.toLowerCase()}</span>
          <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
        </Link>
      </div>
    </div>
  );
}
