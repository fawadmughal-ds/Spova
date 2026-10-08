import type { Metadata } from 'next';
import { ComplaintsPage } from '@/components/marketing/company-complaints';

export const metadata: Metadata = {
  title: 'Complaints',
  description: 'How to raise a complaint, what to include, and how it is acknowledged, investigated and answered.',
};

export default function Page() {
  return <ComplaintsPage />;
}
