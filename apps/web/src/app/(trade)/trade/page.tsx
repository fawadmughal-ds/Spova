'use client';

import Link from 'next/link';
import { ArrowLeft, LineChart } from 'lucide-react';
import { RequireAuth } from '@/lib/auth-context';
import { BRAND } from '@/lib/utils';
import { Logo } from '@/components/logo';

export default function TradePage() {
  return (
    <RequireAuth>
      <div className="flex min-h-screen flex-col bg-ink-950">
        <header className="flex h-12 items-center justify-between border-b border-white/5 px-4">
          <Link href="/app" className="flex items-center gap-2 text-sm text-ink-300 hover:text-white">
            <ArrowLeft className="h-4 w-4" /> Client area
          </Link>
          <div className="flex items-center gap-2">
            <Logo size={22} />
            <span className="text-sm font-bold">{BRAND} WebTrader</span>
          </div>
          <span className="text-xs text-ink-500">UTC {new Date().toISOString().slice(11, 16)}</span>
        </header>
        <div className="grid flex-1 grid-cols-[260px_1fr_300px]">
          <aside className="border-r border-white/5 p-3 text-xs text-ink-500">Watchlist (milestone 2)</aside>
          <main className="flex items-center justify-center">
            <div className="text-center text-ink-400">
              <LineChart className="mx-auto h-10 w-10 text-brand-500/50" />
              <p className="mt-3 font-semibold text-ink-200">Terminal arrives with milestone 2 (13 Oct)</p>
              <p className="mt-1 text-sm">Live Binance ticks, candles 1m-1d, market / limit / stop orders, positions with live P/L, SL/TP, margin engine.</p>
            </div>
          </main>
          <aside className="border-l border-white/5 p-3 text-xs text-ink-500">Order ticket (milestone 2)</aside>
        </div>
      </div>
    </RequireAuth>
  );
}
