import { TierPage, tierMetadata } from '@/components/marketing/tier-page';

export const metadata = tierMetadata('platinum');

export default function PlatinumAccountPage() {
  return <TierPage tier="platinum" />;
}
