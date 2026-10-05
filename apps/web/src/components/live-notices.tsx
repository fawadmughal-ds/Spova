'use client';

import { useAccountStream } from '@/lib/ws';
import { useToast } from '@/components/toast';

/** Mounts the WS connection for the session and surfaces server notices as toasts. */
export function LiveNotices() {
  const toast = useToast();
  useAccountStream(
    () => {},
    (n) => toast({ title: n.title, body: n.body, level: n.level }),
  );
  return null;
}
