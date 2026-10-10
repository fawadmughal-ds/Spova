'use client';

import { useEffect, useState } from 'react';
import { ShieldHalf } from 'lucide-react';
import { riskConfigSchema, type RiskConfigDto } from '@spova/shared';
import { get, put } from '@/lib/api';
import { fmtMoney } from '@/lib/utils';
import { useToast } from '@/components/toast';
import { Badge, Button, Input, Skeleton } from '@/components/ui';
import { friendlyError } from '@/components/portal/api-error';

/** One editable card per account tier: margin call, stop-out, leverage and minimum deposit. */
export function RiskTiers() {
  const [rows, setRows] = useState<RiskConfigDto[] | null>(null);
  useEffect(() => {
    get<RiskConfigDto[]>('/admin/risk-config').then(setRows).catch(() => setRows([]));
  }, []);
  if (!rows)
    return (
      <div className="grid gap-4 lg:grid-cols-2">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-64 rounded-2xl" />
        ))}
      </div>
    );
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {rows.map((r) => (
        <TierCard key={r.tier} r={r} onSaved={(u) => setRows((x) => (x ? x.map((y) => (y.tier === u.tier ? u : y)) : x))} />
      ))}
    </div>
  );
}

function TierCard({ r, onSaved }: { r: RiskConfigDto; onSaved: (r: RiskConfigDto) => void }) {
  const toast = useToast();
  const [f, setF] = useState({ marginCallPct: String(r.marginCallPct), stopOutPct: String(r.stopOutPct), defaultLeverage: String(r.defaultLeverage), maxLeverage: String(r.maxLeverage), minDeposit: r.minDeposit, spreadDiscountPct: String(r.spreadDiscountPct) });
  const [err, setErr] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF((x) => ({ ...x, [k]: e.target.value }));
  const dirty = f.marginCallPct !== String(r.marginCallPct) || f.stopOutPct !== String(r.stopOutPct) || f.defaultLeverage !== String(r.defaultLeverage) || f.maxLeverage !== String(r.maxLeverage) || f.minDeposit !== r.minDeposit || f.spreadDiscountPct !== String(r.spreadDiscountPct);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = riskConfigSchema.safeParse({ marginCallPct: Number(f.marginCallPct), stopOutPct: Number(f.stopOutPct), defaultLeverage: Number(f.defaultLeverage), maxLeverage: Number(f.maxLeverage), minDeposit: f.minDeposit, spreadDiscountPct: Number(f.spreadDiscountPct) });
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      for (const i of parsed.error.issues) errs[String(i.path[0])] ??= i.message;
      setErr(errs);
      return;
    }
    setErr({});
    setBusy(true);
    try {
      const u = await put<RiskConfigDto>(`/admin/risk-config/${r.tier}`, parsed.data);
      onSaved(u);
      toast({ title: `${r.tier} tier saved`, body: 'New orders and margin checks use the new levels immediately.', level: 'success' });
    } catch (e2) {
      const f2 = friendlyError(e2);
      toast({ title: f2.title, body: f2.body, level: 'danger' });
    } finally {
      setBusy(false);
    }
  };
  return (
    <form onSubmit={submit} noValidate className="card p-5 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gold/10 text-gold ring-1 ring-inset ring-gold/25">
            <ShieldHalf className="h-5 w-5" />
          </span>
          <div>
            <div className="font-display text-lg font-bold capitalize tracking-tight">{r.tier}</div>
            <div className="text-xs text-ink-400">
              {r.accounts} account{r.accounts === 1 ? '' : 's'} · min deposit {fmtMoney(r.minDeposit)} USD
            </div>
          </div>
        </div>
        {dirty && <Badge tone="warning">Unsaved</Badge>}
      </div>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <Input label="Margin call (%)" name={`${r.tier}-mc`} type="number" value={f.marginCallPct} onChange={set('marginCallPct')} error={err.marginCallPct} hint="Warning and no new positions below this level" />
        <Input label="Stop-out (%)" name={`${r.tier}-so`} type="number" value={f.stopOutPct} onChange={set('stopOutPct')} error={err.stopOutPct} hint="Positions are closed automatically below this" />
        <Input label="Default leverage (1:x)" name={`${r.tier}-dl`} type="number" value={f.defaultLeverage} onChange={set('defaultLeverage')} error={err.defaultLeverage} />
        <Input label="Max leverage (1:x)" name={`${r.tier}-ml`} type="number" value={f.maxLeverage} onChange={set('maxLeverage')} error={err.maxLeverage} />
        <Input label="Minimum deposit (USD)" name={`${r.tier}-md`} value={f.minDeposit} onChange={set('minDeposit')} error={err.minDeposit} />
        <Input label="Spread discount (%)" name={`${r.tier}-sd`} type="number" value={f.spreadDiscountPct} onChange={set('spreadDiscountPct')} error={err.spreadDiscountPct} hint="Applied to the instrument markup for this tier" />
      </div>
      <div className="mt-5 flex justify-end">
        <Button type="submit" loading={busy} disabled={!dirty}>
          Save {r.tier}
        </Button>
      </div>
    </form>
  );
}
