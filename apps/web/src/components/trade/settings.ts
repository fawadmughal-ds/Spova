'use client';

import { useSyncExternalStore } from 'react';
import type { Timeframe } from '@spova/shared';

/**
 * Tiny persisted stores (localStorage) with a useSyncExternalStore hook. Each store holds one JSON
 * value; `set` replaces it, `patch` merges. Writes are guarded so a blocked storage never throws.
 */
export function createLocalStore<T extends object>(key: string, defaults: T) {
  let value: T = defaults;
  let loaded = false;
  const listeners = new Set<() => void>();
  const load = () => {
    if (loaded || typeof window === 'undefined') return;
    loaded = true;
    try {
      const raw = localStorage.getItem(key);
      if (raw) value = { ...defaults, ...(JSON.parse(raw) as Partial<T>) };
    } catch {
      /* keep defaults */
    }
  };
  const get = () => {
    load();
    return value;
  };
  const set = (next: T) => {
    value = next;
    try {
      localStorage.setItem(key, JSON.stringify(next));
    } catch {
      /* storage blocked */
    }
    listeners.forEach((l) => l());
  };
  const patch = (p: Partial<T>) => set({ ...get(), ...p });
  const subscribe = (l: () => void) => {
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  };
  const use = () => useSyncExternalStore(subscribe, get, () => defaults);
  return { get, set, patch, subscribe, use };
}

export type ChartType = 'candles' | 'bars' | 'line';
export interface TerminalSettings {
  /** ask before sending one-click market orders (MatchTrader default: off) */
  confirmOrders: boolean;
  sounds: boolean;
  showVolume: boolean;
  showPositionLines: boolean;
  chartType: ChartType;
  tf: Timeframe;
  ma20: boolean;
  ma50: boolean;
  bollinger: boolean;
  /** height of the bottom panel on desktop */
  bottomHeight: number;
  bottomCollapsed: boolean;
}
export const DEFAULT_SETTINGS: TerminalSettings = {
  confirmOrders: false,
  sounds: true,
  showVolume: true,
  showPositionLines: true,
  chartType: 'candles',
  tf: 'm15',
  ma20: false,
  ma50: false,
  bollinger: false,
  bottomHeight: 330,
  bottomCollapsed: false,
};
export const settingsStore = createLocalStore<TerminalSettings>('wt-settings', DEFAULT_SETTINGS);
export const useSettings = settingsStore.use;

export interface FavouritesState {
  ids: string[];
  /** set once the featured instruments were copied in on first run */
  seeded: boolean;
}
export const favouritesStore = createLocalStore<FavouritesState>('wt-favourites', { ids: [], seeded: false });
export const useFavourites = favouritesStore.use;
export const toggleFavourite = (id: string) => {
  const ids = favouritesStore.get().ids;
  favouritesStore.set({ ids: ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id], seeded: true });
};

export interface PriceAlert {
  id: string;
  symbol: string;
  price: string;
  createdAt: number;
}
export const alertsStore = createLocalStore<{ items: PriceAlert[] }>('wt-alerts', { items: [] });
export const useAlerts = alertsStore.use;
export const addAlert = (symbol: string, price: string) => alertsStore.set({ items: [...alertsStore.get().items, { id: crypto.randomUUID(), symbol, price, createdAt: Date.now() }] });
export const removeAlert = (id: string) => alertsStore.set({ items: alertsStore.get().items.filter((a) => a.id !== id) });

/** Chart templates: a named snapshot of the chart-related settings. */
export type ChartTemplate = Pick<TerminalSettings, 'chartType' | 'tf' | 'ma20' | 'ma50' | 'bollinger' | 'showVolume' | 'showPositionLines'>;
export const TEMPLATE_NAMES = ['Template 1', 'Template 2', 'Template 3'] as const;
export const templatesStore = createLocalStore<{ active: string; saved: Record<string, ChartTemplate> }>('wt-templates', { active: 'Template 1', saved: {} });
export const useTemplates = templatesStore.use;
export const pickTemplate = (s: TerminalSettings): ChartTemplate => ({ chartType: s.chartType, tf: s.tf, ma20: s.ma20, ma50: s.ma50, bollinger: s.bollinger, showVolume: s.showVolume, showPositionLines: s.showPositionLines });
