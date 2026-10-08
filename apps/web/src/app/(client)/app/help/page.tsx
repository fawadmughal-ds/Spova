import { LifeBuoy } from 'lucide-react';
import { ComingSoon, HelpPreview } from '@/components/coming-soon';

export default function HelpPage() {
  return (
    <ComingSoon
      title="Help"
      milestone="milestone 2 (13 Oct)"
      icon={LifeBuoy}
      blurb="Support will live inside the client area as tickets you can follow from open to resolved."
      items={['Open a support ticket', 'Ticket history and replies', 'FAQ links']}
      preview={<HelpPreview />}
    />
  );
}
