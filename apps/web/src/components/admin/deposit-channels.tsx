'use client';

import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { ChevronDown, Landmark, QrCode, Save, Upload, X } from 'lucide-react';
import { DEFAULT_DEPOSIT_CHANNELS, depositChannelsSchema, type DepositChannels } from '@spova/shared';
import { get, put } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useToast } from '@/components/toast';
import { Button, Input, Skeleton, Switch } from '@/components/ui';
import { Textarea } from './queue-bits';
import { friendlyError } from '@/components/portal/api-error';

type Key = Exclude<keyof DepositChannels, 'cashier'>;
const TITLES: Record<Key, string> = { bank: 'Bank transfer', rtgs: 'RTGS', upi: 'UPI', binance: 'Binance Pay', crypto_usdt: 'Crypto (USDT)', card: 'Card' };
const FIELDS: Record<Key, { name: string; label: string; placeholder?: string }[]> = {
  bank: [
    { name: 'bankName', label: 'Bank name' },
    { name: 'accountName', label: 'Account name' },
    { name: 'accountNumber', label: 'Account number' },
    { name: 'ifsc', label: 'IFSC' },
    { name: 'swift', label: 'SWIFT (international)' },
    { name: 'currency', label: 'Currency the client pays in', placeholder: 'INR' },
  ],
  rtgs: [
    { name: 'bankName', label: 'Bank name' },
    { name: 'accountName', label: 'Account name' },
    { name: 'accountNumber', label: 'Account number' },
    { name: 'ifsc', label: 'IFSC' },
    { name: 'swift', label: 'SWIFT (international)' },
    { name: 'currency', label: 'Currency the client pays in', placeholder: 'INR' },
  ],
  upi: [
    { name: 'vpa', label: 'UPI ID (VPA)', placeholder: 'name@bank' },
    { name: 'payeeName', label: 'Payee name' },
    { name: 'currency', label: 'Currency the client pays in', placeholder: 'INR' },
  ],
  binance: [
    { name: 'payId', label: 'Binance Pay ID' },
    { name: 'email', label: 'Binance email (optional)' },
    { name: 'qrLink', label: 'Binance Pay QR link (optional)', placeholder: 'https://app.binance.com/qr/...' },
  ],
  crypto_usdt: [
    { name: 'address', label: 'Wallet address' },
    { name: 'network', label: 'Network', placeholder: 'TRC20' },
  ],
  card: [],
};

const QR_MAX_BYTES = 400 * 1024;
const QR_MIME = ['image/png', 'image/jpeg', 'image/webp'];

/** Upload a QR image for a payment channel. Stored inline (data-URL) with the channel; clients see it instead of the auto-generated QR. */
function QrUpload({ value, onChange }: { value: string; onChange: (dataUrl: string) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [err, setErr] = useState<string | null>(null);

  const pick = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    e.target.value = '';
    if (!f) return;
    if (!QR_MIME.includes(f.type)) return setErr('Only PNG, JPG or WEBP images.');
    if (f.size > QR_MAX_BYTES) return setErr('Image is too large — keep it under 400 KB.');
    setErr(null);
    const reader = new FileReader();
    reader.onload = () => onChange(String(reader.result || ''));
    reader.onerror = () => setErr('Could not read that file.');
    reader.readAsDataURL(f);
  };

  return (
    <div className="mt-3">
      <input ref={input} type="file" accept={QR_MIME.join(',')} className="sr-only" tabIndex={-1} onChange={pick} />
      <div className="flex items-center gap-3">
        <span className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-white/[0.03] text-ink-500">
          {value ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={value} alt="QR preview" className="h-full w-full object-contain p-1" />
          ) : (
            <QrCode className="h-6 w-6" />
          )}
        </span>
        <div className="min-w-0">
          <div className="text-sm font-medium text-white">Payment QR image</div>
          <p className="text-xs text-ink-400">{value ? 'Shown to clients on this method.' : 'Upload your own QR (UPI / Binance / wallet) — PNG, JPG or WEBP, under 400 KB.'}</p>
          <div className="mt-1.5 flex items-center gap-3">
            <button type="button" onClick={() => input.current?.click()} className="inline-flex items-center gap-1.5 text-xs font-medium text-brand-300 link-underline">
              <Upload className="h-3.5 w-3.5" /> {value ? 'Replace' : 'Upload QR'}
            </button>
            {value && (
              <button type="button" onClick={() => onChange('')} className="inline-flex items-center gap-1 text-xs text-ink-400 hover:text-down">
                <X className="h-3.5 w-3.5" /> Remove
              </button>
            )}
          </div>
        </div>
      </div>
      {err && <p className="mt-2 text-xs text-down">{err}</p>}
    </div>
  );
}

