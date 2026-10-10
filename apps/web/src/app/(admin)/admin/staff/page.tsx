'use client';

import { PageHeader } from '@/components/app-shell';
import { StaffTable } from '@/components/admin/staff-table';

export default function StaffPage() {
  return (
    <>
      <PageHeader title="Staff" sub="Who can sign in to the back office. Admins handle queues and clients; superadmins also manage staff and platform switches." />
      <StaffTable />
    </>
  );
}
