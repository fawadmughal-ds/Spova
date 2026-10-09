import type { Metadata } from 'next';
import { Lightbulb } from 'lucide-react';
import { ComingSoon } from '@/components/coming-soon';

export const metadata: Metadata = { title: 'InvestiQ' };

/** Placeholder for the InvestiQ section linked from the terminal rail. Nothing here is live yet. */
export default function InvestiQPage() {
  return (
    <ComingSoon
      title="InvestiQ"
      milestone="a later release"
      icon={Lightbulb}
      blurb="InvestiQ is planned as a research area inside the client portal. The scope is not final yet, so nothing is promised here; this page only reserves the link from the terminal."
      items={['Scope and launch date to be confirmed by the broker.', 'Until then, the web terminal, account statements and the help desk are the places to go.']}
    />
  );
}
