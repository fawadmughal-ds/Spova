'use client';

import { PageHeader } from '@/components/app-shell';
import { InstrumentsTable } from '@/components/admin/instruments-table';

export default function InstrumentsPage() {
  return (
    <>
      <PageHeader title="Instruments" sub="Switch instruments on or off, feature them in the terminal, and set spread markup, swaps, leverage and lot limits. Every change is audited." />
      <InstrumentsTable />
    </>
  );
}
