'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight, Landmark, Megaphone, PauseCircle, Send, UserPlus } from 'lucide-react';
import { broadcastSchema, platformSettingsSchema, type BroadcastResultDto, type PlatformSettings } from '@spova/shared';
import { get, post, put } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useToast } from '@/components/toast';
import { Badge, Button, Input, Select, Skeleton, Switch } from '@/components/ui';
import { Textarea } from './queue-bits';
import { friendlyError } from '@/components/portal/api-error';

/** Platform-wide switches: trading halt, announcement banner, registration and live-account opening, plus broadcasts. */
export function PlatformControls() {
  const toast = useToast();
  const [cfg, setCfg] = useState<PlatformSettings | null>(null);
  const [saved, setSaved] = useState<PlatformSettings | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    get<PlatformSettings>('/admin/platform')
      .then((p) => {
        setCfg(p);
        setSaved(p);
      })
      .catch(() => undefined);
  }, []);
  const dirty = cfg && saved && JSON.stringify(cfg) !== JSON.stringify(saved);
  const save = async () => {
    if (!cfg) return;
    const parsed = platformSettingsSchema.safeParse(cfg);
    if (!parsed.success) return toast({ title: 'Check the fields', body: parsed.error.issues[0]?.message, level: 'danger' });
    if (parsed.data.tradingHalt.enabled && !saved?.tradingHalt.enabled && !confirm('Pause trading for every client? New orders will be refused until you switch it back.')) return;
    setBusy(true);
    try {
      const p = await put<PlatformSettings>('/admin/platform', parsed.data);
      setCfg(p);
      setSaved(p);
      toast({ title: 'Platform settings saved', body: 'Every connected client sees the change now.', level: 'success' });
    } catch (e) {
      const f = friendlyError(e);
      toast({ title: f.title, body: f.body, level: 'danger' });
    } finally {
      setBusy(false);
    }
  };
  if (!cfg)
    return (
      <div className="grid gap-5 lg:grid-cols-2">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-56 rounded-2xl" />
        ))}
      </div>
    );
  return (
    <div className="space-y-5">
      <div className="grid gap-5 lg:grid-cols-2">
        <section className={cn('card p-5 transition-colors sm:p-6', cfg.tradingHalt.enabled && 'border-down/40')}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className={cn('flex h-10 w-10 items-center justify-center rounded-xl ring-1 ring-inset', cfg.tradingHalt.enabled ? 'bg-down/10 text-down ring-down/30' : 'bg-white/[0.04] text-ink-300 ring-white/10')}>
                <PauseCircle className="h-5 w-5" />
              </span>
              <div>
                <div className="font-display text-lg font-bold tracking-tight">Trading halt</div>
                <div className="text-xs text-ink-400">Refuses every new order. Open positions stay open and can still be closed; the risk engine keeps running.</div>
              </div>
            </div>
            <Switch checked={cfg.tradingHalt.enabled} onChange={(v) => setCfg({ ...cfg, tradingHalt: { ...cfg.tradingHalt, enabled: v } })} label="Trading halt" />
          </div>
          <Textarea className="mt-4" label="Message shown to clients" name="halt-msg" rows={2} value={cfg.tradingHalt.message} onChange={(e) => setCfg({ ...cfg, tradingHalt: { ...cfg.tradingHalt, message: e.target.value } })} />
          {cfg.tradingHalt.enabled && <Badge tone="danger" dot className="mt-3">Orders are refused while this is on</Badge>}
        </section>

        <section className="card p-5 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-400/10 text-brand-300 ring-1 ring-inset ring-brand-400/25">
                <Megaphone className="h-5 w-5" />
              </span>
              <div>
                <div className="font-display text-lg font-bold tracking-tight">Announcement banner</div>
                <div className="text-xs text-ink-400">A strip at the top of the terminal and the client area, for example a holiday schedule or a maintenance window.</div>
              </div>
            </div>
            <Switch checked={cfg.announcement.enabled} onChange={(v) => setCfg({ ...cfg, announcement: { ...cfg.announcement, enabled: v } })} label="Announcement" />
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_150px]">
            <Textarea label="Text" name="ann-text" rows={2} value={cfg.announcement.text} onChange={(e) => setCfg({ ...cfg, announcement: { ...cfg.announcement, text: e.target.value } })} />
            <Select label="Style" name="ann-level" value={cfg.announcement.level} onChange={(e) => setCfg({ ...cfg, announcement: { ...cfg.announcement, level: e.target.value as PlatformSettings['announcement']['level'] } })}>
              <option value="info">Info (blue)</option>
              <option value="success">Good news (green)</option>
              <option value="warning">Warning (amber)</option>
              <option value="danger">Urgent (red)</option>
            </Select>
          </div>
        </section>

        <section className="card p-5 sm:p-6">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/[0.04] text-ink-300 ring-1 ring-inset ring-white/10">
              <UserPlus className="h-5 w-5" />
            </span>
            <div className="font-display text-lg font-bold tracking-tight">Onboarding</div>
          </div>
          <div className="mt-4 space-y-3">
            <label className="flex items-center justify-between gap-4 rounded-xl border border-white/[0.07] px-4 py-3">
              <span>
                <span className="block text-sm font-medium text-white">New registrations</span>
                <span className="block text-xs text-ink-400">Off shows "registrations are paused" on the sign-up page.</span>
              </span>
              <Switch checked={cfg.registrationOpen} onChange={(v) => setCfg({ ...cfg, registrationOpen: v })} label="Registration open" />
            </label>
            <label className="flex items-center justify-between gap-4 rounded-xl border border-white/[0.07] px-4 py-3">
              <span>
                <span className="block text-sm font-medium text-white">Opening live accounts</span>
                <span className="block text-xs text-ink-400">Off keeps existing live accounts working but stops new ones.</span>
              </span>
              <Switch checked={cfg.liveAccountsOpen} onChange={(v) => setCfg({ ...cfg, liveAccountsOpen: v })} label="Live accounts open" />
            </label>
          </div>
        </section>

        <section className="card p-5 sm:p-6">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gold/10 text-gold ring-1 ring-inset ring-gold/25">
              <Landmark className="h-5 w-5" />
            </span>
            <div className="font-display text-lg font-bold tracking-tight">Deposit channels</div>
          </div>
          <p className="mt-3 text-sm text-ink-300">Bank account, UPI ID, Binance Pay ID, USDT wallet and the cashier footer are edited on the Payments page.</p>
          <Link href="/admin/payments" className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-brand-300">
            Open Payments <ArrowUpRight className="h-4 w-4" />
          </Link>
        </section>
      </div>
      <div className="flex items-center justify-end gap-3">
        {dirty && <span className="text-xs text-gold">Unsaved changes</span>}
        <Button onClick={() => void save()} loading={busy} disabled={!dirty}>
          Save platform settings
        </Button>
      </div>
      <BroadcastForm />
    </div>
  );
}

