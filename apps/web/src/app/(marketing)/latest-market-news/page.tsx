import type { Metadata } from 'next';
import { ListFilter, Newspaper, Zap } from 'lucide-react';
import { FeedPage } from '@/components/education/shared';
import { NewsWirePreview } from '@/components/education/previews';

export const metadata: Metadata = {
  title: 'Latest market news',
  description: 'A market news wire grouped by asset class, planned for clients.',
};

export default function LatestMarketNewsPage() {
  return (
    <FeedPage
      href="/latest-market-news"
      eyebrow="Education — Latest market news"
      title="Headlines that *move prices*"
      lead="Prices react to information. A news wire sorted by asset class keeps the stories that matter to your positions in one place, without the noise of a general feed."
      preview={<NewsWirePreview />}
      previewNote="Sample layout · no real headlines"
      pointsTitle="How the wire *is organised*"
      points={[
        { icon: ListFilter, title: 'By asset class', body: 'Forex, indices, commodities, shares, crypto and metals each get their own stream.' },
        { icon: Zap, title: 'Newest first', body: 'Stories are listed as they arrive, so the top of the wire is always the latest item.' },
        { icon: Newspaper, title: 'Context with the headline', body: 'A short summary under each headline says why the story might matter to a market.' },
      ]}
      gateBody="The news wire depends on an external feed that has not been connected yet. When it is, clients will be able to read it from the client area. The rows above are a sample layout and contain no real headlines."
    />
  );
}
