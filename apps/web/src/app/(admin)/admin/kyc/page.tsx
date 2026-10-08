'use client';

import { PageHeader } from '@/components/app-shell';
import { KycQueue } from '@/components/admin/kyc-queue';

export default function KycQueuePage() {
  return (
    <>
      <PageHeader title="KYC queue" sub="Identity, address and payment-method documents. New uploads appear here live." />
      <KycQueue />
    </>
  );
}
