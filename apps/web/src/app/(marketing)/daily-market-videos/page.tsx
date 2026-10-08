import type { Metadata } from 'next';
import { Clapperboard, Timer, Tv } from 'lucide-react';
import { FeedPage } from '@/components/education/shared';
import { VideoWallPreview } from '@/components/education/previews';

export const metadata: Metadata = {
  title: 'Daily market videos',
  description: 'Short video recaps of the trading session and the levels to watch, planned for clients.',
};

export default function DailyMarketVideosPage() {
  return (
    <FeedPage
      href="/daily-market-videos"
      eyebrow="Education — Daily market videos"
      title="The session, *in a few minutes*"
      lead="Not everyone has time to read the whole tape. A short daily video is meant to cover what moved, why it might have moved, and what is on the schedule next."
      preview={<VideoWallPreview />}
      previewNote="Sample layout · no real videos"
      pointsTitle="What each video *is for*"
      points={[
        { icon: Timer, title: 'Short by design', body: 'A few minutes per session, so it fits before the open or over a coffee.' },
        { icon: Tv, title: 'Charts on screen', body: 'Levels and moves are shown on the chart rather than described, which makes them easier to check yourself.' },
        { icon: Clapperboard, title: 'Commentary, not advice', body: 'Videos explain what happened in the market. They are general information and do not recommend any trade.' },
      ]}
      gateBody="Videos are supplied by an external provider that has not been connected yet. When it is, clients will be able to watch them from the client area. The player above is a sample layout with nothing to play."
    />
  );
}
