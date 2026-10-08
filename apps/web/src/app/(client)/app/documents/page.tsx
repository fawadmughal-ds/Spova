'use client';

import { useCallback, useEffect, useState } from 'react';
import { CreditCard, FileUser, FolderOpen, Home, LockKeyhole, ShieldCheck, Timer } from 'lucide-react';
import { WS_EVENTS, type KycDocumentDto, type KycStatusMap, type WsKycStatus } from '@spova/shared';
import { useAuth } from '@/lib/auth-context';
import { get } from '@/lib/api';
import { useUserEvent } from '@/lib/ws';
import { PageHeader } from '@/components/app-shell';
import { Skeleton } from '@/components/ui';
import { KycSteps } from '@/components/portal/kyc-steps';
import { KycGroupCard } from '@/components/portal/kyc-group-card';

const GROUPS = [
  { group: 'poi', title: 'Proof of identity', hint: 'Passport, national ID card or driving licence. All four corners visible, not expired.', icon: <FileUser className="h-5 w-5" /> },
  { group: 'por', title: 'Proof of residence', hint: 'Utility bill, bank statement or government letter issued in the last 3 months, showing your name and address.', icon: <Home className="h-5 w-5" /> },
  { group: 'payment', title: 'Payment method', hint: 'Needed before the first withdrawal to a new card or bank account. Hide the middle digits of any card.', icon: <CreditCard className="h-5 w-5" />, optional: true },
  { group: 'other', title: 'Other', hint: 'Anything our compliance team asked you for, such as a source-of-funds declaration.', icon: <FolderOpen className="h-5 w-5" />, optional: true },
] as const;

export default function DocumentsPage() {
  const { me, refresh } = useAuth();
  const [status, setStatus] = useState<KycStatusMap | null>(null);
  const [docs, setDocs] = useState<KycDocumentDto[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [s, d] = await Promise.all([get<KycStatusMap>('/me/kyc/status'), get<KycDocumentDto[]>('/me/kyc/documents')]);
      setStatus(s);
      setDocs(d);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // a reviewer decided: refresh the lists and the account flags (LiveNotices already toasts the decision)
  useUserEvent<WsKycStatus>(WS_EVENTS.KYC_STATUS, () => {
    void load();
    void refresh();
  });

  const onUploaded = (doc: KycDocumentDto) => {
    setDocs((d) => [doc, ...(d ?? [])]);
    // the newest document decides the group status unless one is already approved
    setStatus((s) => (s && s[doc.group as keyof KycStatusMap] !== 'approved' ? { ...s, [doc.group]: 'pending' } : s));
  };

  const groupStatus = (g: (typeof GROUPS)[number]['group']): KycStatusMap['poi'] => {
    if (g === 'other') {
      const mine = docs?.filter((d) => d.group === 'other') ?? [];
      return mine.some((d) => d.status === 'approved') ? 'approved' : (mine[0]?.status ?? 'incomplete');
    }
    return status?.[g] ?? 'incomplete';
  };

  const verified = !!(me?.kyc.poi && me?.kyc.por);

  return (
    <>
      <PageHeader
        title="Documents"
        sub="Verify your identity once to unlock live trading, deposits and withdrawals."
        action={
          <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-400">
            <LockKeyhole className="h-3 w-3" /> Private · encrypted · never shared
          </span>
        }
      />

      {status === null || docs === null ? (
        <div className="space-y-5">
          <Skeleton className="h-44 rounded-2xl" />
          <div className="grid gap-5 lg:grid-cols-2">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-72 rounded-2xl" />
            ))}
          </div>
          {error && <p className="text-sm text-down">{error}</p>}
        </div>
      ) : (
        <>
          {verified ? (
            <section data-in="true" className="card corners mb-6 flex flex-wrap items-center gap-4 p-5 sm:p-6" style={{ '--corner': 'rgb(var(--up-rgb) / 0.4)' } as React.CSSProperties}>
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-up/10 text-up ring-1 ring-inset ring-up/25">
                <ShieldCheck className="h-6 w-6" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="label !text-up">Verified</div>
                <p className="mt-1 text-sm text-ink-200">Identity and address are confirmed. Live trading, deposits and withdrawals are open to you.</p>
              </div>
              <span className="inline-flex items-center gap-2 text-xs text-ink-400">
                <Timer className="h-3.5 w-3.5" /> Payment proof is only requested before a first withdrawal to a new destination.
              </span>
            </section>
          ) : (
            <KycSteps poi={!!me?.kyc.poi} por={!!me?.kyc.por} status={status} cta={false} />
          )}

          <div className="grid gap-5 lg:grid-cols-2">
            {GROUPS.map((g, i) => (
              <KycGroupCard
                key={g.group}
                group={g.group}
                title={g.title}
                hint={g.hint}
                icon={g.icon}
                optional={'optional' in g ? g.optional : undefined}
                status={groupStatus(g.group)}
                docs={docs.filter((d) => d.group === g.group)}
                onUploaded={onUploaded}
                className="animate-page-in"
                style={{ animationDelay: `${120 + i * 90}ms` }}
              />
            ))}
          </div>

          <p className="mt-6 text-center text-xs text-ink-500">
            Files are stored privately and only visible to you and our compliance team. Reviews normally complete within one business day; you will see the result here and by email.
          </p>
        </>
      )}
    </>
  );
}
