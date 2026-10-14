'use client';

import { useState } from 'react';
import { Pencil, Save, Send, Trash2, X } from 'lucide-react';
import type { ClientNoteDto } from '@spova/shared';
import { del, patch, post } from '@/lib/api';
import { cn, fmtDate } from '@/lib/utils';
import { Button, Card } from '@/components/ui';
import { useToast } from '@/components/toast';
import { friendlyError } from '@/components/portal/api-error';

/**
 * The client's file: a single free-text "about this client" note (saved to User.adminNotes) and a
 * timestamped comment log agents add during calls. Everything is persisted in the DB and survives reload.
 */
export function ClientNotesPanel({ userId, initialNotes, initialComments }: { userId: string; initialNotes: string | null; initialComments: ClientNoteDto[] }) {
  const toast = useToast();
  const [notes, setNotes] = useState(initialNotes ?? '');
  const [savedNotes, setSavedNotes] = useState(initialNotes ?? '');
  const [savingNotes, setSavingNotes] = useState(false);

  const [comments, setComments] = useState<ClientNoteDto[]>(initialComments);
  const [draft, setDraft] = useState('');
  const [adding, setAdding] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editBody, setEditBody] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const saveNotes = async () => {
    setSavingNotes(true);
    try {
      await patch(`/admin/users/${userId}`, { notes: notes.trim() || null });
      setSavedNotes(notes);
      toast({ title: 'Notes saved', level: 'success' });
    } catch (e) {
      const fe = friendlyError(e);
      toast({ title: fe.title, body: fe.body, level: 'danger' });
    } finally {
      setSavingNotes(false);
    }
  };

  const addComment = async () => {
    if (!draft.trim()) return;
    setAdding(true);
    try {
      const c = await post<ClientNoteDto>(`/admin/users/${userId}/notes`, { body: draft.trim() });
      setComments((cs) => [c, ...cs]);
      setDraft('');
    } catch (e) {
      const fe = friendlyError(e);
      toast({ title: fe.title, body: fe.body, level: 'danger' });
    } finally {
      setAdding(false);
    }
  };

  const saveEdit = async (id: string) => {
    if (!editBody.trim()) return;
    setBusyId(id);
    try {
      const c = await patch<ClientNoteDto>(`/admin/notes/${id}`, { body: editBody.trim() });
      setComments((cs) => cs.map((x) => (x.id === id ? c : x)));
      setEditId(null);
    } catch (e) {
      const fe = friendlyError(e);
      toast({ title: fe.title, body: fe.body, level: 'danger' });
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (id: string) => {
    setBusyId(id);
    try {
      await del(`/admin/notes/${id}`);
      setComments((cs) => cs.filter((x) => x.id !== id));
    } catch (e) {
      const fe = friendlyError(e);
      toast({ title: fe.title, body: fe.body, level: 'danger' });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Card title="Notes & call log" className="xl:col-span-3">
      <div className="grid gap-6 lg:grid-cols-2">
        {/* single "about this client" note */}
        <div>
          <label className="text-[11px] uppercase tracking-wider text-ink-500">About this client</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={5}
            placeholder="e.g. Works as a doctor, prefers evening calls, interested in gold…"
            className="mt-2 w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-sm text-white outline-none transition-colors focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
          />
          <div className="mt-2 flex justify-end">
            <Button size="sm" onClick={() => void saveNotes()} loading={savingNotes} disabled={notes === savedNotes}>
              <Save className="h-3.5 w-3.5" /> Save notes
            </Button>
          </div>
        </div>

        {/* timestamped comment log */}
        <div>
          <label className="text-[11px] uppercase tracking-wider text-ink-500">Call log — add a comment</label>
          <div className="mt-2 flex items-start gap-2">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={2}
              placeholder="e.g. Client said call 5 minutes later"
              className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white outline-none transition-colors focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') void addComment();
              }}
            />
            <Button size="sm" onClick={() => void addComment()} loading={adding} disabled={!draft.trim()} className="mt-0.5 shrink-0">
              <Send className="h-3.5 w-3.5" /> Add
            </Button>
          </div>

          <ul className="mt-4 max-h-80 space-y-2 overflow-y-auto pr-1">
            {comments.length === 0 ? (
              <li className="py-6 text-center text-sm text-ink-500">No comments yet.</li>
            ) : (
              comments.map((c) => (
                <li key={c.id} className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
                  {editId === c.id ? (
                    <div className="flex items-start gap-2">
                      <textarea value={editBody} onChange={(e) => setEditBody(e.target.value)} rows={2} className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1.5 text-sm text-white outline-none focus:border-brand-500" />
                      <div className="flex shrink-0 flex-col gap-1">
                        <Button size="sm" onClick={() => void saveEdit(c.id)} loading={busyId === c.id} className="h-7 px-2">
                          <Save className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditId(null)} className="h-7 px-2">
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="whitespace-pre-wrap text-sm text-ink-100">{c.body}</div>
                      <div className="mt-1 flex items-center justify-between">
                        <span className="text-[11px] text-ink-500">
                          {c.authorName} · {fmtDate(c.createdAt)}
                          {c.updatedAt !== c.createdAt ? ' · edited' : ''}
                        </span>
                        <span className="flex gap-1">
                          <button type="button" onClick={() => (setEditId(c.id), setEditBody(c.body))} className="rounded p-1 text-ink-400 transition-colors hover:bg-white/[0.06] hover:text-white" aria-label="Edit comment">
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button type="button" onClick={() => void remove(c.id)} disabled={busyId === c.id} className={cn('rounded p-1 text-ink-400 transition-colors hover:bg-down/10 hover:text-down', busyId === c.id && 'opacity-50')} aria-label="Delete comment">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </span>
                      </div>
                    </>
                  )}
                </li>
              ))
            )}
          </ul>
        </div>
      </div>
    </Card>
  );
}
