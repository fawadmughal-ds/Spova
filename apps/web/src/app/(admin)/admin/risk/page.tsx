'use client';

import { PageHeader } from '@/components/app-shell';
import { RiskTiers } from '@/components/admin/risk-tiers';

export default function RiskPage() {
  return (
    <>
      <PageHeader title="Risk & limits" sub="Margin call and stop-out levels, leverage and minimum deposit per account tier. The risk engine picks up changes on its next cycle (seconds)." />
      <RiskTiers />
    </>
  );
}
