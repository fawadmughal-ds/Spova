'use client';

import { PageHeader } from '@/components/app-shell';
import { PlatformControls } from '@/components/admin/platform-controls';
import { EmailSettingsPanel } from '@/components/admin/email-settings';

export default function PlatformPage() {
  return (
    <>
      <PageHeader title="Platform" sub="Switches that affect every client at once: pause trading, show an announcement, open or close registration, and send a broadcast." />
      <PlatformControls />
      <div className="mt-6">
        <EmailSettingsPanel />
      </div>
    </>
  );
}
