import type { Metadata } from 'next';
import { BellRing, Filter, Gauge } from 'lucide-react';
import { FeedPage } from '@/components/education/shared';
import { CalendarPreview } from '@/components/education/previews';

export const metadata: Metadata = {
  title: 'Economic calendar',
  description: 'A schedule of the releases and decisions that tend to move markets: rate decisions, inflation, employment and growth data.',
};

export default function EconomicCalendarPage() {
  return (
    <FeedPage
      href="/economic-calendar"
      eyebrow="Education — Economic calendar"
      title="Know what is *on the schedule*"
      lead="Rate decisions, inflation prints and employment reports arrive on a timetable. A calendar lets you see them coming, so a volatile hour is something you planned around rather than something that happened to you."
      preview={<CalendarPreview />}
      previewNote="Sample layout · no real events"
      pointsTitle="Built around *three questions*"
      points={[
        { icon: Gauge, title: 'How much does it matter?', body: 'Each release carries an impact rating, so a central bank decision does not look the same as a minor survey.' },
        { icon: Filter, title: 'Does it touch my market?', body: 'Filter by currency and by day to see only the events relevant to the instruments you trade.' },
        { icon: BellRing, title: 'What was expected?', body: 'Previous, forecast and actual figures sit side by side, because markets react to the surprise, not the number.' },
      ]}
      gateBody="The calendar is driven by an external data feed that has not been connected yet. When it is, it will be available from the client area. Until then, the layout above is a sample only and shows no real events."
    />
  );
}
