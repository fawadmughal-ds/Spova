'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight } from 'lucide-react';
import { registerSchema, SUITABILITY_LABELS, type MeDto, type RegisterInput } from '@spova/shared';
import { usePlatform } from '@/lib/platform';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useForm } from '@/lib/use-form';
import { COUNTRIES } from '@/lib/countries';
import { Reveal } from '@/components/motion';
import { Alert, Button, Input, Select } from '@/components/ui';
import { AuthHeading, CheckRow, PasswordStrength, PasswordToggle } from '@/components/auth/parts';

function Step({ n, children }: { n: string; children: string }) {
  return (
    <div className="flex items-center gap-3 pt-2">
      <span className="font-mono text-[10px] font-semibold tracking-[0.16em] text-brand-300">{n}</span>
      <span className="label">{children}</span>
      <span className="h-px flex-1 bg-gradient-to-r from-white/10 to-transparent" />
    </div>
  );
}

export default function RegisterPage() {
  const platform = usePlatform();
  const router = useRouter();
  const { setMe } = useAuth();
  const [show, setShow] = useState(false);
  const f = useForm<RegisterInput>(registerSchema, { countryCode: 'AE' });

  const QSelect = ({ label, field, options }: { label: string; field: keyof RegisterInput; options: Record<string, string> }) => (
    <Select label={label} {...f.bind(field)}>
      <option value="">Select…</option>
      {Object.entries(options).map(([v, l]) => (
        <option key={v} value={v}>
          {l}
        </option>
      ))}
    </Select>
  );

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void f.submit(async (data) => {
      const me = await api<MeDto>('/auth/register', { method: 'POST', body: data, noRetry: true });
      setMe(me);
      router.replace('/client-area?welcome=1');
    });
  };

  return (
    <>
      <AuthHeading eyebrow="Two minutes" title="Open *your account*" sub="Free demo with $10,000 virtual funds. Takes two minutes." />
      {!platform.registrationOpen && (
        <div role="alert" className="mt-6 rounded-xl border border-gold/30 bg-gold/[0.08] px-4 py-3 text-sm text-ink-100">
          <strong>New registrations are paused.</strong> Please try again later or contact support. Existing clients can still sign in.
        </div>
      )}
      <form onSubmit={onSubmit} className="mt-8" noValidate>
        <Reveal variant="stagger" delay={250} step={55} className="space-y-4">
          {f.serverError && <Alert tone="danger">{f.serverError}</Alert>}

          <Step n="01">About you</Step>
          <div className="grid grid-cols-2 gap-3">
            <Input label="First name" autoComplete="given-name" {...f.bind('firstName')} />
            <Input label="Last name" autoComplete="family-name" {...f.bind('lastName')} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Date of birth" type="date" {...f.bind('dob')} />
            <Select label="Country of residence" {...f.bind('countryCode')}>
              {COUNTRIES.map(([code, name]) => (
                <option key={code} value={code}>
                  {name}
                </option>
              ))}
            </Select>
          </div>

          <Step n="02">Contact</Step>
          <div className="grid gap-3 sm:grid-cols-2">
            <Input label="Email" type="email" autoComplete="email" {...f.bind('email')} />
            <Input label="Phone" type="tel" placeholder="+971501234567" autoComplete="tel" {...f.bind('phone')} />
          </div>

          <Step n="03">Residential address</Step>
          <Input label="Address" autoComplete="street-address" {...f.bind('address')} />
          <div className="grid grid-cols-2 gap-3">
            <Input label="City" autoComplete="address-level2" {...f.bind('city')} />
            <Input label="ZIP / Postal code (optional)" autoComplete="postal-code" {...f.bind('zip')} />
          </div>

          <Step n="04">Your trading profile</Step>
          <div className="grid gap-3 sm:grid-cols-2">
            <QSelect label="Source of funds" field="sourceOfFunds" options={SUITABILITY_LABELS.sourceOfFunds} />
            <QSelect label="Employment status" field="employmentStatus" options={SUITABILITY_LABELS.employmentStatus} />
            <QSelect label="Annual income" field="annualIncome" options={SUITABILITY_LABELS.annualIncome} />
            <QSelect label="Estimated net worth" field="netWorth" options={SUITABILITY_LABELS.netWorth} />
            <QSelect label="Expected deposit" field="expectedDeposit" options={SUITABILITY_LABELS.expectedDeposit} />
            <QSelect label="Trading experience" field="tradingExperience" options={SUITABILITY_LABELS.tradingExperience} />
            <QSelect label="Trading objective" field="tradingObjective" options={SUITABILITY_LABELS.tradingObjective} />
          </div>

          <Step n="05">Security</Step>
          <Input
            label="Password"
            type={show ? 'text' : 'password'}
            autoComplete="new-password"
            {...f.bind('password')}
            right={<PasswordToggle show={show} onToggle={() => setShow((v) => !v)} />}
          />
          <PasswordStrength value={String(f.values.password ?? '')} />

          <div className="space-y-2 pt-2">
            <CheckRow {...f.bindCheckbox('tcAccepted')} error={f.errors.tcAccepted}>
              I accept the{' '}
              <Link href="/legal" className="link-underline text-brand-300">
                Client Agreement
              </Link>{' '}
              and Privacy Policy.
            </CheckRow>
            <CheckRow {...f.bindCheckbox('riskAccepted')} error={f.errors.riskAccepted}>
              I have read the Risk Disclosure and understand CFDs can lose money rapidly due to leverage.
            </CheckRow>
          </div>

          <Button type="submit" size="lg" className="group w-full rounded-2xl" loading={f.submitting}>
            Create account <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
          </Button>
        </Reveal>
      </form>
      <Reveal variant="fade" delay={900}>
        <p className="mt-6 text-center text-sm text-ink-400">
          Already registered?{' '}
          <Link href="/login" className="link-underline font-medium text-brand-300 transition-colors hover:text-brand-200">
            Log in
          </Link>
        </p>
      </Reveal>
    </>
  );
}
