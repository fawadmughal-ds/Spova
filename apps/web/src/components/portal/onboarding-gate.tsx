'use client';

import { ArrowRight, LogOut, ShieldCheck } from 'lucide-react';
import { onboardingSchema, SUITABILITY_LABELS, type MeDto, type OnboardingInput } from '@spova/shared';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useForm } from '@/lib/use-form';
import { COUNTRIES } from '@/lib/countries';
import { BRAND } from '@/lib/utils';
import { Alert, Button, Input, Select } from '@/components/ui';

function Section({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4">
      <div className="flex items-center gap-3">
        <span className="font-mono text-[10px] font-semibold tracking-[0.16em] text-brand-500">{n}</span>
        <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-500">{title}</span>
        <span className="h-px flex-1 bg-ink-100" />
      </div>
      {children}
    </section>
  );
}

/**
 * Required one-time onboarding shown the first time a client reaches the dashboard: date of birth,
 * country, residential address and the suitability questionnaire. Completing it marks the profile
 * complete and lifts the gate. There is no skip — only sign out.
 */
export function OnboardingGate() {
  const { me, setMe, logout } = useAuth();
  const f = useForm<OnboardingInput>(onboardingSchema, { countryCode: 'AE' });

  const QSelect = ({ label, field, options }: { label: string; field: keyof OnboardingInput; options: Record<string, string> }) => (
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
      const updated = await api<MeDto>('/me/onboarding', { method: 'POST', body: data });
      setMe(updated);
    });
  };

  const firstName = me?.profile?.firstName;

  return (
    <div className="light-scope min-h-dvh overflow-y-auto bg-ink-100 py-8 text-ink-900">
      <div className="mx-auto w-full max-w-2xl px-4">
        <div className="rounded-3xl border border-ink-100 bg-white p-6 shadow-lift sm:p-8">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand-500/10 text-brand-600">
                <ShieldCheck className="h-6 w-6" />
              </span>
              <div>
                <h1 className="text-[22px] font-bold leading-tight text-ink-900">Complete your profile</h1>
                <p className="mt-0.5 text-sm text-ink-500">
                  {firstName ? `Welcome, ${firstName}. ` : ''}A few details to finish setting up your {BRAND} account.
                </p>
              </div>
            </div>
            <button type="button" onClick={() => void logout()} className="inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2 py-1 text-xs text-ink-400 transition-colors hover:text-ink-700">
              <LogOut className="h-3.5 w-3.5" /> Sign out
            </button>
          </div>

          <form onSubmit={onSubmit} className="mt-7 space-y-7" noValidate>
            {f.serverError && <Alert tone="danger">{f.serverError}</Alert>}

            <Section n="01" title="About you">
              <div className="grid gap-3 sm:grid-cols-2">
                <Input label="Date of birth" type="date" {...f.bind('dob')} />
                <Select label="Country of residence" {...f.bind('countryCode')}>
                  {COUNTRIES.map(([code, name]) => (
                    <option key={code} value={code}>
                      {name}
                    </option>
                  ))}
                </Select>
              </div>
            </Section>

            <Section n="02" title="Residential address">
              <Input label="Address" autoComplete="street-address" {...f.bind('address')} />
              <div className="grid grid-cols-2 gap-3">
                <Input label="City" autoComplete="address-level2" {...f.bind('city')} />
                <Input label="ZIP / Postal code (optional)" autoComplete="postal-code" {...f.bind('zip')} />
              </div>
            </Section>

            <Section n="03" title="Suitability questionnaire">
              <div className="grid gap-3 sm:grid-cols-2">
                <QSelect label="Source of funds" field="sourceOfFunds" options={SUITABILITY_LABELS.sourceOfFunds} />
                <QSelect label="Employment status" field="employmentStatus" options={SUITABILITY_LABELS.employmentStatus} />
                <QSelect label="Job role" field="jobRole" options={SUITABILITY_LABELS.jobRole} />
                {f.values.jobRole === 'other' && <Input label="Please specify your job role" {...f.bind('jobRoleOther')} />}
                <QSelect label="Annual income" field="annualIncome" options={SUITABILITY_LABELS.annualIncome} />
                <QSelect label="Estimated net worth" field="netWorth" options={SUITABILITY_LABELS.netWorth} />
                <QSelect label="Expected deposit (next 12 months)" field="expectedDeposit" options={SUITABILITY_LABELS.expectedDeposit} />
                <QSelect label="Trading experience" field="tradingExperience" options={SUITABILITY_LABELS.tradingExperience} />
                <QSelect label="Trading objective" field="tradingObjective" options={SUITABILITY_LABELS.tradingObjective} />
                <QSelect label="Are you a US citizen or US tax resident?" field="usCitizen" options={SUITABILITY_LABELS.usCitizen} />
                <QSelect label="Politically exposed person (PEP)?" field="pep" options={SUITABILITY_LABELS.pep} />
              </div>
            </Section>

            <Button type="submit" size="lg" className="group w-full rounded-2xl" loading={f.submitting}>
              Save and continue <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
