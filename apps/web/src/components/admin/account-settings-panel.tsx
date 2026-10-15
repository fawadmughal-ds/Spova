'use client';

import { useEffect, useState } from 'react';
import type { AccountDto } from '@spova/shared';
import { del, patch, ApiError } from '@/lib/api';
import { useToast } from '@/components/toast';
import { Button, Card, Input, Select } from '@/components/ui';

const TIERS = ['classic', 'silver', 'gold', 'platinum', 'vip'] as const;

/** Leverage / tier / status / trading block. Each save = PATCH /admin/accounts/:id (+audit). */
export function AccountSettingsPanel({ account, onChanged, onDeleted }: { account: AccountDto; onChanged: (a: AccountDto) => void; onDeleted?: (id: string) => void }) {
  const toast = useToast();
  const [deleting, setDeleting] = useState(false);
  const [leverage, setLeverage] = useState(String(account.leverage));
  const [tier, setTier] = useState<string>(account.tier);
  const [status, setStatus] = useState<string>(account.status);
  const [blocked, setBlocked] = useState(account.tradingBlocked);
  const [swapFree, setSwapFree] = useState(account.swapFree);
  const [usdRate, setUsdRate] = useState(account.usdRate ?? '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setLeverage(String(account.leverage));
    setTier(account.tier);
    setStatus(account.status);
    setBlocked(account.tradingBlocked);
    setSwapFree(account.swapFree);
    setUsdRate(account.usdRate ?? '');
  }, [account]);

  const save = async () => {
    setSaving(true);
    try {
      const a = await patch<AccountDto>(`/admin/accounts/${account.id}`, {
        leverage: Number(leverage),
        tier,
        status,
        tradingBlocked: blocked,
        swapFree,
        usdRate: usdRate === '' ? null : Number(usdRate),
      });
      onChanged(a);
      toast({ title: 'Account updated', level: 'success' });
    } catch (e) {
      toast({ title: 'Update failed', body: e instanceof ApiError ? e.message : undefined, level: 'danger' });
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!confirm(`Delete ${account.type} account ${account.loginCode}? This permanently removes the account and all its trades, orders and ledger history. This cannot be undone.`)) return;
    setDeleting(true);
    try {
      await del(`/admin/accounts/${account.id}`);
      toast({ title: `Account ${account.loginCode} deleted`, level: 'success' });
      onDeleted?.(account.id);
    } catch (e) {
      toast({ title: 'Delete failed', body: e instanceof ApiError ? e.message : undefined, level: 'danger' });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Card title="Account settings">
      <div className="space-y-3">
        <Select label="Leverage" value={leverage} onChange={(e) => setLeverage(e.target.value)}>
          {[1, 2, 5, 10, 20, 30, 50, 100, 200, 300, 400].map((l) => (
            <option key={l} value={l}>
              1:{l}
            </option>
          ))}
        </Select>
        <Select label="Tier" value={tier} onChange={(e) => setTier(e.target.value)}>
          {TIERS.map((t) => (
            <option key={t} value={t} className="capitalize">
              {t}
            </option>
          ))}
        </Select>
        <Select label="Status" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="enabled">Enabled</option>
          <option value="readonly">Read-only (close only)</option>
          <option value="disabled">Disabled</option>
        </Select>
        <label className="flex items-center justify-between rounded-xl border border-white/10 px-3 py-2.5 text-sm">
          <span>
            Block trading
            <span className="block text-xs text-ink-500">Client cannot open or close positions</span>
          </span>
          <input type="checkbox" className="h-5 w-5 accent-down" checked={blocked} onChange={(e) => setBlocked(e.target.checked)} />
        </label>
        <label className="flex items-center justify-between rounded-xl border border-white/10 px-3 py-2.5 text-sm">
          <span>
            Swap-free
            <span className="block text-xs text-ink-500">No overnight swap charges on this account</span>
          </span>
          <input type="checkbox" className="h-5 w-5 accent-brand-500" checked={swapFree} onChange={(e) => setSwapFree(e.target.checked)} />
        </label>
        <Input
          label="USD rate override (per account)"
          type="number"
          inputMode="decimal"
          value={usdRate}
          onChange={(e) => setUsdRate(e.target.value)}
          placeholder="Blank = global cashier rate"
        />
        <Input label="Login code" value={account.loginCode} readOnly disabled />
        <Button className="w-full" variant="secondary" onClick={() => void save()} loading={saving}>
          Save settings
        </Button>
        <Button className="w-full" variant="danger" onClick={() => void remove()} loading={deleting}>
          Delete account
        </Button>
      </div>
    </Card>
  );
}
