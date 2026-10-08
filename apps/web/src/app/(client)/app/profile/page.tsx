'use client';

import { useState } from 'react';
import { BadgeCheck, BellRing, Globe, KeyRound, Mail, MailCheck, MessageSquareText, PhoneCall, ShieldAlert, Smartphone, UserRound } from 'lucide-react';
import { changePasswordSchema, updateProfileSchema, type MeDto, type ProfileDto, type UpdateProfileInput } from '@spova/shared';
import { z } from 'zod';
import { useAuth } from '@/lib/auth-context';
import { patch } from '@/lib/api';
import { useForm } from '@/lib/use-form';
import { COUNTRIES } from '@/lib/countries';
import { cn, initials } from '@/lib/utils';
import { useToast } from '@/components/toast';
import { Alert, Badge, Button, Card, Input, Select, Switch } from '@/components/ui';
import { PasswordRules } from '@/components/portal/password-rules';
import { SlidingTabs } from '@/components/portal/sliding-tabs';

type Tab = 'personal' | 'settings' | 'password';

const TABS: { value: Tab; label: React.ReactNode }[] = [
  { value: 'personal', label: <><UserRound className="h-4 w-4" /> Personal</> },
  { value: 'settings', label: <><BellRing className="h-4 w-4" /> Settings</> },
  { value: 'password', label: <><KeyRound className="h-4 w-4" /> Password</> },
];

export default function ProfilePage() {
  const [tab, setTab] = useState<Tab>('personal');
  const { me } = useAuth();
  if (!me?.profile) return null;

  return (
    <>
      <ProfileHeader me={me} profile={me.profile} />
      <SlidingTabs variant="underline" items={TABS} value={tab} onChange={setTab} className="mb-6" />
      <div key={tab} className="animate-page-in">
        {tab === 'personal' && <PersonalForm profile={me.profile} />}
        {tab === 'settings' && <SettingsForm profile={me.profile} />}
        {tab === 'password' && <PasswordForm />}
      </div>
    </>
  );
}

