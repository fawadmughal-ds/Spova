'use client';

import { useRef, useState } from 'react';
import { ArrowRight, Ban, MessageSquareText, Paperclip } from 'lucide-react';
import { KYC_MIME_TYPES } from '@spova/shared';
import type { PaymentMethodDto, PaymentRequestDto } from '@spova/shared';
import { fileUrl, post, upload } from '@/lib/api';
import { cn, fmtDate, fmtMoney } from '@/lib/utils';
import { Button } from '@/components/ui';
import { useToast } from '@/components/toast';
import { fmtLogin } from './account-plate';
import { LedgerIcon } from './ledger-icon';
import { PaymentChip } from './status-chip';
import { friendlyError } from './api-error';

/** Short, readable handle for a request id: first 8 hex chars, upper-cased. */
export const shortId = (id: string) => id.replace(/-/g, '').slice(0, 8).toUpperCase();

/** One deposit / withdrawal request. Pending rows can be cancelled after an inline confirmation. */
export function PaymentRow({ p, methods, index = 0, onChanged, compact }: { p: PaymentRequestDto; methods?: PaymentMethodDto[]; index?: number; onChanged?: (p: PaymentRequestDto) => void; compact?: boolean }) {
  const toast = useToast();
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const withdraw = p.kind === 'withdraw';

  const attach = async (file: File) => {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.set('file', file, file.name);
      const updated = await upload<PaymentRequestDto>(`/me/payments/${p.id}/proof`, fd);
      toast({ title: 'Payment proof attached', body: file.name, level: 'success' });
      onChanged?.(updated);
    } catch (e) {
      const f = friendlyError(e);
      toast({ title: f.title, body: f.body, level: 'danger' });
    } finally {
      setUploading(false);
    }
  };
  const method = methods?.find((m) => m.id === p.method)?.label ?? p.method;

  const cancel = async () => {
    setBusy(true);
    try {
      const updated = await post<PaymentRequestDto>(`/me/payments/${p.id}/cancel`);
      toast({ title: 'Request cancelled', body: `${withdraw ? 'Withdrawal' : 'Deposit'} of ${fmtMoney(p.amount)} ${p.currency} will not be processed.`, level: 'info' });
      onChanged?.(updated);
    } catch (e) {
      const f = friendlyError(e);
      toast({ title: f.title, body: f.body, level: 'danger' });
    } finally {
      setBusy(false);
      setConfirm(false);
    }
  };

  return (
    <li
      className={cn(
        'animate-page-in group rounded-2xl border transition-colors duration-300',
        compact ? 'border-transparent px-2 py-2.5 hover:bg-white/[0.035]' : 'border-white/[0.07] bg-white/[0.02] p-3.5 hover:border-white/[0.14]',
        p.status === 'pending' && !compact && 'border-gold/25',
      )}
      style={{ animationDelay: `${index * 55}ms` }}
    >
      <div className="flex items-start gap-3.5">
        <LedgerIcon type={p.kind} negative={withdraw} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-sm font-semibold capitalize text-white">{withdraw ? 'Withdrawal' : 'Deposit'}</span>
            <PaymentChip status={p.status} />
            {p.testMode && (
              <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-ink-400 ring-1 ring-inset ring-white/10">
                Test mode
              </span>
            )}
            {!compact && (
              <span className="text-xs text-ink-500">
                via {method} · acc <span className="tabular font-mono">{fmtLogin(p.accountLogin)}</span>
              </span>
            )}
          </div>
          <div className="mt-1 text-[11px] text-ink-500">
            {compact ? `${method} · ` : ''}
            {fmtDate(p.createdAt)}
            {p.decidedAt && !compact && <span> · decided {fmtDate(p.decidedAt)}</span>}
          </div>
          {!compact && p.destination && (
            <div className="mt-1.5 flex items-start gap-1.5 text-xs text-ink-300">
              <ArrowRight className="mt-0.5 h-3 w-3 shrink-0 text-ink-500" />
              <span className="min-w-0 break-all">
                <span className="font-medium text-ink-200">{p.destination.label}</span> · {p.destination.details}
              </span>
            </div>
          )}
          {!compact && p.reference && (
            <div className="mt-1 text-xs text-ink-400">
              {withdraw ? 'Reason' : 'Reference'}: <span className="font-mono text-ink-300">{p.reference}</span>
            </div>
          )}
          {!compact && p.card && (p.card.brand || p.card.last4) && (
            <div className="mt-1 text-xs text-ink-400">
              Card: <span className="font-medium capitalize text-ink-200">{p.card.brand ?? 'card'}</span>
              {p.card.last4 ? <span className="font-mono text-ink-300"> ···· {p.card.last4}</span> : null}
              {p.card.name ? <span className="text-ink-500"> · {p.card.name}</span> : null}
            </div>
          )}
          {!compact && !withdraw && (
            <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs">
              {p.proof ? (
                <a href={fileUrl(`/me/payments/${p.id}/proof`)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-full border border-up/30 bg-up/[0.06] px-2.5 py-0.5 text-up transition-colors hover:bg-up/10">
                  <Paperclip className="h-3 w-3" /> Proof: <span className="max-w-[180px] truncate font-mono">{p.proof.name}</span>
                </a>
              ) : p.status === 'pending' && onChanged ? (
                <>
                  <input ref={fileInput} type="file" accept={KYC_MIME_TYPES.join(',')} className="sr-only" tabIndex={-1} onChange={(e) => e.target.files?.[0] && void attach(e.target.files[0])} />
                  <button type="button" disabled={uploading} onClick={() => fileInput.current?.click()} className="inline-flex items-center gap-1.5 rounded-full border border-gold/40 bg-gold/[0.08] px-2.5 py-0.5 text-gold transition-colors hover:bg-gold/15 disabled:opacity-60">
                    <Paperclip className="h-3 w-3" /> {uploading ? 'Uploading…' : 'Attach payment proof'}
                  </button>
                  <span className="text-ink-500">No slip attached yet</span>
                </>
              ) : null}
            </div>
          )}
          {p.adminNote && (
            <div className={cn('mt-2 flex items-start gap-2 rounded-xl px-3 py-2 text-xs ring-1 ring-inset', p.status === 'declined' ? 'bg-down/[0.06] text-down ring-down/20' : 'bg-white/[0.04] text-ink-200 ring-white/10')}>
              <MessageSquareText className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                <span className="font-semibold">Back office:</span> {p.adminNote}
              </span>
            </div>
          )}
        </div>
        <div className="tabular shrink-0 text-right font-mono">
          <div className={cn('font-semibold', withdraw ? 'text-down' : 'text-up', p.status !== 'approved' && p.status !== 'pending' && 'text-ink-400 line-through decoration-ink-500/60')}>
            {withdraw ? '-' : '+'}
            {fmtMoney(p.amount)}
          </div>
          <div className="mt-0.5 text-[11px] text-ink-500">{p.currency}</div>
        </div>
      </div>

      {p.status === 'pending' && onChanged && (
        <div className="mt-3 border-t border-white/[0.06] pt-3">
          {confirm ? (
            <div className="animate-pop-in flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs text-ink-200">Cancel this {withdraw ? 'withdrawal' : 'deposit'} request? This cannot be undone.</span>
              <span className="flex gap-2">
                <Button size="sm" variant="ghost" onClick={() => setConfirm(false)} disabled={busy}>
                  Keep it
                </Button>
                <Button size="sm" variant="danger" onClick={() => void cancel()} loading={busy}>
                  Yes, cancel
                </Button>
              </span>
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[11px] text-ink-500">Waiting for the back office. You can still cancel.</span>
              <button type="button" onClick={() => setConfirm(true)} className="inline-flex items-center gap-1.5 rounded-full border border-white/10 px-3 py-1 text-xs text-ink-300 transition-colors hover:border-down/40 hover:text-down">
                <Ban className="h-3 w-3" /> Cancel request
              </button>
            </div>
          )}
        </div>
      )}
    </li>
  );
}
