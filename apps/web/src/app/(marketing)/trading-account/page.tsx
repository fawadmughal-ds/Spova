import Link from 'next/link';
import type { Metadata } from 'next';
import { Check } from 'lucide-react';
import { publicGet, type PublicRisk } from '@/lib/server-api';
import { fmtMoney } from '@/lib/utils';

export const metadata: Metadata = { title: 'Trading accounts' };

const PERKS: Record<string, string[]> = {
  classic: ['All instruments', 'Web terminal', 'Email support', 'Daily market news'],
  silver: ['Everything in Classic', '10% spread discount', 'Priority support', 'Weekly webinars'],
  gold: ['Everything in Silver', '20% spread discount', 'Dedicated account manager', 'Trading signals'],
  platinum: ['Everything in Gold', '30% spread discount', 'VPS hosting', 'Premium analysis'],
  vip: ['Everything in Platinum', '40% spread discount', 'Personal analyst', 'Custom conditions'],
};

export default async function TiersPage() {
  const tiers = await publicGet<PublicRisk[]>('/market/risk-config', []);

  return (
    <>
      <section className="border-b border-white/5">
        <div className="mx-auto max-w-7xl px-4 py-20 text-center sm:px-6">
          <p className="text-xs font-semibold uppercase tracking-widest text-brand-400">Accounts</p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">Pick the account that fits</h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-ink-300">
            Five tiers, one platform. Conditions improve as your balance grows. Every tier includes negative balance protection and the same instruments.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-5">
          {(tiers.length ? tiers : FALLBACK).map((t) => {
            const hot = t.tier === 'gold';
            return (
              <div key={t.tier} id={t.tier} className={`card relative flex flex-col p-6 ${hot ? 'ring-1 ring-brand-500/60 shadow-glow' : ''}`}>
                {hot && <span className="absolute -top-3 left-6 rounded-full bg-brand-500 px-3 py-0.5 text-[11px] font-bold uppercase text-ink-950">Popular</span>}
                <h3 className="text-lg font-bold capitalize">{t.tier}</h3>
                <div className="mt-3 text-3xl font-bold tabular">${fmtMoney(t.minDeposit).replace('.00', '')}</div>
                <div className="text-xs uppercase tracking-wider text-ink-500">min deposit</div>
                <dl className="mt-5 space-y-2 border-t border-white/5 pt-5 text-sm">
                  <div className="flex justify-between"><dt className="text-ink-400">Max leverage</dt><dd className="tabular">1:{t.maxLeverage}</dd></div>
                  <div className="flex justify-between"><dt className="text-ink-400">Margin call</dt><dd className="tabular">{Number(t.marginCallPct)}%</dd></div>
                  <div className="flex justify-between"><dt className="text-ink-400">Stop out</dt><dd className="tabular">{Number(t.stopOutPct)}%</dd></div>
                  <div className="flex justify-between"><dt className="text-ink-400">Spread discount</dt><dd className="tabular">{Number(t.spreadDiscountPct)}%</dd></div>
                </dl>
                <ul className="mt-5 flex-1 space-y-2 text-sm">
                  {PERKS[t.tier]?.map((p) => (
                    <li key={p} className="flex items-start gap-2 text-ink-200">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-400" /> {p}
                    </li>
                  ))}
                </ul>
                <Link href="/register" className={`mt-6 rounded-xl py-2.5 text-center text-sm font-semibold ${hot ? 'bg-brand-500 text-ink-950 hover:bg-brand-400' : 'border border-white/15 hover:border-white/30'}`}>
                  Open account
                </Link>
              </div>
            );
          })}
        </div>
        <p className="mt-8 text-center text-xs text-ink-500">Tier is assigned by the broker based on net deposits. Demo accounts use Classic conditions.</p>
      </section>
    </>
  );
}

const FALLBACK: PublicRisk[] = ['classic', 'silver', 'gold', 'platinum', 'vip'].map((tier, i) => ({
  tier,
  marginCallPct: '100',
  stopOutPct: '20',
  defaultLeverage: 100,
  maxLeverage: 400,
  minDeposit: ['150', '5000', '25000', '50000', '100000'][i],
  spreadDiscountPct: String(i * 10),
}));
