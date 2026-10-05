'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff } from 'lucide-react';
import { registerSchema, type MeDto, type RegisterInput } from '@spova/shared';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useForm } from '@/lib/use-form';
import { COUNTRIES } from '@/lib/countries';
import { Alert, Button, Input, Select } from '@/components/ui';

export default function RegisterPage() {
  const router = useRouter();
  const { setMe } = useAuth();
  const [show, setShow] = useState(false);
  const f = useForm<RegisterInput>(registerSchema, { countryCode: 'AE' });

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void f.submit(async (data) => {
      const me = await api<MeDto>('/auth/register', { method: 'POST', body: data, noRetry: true });
      setMe(me);
      router.replace('/app?welcome=1');
    });
  };

  return (
    <>
      <h1 className="text-2xl font-bold">Open your account</h1>
      <p className="mt-1 text-sm text-ink-400">Free demo with $10,000 virtual funds. Takes two minutes.</p>
      <form onSubmit={onSubmit} className="mt-8 space-y-4" noValidate>
        {f.serverError && <Alert tone="danger">{f.serverError}</Alert>}
        <div className="grid grid-cols-2 gap-3">
          <Input label="First name" autoComplete="given-name" {...f.bind('firstName')} />
          <Input label="Last name" autoComplete="family-name" {...f.bind('lastName')} />
        </div>
        <Input label="Email" type="email" autoComplete="email" {...f.bind('email')} />
        <div className="grid grid-cols-2 gap-3">
          <Input label="Phone" type="tel" placeholder="+971501234567" autoComplete="tel" {...f.bind('phone')} />
          <Input label="Date of birth" type="date" {...f.bind('dob')} />
        </div>
        <Select label="Country of residence" {...f.bind('countryCode')}>
          {COUNTRIES.map(([code, name]) => (
            <option key={code} value={code}>
              {name}
            </option>
          ))}
        </Select>
        <Input
          label="Password"
          type={show ? 'text' : 'password'}
          autoComplete="new-password"
          hint="8-32 characters with upper, lower, number and symbol"
          {...f.bind('password')}
          right={
            <button type="button" onClick={() => setShow((v) => !v)} className="hover:text-ink-200" aria-label="Toggle password">
              {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          }
        />
        <label className="flex items-start gap-3 text-sm text-ink-300">
          <input type="checkbox" className="mt-0.5 h-4 w-4 accent-brand-500" {...f.bindCheckbox('tcAccepted')} />
          <span>
            I accept the{' '}
            <Link href="/legal" className="text-brand-300">
              Client Agreement
            </Link>{' '}
            and Privacy Policy.
          </span>
        </label>
        {f.errors.tcAccepted && <p className="-mt-2 text-xs text-down">{f.errors.tcAccepted}</p>}
        <label className="flex items-start gap-3 text-sm text-ink-300">
          <input type="checkbox" className="mt-0.5 h-4 w-4 accent-brand-500" {...f.bindCheckbox('riskAccepted')} />
          <span>I have read the Risk Disclosure and understand CFDs can lose money rapidly due to leverage.</span>
        </label>
        {f.errors.riskAccepted && <p className="-mt-2 text-xs text-down">{f.errors.riskAccepted}</p>}
        <Button type="submit" size="lg" className="w-full" loading={f.submitting}>
          Create account
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-ink-400">
        Already registered?{' '}
        <Link href="/login" className="font-medium text-brand-300 hover:text-brand-200">
          Log in
        </Link>
      </p>
    </>
  );
}
