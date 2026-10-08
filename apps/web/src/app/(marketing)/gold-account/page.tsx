import { TierPage, tierMetadata } from '@/components/marketing/tier-page';

export const metadata = tierMetadata('gold');

export default function GoldAccountPage() {
  return <TierPage tier="gold" />;
}
