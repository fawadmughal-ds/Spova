import { ArrowDownToLine, ArrowUpFromLine, CircleMinus, CirclePlus, Gift, Moon, Percent, Receipt, SlidersHorizontal, TrendingDown, TrendingUp, type LucideIcon } from 'lucide-react';
import type { LedgerType } from '@spova/shared';
import { cn } from '@/lib/utils';

const ICONS: Record<LedgerType, LucideIcon> = {
  deposit: ArrowDownToLine,
  withdraw: ArrowUpFromLine,
  credit: CirclePlus,
  debit: CircleMinus,
  bonus: Gift,
  pnl: TrendingUp,
  swap: Moon,
  fee: Receipt,
  commission: Percent,
  adjustment: SlidersHorizontal,
};

/** Square glyph for a ledger row: icon by entry type, colour by the sign of the amount. */
export function LedgerIcon({ type, negative, className }: { type: LedgerType; negative: boolean; className?: string }) {
  const Icon = type === 'pnl' && negative ? TrendingDown : (ICONS[type] ?? SlidersHorizontal);
  return (
    <span
      className={cn(
        'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ring-1 ring-inset transition-transform duration-500 ease-spring group-hover:-rotate-6 group-hover:scale-110',
        negative ? 'bg-down/10 text-down ring-down/25' : 'bg-up/10 text-up ring-up/25',
        className,
      )}
    >
      <Icon className="h-4 w-4" />
    </span>
  );
}
