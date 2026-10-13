'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { useSettings } from '@/components/trade/settings';
import type { SymbolSpec } from '@/components/trade/format';

/**
 * TradingView Advanced Chart widget. Shows TradingView market data for the mapped symbol with its full
 * indicator + drawing-tool set. Our own prices and open positions live in the ticket / positions panels,
 * not on this chart. Loaded from TradingView's CDN (their widget cannot be self-hosted).
 */

// crypto: our id (xxxUSD) -> TradingView base ticker on Binance
const CRYPTO_BASE: Record<string, string> = { BTCUSD: 'BTC', ETHUSD: 'ETH', LTCUSD: 'LTC', XRPUSD: 'XRP', SOLUSD: 'SOL', BNBUSD: 'BNB', ADAUSD: 'ADA', DOGUSD: 'DOGE', DOTUSD: 'DOT', AVAUSD: 'AVAX', LNKUSD: 'LINK', TRXUSD: 'TRX' };
// indices -> TradingView index symbols
const INDEX_TV: Record<string, string> = { US500: 'SPX', US100: 'NDX', US30: 'DJI', DE40: 'DAX', UK100: 'UKX', JP225: 'NI225', AUS200: 'ASX:XJO', HK50: 'HSI', FRA40: 'CAC40', EU50: 'SX5E', US2000: 'RUT' };
// commodities -> TradingView
const COMMODITY_TV: Record<string, string> = { USOIL: 'TVC:USOIL', UKOIL: 'TVC:UKOIL', NATGAS: 'TVC:NATGAS', COPPER: 'TVC:COPPER', COFFEE: 'ICEUS:KC1!', CORN: 'CBOT:ZC1!', WHEAT: 'CBOT:ZW1!' };
// US-listed shares that are NOT on NASDAQ
const NYSE_SHARES = new Set(['JPM', 'DIS', 'BABA']);

function tvSymbol(spec: SymbolSpec): string {
  const id = spec.id;
  const cls = spec.assetClass;
  if (cls === 'crypto') return `BINANCE:${CRYPTO_BASE[id] ?? id.replace(/USD$/, '')}USDT`;
  if (cls === 'forex') return `FX:${id}`;
  if (cls === 'metal') return `OANDA:${id}`;
  if (cls === 'index') {
    const t = INDEX_TV[id] ?? id;
    return t.includes(':') ? t : `TVC:${t}`;
  }
  if (cls === 'commodity') return COMMODITY_TV[id] ?? `TVC:${id}`;
  if (cls === 'stock') return `${NYSE_SHARES.has(id) ? 'NYSE' : 'NASDAQ'}:${id}`;
  return id;
}

let tvLoader: Promise<void> | null = null;
function loadTv(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if ((window as unknown as { TradingView?: unknown }).TradingView) return Promise.resolve();
  if (tvLoader) return tvLoader;
  tvLoader = new Promise<void>((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://s3.tradingview.com/tv.js';
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('tv load failed'));
    document.head.appendChild(s);
  });
  return tvLoader;
}

export function TradingViewChart({ spec, className, footer }: { spec: SymbolSpec; className?: string; footer?: ReactNode }) {
  const { theme } = useSettings();
  const holderRef = useRef<HTMLDivElement>(null);
  const idRef = useRef(`tv_${Math.random().toString(36).slice(2)}`);

  useEffect(() => {
    let cancelled = false;
    const symbol = tvSymbol(spec);
    void loadTv()
      .then(() => {
        if (cancelled || !holderRef.current) return;
        holderRef.current.innerHTML = `<div id="${idRef.current}" style="height:100%;width:100%"></div>`;
        const TV = (window as unknown as { TradingView: { widget: new (o: Record<string, unknown>) => unknown } }).TradingView;
        new TV.widget({
          container_id: idRef.current,
          symbol,
          autosize: true,
          interval: '15',
          timezone: 'Etc/UTC',
          theme: theme === 'light' ? 'light' : 'dark',
          style: '1',
          locale: 'en',
          toolbar_bg: theme === 'light' ? '#ffffff' : '#0e1118',
          enable_publishing: false,
          allow_symbol_change: false,
          hide_side_toolbar: false,
          withdateranges: true,
          details: false,
          calendar: false,
          backgroundColor: theme === 'light' ? '#ffffff' : '#0e1118',
          gridColor: theme === 'light' ? 'rgba(42,46,57,0.06)' : 'rgba(255,255,255,0.06)',
        });
      })
      .catch(() => {
        if (!cancelled && holderRef.current) {
          holderRef.current.innerHTML = '<div style="height:100%;display:flex;align-items:center;justify-content:center;color:var(--t-muted);font-size:13px;text-align:center;padding:16px">Chart could not load. Check your connection and refresh.</div>';
        }
      });
    return () => {
      cancelled = true;
    };
  }, [spec, theme]);

  return (
    <section className={cn('t-panel overflow-hidden', className)} aria-label={`${spec.id} chart`}>
      <div ref={holderRef} className="min-h-0 flex-1" />
      {footer}
    </section>
  );
}
