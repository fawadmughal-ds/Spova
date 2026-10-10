'use client';

import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { Check, Copy, FileImage, FileText, Paperclip, QrCode, TriangleAlert, X } from 'lucide-react';
import QRCode from 'qrcode';
import { KYC_MAX_BYTES, KYC_MIME_TYPES, type DepositChannelDto } from '@spova/shared';
import { cn } from '@/lib/utils';
import { fmtBytes } from './upload-zone';

/** QR payload for a channel; UPI gets the amount appended so the app pre-fills it. */
export function qrPayload(ch: DepositChannelDto, amount: string): string | null {
  if (!ch.qr) return null;
  if (ch.qrKind === 'upi' && amount && Number(amount) > 0) return `${ch.qr}&am=${Number(amount).toFixed(2)}`;
  return ch.qr;
}

function CopyButton({ value }: { value: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button
      type="button"
      aria-label="Copy"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setOk(true);
          setTimeout(() => setOk(false), 1400);
        } catch {
          /* clipboard blocked */
        }
      }}
      className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border transition-colors', ok ? 'border-up/40 bg-up/10 text-up' : 'border-white/10 text-ink-400 hover:border-brand-400/50 hover:text-brand-300')}
    >
      {ok ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}

/** "Pay to" details of the chosen deposit method: fields with copy buttons, a scannable QR and the admin's note. */
export function PayToPanel({ channel, amount, className }: { channel: DepositChannelDto; amount: string; className?: string }) {
  const payload = qrPayload(channel, amount);
  const [png, setPng] = useState<string | null>(null);
  useEffect(() => {
    if (!payload) {
      setPng(null);
      return;
    }
    let live = true;
    QRCode.toDataURL(payload, { width: 176, margin: 1, color: { dark: '#0b1220', light: '#ffffff' } })
      .then((d) => live && setPng(d))
      .catch(() => live && setPng(null));
    return () => {
      live = false;
    };
  }, [payload]);

  return (
    <div className={cn('animate-page-in rounded-2xl border border-brand-400/25 bg-brand-400/[0.04] p-4 sm:p-5', className)}>
      <div className="flex flex-col gap-5 sm:flex-row">
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-white">{channel.title}</div>
          {channel.fields.length > 0 ? (
            <dl className="mt-3 space-y-2">
              {channel.fields.map((f) => (
                <div key={f.label} className="flex items-center gap-3 rounded-xl bg-paper/70 px-3 py-2 ring-1 ring-inset ring-white/[0.08]">
                  <dt className="w-28 shrink-0 text-[11px] uppercase tracking-[0.1em] text-ink-500">{f.label}</dt>
                  <dd className="min-w-0 flex-1 break-all font-mono text-[13px] text-white">{f.value}</dd>
                  {f.copy && <CopyButton value={f.value} />}
                </div>
              ))}
            </dl>
          ) : null}
          {channel.note && <p className="mt-3 text-xs leading-relaxed text-ink-300">{channel.note}</p>}
        </div>
        {png && (
          <div className="flex shrink-0 flex-col items-center gap-2 self-start">
            <div className="rounded-2xl border border-white/10 bg-white p-2 shadow-sm">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={png} alt="Payment QR code" width={176} height={176} />
            </div>
            <span className="inline-flex items-center gap-1 text-[11px] text-ink-400">
              <QrCode className="h-3 w-3" /> {channel.qrKind === 'upi' ? 'Scan with any UPI app' : channel.qrKind === 'link' ? 'Scan in the Binance app' : 'Scan with your wallet app'}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

const ACCEPT = KYC_MIME_TYPES.join(',');

/** Picks the payment slip / screenshot before the request is sent. Validates type and size locally. */
export function ProofPicker({ file, onChange, required, error }: { file: File | null; onChange: (f: File | null) => void; required: boolean; error?: string }) {
  const input = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [local, setLocal] = useState<string | null>(null);

  useEffect(() => {
    if (!file || !file.type.startsWith('image/')) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const pick = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    e.target.value = '';
    if (!f) return;
    if (!(KYC_MIME_TYPES as readonly string[]).includes(f.type)) return setLocal('Only JPG, PNG, WEBP or PDF files are accepted.');
    if (f.size > KYC_MAX_BYTES) return setLocal(`This file is ${fmtBytes(f.size)}. The limit is 10 MB.`);
    setLocal(null);
    onChange(f);
  };
  const problem = local ?? error;

  return (
    <div>
      <input ref={input} type="file" accept={ACCEPT} className="sr-only" tabIndex={-1} onChange={pick} />
      {file ? (
        <div className="animate-pop-in flex items-center gap-3 rounded-2xl border border-up/25 bg-up/[0.05] p-3">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-paper ring-1 ring-inset ring-white/10 text-ink-400">
            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview} alt="" className="h-full w-full object-cover" />
            ) : file.type === 'application/pdf' ? (
              <FileText className="h-5 w-5" />
            ) : (
              <FileImage className="h-5 w-5" />
            )}
          </span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium text-white">{file.name}</div>
            <div className="font-mono text-[11px] text-ink-500">{fmtBytes(file.size)} · attached to this request</div>
          </div>
          <button type="button" onClick={() => input.current?.click()} className="text-xs font-medium text-brand-300 link-underline">
            Change
          </button>
          <button type="button" aria-label="Remove file" onClick={() => onChange(null)} className="flex h-7 w-7 items-center justify-center rounded-lg text-ink-400 hover:bg-white/[0.06] hover:text-down">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => input.current?.click()}
          className={cn(
            'group flex w-full items-center gap-3 rounded-2xl border border-dashed p-3 text-left transition-colors',
            problem ? 'border-down/40 bg-down/[0.04]' : 'border-white/15 hover:border-brand-400/50 hover:bg-brand-400/[0.04]',
          )}
        >
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/[0.04] text-ink-400 transition-colors group-hover:text-brand-300">
            <Paperclip className="h-5 w-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-medium text-white">
              Attach payment proof {required ? <span className="text-down">*</span> : <span className="text-ink-500">(optional)</span>}
            </span>
            <span className="block text-xs text-ink-400">Transfer receipt, UPI success screen or Binance / wallet screenshot. JPG, PNG, WEBP or PDF, max 10 MB.</span>
          </span>
        </button>
      )}
      {problem && (
        <div className="animate-pop-in mt-2 flex items-start gap-2 rounded-xl bg-down/10 px-3 py-2 text-xs text-down ring-1 ring-inset ring-down/30">
          <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{problem}</span>
        </div>
      )}
    </div>
  );
}
