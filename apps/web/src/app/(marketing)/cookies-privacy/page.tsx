import type { Metadata } from 'next';
import { PrivacyPage } from '@/components/marketing/company-privacy';

export const metadata: Metadata = {
  title: 'Cookies & privacy',
  description: 'What personal data we collect, how it is used, and the cookies this site sets.',
};

export default function Page() {
  return <PrivacyPage />;
}
