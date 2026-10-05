'use client';

import { useState } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import type { PublicSymbol } from '@/lib/server-api';

const CLASSES: { key: string; label: string; href: string }[] = [
  { key: 'forex', label: 'Forex', href: '/forex' },
  { key: 'index', label: 'Indices', href: '/indices' },
  { key: 'commodity', label: 'Commodities', href: '/commodities' },
  { key: 'stock', label: 'Shares', href: '/shares' },
  { key: 'crypto', label: 'Crypto', href: '/cryptocurrencies' },
  { key: 'metal', label: 'Metals', href: '/metals' },
];

export function InstrumentTabs({ symbols }: { symbols: PublicSymbol[] }) {
  const [active, setActive] = useState('forex');
  const rows = symbols.filter((s) => s.assetClass === active).slice(0, 8);
  const current = CLASSES.find((c) => c.key === active)!;

  return (
    <div className="card overflow-hidden">
      <div className="flex gap-1 overflow-x-auto border-b border-white/5 p-2">
        {CLASSES.map((c) => (
          <button
            key={c.key}
            onClick={() => setActive(c.key)}
            className={cn('whitespace-nowrap rounded-lg px-4 py-2 text-sm transition', active === c.key ? 'bg-brand-500 text-ink-950 font-semibold' : 'text-ink-300 hover:bg-white/5 hover:text-white')}
          >
            {c.label}
          </button>
        ))}
      </div>
      <table className="w-full text-sm">
        <thead className="text-left text-[11px] uppercase tracking-wider text-ink-500">
          <tr>
            <th className="px-5 py-3 font-medium">Instrument</th>
            <th className="px-5 py-3 font-medium">Bid</th>
            <th className="px-5 py-3 font-medium">Ask</th>
            <th className="px-5 py-3 font-medium">Max leverage</th>
            <th className="px-5 py-3 font-medium" />
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {rows.length === 0 && (
            <tr>
              <td colSpan={5} className="px-5 py-8 text-center text-ink-500">
                Instruments will appear once the price feed is connected.
              </td>
            </tr>
          )}
          {rows.map((s) => (
            <tr key={s.id} className="hover:bg-white/[0.03]">
              <td className="px-5 py-3">
                <div className="font-semibold">{s.id}</div>
                <div className="text-xs text-ink-500">{s.name}</div>
              </td>
              <td className="tabular px-5 py-3">{s.quote?.bid ?? '—'}</td>
              <td className="tabular px-5 py-3">{s.quote?.ask ?? '—'}</td>
              <td className="tabular px-5 py-3">1:{s.leverageMax}</td>
              <td className="px-5 py-3 text-right">
                <Link href="/register" className="rounded-lg bg-white/5 px-3 py-1.5 text-xs hover:bg-brand-500 hover:text-ink-950">
                  Trade
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="border-t border-white/5 p-3 text-right">
        <Link href={current.href} className="text-sm text-brand-300 hover:text-brand-200">
          All {current.label.toLowerCase()} →
        </Link>
      </div>
    </div>
  );
}
