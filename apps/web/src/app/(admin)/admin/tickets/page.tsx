'use client';

import { PageHeader } from '@/components/app-shell';
import { TicketInbox } from '@/components/admin/ticket-inbox';

export default function TicketsPage() {
  return (
    <>
      <PageHeader title="Support tickets" sub="Client conversations. New tickets and client replies arrive live." />
      <TicketInbox />
    </>
  );
}
