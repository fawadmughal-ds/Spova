'use client';

import { Suspense, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { post } from '@/lib/api';
import { PageHeader } from '@/components/app-shell';
import { Card } from '@/components/ui';
import { ActivityFeed } from '@/components/admin/activity-feed';

function ActivityInner() {
  const params = useSearchParams();
  const initialKind = params.get('kind') ?? '';

  // opening the feed clears the unread badge
  useEffect(() => {
    void post('/admin/activity/read').catch(() => {});
  }, []);

  return (
    <Card title="Activity feed">
      <ActivityFeed initialKind={initialKind} />
    </Card>
  );
}

export default function ActivityPage() {
  return (
    <div>
      <PageHeader title="Activity" sub="Everything your clients do, newest first. Search, filter by type or pick a date range." />
      <Suspense fallback={null}>
        <ActivityInner />
      </Suspense>
    </div>
  );
}
