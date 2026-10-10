'use client';

import { Suspense } from 'react';
import { PaymentsView } from '@/components/portal/payments-view';

export default function PaymentsPage() {
  return (
    <Suspense>
      <PaymentsView />
    </Suspense>
  );
}
