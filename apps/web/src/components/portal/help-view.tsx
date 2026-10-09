'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, BookOpen, CheckCheck, Headset, LifeBuoy, Lock, MessageSquarePlus, Plus, Send, UserRound } from 'lucide-react';
import { createTicketSchema, ticketMessageSchema, WS_EVENTS, type CreateTicketInput, type TicketDetailDto, type TicketDto } from '@spova/shared';
import { useAuth } from '@/lib/auth-context';
import { get, post } from '@/lib/api';
import { useUserEvent } from '@/lib/ws';
import { useForm } from '@/lib/use-form';
import { buttonClass } from '@/lib/button';
import { cn, fmtDate, initials } from '@/lib/utils';
import { PageHeader } from '@/components/app-shell';
import { useToast } from '@/components/toast';
import { Alert, Button, Empty, Input, Skeleton } from '@/components/ui';
import { TicketChip } from '@/components/portal/status-chip';
import { friendlyError } from '@/components/portal/api-error';

type View = 'list' | 'new' | 'thread';

const textarea =
  'w-full resize-none rounded-xl border bg-white/[0.03] px-3.5 py-2.5 text-sm text-ink-100 placeholder:text-ink-500 transition-[border-color,box-shadow,background-color] duration-300 hover:bg-white/[0.05] focus:bg-ink-900 focus:outline-none focus:ring-4';
const textareaOk = 'border-white/10 hover:border-white/20 focus:border-brand-400/70 focus:ring-brand-400/15';
const textareaErr = 'border-down/60 focus:border-down focus:ring-down/15';

export function HelpView() {
  const toast = useToast();
  const [tickets, setTickets] = useState<TicketDto[] | null>(null);
  const [view, setView] = useState<View>('list');
  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<TicketDetailDto | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);

  const loadList = useCallback(async () => {
    try {
      setTickets(await get<TicketDto[]>('/me/tickets'));
    } catch {
      setTickets((t) => t ?? []);
    }
  }, []);
  const loadDetail = useCallback(async (id: string) => {
    try {
      setDetail(await get<TicketDetailDto>(`/me/tickets/${id}`));
      setDetailError(null);
    } catch (e) {
      setDetailError(friendlyError(e).title);
    }
  }, []);

  useEffect(() => {
    void loadList();
  }, [loadList]);
  useEffect(() => {
    if (!selected) return;
    setDetail(null);
    void loadDetail(selected);
  }, [selected, loadDetail]);

  // staff replied / reopened / closed: refresh what is on screen (a staff reply is also toasted by LiveNotices)
  useUserEvent<{ id: string; status: TicketDto['status'] }>(WS_EVENTS.TICKET_UPDATED, (p) => {
    void loadList();
    if (p.id === selected) void loadDetail(p.id);
    if (p.status !== 'answered') toast({ title: p.status === 'closed' ? 'Ticket closed by support' : 'Ticket reopened', level: 'info' });
  });

  const open = (id: string) => {
    setSelected(id);
    setView('thread');
  };
  const onCreated = (t: TicketDetailDto) => {
    setTickets((xs) => [t, ...(xs ?? []).filter((x) => x.id !== t.id)]);
    setDetail(t);
    setSelected(t.id);
    setView('thread');
  };
  const onDetailChanged = (t: TicketDetailDto) => {
    setDetail(t);
    setTickets((xs) => (xs ?? []).map((x) => (x.id === t.id ? { ...x, status: t.status, updatedAt: t.updatedAt, messageCount: t.messageCount, lastMessage: t.lastMessage } : x)));
  };

  const openCount = tickets?.filter((t) => t.status !== 'closed').length ?? 0;

  return (
    <>
      <PageHeader
        title="Help"
        sub="Ask our support team anything about your account; replies land here and in your inbox."
        action={
          <Link href="/faq" className={buttonClass('outline', 'sm', 'group h-9 rounded-full px-4')}>
            <BookOpen className="h-3.5 w-3.5" /> Browse the FAQ <ArrowRight className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-0.5" />
          </Link>
        }
      />

      <div className="grid gap-5 lg:grid-cols-[340px_1fr] lg:items-start">
        {/* ticket list: on phones it is its own screen */}
        <aside className={cn('card min-w-0 p-4 sm:p-5', view !== 'list' && 'hidden lg:block')}>
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-ink-100">
              <span className="h-3.5 w-0.5 rounded-full bg-gradient-to-b from-brand-300 to-brand-600" />
              Your tickets
              {tickets && tickets.length > 0 && <span className="font-mono text-[11px] font-normal text-ink-500">{openCount} open</span>}
            </h2>
            <Button size="sm" variant={view === 'new' ? 'secondary' : 'primary'} className="group h-8 rounded-full" onClick={() => setView('new')}>
              <Plus className="h-3.5 w-3.5 transition-transform duration-500 group-hover:rotate-90" /> New ticket
            </Button>
          </div>
          {tickets === null ? (
            <div className="space-y-2">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-20 rounded-2xl" />
              ))}
            </div>
          ) : tickets.length === 0 ? (
            <Empty icon={<LifeBuoy className="h-6 w-6" />}>
              No tickets yet.
              <div className="mt-1 text-xs text-ink-500">Most questions are answered in under a business day.</div>
            </Empty>
          ) : (
            <ul className="space-y-2">
              {tickets.map((t, i) => (
                <TicketListItem key={t.id} t={t} index={i} active={view === 'thread' && t.id === selected} onClick={() => open(t.id)} />
              ))}
            </ul>
          )}
        </aside>

        <main className={cn('min-w-0', view === 'list' && 'hidden lg:block')}>
          {view === 'new' ? (
            <NewTicketForm onCreated={onCreated} onBack={() => setView('list')} />
          ) : view === 'thread' && selected ? (
            <TicketThread id={selected} detail={detail} error={detailError} onChanged={onDetailChanged} onBack={() => setView('list')} />
          ) : (
            <WelcomePanel onNew={() => setView('new')} />
          )}
        </main>
      </div>
    </>
  );
}

