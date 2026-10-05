'use client';

import { useCallback, useEffect, useState } from 'react';
import type { AccountDto, WsAccountSnapshot } from '@spova/shared';
import { get } from '@/lib/api';
import { useAccountStream } from '@/lib/ws';

interface AccountsResponse {
  demo: AccountDto[];
  live: AccountDto[];
}

/** Loads the user's accounts and patches them in place from WS snapshots. */
export function useAccounts() {
  const [data, setData] = useState<AccountsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setData(await get<AccountsResponse>('/me/accounts'));
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const { connected } = useAccountStream((s: WsAccountSnapshot) => {
    setData((d) => {
      if (!d) return d;
      const patch = (a: AccountDto) =>
        a.id === s.accountId
          ? { ...a, balance: s.balance, credit: s.credit, equity: s.equity, usedMargin: s.usedMargin, freeMargin: s.freeMargin, marginLevel: s.marginLevel }
          : a;
      return { demo: d.demo.map(patch), live: d.live.map(patch) };
    });
  });

  const all = data ? [...data.live, ...data.demo] : [];
  return { data, all, error, reload: load, connected };
}
