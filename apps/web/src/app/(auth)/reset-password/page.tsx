'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { z } from 'zod';
import { passwordSchema } from '@spova/shared';
import { post } from '@/lib/api';
import { buttonClass } from '@/lib/button';
import { useForm } from '@/lib/use-form';
import { Reveal } from '@/components/motion';
import { Alert, Button, Input } from '@/components/ui';
import { AuthHeading, PasswordStrength, PasswordToggle, SuccessPanel } from '@/components/auth/parts';

const schema = z
  .object({ password: passwordSchema, confirm: z.string() })
  .refine((v) => v.password === v.confirm, { path: ['confirm'], message: 'Passwords do not match' });

function ResetForm() {
  const token = useSearchParams().get('token') ?? '';
  const [done, setDone] = useState(false);
  const [show, setShow] = useState(false);
  const f = useForm<z.infer<typeof schema>>(schema);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void f.submit(async (data) => {
      await post('/auth/reset-password', { token, password: data.password });
      setDone(true);
    });
  };

  if (!token)
    return (
      <>
        <AuthHeading eyebrow="Account recovery" title="Link *not valid*" />
        <Alert tone="danger" className="mt-8">
          Missing reset token. Use the link from your email.
        </Alert>
        <p className="mt-8 text-center text-sm text-ink-400">
          <Link href="/forgot-password" className="group inline-flex items-center gap-2 text-brand-300 transition-colors hover:text-brand-200">
            <ArrowLeft className="h-3.5 w-3.5 transition-transform duration-300 group-hover:-translate-x-1" />
            <span className="link-underline">Request a new link</span>
          </Link>
        </p>
      </>
    );

  return (
    <>
      <AuthHeading eyebrow="Account recovery" title="Choose a *new password*" />
      {done ? (
        <SuccessPanel title="Password updated">
          <Link href="/login" className={buttonClass('primary', 'md', 'group mt-3 rounded-full')}>
            Log in <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
          </Link>
        </SuccessPanel>
      ) : (
        <form onSubmit={onSubmit} className="mt-9" noValidate>
          <Reveal variant="stagger" delay={250} step={70} className="space-y-4">
            {f.serverError && <Alert tone="danger">{f.serverError}</Alert>}
            <Input
              label="New password"
              type={show ? 'text' : 'password'}
              autoComplete="new-password"
              {...f.bind('password')}
              right={<PasswordToggle show={show} onToggle={() => setShow((v) => !v)} />}
            />
            <PasswordStrength value={String(f.values.password ?? '')} />
            <Input label="Confirm password" type={show ? 'text' : 'password'} autoComplete="new-password" {...f.bind('confirm')} />
            <Button type="submit" size="lg" className="w-full rounded-2xl" loading={f.submitting}>
              Update password
            </Button>
          </Reveal>
        </form>
      )}
    </>
  );
}

export default function ResetPage() {
  return (
    <Suspense>
      <ResetForm />
    </Suspense>
  );
}
