import { ComingSoon } from '@/components/coming-soon';

export default function PaymentsPage() {
  return (
    <ComingSoon
      title="Deposit / Withdraw"
      milestone="milestone 2 (13 Oct)"
      items={['Deposit request: amount presets, method (bank / crypto USDT / card placeholder)', 'Withdrawal request on live accounts, KYC-gated', 'Payment history with status chips', 'Admin approve / decline posts to the ledger instantly']}
    />
  );
}
