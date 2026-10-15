'use client';

const ymd = (d: Date) => d.toISOString().slice(0, 10);

const PRESETS: { label: string; days?: number; months?: number }[] = [
  { label: '1D', days: 1 },
  { label: '3D', days: 3 },
  { label: '7D', days: 7 },
  { label: '15D', days: 15 },
  { label: '30D', days: 30 },
  { label: '3M', months: 3 },
  { label: '6M', months: 6 },
  { label: '12M', months: 12 },
];

/** Quick date-range presets: picks from = today − range, to = today. */
export function DatePresets({ onPick }: { onPick: (from: string, to: string) => void }) {
  const pick = (p: (typeof PRESETS)[number]) => {
    const to = new Date();
    const from = new Date();
    if (p.days) from.setDate(from.getDate() - p.days);
    if (p.months) from.setMonth(from.getMonth() - p.months);
    onPick(ymd(from), ymd(to));
  };
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {PRESETS.map((p) => (
        <button
          key={p.label}
          type="button"
          onClick={() => pick(p)}
          className="rounded-full border border-white/10 px-2.5 py-1 text-xs font-medium text-ink-300 transition-colors hover:border-brand-500/60 hover:bg-brand-500/[0.08] hover:text-white"
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}
