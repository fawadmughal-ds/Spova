import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

// Mirrors passwordSchema in @spova/shared. Display only; the schema stays the judge.
const RULES: [label: string, test: (v: string) => boolean][] = [
  ['8-32 characters', (v) => v.length >= 8 && v.length <= 32],
  ['Lowercase', (v) => /[a-z]/.test(v)],
  ['Uppercase', (v) => /[A-Z]/.test(v)],
  ['Number', (v) => /[0-9]/.test(v)],
  ['Symbol', (v) => /[^A-Za-z0-9]/.test(v)],
];

/** Live checklist under a new-password field: one segment and one chip per rule. */
export function PasswordRules({ value }: { value: string }) {
  const passed = RULES.map(([, test]) => test(value));
  const score = passed.filter(Boolean).length;
  const tone = score === RULES.length ? 'bg-up shadow-[0_0_10px_rgb(var(--up-rgb)/0.6)]' : score >= 3 ? 'bg-gold' : 'bg-down';
  return (
    <div aria-hidden>
      <div className="grid grid-cols-5 gap-1.5">
        {RULES.map((_, i) => (
          <span key={i} className={cn('meter-seg h-1 rounded-full', i < score ? tone : 'bg-white/[0.08]')} />
        ))}
      </div>
      <ul className="mt-2.5 flex flex-wrap gap-1.5">
        {RULES.map(([label], i) => (
          <li
            key={label}
            className={cn(
              'inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-[10px] ring-1 ring-inset transition-colors duration-300',
              passed[i] ? 'bg-up/10 text-up ring-up/25' : 'bg-white/[0.03] text-ink-500 ring-white/[0.08]',
            )}
          >
            <Check className={cn('h-3 w-3 transition-all duration-300', passed[i] ? 'scale-100 opacity-100' : 'w-0 scale-0 opacity-0')} strokeWidth={3} />
            {label}
          </li>
        ))}
      </ul>
    </div>
  );
}
