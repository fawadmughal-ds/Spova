'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowRight } from 'lucide-react';
import { loginSchema, type LoginInput, type MeDto } from '@spova/shared';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useForm } from '@/lib/use-form';
import { Reveal } from '@/components/motion';
import { Alert, Button, Input } from '@/components/ui';
import { AuthHeading, PasswordToggle } from '@/components/auth/parts';

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
      <AuthHeading eyebrow="Client area" title="Welcome *back*" sub="Sign in to your client area." />
      <form onSubmit={onSubmit} className="mt-9" noValidate>
        <Reveal variant="stagger" delay={250} step={70} className="space-y-4">
          {f.serverError && <Alert tone="danger">{f.serverError}</Alert>}
          <Input label="Email" type="email" autoComplete="email" placeholder="you@example.com" {...f.bind('email')} />
          <Input
            label="Password"
            type={show ? 'text' : 'password'}
            autoComplete="current-password"
            placeholder="••••••••"
            {...f.bind('password')}
            right={<PasswordToggle show={show} onToggle={() => setShow((v) => !v)} />}
          />
          <div className="flex items-center justify-end text-sm">
            <Link href="/forgot-password" className="link-underline text-brand-300 transition-colors hover:text-brand-200">
              Forgot password?
            </Link>
          </div>
          <Button type="submit" size="lg" className="group w-full rounded-2xl" loading={f.submitting}>
            Log in <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
          </Button>
        </Reveal>
      </form>

      <Reveal variant="fade" delay={650}>
        <div className="mt-8 flex items-center gap-4">
          <span className="h-px flex-1 bg-gradient-to-r from-transparent to-white/10" />
          <span className="label">New here?</span>
          <span className="h-px flex-1 bg-gradient-to-l from-transparent to-white/10" />
        </div>
        <Link href="/register" className="card card-hover group mt-5 flex items-center justify-between gap-4 px-5 py-4">
          <span>
            <span className="block text-sm font-semibold text-white">Open an account</span>
            <span className="block text-xs text-ink-400">Free demo with $10,000 virtual funds</span>
          </span>
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-400/15 text-brand-300 transition-all duration-500 ease-spring group-hover:bg-brand-400 group-hover:text-ink-950">
            <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5" />
          </span>
        </Link>
        <p className="mt-8 text-xs leading-relaxed text-ink-500">CFDs are complex instruments and come with a high risk of losing money rapidly due to leverage.</p>
      </Reveal>
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
