'use client';

import type { ReactNode } from 'react';
import { AuthProvider } from '@/lib/auth-context';
import { ToastProvider } from '@/components/toast';

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <AuthProvider>{children}</AuthProvider>
    </ToastProvider>
  );
}
