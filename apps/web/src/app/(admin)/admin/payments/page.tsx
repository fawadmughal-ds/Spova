'use client';

import { useState } from 'react';
import { PageHeader } from '@/components/app-shell';
import { PaymentsQueue, PendingTotals } from '@/components/admin/payments-queue';

export default function PaymentsQueuePage() {
  // bumped after every decision and every live request so the header totals follow the queue
  const [version, setVersion] = useState(0);
  return (
    <>
      <PageHeader title="Payments" sub="Deposit and withdrawal requests. Approving posts the ledger entry; declining sends your note to the client." />
      <PendingTotals version={version} />
      <PaymentsQueue onChanged={() => setVersion((v) => v + 1)} />
    </>
  );
}