/** Back-office editor for where clients send deposits. Saved values show on the client's deposit form immediately. */
export function DepositChannelsEditor({ className }: { className?: string }) {
  const toast = useToast();
  const [cfg, setCfg] = useState<DepositChannels | null>(null);
  const [open, setOpen] = useState(true);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<string | null>(null);

  useEffect(() => {
    get<DepositChannels>('/admin/payments/channels')
      .then(setCfg)
      .catch(() => setCfg(DEFAULT_DEPOSIT_CHANNELS));
  }, []);

  const patch = <K extends keyof DepositChannels>(k: K, p: Partial<DepositChannels[K]>) => setCfg((c) => (c ? { ...c, [k]: { ...c[k], ...p } } : c));

  const save = async () => {
    if (!cfg) return;
    const parsed = depositChannelsSchema.safeParse(cfg);
    if (!parsed.success) {
      setErrors(parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(' · '));
      return;
    }
    setErrors(null);
    setBusy(true);
    try {
      const saved = await put<DepositChannels>('/admin/payments/channels', parsed.data);
      setCfg(saved);
      toast({ title: 'Deposit channels saved', body: 'Clients now see the new details on the deposit form.', level: 'success' });
    } catch (e) {
      const f = friendlyError(e);
      toast({ title: f.title, body: f.body, level: 'danger' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className={cn('card overflow-hidden', className)}>
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="flex w-full items-center gap-3 p-5 text-left sm:px-6">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gold/10 text-gold ring-1 ring-inset ring-gold/25">
          <Landmark className="h-5 w-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-base font-semibold text-white">Deposit channels &amp; USD rates</span>
          <span className="block text-xs text-ink-400">Where clients pay in, and the price of 1 USD in INR shown on the cashier. {cfg ? `${(Object.keys(TITLES) as Key[]).filter((k) => cfg[k].enabled).map((k) => TITLES[k]).join(', ')} enabled.` : ''}</span>
        </span>
        <ChevronDown className={cn('h-5 w-5 text-ink-400 transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="animate-page-in border-t border-white/[0.06] p-5 sm:px-6">
          {!cfg ? (
            <Skeleton className="h-40 rounded-xl" />
          ) : (
            <div className="grid gap-5 lg:grid-cols-2">
              {(Object.keys(TITLES) as Key[]).map((k) => (
                <div key={k} className={cn('rounded-2xl border p-4 transition-colors', cfg[k].enabled ? 'border-white/[0.1] bg-white/[0.02]' : 'border-dashed border-white/[0.08] opacity-80')}>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-semibold text-white">{TITLES[k]}</span>
                    <Switch checked={cfg[k].enabled} onChange={(v) => patch(k, { enabled: v } as Partial<DepositChannels[typeof k]>)} label={cfg[k].enabled ? 'Enabled' : 'Off'} />
                  </div>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    {FIELDS[k].map((f) => (
                      <Input
                        key={f.name}
                        label={f.label}
                        name={`${k}-${f.name}`}
                        placeholder={f.placeholder}
                        value={(cfg[k] as unknown as Record<string, string>)[f.name] ?? ''}
                        onChange={(e) => patch(k, { [f.name]: e.target.value } as Partial<DepositChannels[typeof k]>)}
                      />
                    ))}
                  </div>
                  {k !== 'card' && (
                    <QrUpload
                      value={(cfg[k] as unknown as { qrImage?: string }).qrImage ?? ''}
                      onChange={(dataUrl) => patch(k, { qrImage: dataUrl } as Partial<DepositChannels[typeof k]>)}
                    />
                  )}
                  <Textarea className="mt-3" label="Note shown to the client" name={`${k}-note`} rows={2} value={cfg[k].note} onChange={(e) => patch(k, { note: e.target.value } as Partial<DepositChannels[typeof k]>)} />
                </div>
              ))}
            </div>
          )}
          {cfg && (
            <div className="mt-5 rounded-2xl border border-white/[0.1] bg-white/[0.02] p-4">
              <div className="text-sm font-semibold text-white">Cashier footer (company information)</div>
              <p className="mt-1 text-xs text-ink-400">Shown under the deposit cashier: legal name, regulator, licence number, address. Use [BRAND] for the brand name.</p>
              <Textarea className="mt-3" label="Footer text" name="cashier-footer" rows={3} value={cfg.cashier.footer} onChange={(e) => patch('cashier', { footer: e.target.value })} />
            </div>
          )}
          {cfg && (
            <div className="mt-5 rounded-2xl border border-white/[0.1] bg-white/[0.02] p-4">
              <div className="text-sm font-semibold text-white">USD conversion rates</div>
              <p className="mt-1 text-xs text-ink-400">The price of 1 USD in each currency, shown on the deposit cashier. Set your own rate here; there is no live feed.</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
                {(['INR', 'PKR', 'AED', 'EUR', 'GBP'] as const).map((ccy) => (
                  <Input
                    key={ccy}
                    label={`1 USD = ? ${ccy}`}
                    name={`rate-${ccy}`}
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min="0"
                    value={String(cfg.cashier.rates[ccy])}
                    onChange={(e) => patch('cashier', { rates: { ...cfg.cashier.rates, [ccy]: Number(e.target.value) } })}
                  />
                ))}
              </div>
            </div>
          )}
          {errors && <p className="mt-3 text-xs text-down">{errors}</p>}
          <div className="mt-5 flex justify-end">
            <Button onClick={() => void save()} loading={busy} disabled={!cfg}>
              <Save className="h-4 w-4" /> Save channels
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