function TicketListItem({ t, index, active, onClick }: { t: TicketDto; index: number; active: boolean; onClick: () => void }) {
  const fresh = t.status === 'answered' && t.lastMessage?.isStaff;
  return (
    <li className="animate-page-in" style={{ animationDelay: `${index * 50}ms` }}>
      <button
        type="button"
        onClick={onClick}
        className={cn(
          'group relative w-full rounded-2xl border p-3.5 text-left transition-[border-color,background-color,box-shadow] duration-300',
          active ? 'border-brand-400/50 bg-brand-400/[0.06] shadow-[0_0_0_3px_rgb(var(--brand-rgb)/0.1)]' : 'border-white/[0.07] bg-white/[0.02] hover:border-brand-400/30 hover:bg-white/[0.04]',
        )}
      >
        <div className="flex items-start justify-between gap-2">
          <span className={cn('min-w-0 flex-1 truncate text-sm font-semibold', t.status === 'closed' ? 'text-ink-400' : 'text-white')}>{t.subject}</span>
          <TicketChip status={t.status} className="shrink-0" />
        </div>
        {t.lastMessage && (
          <p className={cn('mt-1.5 line-clamp-1 text-xs', fresh ? 'text-ink-200' : 'text-ink-500')}>
            <span className="text-ink-400">{t.lastMessage.isStaff ? 'Support: ' : 'You: '}</span>
            {t.lastMessage.body}
          </p>
        )}
        <div className="mt-2 flex items-center justify-between gap-2 text-[11px] text-ink-500">
          <span className="font-mono">{fmtDate(t.updatedAt)}</span>
          {fresh ? (
            <span className="inline-flex items-center gap-1.5 font-medium text-brand-300">
              <span className="live-dot !h-1.5 !w-1.5" /> New reply
            </span>
          ) : (
            <span className="font-mono">
              {t.messageCount} msg{t.messageCount === 1 ? '' : 's'}
            </span>
          )}
        </div>
      </button>
    </li>
  );
}

