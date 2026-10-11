'use client';

import { useEffect, useState } from 'react';
import { Mail, Save } from 'lucide-react';
import { DEFAULT_EMAIL_SETTINGS, EMAIL_TYPES, type EmailSettings, type EmailType } from '@spova/shared';
import { get, put } from '@/lib/api';
import { useToast } from '@/components/toast';
import { Button, Skeleton, Switch } from '@/components/ui';

const LABELS: Record<EmailType, { title: string; sub: string }> = {
  welcome: { title: 'Sign-up welcome', sub: 'Sent when a client registers' },
  login: { title: 'New sign-in', sub: 'Sent when a client logs in' },
  kycReminder: { title: 'Document reminder (3, 2 and 1 days left)', sub: 'A daily reminder before the upload deadline' },
  kycFrozen: { title: 'Account frozen', sub: 'Trading paused after the 15-day deadline' },
  kycUnfrozen: { title: 'Account unfrozen', sub: 'Trading resumed after documents arrive' },
  creditAdded: { title: 'Credit / funds added', sub: 'When the back office adds money or credit' },
  depositInvite: { title: 'Deposit invitation', sub: 'Sent by the “Send deposit email” button on a client' },
};

/** Toggle which client notification emails the system sends. Transactional mail always sends. */
export function EmailSettingsPanel() {
  const toast = useToast();
  const [cfg, setCfg] = useState<EmailSettings | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    get<EmailSettings>('/admin/email-settings')
      .then(setCfg)
      .catch(() => setCfg(DEFAULT_EMAIL_SETTINGS));
  }, []);

  const save = async () => {
    if (!cfg) return;
    setBusy(true);
    try {
      const saved = await put<EmailSettings>('/admin/email-settings', cfg);
      setCfg(saved);
      toast({ title: 'Email settings saved', body: 'The system now sends only the emails you kept on.', level: 'success' });
    } catch {
      toast({ title: 'Could not save email settings', level: 'danger' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5 sm:p-6">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-500/10 text-brand-300">
          <Mail className="h-5 w-5" />
        </span>
        <div>
          <h3 className="text-base font-semibold text-white">Client emails</h3>
          <p className="text-xs text-ink-400">Keep or block each notification email. Transactional emails (password reset, payment result) always send. From: info@zerventa.com.</p>
        </div>
      </div>
      {!cfg ? (
        <Skeleton className="mt-5 h-48 rounded-xl" />
      ) : (
        <>
          <div className="mt-5 divide-y divide-white/[0.06]">
            {EMAIL_TYPES.map((t) => (
              <div key={t} className="flex items-center justify-between gap-4 py-3">
                <div>
                  <div className="text-sm font-medium text-white">{LABELS[t].title}</div>
                  <div className="text-xs text-ink-400">{LABELS[t].sub}</div>
                </div>
                <Switch checked={cfg[t]} onChange={(v) => setCfg({ ...cfg, [t]: v })} label={cfg[t] ? 'On' : 'Off'} />
              </div>
            ))}
          </div>
          <div className="mt-5 flex justify-end">
            <Button onClick={() => void save()} loading={busy}>
              <Save className="h-4 w-4" /> Save emails
            </Button>
          </div>
        </>
      )}
    </section>
  );
}
