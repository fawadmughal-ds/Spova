'use client';

import type { ReactNode } from 'react';
import { AuthProvider } from '@/lib/auth-context';
import { ToastProvider } from '@/components/toast';
import { CookieConsent } from '@/components/cookie-consent';

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <AuthProvider>
        {children}
        <CookieConsent />
      </AuthProvider>
    </ToastProvider>
  );
}
