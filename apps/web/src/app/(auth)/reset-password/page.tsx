'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { z } from 'zod';
import { passwordSchema } from '@spova/shared';
import { post } from '@/lib/api';
import { useForm } from '@/lib/use-form';
import { Alert, Button, Input } from '@/components/ui';

const schema = z
  .object({ password: passwordSchema, confirm: z.string() })
  .refine((v) => v.password === v.confirm, { path: ['confirm'], message: 'Passwords do not match' });

function ResetForm() {
  const token = useSearchParams().get('token') ?? '';
  const [done, setDone] = useState(false);
  const f = useForm<z.infer<typeof schema>>(schema);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void f.submit(async (data) => {
      await post('/auth/reset-password', { token, password: data.password });
      setDone(true);
    });
  };

  if (!token) return <Alert tone="danger">Missing reset token. Use the link from your email.</Alert>;

  return (
    <>
      <h1 className="text-2xl font-bold">Choose a new password</h1>
      {done ? (
        <Alert tone="success" className="mt-8">
          Password updated.{' '}
          <Link href="/login" className="font-semibold underline">
            Log in
          </Link>
        </Alert>
      ) : (
        <form onSubmit={onSubmit} className="mt-8 space-y-4" noValidate>
          {f.serverError && <Alert tone="danger">{f.serverError}</Alert>}
          <Input label="New password" type="password" autoComplete="new-password" hint="8-32 characters with upper, lower, number and symbol" {...f.bind('password')} />
          <Input label="Confirm password" type="password" autoComplete="new-password" {...f.bind('confirm')} />
          <Button type="submit" size="lg" className="w-full" loading={f.submitting}>
            Update password
          </Button>
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
