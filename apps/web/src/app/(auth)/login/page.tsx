'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Eye, EyeOff } from 'lucide-react';
import { loginSchema, type LoginInput, type MeDto } from '@spova/shared';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useForm } from '@/lib/use-form';
import { Alert, Button, Input } from '@/components/ui';

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const { setMe } = useAuth();
  const [show, setShow] = useState(false);
  const f = useForm<LoginInput>(loginSchema);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void f.submit(async (data) => {
      const me = await api<MeDto>('/auth/login', { method: 'POST', body: data, noRetry: true });
      setMe(me);
      const next = params.get('next');
      const isAdmin = me.role === 'admin' || me.role === 'superadmin';
      router.replace(next && next.startsWith('/') ? next : isAdmin ? '/admin' : '/app');
    });
  };

  return (
    <>
      <h1 className="text-2xl font-bold">Welcome back</h1>
      <p className="mt-1 text-sm text-ink-400">Sign in to your client area.</p>
      <form onSubmit={onSubmit} className="mt-8 space-y-4" noValidate>
        {f.serverError && <Alert tone="danger">{f.serverError}</Alert>}
        <Input label="Email" type="email" autoComplete="email" placeholder="you@example.com" {...f.bind('email')} />
        <Input
          label="Password"
          type={show ? 'text' : 'password'}
          autoComplete="current-password"
          placeholder="••••••••"
          {...f.bind('password')}
          right={
            <button type="button" onClick={() => setShow((v) => !v)} className="hover:text-ink-200" aria-label="Toggle password">
              {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          }
        />
        <div className="flex items-center justify-between text-sm">
          <Link href="/forgot-password" className="text-brand-300 hover:text-brand-200">
            Forgot password?
          </Link>
        </div>
        <Button type="submit" size="lg" className="w-full" loading={f.submitting}>
          Log in
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-ink-400">
        New here?{' '}
        <Link href="/register" className="font-medium text-brand-300 hover:text-brand-200">
          Open an account
        </Link>
      </p>
      <p className="mt-10 text-xs text-ink-500">CFDs are complex instruments and come with a high risk of losing money rapidly due to leverage.</p>
    </>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
