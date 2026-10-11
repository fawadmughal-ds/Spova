import { cn } from '@/lib/utils';

/** Per-tier badge colour (classic / silver / gold / platinum / vip). Theme-independent inline colours. */
const TIER: Record<string, { bg: string; fg: string; ring: string; label: string }> = {
  classic: { bg: 'rgba(100,116,139,0.18)', fg: '#94a3b8', ring: 'rgba(100,116,139,0.45)', label: 'Classic' },
  silver: { bg: 'rgba(148,163,184,0.22)', fg: '#cbd5e1', ring: 'rgba(148,163,184,0.5)', label: 'Silver' },
  gold: { bg: 'rgba(202,162,58,0.20)', fg: '#e3b94f', ring: 'rgba(202,162,58,0.55)', label: 'Gold' },
  platinum: { bg: 'rgba(45,212,191,0.18)', fg: '#5eead4', ring: 'rgba(45,212,191,0.5)', label: 'Platinum' },
  vip: { bg: 'rgba(168,85,247,0.22)', fg: '#c084fc', ring: 'rgba(168,85,247,0.55)', label: 'VIP' },
};

/** The account's tier as a coloured chip; demo accounts also get a small green "Demo" marker. */
export function TierTag({ tier, demo, className }: { tier: string; demo?: boolean; className?: string }) {
  const t = TIER[tier] ?? TIER.classic;
  return (
    <span className={cn('inline-flex items-center gap-1', className)}>
      <span className="rounded px-1.5 py-px text-[10px] font-bold uppercase leading-4 tracking-wide" style={{ background: t.bg, color: t.fg, boxShadow: `inset 0 0 0 1px ${t.ring}` }}>
        {t.label}
      </span>
      {demo && <span className="rounded bg-[#15803d]/20 px-1 py-px text-[9px] font-bold uppercase leading-4 tracking-wide text-[#22c55e]">Demo</span>}
    </span>
  );
}
