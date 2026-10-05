'use client';

import { useState } from 'react';
import Link from 'next/link';
import { forgotPasswordSchema } from '@spova/shared';
import { post } from '@/lib/api';
import { useForm } from '@/lib/use-form';
import { Alert, Button, Input } from '@/components/ui';

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
      <h1 className="text-2xl font-bold">Reset your password</h1>
      <p className="mt-1 text-sm text-ink-400">We will email you a link valid for one hour.</p>
      {sent ? (
        <Alert tone="success" className="mt-8">
          If an account exists for that email, a reset link is on its way.
        </Alert>
      ) : (
        <form onSubmit={onSubmit} className="mt-8 space-y-4" noValidate>
          {f.serverError && <Alert tone="danger">{f.serverError}</Alert>}
          <Input label="Email" type="email" autoComplete="email" {...f.bind('email')} />
          <Button type="submit" size="lg" className="w-full" loading={f.submitting}>
            Send reset link
          </Button>
        </form>
      )}
      <p className="mt-6 text-center text-sm text-ink-400">
        <Link href="/login" className="text-brand-300 hover:text-brand-200">
          Back to login
        </Link>
      </p>
    </>
  );
}
