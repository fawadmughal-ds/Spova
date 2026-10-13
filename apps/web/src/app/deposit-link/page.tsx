'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { post } from '@/lib/api';
import { ApiError } from '@/lib/api';
import { Spinner } from '@/components/ui';
import { BRAND } from '@/lib/utils';

function DepositLink() {
  const params = useSearchParams();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = params.get('token');
    if (!token) {
      setError('This link is missing its code. Please use the full link from your email.');
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        await post('/auth/deposit-link', { token });
        if (!cancelled) router.replace('/client-area?panel=deposit');
      } catch (e) {
        if (!cancelled) setError(e instanceof ApiError ? e.message : 'This link could not be opened. Please ask support for a new one.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [params, router]);

  return (
    <main className="flex min-h-dvh items-center justify-center bg-[#eef2f7] px-4">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto mb-5 h-11 w-11">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/zerventa-mark.png" alt={BRAND} width={44} height={44} className="rounded-xl" />
        </div>
        {error ? (
          <>
            <h1 className="mb-2 text-lg font-bold text-slate-900">Link unavailable</h1>
            <p className="mb-6 text-sm text-slate-500">{error}</p>
            <Link href="/login" className="inline-block rounded-lg bg-[#2563eb] px-5 py-2.5 text-sm font-semibold text-white">
              Go to login
            </Link>
          </>
        ) : (
          <>
            <h1 className="mb-2 text-lg font-bold text-slate-900">Opening your deposit page…</h1>
            <p className="mb-6 text-sm text-slate-500">One moment while we sign you in securely.</p>
            <Spinner className="mx-auto h-6" />
          </>
        )}
      </div>
    </main>
  );
}

export default function DepositLinkPage() {
  return (
    <Suspense fallback={null}>
      <DepositLink />
    </Suspense>
  );
}
