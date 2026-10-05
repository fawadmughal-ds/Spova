'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import type { MeDto } from '@spova/shared';
import { api, ApiError, post } from './api';

interface AuthState {
  me: MeDto | null;
  loading: boolean;
  refresh: () => Promise<MeDto | null>;
  logout: () => Promise<void>;
  setMe: (me: MeDto | null) => void;
}

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children, initial = null }: { children: ReactNode; initial?: MeDto | null }) {
  const [me, setMe] = useState<MeDto | null>(initial);
  const [loading, setLoading] = useState(initial === null);
  const router = useRouter();

  const refresh = useCallback(async () => {
    try {
      const m = await api<MeDto>('/auth/me');
      setMe(m);
      return m;
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) setMe(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (initial === null) void refresh();
  }, [initial, refresh]);

  const logout = useCallback(async () => {
    try {
      await post('/auth/logout');
    } catch {
      /* already logged out */
    }
    setMe(null);
    router.replace('/login');
  }, [router]);

  const value = useMemo(() => ({ me, loading, refresh, logout, setMe }), [me, loading, refresh, logout]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth outside AuthProvider');
  return v;
}

/** Client-side gate: waits for /auth/me, redirects to /login (with next=) when not signed in, enforces roles. */
export function RequireAuth({ children, roles }: { children: ReactNode; roles?: MeDto['role'][] }) {
  const { me, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!me) {
      const next = typeof window !== 'undefined' ? window.location.pathname : '/app';
      router.replace(`/login?next=${encodeURIComponent(next)}`);
    } else if (roles && !roles.includes(me.role)) {
      router.replace('/app');
    }
  }, [loading, me, roles, router]);

  if (loading || !me || (roles && !roles.includes(me.role))) {
    return (
      <div className="flex min-h-screen items-center justify-center text-ink-400">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-ink-600 border-t-brand-500" />
      </div>
    );
  }
  return <>{children}</>;
}
