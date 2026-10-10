'use client';

import { Suspense } from 'react';
import { DocumentsPanel } from '@/components/portal/documents-panel';
import { Skeleton } from '@/components/ui';

export default function DocumentsPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <div className="card rounded-2xl p-5 sm:p-8">
        <Suspense fallback={<Skeleton className="h-96 rounded-xl" />}>
          <DocumentsPanel />
        </Suspense>
      </div>
    </div>
  );
}
