'use client';

import { useCallback, useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import Link from 'next/link';
import { ArrowUpRight, CheckCheck, Lock, MessagesSquare, RotateCcw, Send } from 'lucide-react';
import { WS_EVENTS, ticketMessageSchema, type TicketDetailDto, type TicketDto, type TicketStatus } from '@spova/shared';
import { get, patch, post, ApiError } from '@/lib/api';
import { useUserEvent } from '@/lib/ws';
import { cn, fmtDate } from '@/lib/utils';
import { useToast } from '@/components/toast';
import { Alert, Badge, Button, Card, Empty, Spinner } from '@/components/ui';
import { ClientCell, Pager, PanelHeader, SidePanel, StatusTabs, TableSkeleton, Textarea, TimeAgo, useQueue } from './queue-bits';

type Tab = TicketStatus | 'all';
const TABS: { value: Tab; label: string }[] = [
  { value: 'open', label: 'Open' },
  { value: 'answered', label: 'Answered' },
  { value: 'closed', label: 'Closed' },
  { value: 'all', label: 'All' },
];
const statusTone: Record<TicketStatus, 'warning' | 'info' | 'neutral'> = { open: 'warning', answered: 'info', closed: 'neutral' };

interface WsTicketNew {
  id: string;
  userId: string;
  subject: string;
  email: string;
  createdAt: string;
}

const clientName = (u?: { email: string; firstName: string | null; lastName: string | null }) => (u ? (u.firstName || u.lastName ? `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim() : u.email) : 'Client');

/** Support inbox with a thread pane. `userId` narrows it to one client; `compact` drops the client column and uses a drawer. */
export function TicketInbox({ userId, compact }: { userId?: string; compact?: boolean }) {
  const toast = useToast();
  const [tab, setTab] = useState<Tab>(userId ? 'all' : 'open');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [thread, setThread] = useState<TicketDetailDto | null>(null);
  const [threadErr, setThreadErr] = useState<string | null>(null);
  const limit = compact ? 10 : 20;
  const q = useQueue<TicketDto>('/admin/tickets', { status: tab === 'all' ? undefined : tab, userId }, limit);
  const items = q.data?.items ?? [];

  const loadThread = useCallback(async (id: string) => {
    try {
      const t = await get<TicketDetailDto>(`/admin/tickets/${id}`);
      setThread(t);
      setThreadErr(null);
    } catch (e) {
      setThreadErr(e instanceof ApiError ? e.message : 'Could not load the ticket');
    }
  }, []);

  useEffect(() => {
    if (!selectedId) {
      setThread(null);
      setThreadErr(null);
      return;
    }
    setThread((prev) => (prev?.id === selectedId ? prev : null));
    void loadThread(selectedId);
  }, [selectedId, loadThread]);

  useUserEvent<WsTicketNew>(WS_EVENTS.ADMIN_TICKET_NEW, (p) => {
    if (userId && p.userId !== userId) return;
    q.refresh();
    toast({ title: 'New ticket', body: `${p.email} · ${p.subject}`, level: 'info' });
  });
  useUserEvent<{ id: string; status: TicketStatus }>(WS_EVENTS.TICKET_UPDATED, (p) => {
    q.refresh();
    if (p.id === selectedId) void loadThread(p.id);
  });

  /** Server returns the whole thread after a reply or status change; mirror it into the list. */
  const applyUpdate = (t: TicketDetailDto) => {
    setThread(t);
    const keep = tab === 'all' || tab === t.status;
    q.setData((prev) =>
      prev
        ? {
            ...prev,
            items: keep ? prev.items.map((x) => (x.id === t.id ? { ...x, ...t, messages: undefined } as TicketDto : x)) : prev.items.filter((x) => x.id !== t.id),
            total: keep ? prev.total : Math.max(0, prev.total - 1),
          }
        : prev,
    );
  };

  const showClient = !userId;
  const cols = (showClient ? 1 : 0) + 4;

  return (
    <div className={cn(!compact && 'grid grid-cols-[minmax(0,1fr)] items-start gap-6 xl:grid-cols-[minmax(0,1fr)_480px]')}>
      <Card className={cn(compact && 'p-4')}>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <StatusTabs
            items={TABS}
            value={tab}
            onChange={(t) => {
              setTab(t);
              q.setPage(1);
            }}
          />
          <span className="font-mono text-[11px] text-ink-400">
            {q.data ? (
              <>
                <span className="text-ink-100">{q.data.total}</span> ticket{q.data.total === 1 ? '' : 's'}
              </>
            ) : (
              '…'
            )}
          </span>
        </div>

        {q.error ? (
          <Alert tone="danger">{q.error}</Alert>
        ) : !q.data ? (
          <TableSkeleton cols={cols} />
        ) : items.length === 0 ? (
          <Empty icon={<MessagesSquare className="h-6 w-6" />}>{tab === 'open' ? 'Inbox zero. No open tickets.' : 'No tickets here.'}</Empty>
        ) : (
          <div className="-mx-2 overflow-x-auto">
            <table className={cn('w-full text-sm', showClient ? 'min-w-[760px]' : 'min-w-[560px]')}>
              <thead className="text-left">
                <tr>
                  <th className="label py-2 pl-2 pr-4 font-medium">Ticket</th>
                  {showClient && <th className="label py-2 pr-4 font-medium">Client</th>}
                  <th className="label py-2 pr-4 text-right font-medium">Msgs</th>
                  <th className="label py-2 pr-4 font-medium">Updated</th>
                  <th className="label py-2 pr-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody key={`${tab}-${q.page}-${userId ?? ''}`} className={cn('transition-opacity duration-300', q.loading && 'opacity-60')}>
                {items.map((t, i) => {
                  const on = selectedId === t.id;
                  const awaiting = t.status === 'open' && t.lastMessage && !t.lastMessage.isStaff;
                  return (
                    <tr
                      key={t.id}
                      onClick={() => setSelectedId(t.id)}
                      className={cn('animate-page-in group cursor-pointer border-t border-white/[0.05] transition-colors duration-300', on ? 'bg-brand-500/10' : 'hover:bg-white/[0.03]')}
                      style={{ animationDelay: `${i * 35}ms` }}
                    >
                      <td className="max-w-[360px] py-2.5 pl-2 pr-4">
                        <div className="flex items-center gap-2">
                          {awaiting && <span className="live-dot !h-1.5 !w-1.5 shrink-0 text-gold" aria-label="Awaiting reply" />}
                          <span className={cn('truncate', awaiting ? 'font-semibold text-white' : 'font-medium text-ink-100')}>{t.subject}</span>
                        </div>
                        {t.lastMessage && (
                          <div className="mt-0.5 truncate text-xs text-ink-400">
                            {t.lastMessage.isStaff && <span className="text-ink-500">You: </span>}
                            {t.lastMessage.body}
                          </div>
                        )}
                      </td>
                      {showClient && t.user && (
                        <td className="py-2.5 pr-4">
                          <ClientCell user={t.user} />
                        </td>
                      )}
                      <td className="tabular py-2.5 pr-4 text-right font-mono text-xs text-ink-300">{t.messageCount}</td>
                      <td className="py-2.5 pr-4 text-xs text-ink-400">
                        <TimeAgo iso={t.updatedAt} />
                      </td>
                      <td className="py-2.5 pr-2">
                        <Badge tone={statusTone[t.status]} className={cn(t.status === 'open' && 'text-gold')}>
                          {t.status}
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {q.data && <Pager page={q.page} pages={q.pages} total={q.data.total} noun="tickets" onPage={q.setPage} />}
      </Card>

      <SidePanel
        open={!!selectedId}
        onClose={() => setSelectedId(null)}
        split={!compact}
        placeholder={
          <div className="bg-dots flex flex-1 flex-col items-center justify-center gap-3 rounded-2xl p-8 text-center text-sm text-ink-400">
            <MessagesSquare className="h-7 w-7 text-ink-500" />
            <div>Select a ticket to read the thread and reply.</div>
            <div className="text-xs text-ink-500">Replies mark the ticket answered and notify the client.</div>
          </div>
        }
      >
        {selectedId &&
          (threadErr ? (
            <div className="p-5">
              <Alert tone="danger">{threadErr}</Alert>
            </div>
          ) : !thread ? (
            <div className="flex flex-1 items-center justify-center py-20">
              <Spinner />
            </div>
          ) : (
            <ThreadPanel thread={thread} onClose={() => setSelectedId(null)} onUpdated={applyUpdate} showClientLink={!userId} />
          ))}
      </SidePanel>
    </div>
  );
}

// ---------------------------------------------------------------- thread
function ThreadPanel({ thread, onClose, onUpdated, showClientLink }: { thread: TicketDetailDto; onClose: () => void; onUpdated: (t: TicketDetailDto) => void; showClientLink: boolean }) {
  const toast = useToast();
  const [body, setBody] = useState('');
  const [bodyErr, setBodyErr] = useState<string | undefined>();
  const [sending, setSending] = useState(false);
  const [changing, setChanging] = useState<TicketStatus | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: 'nearest' });
  }, [thread.id, thread.messages.length]);

  useEffect(() => {
    setBody('');
    setBodyErr(undefined);
    setErr(null);
  }, [thread.id]);

  const send = async (e?: FormEvent) => {
    e?.preventDefault();
    const parsed = ticketMessageSchema.safeParse({ body });
    if (!parsed.success) {
      setBodyErr('Write a reply first');
      return;
    }
    setSending(true);
    setErr(null);
    try {
      const t = await post<TicketDetailDto>(`/admin/tickets/${thread.id}/messages`, parsed.data);
      onUpdated(t);
      setBody('');
      toast({ title: 'Reply sent', body: `${thread.subject} · marked answered`, level: 'success' });
    } catch (e2) {
      const msg = e2 instanceof ApiError ? e2.message : 'Something went wrong. Please try again.';
      setErr(msg);
      toast({ title: 'Reply failed', body: msg, level: 'danger' });
    } finally {
      setSending(false);
    }
  };

  const setStatus = async (status: TicketStatus) => {
    setChanging(status);
    setErr(null);
    try {
      const t = await patch<TicketDetailDto>(`/admin/tickets/${thread.id}`, { status });
      onUpdated(t);
      toast({ title: status === 'closed' ? 'Ticket closed' : status === 'open' ? 'Ticket reopened' : 'Marked answered', body: thread.subject, level: status === 'closed' ? 'warning' : 'success' });
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : 'Something went wrong. Please try again.';
      setErr(msg);
      toast({ title: 'Update failed', body: msg, level: 'danger' });
    } finally {
      setChanging(null);
    }
  };

  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') void send();
  };

  const name = clientName(thread.user);

  return (
    <>
      <PanelHeader
        title={thread.subject}
        sub={
          <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <span className="truncate">
              {name}
              {thread.user && name !== thread.user.email ? ` · ${thread.user.email}` : ''}
            </span>
            <span className="text-ink-500">opened {fmtDate(thread.createdAt)}</span>
            {showClientLink && thread.user && (
              <Link href={`/admin/clients/${thread.user.id}`} className="inline-flex items-center gap-0.5 text-brand-300 hover:text-brand-200">
                Client profile <ArrowUpRight className="h-3 w-3" />
              </Link>
            )}
          </span>
        }
        onClose={onClose}
      >
        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          <Badge tone={statusTone[thread.status]} className={cn(thread.status === 'open' && 'text-gold')}>
            {thread.status}
          </Badge>
          {thread.status === 'open' && (
            <Button size="sm" variant="outline" loading={changing === 'answered'} disabled={!!changing} onClick={() => void setStatus('answered')}>
              <CheckCheck className="h-3.5 w-3.5" /> Mark answered
            </Button>
          )}
          {thread.status !== 'closed' ? (
            <Button size="sm" variant="ghost" loading={changing === 'closed'} disabled={!!changing} onClick={() => void setStatus('closed')}>
              <Lock className="h-3.5 w-3.5" /> Close
            </Button>
          ) : (
            <Button size="sm" variant="outline" loading={changing === 'open'} disabled={!!changing} onClick={() => void setStatus('open')}>
              <RotateCcw className="h-3.5 w-3.5" /> Reopen
            </Button>
          )}
        </div>
      </PanelHeader>

      <div className="flex-1 space-y-3 p-5">
        {thread.messages.map((m, i) => (
          <div key={m.id} className={cn('animate-page-in flex', m.isStaff ? 'justify-end' : 'justify-start')} style={{ animationDelay: `${Math.min(i, 12) * 40}ms` }}>
            <div
              className={cn(
                'admin-bubble max-w-[86%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed',
                m.isStaff ? 'rounded-br-md bg-brand-500 text-paper shadow-glow' : 'rounded-bl-md bg-white/[0.05] text-ink-100 ring-1 ring-inset ring-white/[0.08]',
              )}
            >
              <div className="whitespace-pre-wrap break-words">{m.body}</div>
              <div className={cn('mt-1.5 font-mono text-[10px]', m.isStaff ? 'text-paper/70' : 'text-ink-500')}>
                {m.isStaff ? 'Staff' : name} · {fmtDate(m.createdAt)}
              </div>
            </div>
          </div>
        ))}
        <div ref={bottom} />
      </div>

      <form onSubmit={(e) => void send(e)} className="sticky bottom-0 space-y-2 border-t border-white/[0.06] bg-paper/90 p-4 backdrop-blur-xl" noValidate>
        {err && <Alert tone="danger">{err}</Alert>}
        {thread.status === 'closed' && <Alert tone="neutral">This ticket is closed. Replying marks it answered again.</Alert>}
        <Textarea
          name="reply"
          aria-label="Reply"
          value={body}
          onChange={(e) => {
            setBody(e.target.value);
            setBodyErr(undefined);
          }}
          onKeyDown={onKey}
          error={bodyErr}
          placeholder={`Reply to ${name}…`}
          rows={3}
          maxLength={4000}
          className="min-h-[72px]"
        />
        <div className="flex items-center justify-between gap-3">
          <span className="text-[11px] text-ink-500">Ctrl + Enter to send · the client is notified</span>
          <Button type="submit" size="sm" loading={sending} disabled={!body.trim()}>
            <Send className="h-3.5 w-3.5" /> Reply
          </Button>
        </div>
      </form>
    </>
  );
}
