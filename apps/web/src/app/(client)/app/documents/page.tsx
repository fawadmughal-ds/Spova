import { ComingSoon } from '@/components/coming-soon';

export default function DocumentsPage() {
  return (
    <ComingSoon
      title="Documents (KYC)"
      milestone="milestone 2 (13 Oct)"
      items={['Proof of identity: passport / ID card / driving licence', 'Proof of residence: utility bill / bank statement', 'Payment method proof', 'Secure private storage, admin review with approve / reject reason']}
    />
  );
}
