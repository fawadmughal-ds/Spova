'use client';

import { useCallback, useEffect, useState } from 'react';
import { CalendarClock, Lock, Play, Unlock } from 'lucide-react';
import { KYC_GROUPS, type KycDeadlineRowDto } from '@spova/shared';
import { get, post } from '@/lib/api';
import { cn, fmtDate } from '@/lib/utils';
import { useToast } from '@/components/toast';
import { Badge, Button, Skeleton } from '@/components/ui';
import { ClientCell } from './queue-bits';
import { friendlyError } from '@/components/portal/api-error';

const GROUP_SHORT: Record<string, string> = { poi: 'ID', por: 'Address', payment: 'Payment', other: 'Other' };

/** Clients still missing documents: frozen ones first, then by days left. Admins can unfreeze (gives 15 more days) or run the sweep now. */
export function KycDeadlines({ limit, className }: { limit?: number; className?: string }) {
  const toast = useToast();
  const [rows, setRows] = useState<KycDeadlineRowDto[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const load = useCallback(() => get<KycDeadlineRowDto[]>('/admin/kyc/deadlines').then(setRows).catch(() => setRows([])), []);
  useEffect(() => {
    void load();
  }, [load]);
  const unfreeze = async (id: string) => {
    setBusy(id);
    try {
      await post(`/admin/kyc/users/${id}/unfreeze`);
      toast({ title: 'Client unfrozen', body: 'Trading is open again and the client has 15 more days to upload the missing documents.', level: 'success' });
      await load();
    } catch (e) {
      const f = friendlyError(e);
      toast({ title: f.title, body: f.body, level: 'danger' });
    } finally {
      setBusy(null);
    }
  };
  const sweep = async () => {
    setBusy('sweep');
    try {
      const r = await post<{ checked: number; reminded: number; frozen: number }>('/admin/kyc/sweep');
      toast({ title: 'Deadline check complete', body: `${r.checked} checked · ${r.reminded} reminded · ${r.frozen} frozen`, level: 'info' });
      await load();
    } catch (e) {
      const f = friendlyError(e);
      toast({ title: f.title, body: f.body, level: 'danger' });
    } finally {
      setBusy(null);
    }
  };
  const list = limit ? (rows ?? []).slice(0, limit) : (rows ?? []);
  return (
    <section className={cn('card p-5 sm:p-6', className)}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 font-display text-lg font-bold">
          <CalendarClock className="h-5 w-5 text-gold" /> Document deadlines
        </div>
        <Button size="sm" variant="outline" loading={busy === 'sweep'} onClick={() => void sweep()}>
          <Play className="h-3.5 w-3.5" /> Run check now
        </Button>
      </div>
      <p className="mb-4 text-xs text-ink-400">Every client has 15 days from sign-up to upload one document in each group. A reminder goes out 3 days before; at the deadline trading is frozen until the documents arrive. The check runs every hour by itself.</p>
      {!rows ? (
        <Skeleton className="h-24 rounded-xl" />
      ) : list.length === 0 ? (
        <p className="text-sm text-ink-400">Everyone is either complete or well inside their window.</p>
      ) : (
        <ul className="divide-y divide-white/[0.05]">
          {list.map((r) => (
            <li key={r.user.id} className="flex flex-wrap items-center gap-3 py-2.5">
              <div className="min-w-[200px] flex-1">
                <ClientCell user={r.user} />
              </div>
              <div className="flex flex-wrap gap-1">
                {KYC_GROUPS.map((g) => (
                  <Badge key={g} tone={r.uploadedGroups.includes(g) ? 'success' : 'neutral'}>
                    {GROUP_SHORT[g] ?? g}
                  </Badge>
                ))}
              </div>
              <div className="w-[150px] text-xs">
                {r.frozen ? (
                  <Badge tone="danger">
                    <Lock className="h-3 w-3" /> Frozen {r.frozenAt ? fmtDate(r.frozenAt, false) : ''}
                  </Badge>
                ) : (
                  <span className={cn('font-mono', r.daysLeft <= 3 ? 'text-gold' : 'text-ink-300')}>
                    {r.daysLeft <= 0 ? 'due now' : `${r.daysLeft} day${r.daysLeft === 1 ? '' : 's'} left`} · {fmtDate(r.deadlineAt, false)}
                  </span>
                )}
              </div>
              {r.frozen && (
                <Button size="sm" variant="secondary" loading={busy === r.user.id} onClick={() => void unfreeze(r.user.id)}>
                  <Unlock className="h-3.5 w-3.5" /> Unfreeze
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
