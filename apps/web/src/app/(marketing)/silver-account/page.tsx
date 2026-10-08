import { TierPage, tierMetadata } from '@/components/marketing/tier-page';

export const metadata = tierMetadata('silver');

export default function SilverAccountPage() {
  return <TierPage tier="silver" />;
}
