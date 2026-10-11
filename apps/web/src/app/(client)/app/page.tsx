'use client';

import { Suspense } from 'react';
import { DashboardView } from '@/components/portal/dashboard-view';

export default function DashboardPage() {
  return (
    <Suspense>
      <DashboardView />
    </Suspense>
  );
}
