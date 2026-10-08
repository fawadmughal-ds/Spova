import type { Metadata } from 'next';
import { BookMarked, Download, Layers3 } from 'lucide-react';
import { FeedPage } from '@/components/education/shared';
import { BookshelfPreview } from '@/components/education/previews';

export const metadata: Metadata = {
  title: 'eBooks',
  description: 'Longer reads on CFD basics, charts, order types and risk management, planned for the education library.',
};

export default function EbooksPage() {
  return (
    <FeedPage
      href="/ebooks"
      eyebrow="Education — eBooks"
      title="Longer reads, *for the deep end*"
      lead="Some subjects need more than a page. The library is planned as a small shelf of guides you can read in an evening and keep open next to the terminal."
      preview={<BookshelfPreview />}
      previewNote="Planned topics · nothing to download yet"
      pointsTitle="How the library *is planned*"
      points={[
        { icon: Layers3, title: 'One subject per book', body: 'Each guide covers a single topic from start to finish, from what a CFD is to building a trading routine.' },
        { icon: BookMarked, title: 'Ordered by experience', body: 'Start with the basics and move on to charts, orders and risk in a sensible sequence.' },
        { icon: Download, title: 'Yours to keep', body: 'Guides are meant to be downloadable, so you can read them offline and come back to them.' },
      ]}
      gateBody="The eBook library has not been published yet. When it is, clients will be able to download the guides from the client area. The spines above show planned topics only."
    />
  );
}
