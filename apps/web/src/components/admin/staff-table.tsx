'use client';

import { useEffect, useState } from 'react';
import { UserPlus } from 'lucide-react';
import { staffCreateSchema, type StaffDto } from '@spova/shared';
import { get, patch, post } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { fmtDate } from '@/lib/utils';
import { useToast } from '@/components/toast';
import { Badge, Button, Input, Select, Skeleton } from '@/components/ui';
import { ClientCell } from './queue-bits';
import { friendlyError } from '@/components/portal/api-error';

/** Back-office users. Superadmins add staff and change roles; admins see the list read-only. */
export function StaffTable() {
  const { me } = useAuth();
  const toast = useToast();
  const superadmin = me?.role === 'superadmin';
  const [rows, setRows] = useState<StaffDto[] | null>(null);
  const [f, setF] = useState({ email: '', firstName: '', lastName: '', role: 'admin', password: '' });
  const [err, setErr] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    get<StaffDto[]>('/admin/staff').then(setRows).catch(() => setRows([]));
  }, []);
  const change = async (id: string, p: { role?: 'admin' | 'superadmin'; status?: 'active' | 'frozen' }) => {
    try {
      const u = await patch<StaffDto>(`/admin/staff/${id}`, p);
      setRows((r) => (r ? r.map((x) => (x.id === id ? u : x)) : r));
      toast({ title: 'Staff member updated', level: 'success' });
    } catch (e) {
      const f2 = friendlyError(e);
      toast({ title: f2.title, body: f2.body, level: 'danger' });
    }
  };
  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = staffCreateSchema.safeParse(f);
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      for (const i of parsed.error.issues) errs[String(i.path[0])] ??= i.message;
      setErr(errs);
      return;
    }
    setErr({});
    setBusy(true);
    try {
      const u = await post<StaffDto>('/admin/staff', parsed.data);
      setRows((r) => [...(r ?? []), u]);
      setF({ email: '', firstName: '', lastName: '', role: 'admin', password: '' });
      toast({ title: 'Staff account created', body: `${u.email} can sign in at /login with the password you set.`, level: 'success' });
    } catch (e2) {
      const f2 = friendlyError(e2);
      toast({ title: f2.title, body: f2.body, level: 'danger' });
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_380px]">
      <section className="card p-5 sm:p-6">
        {!rows ? (
          <Skeleton className="h-40 rounded-xl" />
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left">
              <tr>
                <th className="label py-2 pr-4 font-medium">Member</th>
                <th className="label py-2 pr-4 font-medium">Role</th>
                <th className="label py-2 pr-4 font-medium">Status</th>
                <th className="label py-2 pr-4 font-medium">Last login</th>
                {superadmin && <th className="label w-[1%] py-2 font-medium">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((u) => (
                <tr key={u.id} className="border-t border-white/[0.05]">
                  <td className="py-2.5 pr-4">
                    <ClientCell user={u} link={false} />
                  </td>
                  <td className="py-2.5 pr-4">
                    <Badge tone={u.role === 'superadmin' ? 'brand' : 'info'}>{u.role}</Badge>
                  </td>
                  <td className="py-2.5 pr-4">
                    <Badge tone={u.status === 'active' ? 'success' : 'danger'}>{u.status}</Badge>
                  </td>
                  <td className="py-2.5 pr-4 text-xs text-ink-400">{u.lastLoginAt ? fmtDate(u.lastLoginAt) : 'never'}</td>
                  {superadmin && (
                    <td className="whitespace-nowrap py-2.5">
                      {u.id !== me?.id ? (
                        <span className="flex gap-1.5">
                          <Button size="sm" variant="ghost" onClick={() => void change(u.id, { role: u.role === 'admin' ? 'superadmin' : 'admin' })}>
                            {u.role === 'admin' ? 'Make superadmin' : 'Make admin'}
                          </Button>
                          <Button size="sm" variant={u.status === 'active' ? 'danger' : 'outline'} onClick={() => void change(u.id, { status: u.status === 'active' ? 'frozen' : 'active' })}>
                            {u.status === 'active' ? 'Freeze' : 'Reactivate'}
                          </Button>
                        </span>
                      ) : (
                        <span className="text-xs text-ink-500">you</span>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
      {superadmin && (
        <form onSubmit={create} noValidate className="card h-fit space-y-4 p-5 sm:p-6">
          <div className="flex items-center gap-2 font-display text-lg font-bold">
            <UserPlus className="h-5 w-5 text-brand-300" /> Add a staff member
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="First name" name="s-first" value={f.firstName} onChange={(e) => setF({ ...f, firstName: e.target.value })} error={err.firstName} />
            <Input label="Last name" name="s-last" value={f.lastName} onChange={(e) => setF({ ...f, lastName: e.target.value })} error={err.lastName} />
          </div>
          <Input label="Email" name="s-email" type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} error={err.email} />
          <Select label="Role" name="s-role" value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })}>
            <option value="admin">Admin (queues, clients, instruments)</option>
            <option value="superadmin">Superadmin (also staff and platform switches)</option>
          </Select>
          <Input label="Temporary password" name="s-pass" type="password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} error={err.password} hint="8 to 32 characters with upper, lower, digit and symbol. Ask them to change it after first login." />
          <Button type="submit" loading={busy} className="w-full">
            Create account
          </Button>
        </form>
      )}
    </div>
  );
}
