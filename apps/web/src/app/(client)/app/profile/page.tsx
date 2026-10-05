'use client';

import { useState } from 'react';
import { changePasswordSchema, updateProfileSchema, type ProfileDto, type UpdateProfileInput } from '@spova/shared';
import { z } from 'zod';
import { useAuth } from '@/lib/auth-context';
import { patch } from '@/lib/api';
import { useForm } from '@/lib/use-form';
import { COUNTRIES } from '@/lib/countries';
import { cn } from '@/lib/utils';
import { PageHeader } from '@/components/app-shell';
import { useToast } from '@/components/toast';
import { Alert, Button, Card, Input, Select } from '@/components/ui';

type Tab = 'personal' | 'settings' | 'password';

export default function ProfilePage() {
  const [tab, setTab] = useState<Tab>('personal');
  const { me } = useAuth();
  if (!me?.profile) return null;

  return (
    <>
      <PageHeader title="Profile" sub={me.email} />
      <div className="mb-5 flex gap-1 border-b border-white/5">
        {(['personal', 'settings', 'password'] as Tab[]).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={cn('-mb-px border-b-2 px-4 py-2 text-sm capitalize', tab === t ? 'border-brand-500 text-white' : 'border-transparent text-ink-400 hover:text-white')}>
            {t}
          </button>
        ))}
      </div>
      {tab === 'personal' && <PersonalForm profile={me.profile} />}
      {tab === 'settings' && <SettingsForm profile={me.profile} />}
      {tab === 'password' && <PasswordForm />}
    </>
  );
}

function PersonalForm({ profile }: { profile: ProfileDto }) {
  const { refresh } = useAuth();
  const toast = useToast();
  const f = useForm<UpdateProfileInput>(updateProfileSchema, {
    firstName: profile.firstName,
    lastName: profile.lastName,
    phone: profile.phone,
    dob: profile.dob ?? undefined,
    countryCode: profile.countryCode,
    city: profile.city ?? '',
    address: profile.address ?? '',
    zip: profile.zip ?? '',
  });
  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void f.submit(async (data) => {
      await patch('/me/profile', data);
      await refresh();
      toast({ title: 'Profile updated', level: 'success' });
    });
  };
  return (
    <Card className="max-w-2xl">
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        {f.serverError && <Alert tone="danger">{f.serverError}</Alert>}
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="First name" {...f.bind('firstName')} />
          <Input label="Last name" {...f.bind('lastName')} />
          <Input label="Phone" {...f.bind('phone')} />
          <Input label="Date of birth" type="date" {...f.bind('dob')} />
          <Select label="Country" {...f.bind('countryCode')}>
            {COUNTRIES.map(([c, n]) => (
              <option key={c} value={c}>
                {n}
              </option>
            ))}
          </Select>
          <Input label="City" {...f.bind('city')} />
          <Input label="Address" className="sm:col-span-2" {...f.bind('address')} />
          <Input label="ZIP / Postal code" {...f.bind('zip')} />
        </div>
        <p className="text-xs text-ink-500">Email cannot be changed here. Contact support to update it.</p>
        <Button type="submit" loading={f.submitting}>
          Save changes
        </Button>
      </form>
    </Card>
  );
}

function SettingsForm({ profile }: { profile: ProfileDto }) {
  const { refresh } = useAuth();
  const toast = useToast();
  const [prefs, setPrefs] = useState({ email: profile.notifEmail, sms: profile.notifSms, push: profile.notifPush, calls: profile.notifCalls });
  const [saving, setSaving] = useState(false);
  const save = async () => {
    setSaving(true);
    try {
      await patch('/me/notification-prefs', prefs);
      await refresh();
      toast({ title: 'Preferences saved', level: 'success' });
    } finally {
      setSaving(false);
    }
  };
  const rows: [keyof typeof prefs, string, string][] = [
    ['email', 'Email', 'Account activity, deposits, withdrawals, KYC results'],
    ['sms', 'SMS', 'Security codes and critical alerts'],
    ['push', 'Push', 'Margin calls and order fills in the terminal'],
    ['calls', 'Phone calls', 'Account manager may contact you'],
  ];
  return (
    <Card className="max-w-2xl" title="Notifications">
      <ul className="divide-y divide-white/5">
        {rows.map(([k, label, desc]) => (
          <li key={k} className="flex items-center justify-between py-3">
            <div>
              <div className="text-sm">{label}</div>
              <div className="text-xs text-ink-500">{desc}</div>
            </div>
            <input type="checkbox" className="h-5 w-5 accent-brand-500" checked={prefs[k]} onChange={(e) => setPrefs((p) => ({ ...p, [k]: e.target.checked }))} />
          </li>
        ))}
      </ul>
      <Button className="mt-4" onClick={() => void save()} loading={saving}>
        Save
      </Button>
    </Card>
  );
}

const pwSchema = changePasswordSchema.extend({ confirm: z.string() }).refine((v) => v.next === v.confirm, { path: ['confirm'], message: 'Passwords do not match' });

function PasswordForm() {
  const toast = useToast();
  const f = useForm<z.infer<typeof pwSchema>>(pwSchema);
  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void f.submit(async (data) => {
      await patch('/me/password', { current: data.current, next: data.next });
      toast({ title: 'Password changed', body: 'Other devices have been signed out.', level: 'success' });
      f.set('current', '');
      f.set('next', '');
      f.set('confirm', '');
    });
  };
  return (
    <Card className="max-w-md" title="Change password">
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        {f.serverError && <Alert tone="danger">{f.serverError}</Alert>}
        <Input label="Current password" type="password" autoComplete="current-password" {...f.bind('current')} />
        <Input label="New password" type="password" autoComplete="new-password" hint="8-32 characters with upper, lower, number and symbol" {...f.bind('next')} />
        <Input label="Confirm new password" type="password" autoComplete="new-password" {...f.bind('confirm')} />
        <Button type="submit" loading={f.submitting}>
          Update password
        </Button>
      </form>
    </Card>
  );
}
