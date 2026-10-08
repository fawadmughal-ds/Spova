import type { Metadata } from 'next';
import { Crosshair, ScrollText, TriangleAlert } from 'lucide-react';
import { FeedPage } from '@/components/education/shared';
import { SignalsPreview } from '@/components/education/previews';

export const metadata: Metadata = {
  title: 'Trading signals',
  description: 'Trade ideas with a direction, an entry area, a target and a stop, for clients to study alongside their own analysis.',
};

export default function SignalsPage() {
  return (
    <FeedPage
      href="/signals"
      eyebrow="Education — Signals"
      title="Trade ideas, *with the reasoning*"
      lead="A signal is a structured trade idea: an instrument, a direction, an entry area, a target and a stop. It is a starting point for your own analysis, never an instruction, and never a promise about the outcome."
      preview={<SignalsPreview />}
      previewNote="Sample layout · no real signals"
      pointsTitle="What a signal *should tell you*"
      points={[
        { icon: Crosshair, title: 'The full plan', body: 'Direction, entry, target and stop are stated together, so the risk is defined before the idea is considered.' },
        { icon: ScrollText, title: 'The why', body: 'Each idea is meant to come with the level or pattern it is based on, so you can judge it instead of following it blind.' },
        { icon: TriangleAlert, title: 'The limits', body: 'Signals are general information, not personal advice. Any idea can fail, and past ideas say nothing reliable about future ones.' },
      ]}
      gateBody="Signals come from an external provider that has not been connected yet. When it is, they will be available to clients from the client area. The cards above are a sample layout and contain no real trade ideas."
    />
  );
}
