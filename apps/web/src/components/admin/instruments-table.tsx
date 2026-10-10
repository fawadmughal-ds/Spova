'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pencil, Search, Star } from 'lucide-react';
import { ASSET_CLASSES, adminSymbolPatchSchema, type AdminSymbolDto, type AdminSymbolPatch } from '@spova/shared';
import { get, patch } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useToast } from '@/components/toast';
import { Badge, Button, Input, Skeleton, Switch } from '@/components/ui';
import { PanelHeader, SidePanel, StatusTabs } from './queue-bits';
import { friendlyError } from '@/components/portal/api-error';

type ClassTab = 'all' | (typeof ASSET_CLASSES)[number];
const CLASS_LABEL: Record<string, string> = { forex: 'Forex', metal: 'Metals', commodity: 'Energies', index: 'Indices', stock: 'Shares', crypto: 'Crypto' };
const spreadOf = (s: AdminSymbolDto) => (s.bid && s.ask ? (Number(s.ask) - Number(s.bid)) / Math.pow(10, -s.digits) : null);
const stale = (s: AdminSymbolDto) => !s.quoteTs || Date.now() - s.quoteTs > 120_000;

/** Every instrument with its live quote and the switches / numbers the broker controls. Edits open a side panel. */
export function InstrumentsTable() {
  const toast = useToast();
  const [rows, setRows] = useState<AdminSymbolDto[] | null>(null);
  const [cls, setCls] = useState<ClassTab>('all');
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState<AdminSymbolDto | null>(null);

  const load = useCallback(() => get<AdminSymbolDto[]>('/admin/symbols').then(setRows).catch(() => setRows([])), []);
  useEffect(() => {
    void load();
    const id = setInterval(() => void load(), 15_000);
    return () => clearInterval(id);
  }, [load]);

  const list = useMemo(() => (rows ?? []).filter((s) => (cls === 'all' || s.assetClass === cls) && (!q || s.id.toLowerCase().includes(q.toLowerCase()) || s.name.toLowerCase().includes(q.toLowerCase()))), [rows, cls, q]);
  const save = async (id: string, p: AdminSymbolPatch) => {
    try {
      const updated = await patch<AdminSymbolDto>(`/admin/symbols/${id}`, p);
      setRows((r) => (r ? r.map((x) => (x.id === id ? updated : x)) : r));
      setEditing((e) => (e && e.id === id ? updated : e));
      toast({ title: `${id} updated`, level: 'success' });
      return true;
    } catch (e) {
      const f = friendlyError(e);
      toast({ title: f.title, body: f.body, level: 'danger' });
      return false;
    }
  };

  const tabs = [{ value: 'all' as ClassTab, label: 'All' }, ...ASSET_CLASSES.map((c) => ({ value: c as ClassTab, label: CLASS_LABEL[c] ?? c }))];

  return (
    <>
      <section className="card p-5 sm:p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <StatusTabs items={tabs} value={cls} onChange={setCls} />
          <label className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-500" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search" className="h-9 w-48 rounded-lg border border-white/10 bg-white/[0.03] pl-9 pr-3 text-sm text-white outline-none focus:border-brand-400/60" />
          </label>
        </div>
        {!rows ? (
          <div className="space-y-2">
            {[0, 1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-11 rounded-xl" />
            ))}
          </div>
        ) : (
          <div className="-mx-2 overflow-x-auto">
            <table className="w-full min-w-[920px] text-sm">
              <thead className="text-left">
                <tr>
                  <th className="label py-2 pl-2 pr-4 font-medium">Instrument</th>
                  <th className="label py-2 pr-4 font-medium">Feed</th>
                  <th className="label py-2 pr-4 text-right font-medium">Bid / Ask</th>
                  <th className="label py-2 pr-4 text-right font-medium">Spread</th>
                  <th className="label py-2 pr-4 text-right font-medium">Markup</th>
                  <th className="label py-2 pr-4 text-right font-medium">Swap L / S</th>
                  <th className="label py-2 pr-4 text-right font-medium">Lev. max</th>
                  <th className="label py-2 pr-4 text-right font-medium">Open pos.</th>
                  <th className="label py-2 pr-4 font-medium">Featured</th>
                  <th className="label py-2 pr-4 font-medium">Enabled</th>
                  <th className="label w-[1%] py-2 pr-2 font-medium" />
                </tr>
              </thead>
              <tbody>
                {list.map((s, i) => (
                  <tr key={s.id} className={cn('animate-page-in border-t border-white/[0.05] transition-colors hover:bg-white/[0.03]', !s.enabled && 'opacity-60')} style={{ animationDelay: `${i * 20}ms` }}>
                    <td className="py-2.5 pl-2 pr-4">
                      <div className="font-mono font-semibold text-white">{s.id}</div>
                      <div className="text-xs text-ink-400">
                        {s.name} · <span className="uppercase">{CLASS_LABEL[s.assetClass] ?? s.assetClass}</span>
                      </div>
                    </td>
                    <td className="py-2.5 pr-4 text-xs">
                      <Badge tone={s.feedSource === 'synthetic' ? 'warning' : 'success'}>{s.feedSource}</Badge>
                      <div className="mt-0.5 font-mono text-[11px] text-ink-500">{s.feedSymbol}</div>
                    </td>
                    <td className="tabular py-2.5 pr-4 text-right font-mono">
                      {s.bid ? (
                        <span className={cn(stale(s) && 'text-ink-500')}>
                          {s.bid} / {s.ask}
                        </span>
                      ) : (
                        <span className="text-ink-500">—</span>
                      )}
                      {s.bid && stale(s) && <div className="text-[10px] text-gold">stale</div>}
                    </td>
                    <td className="tabular py-2.5 pr-4 text-right font-mono">{spreadOf(s) === null ? '—' : `${spreadOf(s)!.toFixed(0)} pts`}</td>
                    <td className="tabular py-2.5 pr-4 text-right font-mono">{s.spreadMarkup}</td>
                    <td className="tabular py-2.5 pr-4 text-right font-mono text-xs">
                      {s.swapLong} / {s.swapShort}
                    </td>
                    <td className="tabular py-2.5 pr-4 text-right font-mono">1:{s.leverageMax}</td>
                    <td className="tabular py-2.5 pr-4 text-right font-mono">{s.openPositions}</td>
                    <td className="py-2.5 pr-4">
                      <button type="button" aria-label={s.featured ? 'Remove from featured' : 'Feature'} onClick={() => void save(s.id, { featured: !s.featured })} className={cn('transition-colors', s.featured ? 'text-gold' : 'text-ink-600 hover:text-ink-300')}>
                        <Star className={cn('h-4 w-4', s.featured && 'fill-current')} />
                      </button>
                    </td>
                    <td className="py-2.5 pr-4">
                      <Switch checked={s.enabled} onChange={(v) => void save(s.id, { enabled: v })} label={`${s.id} enabled`} />
                    </td>
                    <td className="py-2.5 pr-2">
                      <Button size="sm" variant="ghost" onClick={() => setEditing(s)}>
                        <Pencil className="h-3.5 w-3.5" /> Edit
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {/* the editor slides in as a drawer on every width; the table keeps the full page */}
      <SidePanel open={!!editing} onClose={() => setEditing(null)} split={false}>
        {editing && <EditPanel key={editing.id} s={editing} onClose={() => setEditing(null)} onSave={(p) => save(editing.id, p)} />}
      </SidePanel>
    </>
  );
}

function EditPanel({ s, onClose, onSave }: { s: AdminSymbolDto; onClose: () => void; onSave: (p: AdminSymbolPatch) => Promise<boolean> }) {
  const [f, setF] = useState({ name: s.name, spreadMarkup: s.spreadMarkup, swapLong: s.swapLong, swapShort: s.swapShort, leverageMax: String(s.leverageMax), minLot: s.minLot, maxLot: s.maxLot, lotStep: s.lotStep, sortOrder: String(s.sortOrder) });
  const [err, setErr] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF((x) => ({ ...x, [k]: e.target.value }));
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = adminSymbolPatchSchema.safeParse({ ...f, leverageMax: Number(f.leverageMax), sortOrder: Number(f.sortOrder) });
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      for (const i of parsed.error.issues) errs[String(i.path[0])] ??= i.message;
      setErr(errs);
      return;
    }
    setErr({});
    setBusy(true);
    if (await onSave(parsed.data)) onClose();
    setBusy(false);
  };
  const pip = Math.pow(10, -s.digits);
  return (
    <>
      <PanelHeader title={<span className="font-mono">{s.id}</span>} sub={`${s.name} · ${s.feedSource}:${s.feedSymbol} · ${s.digits} digits`} onClose={onClose} />
      <form onSubmit={submit} noValidate className="space-y-5 p-5">
        <Input label="Display name" name="name" value={f.name} onChange={set('name')} error={err.name} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Spread markup (price units)" name="spreadMarkup" value={f.spreadMarkup} onChange={set('spreadMarkup')} error={err.spreadMarkup} hint={`Added to the raw quote: half on each side. 1 point = ${pip}`} />
          <Input label="Max leverage (1:x)" name="leverageMax" type="number" value={f.leverageMax} onChange={set('leverageMax')} error={err.leverageMax} />
          <Input label="Swap long (points / night)" name="swapLong" value={f.swapLong} onChange={set('swapLong')} error={err.swapLong} />
          <Input label="Swap short (points / night)" name="swapShort" value={f.swapShort} onChange={set('swapShort')} error={err.swapShort} />
          <Input label="Min lot" name="minLot" value={f.minLot} onChange={set('minLot')} error={err.minLot} />
          <Input label="Max lot" name="maxLot" value={f.maxLot} onChange={set('maxLot')} error={err.maxLot} />
          <Input label="Lot step" name="lotStep" value={f.lotStep} onChange={set('lotStep')} error={err.lotStep} />
          <Input label="Sort order" name="sortOrder" type="number" value={f.sortOrder} onChange={set('sortOrder')} error={err.sortOrder} hint="Lower shows first in the terminal" />
        </div>
        <p className="text-xs text-ink-400">Changes apply to new orders within 30 seconds. Open positions keep the terms they were opened with. {s.openPositions > 0 && <span className="text-gold">{s.openPositions} position(s) are open on this instrument now.</span>}</p>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={busy}>
            Save instrument
          </Button>
        </div>
      </form>
    </>
  );
}
