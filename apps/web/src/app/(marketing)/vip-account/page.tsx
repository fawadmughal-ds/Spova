import { TierPage, tierMetadata } from '@/components/marketing/tier-page';

export const metadata = tierMetadata('vip');

export default function VipAccountPage() {
  return <TierPage tier="vip" />;
}
