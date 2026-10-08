import { TierPage, tierMetadata } from '@/components/marketing/tier-page';

export const metadata = tierMetadata('classic');

export default function ClassicAccountPage() {
  return <TierPage tier="classic" />;
}
