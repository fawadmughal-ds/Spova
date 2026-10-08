import { FileCheck2 } from 'lucide-react';
import { ComingSoon, DocumentsPreview } from '@/components/coming-soon';

export default function DocumentsPage() {
  return (
    <ComingSoon
      title="Documents (KYC)"
      milestone="milestone 2 (13 Oct)"
      icon={FileCheck2}
      blurb="Verification unlocks live trading and withdrawals. This is what the upload flow will cover."
      items={['Proof of identity: passport / ID card / driving licence', 'Proof of residence: utility bill / bank statement', 'Payment method proof', 'Secure private storage, admin review with approve / reject reason']}
      preview={<DocumentsPreview />}
    />
  );
}
