import type { Metadata } from 'next';
import { PartnerPage } from '@/components/marketing/company-partner';

export const metadata: Metadata = {
  title: 'Become a partner',
  description: 'Join the affiliate programme: sign up, promote the platform and get paid for the clients you refer.',
};

export default function Page() {
  return <PartnerPage />;
}
