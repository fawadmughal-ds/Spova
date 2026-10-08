import Link from 'next/link';
import type { CSSProperties } from 'react';
import { Check, Minus } from 'lucide-react';
import type { PublicRisk } from '@/lib/server-api';
import { cn } from '@/lib/utils';
import { buttonClass } from '@/lib/button';
import { tierHref } from '@/lib/site-nav';
import { TIER_TINT, tierName, tierRows } from '@/lib/tiers';
import { Reveal } from '@/components/motion';

/** Side-by-side table of every tier. The `highlight` column is lit in its own tier colour; headers link to the tier pages. */
export function TierCompare({ tiers, highlight = 'gold' }: { tiers: PublicRisk[]; highlight?: string }) {
  const rows = tierRows(tiers);
  const lit = (tier: string) => tier === highlight && 'bg-[rgb(var(--c)/0.08)]';

  return (
    <Reveal variant="none" className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[680px] text-sm">
          <thead>
            <tr className="border-b border-white/[0.07]">
              <th className="label sticky left-0 z-10 bg-ink-900 px-5 py-5 text-left font-medium max-sm:px-4">Feature</th>
              {tiers.map((t) => (
                <th key={t.tier} style={{ '--c': TIER_TINT[t.tier] ?? TIER_TINT.classic } as CSSProperties} className={cn('relative px-4 py-5 text-center', lit(t.tier))}>
                  {t.tier === highlight && <span className="grow-x absolute inset-x-0 top-0 h-0.5 bg-[rgb(var(--c))]" />}
                  <Link href={tierHref(t.tier)} className="inline-flex items-center gap-2 font-display text-base font-bold tracking-tight transition-colors hover:text-[rgb(var(--c))]">
                    <span className="h-2 w-2 rounded-full bg-[rgb(var(--c))] shadow-[0_0_10px_rgb(var(--c)/0.8)]" />
                    {tierName(t.tier)}
                  </Link>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(([label, cell], r) => (
              <tr key={label} className="row-in group border-t border-white/[0.05] transition-colors duration-300 first:border-t-0 hover:bg-white/[0.03]" style={{ '--i': r } as CSSProperties}>
                <td className="sticky left-0 z-10 bg-ink-900 px-5 py-3.5 text-ink-200 transition-colors duration-300 group-hover:text-white max-sm:px-4 max-sm:text-xs">
                  <span className="block max-sm:w-[104px]">{label}</span>
                </td>
                {tiers.map((t, i) => {
                  const v = cell(t, i);
                  return (
                    <td key={t.tier} style={{ '--c': TIER_TINT[t.tier] ?? TIER_TINT.classic } as CSSProperties} className={cn('px-4 py-3.5 text-center', lit(t.tier))}>
                      {v === true ? (
                        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[rgb(var(--c)/0.14)] text-[rgb(var(--c))] transition-transform duration-500 ease-spring group-hover:scale-125">
                          <Check className="h-3.5 w-3.5" />
                        </span>
                      ) : v === false || v === null ? (
                        <Minus className="mx-auto h-4 w-4 text-ink-600" />
                      ) : (
                        <span className={cn('tabular font-mono', t.tier === highlight ? 'font-semibold text-white' : 'text-ink-100')}>{v}</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-white/[0.07]">
              <td className="sticky left-0 z-10 bg-ink-900 px-5 py-4" />
              {tiers.map((t) => (
                <td key={t.tier} style={{ '--c': TIER_TINT[t.tier] ?? TIER_TINT.classic } as CSSProperties} className={cn('px-3 py-4 text-center', lit(t.tier))}>
                  <Link href="/register" className={buttonClass(t.tier === highlight ? 'primary' : 'secondary', 'sm', 'w-full max-w-[130px]')}>
                    Open
                  </Link>
                </td>
              ))}
            </tr>
          </tfoot>
        </table>
      </div>
    </Reveal>
  );
}
