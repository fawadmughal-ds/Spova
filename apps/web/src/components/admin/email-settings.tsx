'use client';

import { useEffect, useState } from 'react';
import { Mail, Save, Eye, ChevronDown, X } from 'lucide-react';
import { DEFAULT_EMAIL_SETTINGS, EMAIL_TYPES, type EmailSettings, type EmailType, type EmailTemplates } from '@spova/shared';
import { get, put } from '@/lib/api';
import { useToast } from '@/components/toast';
import { Button, Input, Skeleton, Switch } from '@/components/ui';

const LABELS: Record<EmailType, { title: string; sub: string }> = {
  welcome: { title: 'Sign-up welcome', sub: 'Sent when a client registers' },
  login: { title: 'New sign-in', sub: 'Sent when a client logs in' },
  kycReminder: { title: 'Document reminder (3, 2 and 1 days left)', sub: 'A daily reminder before the upload deadline' },
  kycFrozen: { title: 'Account frozen', sub: 'Trading paused after the 15-day deadline' },
  kycUnfrozen: { title: 'Account unfrozen', sub: 'Trading resumed after documents arrive' },
  creditAdded: { title: 'Credit / funds added', sub: 'When the back office adds money or credit' },
  depositInvite: { title: 'Deposit invitation', sub: 'Sent by the “Send deposit email” button on a client' },
};

export function EmailSettingsPanel() {
  const toast = useToast();
  const [cfg, setCfg] = useState<EmailSettings | null>(null);
  const [tpl, setTpl] = useState<EmailTemplates>({});
  const [open, setOpen] = useState<EmailType | null>(null);
  const [preview, setPreview] = useState<{ type: EmailType; subject: string; html: string } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    get<EmailSettings>('/admin/email-settings').then(setCfg).catch(() => setCfg(DEFAULT_EMAIL_SETTINGS));
    get<EmailTemplates>('/admin/email-templates').then(setTpl).catch(() => setTpl({}));
  }, []);

  const setOverride = (t: EmailType, field: 'subject' | 'intro', value: string) => {
    setTpl((prev) => {
      const next = { ...prev, [t]: { ...(prev[t] ?? {}), [field]: value || undefined } };
      if (!next[t]?.subject && !next[t]?.intro) delete next[t];
      return next;
    });
  };

  const showPreview = async (t: EmailType) => {
    try {
      // save overrides first so the preview reflects unsaved edits
      await put('/admin/email-templates', tpl);
      const r = await get<{ subject: string; html: string }>(`/admin/email-preview/${t}`);
      setPreview({ type: t, ...r });
    } catch {
      toast({ title: 'Could not render preview', level: 'danger' });
    }
  };

  const save = async () => {
    if (!cfg) return;
    setBusy(true);
    try {
      const [saved] = await Promise.all([put<EmailSettings>('/admin/email-settings', cfg), put<EmailTemplates>('/admin/email-templates', tpl)]);
      setCfg(saved);
      toast({ title: 'Emails saved', body: 'Your subjects, messages and on/off switches are live.', level: 'success' });
    } catch {
      toast({ title: 'Could not save emails', level: 'danger' });
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
          <p className="text-xs text-ink-400">Switch each email on or off, set its subject and opening message, and preview it. The Zerventa header, colours and footer stay fixed. From: info@zerventa.com.</p>
        </div>
      </div>

      {!cfg ? (
        <Skeleton className="mt-5 h-48 rounded-xl" />
      ) : (
        <>
          <div className="mt-5 divide-y divide-white/[0.06]">
            {EMAIL_TYPES.map((t) => {
              const isOpen = open === t;
              return (
                <div key={t} className="py-3">
                  <div className="flex items-center justify-between gap-4">
                    <button type="button" onClick={() => setOpen(isOpen ? null : t)} className="group flex min-w-0 items-center gap-2 text-left">
                      <ChevronDown className={`h-4 w-4 shrink-0 text-ink-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                      <span className="min-w-0">
                        <span className="block text-sm font-medium text-white">{LABELS[t].title}</span>
                        <span className="block text-xs text-ink-400">{LABELS[t].sub}</span>
                      </span>
                    </button>
                    <div className="flex shrink-0 items-center gap-3">
                      <button type="button" onClick={() => void showPreview(t)} className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-2.5 py-1.5 text-xs text-ink-200 hover:bg-white/[0.04]">
                        <Eye className="h-3.5 w-3.5" /> Preview
                      </button>
                      <Switch checked={cfg[t]} onChange={(v) => setCfg({ ...cfg, [t]: v })} label={cfg[t] ? 'On' : 'Off'} />
                    </div>
                  </div>
                  {isOpen && (
                    <div className="mt-3 grid gap-3 pl-6">
                      <Input
                        label="Subject"
                        placeholder="Leave blank to use the default subject"
                        value={tpl[t]?.subject ?? ''}
                        onChange={(e) => setOverride(t, 'subject', e.target.value)}
                      />
                      <label className="block">
                        <span className="mb-1.5 block text-sm text-ink-200">Opening message</span>
                        <textarea
                          rows={3}
                          placeholder="An extra line shown at the top of this email. Leave blank to use the default wording."
                          value={tpl[t]?.intro ?? ''}
                          onChange={(e) => setOverride(t, 'intro', e.target.value)}
                          className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2.5 text-sm text-white placeholder:text-ink-500 focus:border-brand-400 focus:outline-none"
                        />
                      </label>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <div className="mt-5 flex justify-end">
            <Button onClick={() => void save()} loading={busy}>
              <Save className="h-4 w-4" /> Save emails
            </Button>
          </div>
        </>
      )}

      {preview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setPreview(null)}>
          <div className="flex max-h-[90vh] w-full max-w-[680px] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
              <div className="min-w-0">
                <div className="text-[11px] uppercase tracking-wider text-slate-400">Preview · {LABELS[preview.type].title}</div>
                <div className="truncate text-sm font-semibold text-slate-900">{preview.subject}</div>
              </div>
              <button type="button" onClick={() => setPreview(null)} className="shrink-0 rounded-lg p-1.5 text-slate-500 hover:bg-slate-100">
                <X className="h-5 w-5" />
              </button>
            </div>
            <iframe title="Email preview" srcDoc={preview.html} className="h-[70vh] w-full border-0 bg-[#eef2f7]" sandbox="" />
          </div>
        </div>
      )}
    </section>
  );
}
