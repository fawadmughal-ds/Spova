import { ArrowLeftRight } from 'lucide-react';
import { ComingSoon, PaymentsPreview } from '@/components/coming-soon';

export default function PaymentsPage() {
  return (
    <ComingSoon
      title="Deposit / Withdraw"
      milestone="milestone 2 (13 Oct)"
      icon={ArrowLeftRight}
      blurb="Funding works as a request queue: you ask, the back office approves, the ledger updates."
      items={['Deposit request: amount presets, method (bank / crypto USDT / card placeholder)', 'Withdrawal request on live accounts, KYC-gated', 'Payment history with status chips', 'Admin approve / decline posts to the ledger instantly']}
      preview={<PaymentsPreview />}
    />
  );
}