/** Identity strip: monogram inside a slowly turning dashed ring, with verification state as chips. */
function ProfileHeader({ me, profile }: { me: MeDto; profile: ProfileDto }) {
  const verified = me.kyc.poi && me.kyc.por;
  const country = COUNTRIES.find(([c]) => c === profile.countryCode)?.[1] ?? profile.countryCode;
  return (
    <section className="card relative mb-6 overflow-hidden p-5 sm:p-6">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(110deg,rgb(var(--brand-rgb)/0.1),transparent_45%)]" />
      <div aria-hidden className="text-outline pointer-events-none absolute -bottom-[0.22em] right-4 hidden select-none font-display text-[7rem] font-extrabold uppercase leading-none tracking-tighter opacity-50 md:block">
        {profile.firstName}
      </div>
      <div className="relative flex flex-wrap items-center gap-5">
        <div className="relative flex h-20 w-20 shrink-0 items-center justify-center">
          <svg viewBox="0 0 80 80" className="absolute inset-0 animate-spin-slow text-brand-400/60" fill="none" aria-hidden>
            <circle cx="40" cy="40" r="38.5" stroke="currentColor" strokeWidth="1" strokeDasharray="3 7" />
          </svg>
          <span className="flex h-[62px] w-[62px] items-center justify-center rounded-full bg-gradient-to-br from-brand-300 to-brand-600 font-display text-xl font-bold text-ink-950 shadow-glow">
            {initials(profile.firstName, profile.lastName, me.email[0]?.toUpperCase())}
          </span>
        </div>
        <div className="min-w-0">
          <h1 className="truncate font-display text-3xl font-bold tracking-tight">
            {profile.firstName} {profile.lastName}
          </h1>
          <div className="mt-1 flex items-center gap-2 text-sm text-ink-400">
            <Mail className="h-3.5 w-3.5" /> <span className="truncate">{me.email}</span>
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {verified ? (
              <Badge tone="success">
                <BadgeCheck className="h-3 w-3" /> Verified
              </Badge>
            ) : (
              <Badge tone="warning">
                <ShieldAlert className="h-3 w-3" /> Verification pending
              </Badge>
            )}
            {me.emailVerified && (
              <Badge tone="brand">
                <MailCheck className="h-3 w-3" /> Email confirmed
              </Badge>
            )}
            <Badge>
              <Globe className="h-3 w-3" /> {country}
            </Badge>
          </div>
        </div>
      </div>
    </section>
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
    <Card className="max-w-3xl" title="Personal details">
      <form onSubmit={onSubmit} className="space-y-5" noValidate>
        {f.serverError && <Alert tone="danger">{f.serverError}</Alert>}
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="First name" {...f.bind('firstName')} />
          <Input label="Last name" {...f.bind('lastName')} />
          <Input label="Phone" {...f.bind('phone')} />
          <Input label="Date of birth" type="date" {...f.bind('dob')} />
        </div>
        <div className="ruler opacity-60" />
        <div className="grid gap-4 sm:grid-cols-2">
          <Select label="Country" {...f.bind('countryCode')}>
            {COUNTRIES.map(([c, n]) => (
              <option key={c} value={c}>
                {n}
              </option>
            ))}
          </Select>
          <Input label="City" {...f.bind('city')} />
          <div className="sm:col-span-2">
            <Input label="Address" {...f.bind('address')} />
          </div>
          <Input label="ZIP / Postal code" {...f.bind('zip')} />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.06] pt-5">
          <p className="text-xs text-ink-500">Email cannot be changed here. Contact support to update it.</p>
          <Button type="submit" loading={f.submitting}>
            Save changes
          </Button>
        </div>
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
  const rows: [keyof typeof prefs, string, string, React.ReactNode][] = [
    ['email', 'Email', 'Account activity, deposits, withdrawals, KYC results', <Mail key="i" className="h-4 w-4" />],
    ['sms', 'SMS', 'Security codes and critical alerts', <MessageSquareText key="i" className="h-4 w-4" />],
    ['push', 'Push', 'Margin calls and order fills in the terminal', <Smartphone key="i" className="h-4 w-4" />],
    ['calls', 'Phone calls', 'Account manager may contact you', <PhoneCall key="i" className="h-4 w-4" />],
  ];
  const on = rows.filter(([k]) => prefs[k]).length;
  return (
    <Card className="max-w-3xl" title="Notifications" action={<span className="tabular font-mono text-[11px] text-ink-400">{on} of {rows.length} on</span>}>
      <ul className="space-y-2">
        {rows.map(([k, label, desc, icon], i) => (
          <li
            key={k}
            style={{ animationDelay: `${i * 60}ms` }}
            className={cn(
              'animate-page-in flex items-center gap-4 rounded-2xl border p-3.5 transition-colors duration-500',
              prefs[k] ? 'border-brand-400/25 bg-brand-400/[0.05]' : 'border-white/[0.06] bg-white/[0.02]',
            )}
          >
            <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-all duration-500', prefs[k] ? 'bg-brand-400/15 text-brand-300' : 'bg-white/[0.04] text-ink-500')}>{icon}</span>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium">{label}</div>
              <div className="text-xs text-ink-500">{desc}</div>
            </div>
            <Switch checked={prefs[k]} onChange={(v) => setPrefs((p) => ({ ...p, [k]: v }))} label={`${label} notifications`} />
          </li>
        ))}
      </ul>
      <div className="mt-5 flex justify-end border-t border-white/[0.06] pt-5">
        <Button onClick={() => void save()} loading={saving}>
          Save
        </Button>
      </div>
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
        <Input label="New password" type="password" autoComplete="new-password" {...f.bind('next')} />
        <PasswordRules value={String(f.values.next ?? '')} />
        <Input label="Confirm new password" type="password" autoComplete="new-password" {...f.bind('confirm')} />
        <div className="flex items-center justify-between gap-3 border-t border-white/[0.06] pt-5">
          <p className="text-xs text-ink-500">Changing it signs out your other devices.</p>
          <Button type="submit" loading={f.submitting}>
            Update password
          </Button>
        </div>
      </form>
    </Card>
  );
}
