'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Mail } from 'lucide-react';
import { forgotPasswordSchema } from '@spova/shared';
import { post } from '@/lib/api';
import { useForm } from '@/lib/use-form';
import { Reveal } from '@/components/motion';
import { Alert, Button, Input } from '@/components/ui';
import { AuthHeading, SuccessPanel } from '@/components/auth/parts';

export default function ForgotPage() {
  const [sent, setSent] = useState(false);
  const f = useForm<{ email: string }>(forgotPasswordSchema);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void f.submit(async (data) => {
      await post('/auth/forgot-password', data);
      setSent(true);
    });
  };

  return (
    <>
      <AuthHeading eyebrow="Account recovery" title="Reset *your password*" sub="We will email you a link valid for one hour." />
      {sent ? (
        <SuccessPanel title="Check your inbox">If an account exists for that email, a reset link is on its way.</SuccessPanel>
      ) : (
        <form onSubmit={onSubmit} className="mt-9" noValidate>
          <Reveal variant="stagger" delay={250} step={70} className="space-y-4">
            {f.serverError && <Alert tone="danger">{f.serverError}</Alert>}
            <Input label="Email" type="email" autoComplete="email" placeholder="you@example.com" right={<Mail className="h-4 w-4" />} {...f.bind('email')} />
            <Button type="submit" size="lg" className="w-full rounded-2xl" loading={f.submitting}>
              Send reset link
            </Button>
          </Reveal>
        </form>
      )}
      <Reveal variant="fade" delay={550}>
        <p className="mt-8 text-center text-sm text-ink-400">
          <Link href="/login" className="group inline-flex items-center gap-2 text-brand-300 transition-colors hover:text-brand-200">
            <ArrowLeft className="h-3.5 w-3.5 transition-transform duration-300 group-hover:-translate-x-1" />
            <span className="link-underline">Back to login</span>
          </Link>
        </p>
      </Reveal>
    </>
  );
}
