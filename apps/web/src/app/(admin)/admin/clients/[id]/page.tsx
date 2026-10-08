'use client';

import { use, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Lock, Unlock } from 'lucide-react';
import type { AccountDto, AdminUserDetailDto } from '@spova/shared';
import { get, patch, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { cn, fmtDate, fmtMoney } from '@/lib/utils';
import { PageHeader } from '@/components/app-shell';
import { LedgerTable } from '@/components/ledger-table';
import { useToast } from '@/components/toast';
import { Badge, Button, Card, Spinner } from '@/components/ui';
import { WalletPanel } from '@/components/admin/wallet-panel';
import { AccountSettingsPanel } from '@/components/admin/account-settings-panel';
import { KycQueue } from '@/components/admin/kyc-queue';
import { PaymentsQueue } from '@/components/admin/payments-queue';
import { TicketInbox } from '@/components/admin/ticket-inbox';
import { SlidingTabs } from '@/components/portal/sliding-tabs';

type Section = 'kyc' | 'payments' | 'tickets';
const SECTIONS: { value: Section; label: string }[] = [
  { value: 'kyc', label: 'KYC documents' },
  { value: 'payments', label: 'Payment requests' },
  { value: 'tickets', label: 'Tickets' },
];

const statusTone = { active: 'success', frozen: 'danger', closed: 'neutral' } as const;

export default function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { me } = useAuth();
  const toast = useToast();
  const [u, setU] = useState<AdminUserDetailDto | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [ledgerVersion, setLedgerVersion] = useState(0);
  const [busy, setBusy] = useState(false);
  const [section, setSection] = useState<Section>('kyc');

  const load = useCallback(async () => {
    const d = await get<AdminUserDetailDto>(`/admin/users/${id}`);
    setU(d);
    setSelected((s) => s ?? d.accounts[0]?.id ?? null);
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const onAccountChanged = (a: AccountDto) => {
    setU((prev) => (prev ? { ...prev, accounts: prev.accounts.map((x) => (x.id === a.id ? a : x)) } : prev));
    setLedgerVersion((v) => v + 1);
  };

  const setStatus = async (status: 'active' | 'frozen') => {
    if (!confirm(status === 'frozen' ? 'Freeze this client? They will be logged out and cannot sign in or trade.' : 'Unfreeze this client?')) return;
    setBusy(true);
    try {
      await patch(`/admin/users/${id}`, { status });
      toast({ title: status === 'frozen' ? 'Client frozen' : 'Client reactivated', level: status === 'frozen' ? 'warning' : 'success' });
      await load();
    } catch (e) {
      toast({ title: 'Failed', body: e instanceof ApiError ? e.message : undefined, level: 'danger' });
    } finally {
      setBusy(false);
    }
  };

  if (!u)
    return (
      <div className="flex justify-center py-20">
        <Spinner />
      </div>
    );

  const account = u.accounts.find((a) => a.id === selected) ?? u.accounts[0];

  return (
    <>
      <PageHeader
        title={u.firstName || u.lastName ? `${u.firstName ?? ''} ${u.lastName ?? ''}` : u.email}
        sub={
          <span className="flex flex-wrap items-center gap-2">
            <span>{u.email}</span>
            <Badge tone={statusTone[u.status]}>{u.status}</Badge>
            <Badge tone={u.kyc.poi ? 'success' : 'neutral'}>POI</Badge>
            <Badge tone={u.kyc.por ? 'success' : 'neutral'}>POR</Badge>
          </span>
        }
        action={
          <div className="flex items-center gap-2">
            <Link href="/admin/clients" className="text-sm text-brand-300">
              ← Clients
            </Link>
            {u.status === 'frozen' ? (
              <Button size="sm" variant="secondary" loading={busy} onClick={() => void setStatus('active')}>
                <Unlock className="h-4 w-4" /> Unfreeze
              </Button>
            ) : (
              <Button size="sm" variant="danger" loading={busy} onClick={() => void setStatus('frozen')}>
                <Lock className="h-4 w-4" /> Freeze client
              </Button>
            )}
          </div>
        }
      />

      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 xl:grid-cols-3">
        {/* profile */}
        <Card title="Profile">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
            {[
              ['Phone', u.profile?.phone],
              ['Country', u.profile?.countryCode],
              ['Date of birth', u.profile?.dob],
              ['City', u.profile?.city],
              ['Address', u.profile?.address],
              ['ZIP', u.profile?.zip],
              ['Registered', fmtDate(u.createdAt)],
              ['Last login', `${fmtDate(u.lastLoginAt)}${u.lastLoginIp ? ` · ${u.lastLoginIp}` : ''}`],
            ].map(([k, v]) => (
              <div key={k as string}>
                <dt className="text-[11px] uppercase tracking-wider text-ink-500">{k}</dt>
                <dd className="text-ink-200">{v || '—'}</dd>
              </div>
            ))}
          </dl>
        </Card>

        {/* accounts */}
        <Card title="Trading accounts" className="xl:col-span-2">
          {u.accounts.length === 0 ? (
            <p className="text-sm text-ink-400">No accounts.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-[11px] uppercase tracking-wider text-ink-500">
                  <tr>
                    <th className="py-2 pr-4 font-medium">Login</th>
                    <th className="py-2 pr-4 font-medium">Type</th>
                    <th className="py-2 pr-4 font-medium">Tier</th>
                    <th className="py-2 pr-4 text-right font-medium">Leverage</th>
                    <th className="py-2 pr-4 text-right font-medium">Balance</th>
                    <th className="py-2 pr-4 text-right font-medium">Credit</th>
                    <th className="py-2 pr-4 text-right font-medium">Equity</th>
                    <th className="py-2 font-medium">Flags</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {u.accounts.map((a) => (
                    <tr key={a.id} onClick={() => setSelected(a.id)} className={cn('cursor-pointer', a.id === account?.id ? 'bg-brand-500/10' : 'hover:bg-white/[0.03]')}>
                      <td className="tabular py-2.5 pr-4 font-semibold">{a.loginCode}</td>
                      <td className="py-2.5 pr-4">
                        <Badge tone={a.type === 'live' ? 'success' : 'info'}>{a.type}</Badge>
                      </td>
                      <td className="py-2.5 pr-4 capitalize">{a.tier}</td>
                      <td className="tabular py-2.5 pr-4 text-right">1:{a.leverage}</td>
                      <td className="tabular py-2.5 pr-4 text-right">{fmtMoney(a.balance)}</td>
                      <td className="tabular py-2.5 pr-4 text-right">{fmtMoney(a.credit)}</td>
                      <td className="tabular py-2.5 pr-4 text-right font-semibold">{fmtMoney(a.equity)}</td>
                      <td className="py-2.5">
                        <div className="flex gap-1">
                          {a.status !== 'enabled' && <Badge tone="warning">{a.status}</Badge>}
                          {a.tradingBlocked && <Badge tone="danger">no trading</Badge>}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      {account && (
        <div className="mt-6 grid grid-cols-[minmax(0,1fr)] gap-6 xl:grid-cols-3">
          <WalletPanel account={account} superadmin={me?.role === 'superadmin'} onChanged={onAccountChanged} />
          <AccountSettingsPanel account={account} onChanged={onAccountChanged} />
          <Card title={`Ledger · ${account.loginCode}`} className="xl:col-span-3">
            <LedgerTable basePath={`/admin/accounts/${account.id}`} version={ledgerVersion} />
          </Card>
        </div>
      )}

      {/* compliance + support for this client; same components as the queues, narrowed to one user */}
      <section className="mt-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-ink-100">
            <span className="h-3.5 w-0.5 rounded-full bg-gradient-to-b from-brand-300 to-brand-600" />
            Compliance and support
          </h2>
          <SlidingTabs items={SECTIONS} value={section} onChange={setSection} />
        </div>
        <div key={section} className="animate-page-in">
          {section === 'kyc' && <KycQueue userId={id} compact />}
          {section === 'payments' && <PaymentsQueue userId={id} compact onChanged={() => void load().then(() => setLedgerVersion((v) => v + 1))} />}
          {section === 'tickets' && <TicketInbox userId={id} compact />}
        </div>
      </section>
    </>
  );
}