function WelcomePanel({ onNew }: { onNew: () => void }) {
  return (
    <section className="card corners overflow-hidden p-6 sm:p-8" style={{ '--corner': 'rgb(var(--brand-rgb) / 0.35)' } as React.CSSProperties}>
      <div className="flex flex-wrap items-center gap-6">
        <span className="relative flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-brand-400/10 text-brand-300 ring-1 ring-inset ring-brand-400/25">
          <span className="absolute inset-0 animate-pulse-ring rounded-2xl border border-brand-400/40" />
          <Headset className="h-7 w-7" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="label !text-brand-300">Support desk</div>
          <h2 className="mt-1 font-display text-2xl font-bold tracking-tight">How can we help?</h2>
          <p className="mt-2 max-w-lg text-sm text-ink-300">Pick a ticket on the left to continue a conversation, or open a new one. Account specialists answer during market hours; urgent trading issues are prioritised.</p>
        </div>
      </div>
      <div className="mt-7 grid gap-3 sm:grid-cols-2">
        <button type="button" onClick={onNew} className="group flex items-center gap-3.5 rounded-2xl border border-brand-400/30 bg-brand-400/[0.05] p-4 text-left transition-colors duration-300 hover:border-brand-400/60">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-400/15 text-brand-300 transition-transform duration-500 ease-spring group-hover:-rotate-6 group-hover:scale-110">
            <MessageSquarePlus className="h-5 w-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-white">Open a ticket</span>
            <span className="block text-xs text-ink-500">Deposits, verification, trading, anything else</span>
          </span>
          <ArrowRight className="h-4 w-4 shrink-0 text-ink-500 transition-transform duration-300 group-hover:translate-x-1 group-hover:text-white" />
        </button>
        <Link href="/faq" className="group flex items-center gap-3.5 rounded-2xl border border-white/[0.07] bg-white/[0.03] p-4 transition-colors duration-300 hover:border-brand-400/30 hover:bg-white/[0.06]">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/[0.04] text-ink-400 ring-1 ring-inset ring-white/10 transition-transform duration-500 ease-spring group-hover:-rotate-6 group-hover:scale-110 group-hover:text-brand-300">
            <BookOpen className="h-5 w-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-white">Read the FAQ</span>
            <span className="block text-xs text-ink-500">Instant answers on funding, leverage and fees</span>
          </span>
          <ArrowRight className="h-4 w-4 shrink-0 text-ink-500 transition-transform duration-300 group-hover:translate-x-1 group-hover:text-white" />
        </Link>
      </div>
    </section>
  );
}

function NewTicketForm({ onCreated, onBack }: { onCreated: (t: TicketDetailDto) => void; onBack: () => void }) {
  const toast = useToast();
  const f = useForm<CreateTicketInput>(createTicketSchema, { subject: '', message: '' });
  const message = String(f.values.message ?? '');
  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void f.submit(async (data) => {
      const t = await post<TicketDetailDto>('/me/tickets', data);
      toast({ title: 'Ticket opened', body: 'We will reply here and by email.', level: 'success' });
      onCreated(t);
    });
  };
  return (
    <section className="card animate-page-in p-5 sm:p-6">
      <div className="mb-5 flex items-center gap-3">
        <button type="button" onClick={onBack} aria-label="Back to tickets" className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 text-ink-400 transition-colors hover:border-brand-400/50 hover:text-brand-300 lg:hidden">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div>
          <h2 className="text-lg font-bold leading-tight">New ticket</h2>
          <p className="text-xs text-ink-400">Tell us what happened; include account numbers or request IDs where you can.</p>
        </div>
      </div>
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        {f.serverError && <Alert tone="danger">{f.serverError}</Alert>}
        <Input label="Subject" placeholder="e.g. Withdrawal #3F2A9C01 still pending" maxLength={120} {...f.bind('subject')} />
        <label className="group/field block" htmlFor="message">
          <span className="label mb-1.5 block transition-colors group-focus-within/field:text-brand-300">Message</span>
          <textarea id="message" rows={7} maxLength={4000} placeholder="Describe the issue. What did you expect, and what happened instead?" className={cn(textarea, f.errors.message ? textareaErr : textareaOk)} {...f.bind('message')} />
          <span className="mt-1.5 flex items-center justify-between gap-3 text-xs">
            {f.errors.message ? <span className="animate-pop-in text-down">{f.errors.message}</span> : <span className="text-ink-500">At least 5 characters.</span>}
            <span className="tabular font-mono text-[11px] text-ink-500">{message.length}/4000</span>
          </span>
        </label>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.06] pt-4">
          <p className="text-xs text-ink-500">Never share your password. We will not ask for it.</p>
          <Button type="submit" loading={f.submitting}>
            <Send className="h-4 w-4" /> Send ticket
          </Button>
        </div>
      </form>
    </section>
  );
}

