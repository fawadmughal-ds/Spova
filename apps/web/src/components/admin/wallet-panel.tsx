'use client';

import { useState } from 'react';
import type { AccountDto } from '@spova/shared';
import { adminCreditSchema, adminDebitSchema } from '@spova/shared';
import { z } from 'zod';
import { post } from '@/lib/api';
import { useForm } from '@/lib/use-form';
import { cn, fmtMoney } from '@/lib/utils';
import { useToast } from '@/components/toast';
import { Alert, Button, Card, Input, Select } from '@/components/ui';

type Mode = 'credit' | 'debit';

/** Admin credit / debit. Every action is a ledger entry + audit row on the server. */
export function WalletPanel({ account, superadmin, onChanged }: { account: AccountDto; superadmin?: boolean; onChanged: (a: AccountDto) => void }) {
  const [mode, setMode] = useState<Mode>('credit');
  const toast = useToast();
  const schema = mode === 'credit' ? adminCreditSchema : adminDebitSchema;
  const f = useForm<z.infer<typeof adminCreditSchema> | z.infer<typeof adminDebitSchema>>(schema as never, { type: mode === 'credit' ? 'deposit' : 'debit' });

  const amount = Number(f.values.amount ?? 0) || 0;
  const bucket = f.values.type === 'bonus' || f.values.type === 'credit' ? 'credit' : 'balance';
  const preview =
    mode === 'credit'
      ? bucket === 'credit'
        ? { balance: Number(account.balance), credit: Number(account.credit) + amount }
        : { balance: Number(account.balance) + amount, credit: Number(account.credit) }
      : { balance: Number(account.balance) - amount, credit: Number(account.credit) };

  const switchMode = (m: Mode) => {
    setMode(m);
    f.set('type', m === 'credit' ? 'deposit' : 'debit');
    f.setServerError(null);
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void f.submit(async (data) => {
      const r = await post<{ entryId: string; account: AccountDto }>(`/admin/accounts/${account.id}/${mode}`, data);
      onChanged(r.account);
      toast({ title: `${mode === 'credit' ? 'Credited' : 'Debited'} ${fmtMoney(data.amount)} ${account.currency}`, body: `Account ${account.loginCode} · new balance ${fmtMoney(r.account.balance)}`, level: 'success' });
      f.set('amount', '');
      f.set('reason', '');
    });
  };

  return (
    <Card title={`Wallet · ${account.loginCode}`}>
      <div className="mb-4 grid grid-cols-2 rounded-xl bg-ink-900 p-1 text-sm">
        {(['credit', 'debit'] as Mode[]).map((m) => (
          <button key={m} type="button" onClick={() => switchMode(m)} className={cn('rounded-lg py-2 capitalize transition', mode === m ? (m === 'credit' ? 'bg-up/20 text-up font-semibold' : 'bg-down/20 text-down font-semibold') : 'text-ink-400 hover:text-white')}>
            {m}
          </button>
        ))}
      </div>
      <form onSubmit={onSubmit} className="space-y-3" noValidate>
        {f.serverError && <Alert tone="danger">{f.serverError}</Alert>}
        <Select label="Type" {...f.bind('type')}>
          {mode === 'credit' ? (
            <>
              <option value="deposit">Deposit (cash, withdrawable)</option>
              <option value="credit">Credit (not withdrawable)</option>
              <option value="bonus">Bonus (not withdrawable)</option>
            </>
          ) : (
            <>
              <option value="debit">Debit</option>
              <option value="withdraw">Withdrawal</option>
              <option value="fee">Fee</option>
            </>
          )}
        </Select>
        <Input label={`Amount (${account.currency})`} inputMode="decimal" placeholder="0.00" {...f.bind('amount')} />
        <Input label="Reason (visible to client)" placeholder="e.g. Bank transfer ref 12345" {...f.bind('reason')} />
        {mode === 'debit' && superadmin && (
          <label className="flex items-center gap-2 text-xs text-ink-400">
            <input type="checkbox" className="accent-brand-500" {...f.bindCheckbox('force')} /> Force (allow negative balance - superadmin)
          </label>
        )}
        <div className="rounded-xl bg-ink-900/70 p-3 text-xs">
          <div className="flex justify-between text-ink-400">
            <span>Balance after</span>
            <span className={cn('tabular font-semibold', preview.balance < 0 ? 'text-down' : 'text-ink-100')}>{fmtMoney(preview.balance)}</span>
          </div>
          <div className="mt-1 flex justify-between text-ink-400">
            <span>Credit after</span>
            <span className="tabular font-semibold text-ink-100">{fmtMoney(preview.credit)}</span>
          </div>
        </div>
        <Button type="submit" className="w-full" variant={mode === 'credit' ? 'primary' : 'danger'} loading={f.submitting}>
          {mode === 'credit' ? 'Credit account' : 'Debit account'}
        </Button>
      </form>
    </Card>
  );
}
