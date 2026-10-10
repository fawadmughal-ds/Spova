'use client';

import { useEffect, useState } from 'react';
import type { PlatformPublicDto } from '@spova/shared';
import { get } from '@/lib/api';
import { useUserEvent } from '@/lib/ws';

const DEFAULT: PlatformPublicDto = { tradingHalt: { enabled: false, message: '' }, announcement: { enabled: false, text: '', level: 'info' }, registrationOpen: true, liveAccountsOpen: true };
let cached: PlatformPublicDto | null = null;
const listeners = new Set<(p: PlatformPublicDto) => void>();
const publish = (p: PlatformPublicDto) => {
  cached = p;
  listeners.forEach((l) => l(p));
};

/**
 * Platform switches set in the back office (trading halt, announcement, registration): fetched once per
 * page load and pushed live over the socket when an admin changes them.
 */
export function usePlatform(): PlatformPublicDto {
  const [p, setP] = useState<PlatformPublicDto>(cached ?? DEFAULT);
  useEffect(() => {
    listeners.add(setP);
    if (!cached)
      get<PlatformPublicDto>('/market/platform')
        .then(publish)
        .catch(() => undefined);
    return () => {
      listeners.delete(setP);
    };
  }, []);
  useUserEvent<PlatformPublicDto>('platform:update', publish);
  return p;
}