function TicketThread({ id, detail, error, onChanged, onBack }: { id: string; detail: TicketDetailDto | null; error: string | null; onChanged: (t: TicketDetailDto) => void; onBack: () => void }) {
  const { me } = useAuth();
  const toast = useToast();
  const [body, setBody] = useState('');
  const [bodyErr, setBodyErr] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const [closing, setClosing] = useState(false);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    end.current?.scrollIntoView({ block: 'nearest' });
  }, [detail?.messages.length]);
  useEffect(() => {
    setBody('');
    setBodyErr(null);
    setConfirmClose(false);
  }, [id]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = ticketMessageSchema.safeParse({ body });
    if (!parsed.success) {
      setBodyErr('Write a message first.');
      return;
    }
    setBodyErr(null);
    setSending(true);
    try {
      const t = await post<TicketDetailDto>(`/me/tickets/${id}/messages`, parsed.data);
      onChanged(t);
      setBody('');
    } catch (err) {
      const f = friendlyError(err);
      setBodyErr(f.body ?? f.title);
    } finally {
      setSending(false);
    }
  };

  const close = async () => {
    setClosing(true);
    try {
      const t = await post<TicketDetailDto>(`/me/tickets/${id}/close`);
      onChanged(t);
      toast({ title: 'Ticket closed', body: 'Thanks for letting us know it is resolved.', level: 'success' });
    } catch (err) {
      const f = friendlyError(err);
      toast({ title: f.title, body: f.body, level: 'danger' });
    } finally {
      setClosing(false);
      setConfirmClose(false);
    }
  };

  if (error)
    return (
      <section className="card p-5">
        <Alert tone="danger">{error}</Alert>
      </section>
    );
  if (!detail)
    return (
      <section className="card p-5 sm:p-6">
        <Skeleton className="h-6 w-2/3 rounded-lg" />
        <Skeleton className="mt-6 h-16 w-3/4 rounded-2xl" />
        <Skeleton className="ml-auto mt-3 h-12 w-1/2 rounded-2xl" />
        <Skeleton className="mt-6 h-24 rounded-2xl" />
      </section>
    );

  const closed = detail.status === 'closed';
  const you = initials(me?.profile?.firstName, me?.profile?.lastName, 'Y');

  return (
    <section key={detail.id} className="card animate-page-in flex flex-col p-5 sm:p-6">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-white/[0.06] pb-4">
        <div className="flex min-w-0 items-start gap-3">
          <button type="button" onClick={onBack} aria-label="Back to tickets" className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/10 text-ink-400 transition-colors hover:border-brand-400/50 hover:text-brand-300 lg:hidden">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="min-w-0">
            <h2 className="break-words text-lg font-bold leading-tight">{detail.subject}</h2>
            <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] text-ink-500">
              <TicketChip status={detail.status} />
              <span className="font-mono">opened {fmtDate(detail.createdAt)}</span>
              <span className="font-mono">· {detail.messages.length} message{detail.messages.length === 1 ? '' : 's'}</span>
            </div>
          </div>
        </div>
        {!closed &&
          (confirmClose ? (
            <div className="animate-pop-in flex items-center gap-2">
              <span className="text-xs text-ink-300">Mark as resolved?</span>
              <Button size="sm" variant="ghost" onClick={() => setConfirmClose(false)} disabled={closing}>
                Not yet
              </Button>
              <Button size="sm" variant="secondary" onClick={() => void close()} loading={closing}>
                <CheckCheck className="h-3.5 w-3.5" /> Close ticket
              </Button>
            </div>
          ) : (
            <Button size="sm" variant="outline" className="rounded-full" onClick={() => setConfirmClose(true)}>
              <CheckCheck className="h-3.5 w-3.5" /> Resolved
            </Button>
          ))}
      </header>

      <ol className="max-h-[52vh] space-y-4 overflow-y-auto py-5 pr-1 [scrollbar-width:thin]">
        {detail.messages.map((msg, i) => (
          <li key={msg.id} className={cn('animate-page-in flex items-end gap-2.5', msg.isStaff ? 'justify-start' : 'flex-row-reverse')} style={{ animationDelay: `${Math.min(i, 8) * 45}ms` }}>
            <span
              className={cn(
                'flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-display text-[11px] font-bold',
                msg.isStaff ? 'bg-brand-400/15 text-brand-300 ring-1 ring-inset ring-brand-400/30' : 'bg-gradient-to-br from-brand-300 to-brand-600 text-ink-950',
              )}
              title={msg.isStaff ? 'Support' : 'You'}
            >
              {msg.isStaff ? <Headset className="h-3.5 w-3.5" /> : you || <UserRound className="h-3.5 w-3.5" />}
            </span>
            <div className={cn('max-w-[82%] sm:max-w-[72%]', msg.isStaff ? 'items-start' : 'items-end')}>
              <div className={cn('whitespace-pre-wrap break-words rounded-2xl px-4 py-2.5 text-sm leading-relaxed', msg.isStaff ? 'bubble-staff bg-white/[0.05] text-ink-100 ring-1 ring-inset ring-white/10' : 'bubble-me bg-brand-500 text-paper shadow-glow')}>{msg.body}</div>
              <div className={cn('mt-1 font-mono text-[10px] text-ink-500', msg.isStaff ? 'text-left' : 'text-right')}>
                {msg.isStaff ? 'Support' : 'You'} · {fmtDate(msg.createdAt)}
              </div>
            </div>
          </li>
        ))}
        <div ref={end} />
      </ol>

      {closed ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-4 py-3 text-sm text-ink-400">
          <span className="inline-flex items-center gap-2">
            <Lock className="h-4 w-4" /> This ticket is closed. Need more help? Open a new one.
          </span>
        </div>
      ) : (
        <form onSubmit={send} className="border-t border-white/[0.06] pt-4">
          <label htmlFor="reply" className="sr-only">
            Reply
          </label>
          <textarea
            id="reply"
            rows={3}
            maxLength={4000}
            value={body}
            onChange={(e) => {
              setBody(e.target.value);
              if (bodyErr) setBodyErr(null);
            }}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') void send(e);
            }}
            placeholder="Write a reply…"
            className={cn(textarea, bodyErr ? textareaErr : textareaOk)}
          />
          <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
            {bodyErr ? <span className="animate-pop-in text-xs text-down">{bodyErr}</span> : <span className="text-[11px] text-ink-500">Ctrl + Enter to send</span>}
            <Button type="submit" size="sm" loading={sending} disabled={!body.trim()}>
              <Send className="h-3.5 w-3.5" /> Send reply
            </Button>
          </div>
        </form>
      )}
    </section>
  );
}
