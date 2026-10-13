'use client';

import { useEffect, useRef, useState } from 'react';
import { Bell } from 'lucide-react';
import Link from 'next/link';
import type { ActivityFeedDto, ActivityEventDto } from '@spova/shared';
import { get, post } from '@/lib/api';
import { fmtAgo } from '@/lib/utils';

/** Admin header bell: mirrors the activity log. Shows recent client events and a badge of unseen ones; clears when marked seen. */
export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState(0);
  const [items, setItems] = useState<ActivityEventDto[]>([]);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    const poll = () => get<{ count: number }>('/admin/activity/unread').then((r) => alive && setCount(r.count)).catch(() => {});
    poll();
    const t = setInterval(poll, 20_000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);

  const openMenu = async () => {
    setOpen(true);
    try {
      const d = await get<ActivityFeedDto>('/admin/activity?limit=14');
      setItems(d.items);
    } catch {
      /* ignore */
    }
  };
  const markSeen = async () => {
    await post('/admin/activity/read').catch(() => {});
    setCount(0);
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => (open ? setOpen(false) : void openMenu())}
        aria-label="Notifications"
        className="relative flex h-9 w-9 items-center justify-center rounded-full text-ink-300 transition-colors hover:bg-white/[0.06] hover:text-white"
      >
        <Bell className="h-5 w-5" />
        {count > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[rgb(var(--shell))] px-1 text-[10px] font-bold text-white">
            {count > 99 ? '99+' : count}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 top-11 z-50 w-80 max-w-[90vw] overflow-hidden rounded-2xl border border-white/10 bg-ink-950 shadow-2xl">
          <div className="flex items-center justify-between border-b border-white/5 px-4 py-2.5">
            <span className="text-sm font-semibold text-white">Notifications</span>
            <button type="button" onClick={() => void markSeen()} className="text-xs text-brand-300 hover:underline">
              Mark all seen
            </button>
          </div>
          <div className="max-h-[60vh] overflow-y-auto">
            {items.length === 0 ? (
              <div className="px-4 py-10 text-center text-sm text-ink-500">Nothing yet.</div>
            ) : (
              items.map((e) => (
                <Link
                  key={e.id}
                  href={e.userId ? `/admin/clients/${e.userId}` : '/admin/activity'}
                  onClick={() => setOpen(false)}
                  className="block border-b border-white/[0.04] px-4 py-2.5 hover:bg-white/[0.03]"
                >
                  <div className="text-[13px] text-white">
                    {e.title}
                    {e.detail ? <span className="text-ink-400"> — {e.detail}</span> : null}
                  </div>
                  <div className="text-[11px] text-ink-500">
                    {e.userName || e.userEmail || 'system'} · {fmtAgo(e.createdAt)}
                  </div>
                </Link>
              ))
            )}
          </div>
          <Link href="/admin/activity" onClick={() => setOpen(false)} className="block border-t border-white/5 px-4 py-2.5 text-center text-xs font-medium text-brand-300 hover:bg-white/[0.03]">
            View all activity
          </Link>
        </div>
      )}
    </div>
  );
}
