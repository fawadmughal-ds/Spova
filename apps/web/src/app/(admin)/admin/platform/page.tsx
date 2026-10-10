'use client';

import { PageHeader } from '@/components/app-shell';
import { PlatformControls } from '@/components/admin/platform-controls';

export default function PlatformPage() {
  return (
    <>
      <PageHeader title="Platform" sub="Switches that affect every client at once: pause trading, show an announcement, open or close registration, and send a broadcast." />
      <PlatformControls />
    </>
  );
}
