'use client';

import { LineChart } from 'lucide-react';
import type { LedgerEntryDto } from '@spova/shared';
import { cn, fmtDate, fmtMoney } from '@/lib/utils';
import { Empty } from '@/components/ui';

const W = 600;
const H = 180;
const PAD = 14;

/**
 * Balance after each recent ledger entry, drawn as a step line (a balance only moves when an entry posts).
 * `entries` arrive newest first, exactly as the ledger endpoint returns them.
 */
export function BalanceChart({ entries, currency }: { entries: LedgerEntryDto[]; currency: string }) {
  if (entries.length === 0) {
    return <Empty icon={<LineChart className="h-6 w-6" />}>Your balance history will draw itself here after the first transaction.</Empty>;
  }

  const rows = [...entries].reverse();
  const values = rows.map((e) => Number(e.balanceAfter));
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min;
  const n = rows.length;
  const x = (i: number) => (n === 1 ? W / 2 : PAD + (i * (W - PAD * 2)) / (n - 1));
  const y = (v: number) => (span === 0 ? H / 2 : PAD + (1 - (v - min) / span) * (H - PAD * 2));

  // step-after path: hold the level, then jump when the next entry posts
  let line = `M0 ${y(values[0])} H${x(0)}`;
  for (let i = 1; i < n; i++) line += ` H${x(i)} V${y(values[i])}`;
  line += ` H${W}`;
  const area = `${line} V${H} H0 Z`;
  const last = values[n - 1];
  const rising = n > 1 ? last >= values[0] : true;
  const tone = rising ? 'text-up' : 'text-down';

  return (
    <div data-in="true">
      <div className="relative h-44">
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className={cn('absolute inset-0 h-full w-full overflow-visible', tone)} fill="none" aria-hidden>
          <defs>
            <linearGradient id="bal-area" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="currentColor" stopOpacity="0.22" />
              <stop offset="1" stopColor="currentColor" stopOpacity="0" />
            </linearGradient>
          </defs>
          {[0.25, 0.5, 0.75].map((g) => (
            <line key={g} x1="0" x2={W} y1={H * g} y2={H * g} stroke="rgb(var(--tint) / 0.05)" strokeDasharray="3 6" vectorEffect="non-scaling-stroke" />
          ))}
          <path d={area} fill="url(#bal-area)" className="chart-area" />
          <path d={line} stroke="currentColor" strokeWidth="2" strokeLinejoin="round" pathLength={1} vectorEffect="non-scaling-stroke" className="draw" />
        </svg>

        {/* one marker per entry; HTML so the dots stay round and can carry a tooltip */}
        {rows.map((e, i) => {
          const neg = e.amount.startsWith('-');
          const isLast = i === n - 1;
          return (
            <div
              key={e.id}
              className="group/pt absolute z-10 -translate-x-1/2 -translate-y-1/2"
              style={{ left: `${(x(i) / W) * 100}%`, top: `${(y(values[i]) / H) * 100}%` }}
            >
              <span
                className={cn('animate-pop-in block h-2.5 w-2.5 rounded-full border-2 border-ink-900 transition-transform duration-300 group-hover/pt:scale-150', neg ? 'bg-down' : 'bg-up', isLast && 'h-3 w-3')}
                style={{ animationDelay: `${500 + i * 110}ms` }}
              />
              {isLast && <span className={cn('pointer-events-none absolute inset-0 animate-pulse-ring rounded-full', neg ? 'bg-down/50' : 'bg-up/50')} />}
              <div
                className={cn(
                  'glass pointer-events-none absolute bottom-full z-20 mb-2 w-max max-w-[220px] rounded-xl px-3 py-2 text-left opacity-0 shadow-lift transition-all duration-300 group-hover/pt:opacity-100',
                  i > n / 2 ? 'right-0' : 'left-0',
                )}
              >
                <div className={cn('tabular font-mono text-xs font-semibold', neg ? 'text-down' : 'text-up')}>
                  {neg ? '' : '+'}
                  {fmtMoney(e.amount)} <span className="font-normal uppercase text-ink-400">{e.type}</span>
                </div>
                <div className="tabular mt-0.5 font-mono text-[11px] text-ink-200">bal {fmtMoney(e.balanceAfter)}</div>
                <div className="mt-0.5 text-[10px] text-ink-500">{fmtDate(e.createdAt)}</div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-3 flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.14em] text-ink-500">
        <span>{fmtDate(rows[0].createdAt, false)}</span>
        <span className="tabular hidden normal-case tracking-normal text-ink-400 sm:inline">
          low {fmtMoney(min)} · high {fmtMoney(max)} {currency}
        </span>
        <span>{n === 1 ? 'latest' : fmtDate(rows[n - 1].createdAt, false)}</span>
      </div>
    </div>
  );
}
