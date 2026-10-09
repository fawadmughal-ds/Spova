'use client';

import { use } from 'react';
import { StatementView } from '@/components/portal/statement-view';

export default function AccountStatementPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <StatementView id={id} />;
}