function BroadcastForm() {
  const toast = useToast();
  const [f, setF] = useState({ title: '', body: '', level: 'info', audience: 'all', email: false });
  const [err, setErr] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = broadcastSchema.safeParse(f);
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      for (const i of parsed.error.issues) errs[String(i.path[0])] ??= i.message;
      setErr(errs);
      return;
    }
    if (!confirm(`Send "${parsed.data.title}" to ${parsed.data.audience === 'all' ? 'every active client' : `clients with a ${parsed.data.audience} account`}${parsed.data.email ? ', by notification and email' : ''}?`)) return;
    setErr({});
    setBusy(true);
    try {
      const r = await post<BroadcastResultDto>('/admin/broadcast', parsed.data);
      toast({ title: 'Broadcast sent', body: `${r.recipients} client(s) notified${parsed.data.email ? `, ${r.emailed} emailed` : ''}.`, level: 'success' });
      setF({ title: '', body: '', level: 'info', audience: 'all', email: false });
    } catch (e2) {
      const f2 = friendlyError(e2);
      toast({ title: f2.title, body: f2.body, level: 'danger' });
    } finally {
      setBusy(false);
    }
  };
  return (
    <form onSubmit={send} noValidate className="card p-5 sm:p-6">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-400/10 text-brand-300 ring-1 ring-inset ring-brand-400/25">
          <Send className="h-5 w-5" />
        </span>
        <div>
          <div className="font-display text-lg font-bold tracking-tight">Broadcast a message</div>
          <div className="text-xs text-ink-400">Appears in every client's notification bell and as a toast in the terminal; optionally also by email.</div>
        </div>
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_1fr]">
        <Input label="Title" name="bc-title" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} error={err.title} />
        <div className="grid grid-cols-2 gap-3">
          <Select label="Audience" name="bc-aud" value={f.audience} onChange={(e) => setF({ ...f, audience: e.target.value })}>
            <option value="all">All active clients</option>
            <option value="live">Clients with a live account</option>
            <option value="demo">Clients with a demo account</option>
          </Select>
          <Select label="Style" name="bc-level" value={f.level} onChange={(e) => setF({ ...f, level: e.target.value })}>
            <option value="info">Info</option>
            <option value="success">Good news</option>
            <option value="warning">Warning</option>
            <option value="danger">Urgent</option>
          </Select>
        </div>
      </div>
      <Textarea className="mt-4" label="Message" name="bc-body" rows={3} value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} error={err.body} />
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-sm text-ink-200">
          <input type="checkbox" checked={f.email} onChange={(e) => setF({ ...f, email: e.target.checked })} className="h-4 w-4 accent-brand-500" /> Also send by email (respects each client's email preference)
        </label>
        <Button type="submit" loading={busy}>
          <Send className="h-4 w-4" /> Send broadcast
        </Button>
      </div>
    </form>
  );
}
