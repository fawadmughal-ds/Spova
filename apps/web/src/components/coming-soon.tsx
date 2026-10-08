import type { CSSProperties, ReactNode } from 'react';
import { ArrowDownToLine, ArrowUpFromLine, Bitcoin, Check, Construction, CreditCard, FileText, Headset, Home, Landmark, Paperclip, SendHorizontal, Upload, User, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PageHeader } from '@/components/app-shell';
import { Reveal, Words } from '@/components/motion';
import { Badge } from '@/components/ui';

/** Roadmap page for a section that is not built yet: what ships, when, and a clearly-labelled mock of how it will look. */
export function ComingSoon({
  title,
  milestone,
  items,
  icon: Icon = Construction,
  blurb,
  preview,
}: {
  title: string;
  milestone: string;
  items: string[];
  icon?: LucideIcon;
  blurb?: string;
  /** non-interactive mock of the future screen */
  preview?: ReactNode;
}) {
  return (
    <>
      <PageHeader title={title} sub="On the roadmap. Nothing here is live yet." />
      <div className={cn('grid gap-6', preview && 'xl:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]')}>
        <Reveal variant="none" className="card corners overflow-hidden p-7 sm:p-8">
          <div className="aurora-blob -left-24 -top-32 h-64 w-80 bg-gold/10" />
          <Reveal variant="stagger" step={90} className="relative">
            <div className="relative flex h-14 w-14 items-center justify-center">
              <span className="absolute inset-0 animate-pulse-ring rounded-2xl border border-gold/40" />
              <span className="relative flex h-14 w-14 items-center justify-center rounded-2xl border border-gold/30 bg-gold/10 text-gold">
                <Icon className="h-6 w-6" />
              </span>
            </div>
            <span className="eyebrow mt-7 !text-gold">In development</span>
            <h2 className="mt-4 font-display font-extrabold tracking-tighter">
              <span className="block text-xl text-ink-300">Scheduled for</span>
              <Words text={`*${milestone}*`} delay={200} className="mt-1 block text-4xl leading-[1.05] sm:text-[2.75rem]" />
            </h2>
            {blurb && <p className="mt-3 max-w-md text-sm leading-relaxed text-ink-400">{blurb}</p>}
          </Reveal>

          <div className="relative mt-8">
            <span className="absolute bottom-3 left-[13px] top-3 w-px bg-white/[0.08]">
              <span className="grow-y block h-full origin-top bg-gradient-to-b from-gold via-brand-400 to-transparent [animation-duration:1.8s]" style={{ '--d': '500ms' } as CSSProperties} />
            </span>
            <Reveal as="ol" variant="stagger" delay={450} step={130} className="relative space-y-4">
              {items.map((item, i) => (
                <li key={item} className="group flex items-start gap-4">
                  <span className="flex h-[27px] w-[27px] shrink-0 items-center justify-center rounded-full border border-white/15 bg-ink-900 font-mono text-[10px] text-ink-300 transition-all duration-500 ease-spring group-hover:scale-110 group-hover:border-brand-400/60 group-hover:text-brand-300">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <span className="pt-0.5 text-sm leading-relaxed text-ink-200">{item}</span>
                </li>
              ))}
            </Reveal>
          </div>
        </Reveal>

        {preview && (
          <Reveal variant="right" delay={200} className="card overflow-hidden">
            <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-3">
              <span className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-300">
                <span className="live-dot text-gold" /> Preview
              </span>
              <span className="label">Design mock · not functional</span>
            </div>
            <div className="relative">
              <div className="bg-dots absolute inset-0 opacity-70" />
              <div className="preview-mock relative p-5 sm:p-6" aria-hidden>
                {preview}
              </div>
            </div>
          </Reveal>
        )}
      </div>
    </>
  );
}

// ---------------------------------------------------------------- previews
function MockChip({ children, on }: { children: ReactNode; on?: boolean }) {
  return (
    <span className={cn('rounded-md px-2 py-1 font-mono text-[10px]', on ? 'bg-brand-400/15 text-brand-200 ring-1 ring-inset ring-brand-400/40' : 'bg-white/[0.05] text-ink-300')}>{children}</span>
  );
}

/** KYC: stepper plus the two upload slots, with a scanner bar passing over the ID. */
export function DocumentsPreview() {
  const steps = ['Identity', 'Address', 'Review', 'Verified'];
  return (
    <div className="space-y-6">
      <div className="relative">
        <div className="absolute left-[12.5%] right-[12.5%] top-3.5 h-px bg-white/10">
          <div className="grow-x h-full w-1/3 bg-gradient-to-r from-brand-500 to-brand-300" style={{ '--d': '600ms' } as CSSProperties} />
        </div>
        <ol className="relative grid grid-cols-4">
          {steps.map((s, i) => (
            <li key={s} className="flex flex-col items-center gap-2">
              <span
                className={cn(
                  'relative flex h-7 w-7 items-center justify-center rounded-full border font-mono text-[10px]',
                  i === 0 ? 'border-brand-400 bg-brand-400 text-ink-950' : i === 1 ? 'border-brand-400/60 bg-ink-900 text-brand-300' : 'border-white/15 bg-ink-900 text-ink-500',
                )}
              >
                {i === 1 && <span className="absolute inset-0 animate-pulse-ring rounded-full border border-brand-400/60" />}
                {i === 0 ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : i + 1}
              </span>
              <span className={cn('label', i < 2 && '!text-ink-200')}>{s}</span>
            </li>
          ))}
        </ol>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {/* proof of identity */}
        <div className="rounded-2xl border border-dashed border-white/15 p-4">
          <div className="flex items-center justify-between">
            <span className="label">Proof of identity</span>
            <Badge tone="warning">Pending</Badge>
          </div>
          <div className="relative mx-auto mt-4 h-28 w-44 overflow-hidden rounded-xl border border-white/10 bg-gradient-to-br from-ink-700 to-ink-800 p-3">
            <div className="flex gap-3">
              <span className="flex h-12 w-10 items-center justify-center rounded-md bg-white/10 text-ink-300">
                <User className="h-5 w-5" />
              </span>
              <div className="flex-1 space-y-1.5 pt-1">
                <span className="block h-1.5 w-full rounded-full bg-white/20" />
                <span className="block h-1.5 w-2/3 rounded-full bg-white/10" />
                <span className="block h-1.5 w-4/5 rounded-full bg-white/10" />
              </div>
            </div>
            <span className="mt-4 block h-1.5 w-full rounded-full bg-white/[0.07]" />
            <span className="mt-1.5 block h-1.5 w-3/4 rounded-full bg-white/[0.07]" />
            <span className="absolute inset-x-0 top-1 h-6 bg-gradient-to-b from-brand-400/0 via-brand-400/25 to-brand-400/0 [animation:scan_3.2s_ease-in-out_infinite]" style={{ '--scan': '84px' } as CSSProperties}>
              <span className="absolute inset-x-0 top-1/2 h-px bg-brand-300 shadow-[0_0_12px_2px_rgb(var(--brand-rgb)/0.7)]" />
            </span>
          </div>
          <div className="mt-4 flex flex-wrap justify-center gap-1.5">
            <MockChip on>Passport</MockChip>
            <MockChip>ID card</MockChip>
            <MockChip>Driving licence</MockChip>
          </div>
        </div>

        {/* proof of residence */}
        <div className="rounded-2xl border border-dashed border-white/15 p-4">
          <div className="flex items-center justify-between">
            <span className="label">Proof of residence</span>
            <Badge>Not uploaded</Badge>
          </div>
          <div className="relative mx-auto mt-4 flex h-28 w-44 flex-col items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.02]">
            <span className="animate-float flex h-10 w-10 items-center justify-center rounded-full bg-white/[0.06] text-ink-300">
              <Upload className="h-4 w-4" />
            </span>
            <span className="text-[11px] text-ink-500">Drop a file or browse</span>
            <Home className="absolute bottom-2 right-2 h-4 w-4 text-ink-600" />
          </div>
          <div className="mt-4 flex flex-wrap justify-center gap-1.5">
            <MockChip>Utility bill</MockChip>
            <MockChip>Bank statement</MockChip>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
        <FileText className="h-4 w-4 shrink-0 text-ink-400" />
        <span className="flex-1 text-xs text-ink-400">Each document is reviewed by the back office: approved, or rejected with a reason.</span>
        <Badge tone="success">Approved</Badge>
        <Badge tone="danger">Rejected</Badge>
      </div>
    </div>
  );
}

/** Payments: deposit ticket with presets that light up in turn, method list and a history strip. */
export function PaymentsPreview() {
  const presets = ['$200', '$500', '$1,000', '$5,000'];
  const methods: [LucideIcon, string, string][] = [
    [Landmark, 'Bank transfer', ''],
    [Bitcoin, 'Crypto USDT', ''],
    [CreditCard, 'Card', 'placeholder'],
  ];
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 rounded-xl bg-white/[0.04] p-1 text-center text-sm">
        <span className="flex items-center justify-center gap-2 rounded-lg bg-white/10 py-2 font-medium text-white">
          <ArrowDownToLine className="h-4 w-4 text-brand-300" /> Deposit
        </span>
        <span className="flex items-center justify-center gap-2 py-2 text-ink-500">
          <ArrowUpFromLine className="h-4 w-4" /> Withdraw
        </span>
      </div>

      <div className="rounded-2xl border border-white/[0.07] bg-ink-900/60 p-5">
        <div className="label">Amount</div>
        <div className="tabular mt-1 flex items-baseline gap-1 font-display text-5xl font-bold tracking-tight">
          <span className="text-ink-500">$</span>500<span className="text-2xl text-ink-500">.00</span>
          <span className="animate-blink ml-1 h-9 w-0.5 self-center bg-brand-400" />
        </div>
        <div className="mt-4 grid grid-cols-4 gap-1.5">
          {presets.map((p, i) => (
            <span
              key={p}
              className="tabular rounded-lg py-2 text-center font-mono text-xs [animation:chip-cycle_6s_linear_infinite]"
              style={{ animationDelay: `${i * 1.5}s`, backgroundColor: 'rgb(var(--tint) / 0.04)', color: 'var(--color-ink-300)' }}
            >
              {p}
            </span>
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        {methods.map(([Icon, name, note], i) => (
          <div key={name} className={cn('flex items-center gap-3 rounded-xl border px-4 py-3', i === 0 ? 'border-brand-400/40 bg-brand-400/[0.05]' : 'border-white/[0.06]')}>
            <Icon className={cn('h-4 w-4', i === 0 ? 'text-brand-300' : 'text-ink-400')} />
            <span className="flex-1 text-sm text-ink-100">
              {name} {note && <span className="text-xs text-ink-500">({note})</span>}
            </span>
            <span className={cn('flex h-4 w-4 items-center justify-center rounded-full border', i === 0 ? 'border-brand-400' : 'border-white/20')}>
              {i === 0 && <span className="h-2 w-2 rounded-full bg-brand-400" />}
            </span>
          </div>
        ))}
      </div>

      <div className="flex h-11 items-center justify-center rounded-xl bg-gradient-to-b from-brand-300 to-brand-500 text-sm font-semibold text-ink-950 opacity-70">Request deposit</div>

      <div>
        <div className="label mb-2">Payment history</div>
        <div className="divide-y divide-white/[0.05] rounded-xl border border-white/[0.06]">
          {(
            [
              ['Deposit', 'warning', 'Pending'],
              ['Deposit', 'success', 'Approved'],
              ['Withdraw', 'danger', 'Declined'],
            ] as const
          ).map(([kind, tone, status]) => (
            <div key={status} className="flex items-center gap-3 px-4 py-2.5">
              <span className="w-16 text-xs text-ink-300">{kind}</span>
              <span className="skeleton h-2.5 flex-1" />
              <Badge tone={tone}>{status}</Badge>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Help: a ticket thread whose messages arrive one after another, then a typing indicator. */
export function HelpPreview() {
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-400/15 text-brand-300">
          <Headset className="h-4 w-4" />
        </span>
        <div className="flex-1">
          <div className="text-sm font-semibold text-ink-100">Support ticket</div>
          <div className="text-[11px] text-ink-500">Ticket history and replies</div>
        </div>
        <Badge tone="success" dot>
          Open
        </Badge>
      </div>

      <Reveal variant="stagger" delay={500} step={650} className="space-y-3">
        <div className="flex items-end justify-end gap-2">
          <div className="max-w-[78%] rounded-2xl rounded-br-md bg-brand-400/15 px-4 py-2.5 text-sm text-ink-100">How long do withdrawals take?</div>
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/[0.07] text-ink-300">
            <User className="h-3.5 w-3.5" />
          </span>
        </div>
        <div className="flex items-end gap-2">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-400/15 text-brand-300">
            <Headset className="h-3.5 w-3.5" />
          </span>
          <div className="max-w-[78%] rounded-2xl rounded-bl-md bg-white/[0.07] px-4 py-2.5 text-sm text-ink-100">
            Requests are reviewed within one business day; bank transfers may take 2-5 days to arrive.
          </div>
        </div>
        <div className="flex items-end gap-2">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-400/15 text-brand-300">
            <Headset className="h-3.5 w-3.5" />
          </span>
          <div className="flex items-center gap-1 rounded-2xl rounded-bl-md bg-white/[0.07] px-4 py-3.5">
            {[0, 1, 2].map((i) => (
              <span key={i} className="h-1.5 w-1.5 animate-bounce rounded-full bg-ink-300" style={{ animationDelay: `${i * 0.15}s` }} />
            ))}
          </div>
        </div>
      </Reveal>

      <div className="flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] py-2 pl-4 pr-2">
        <Paperclip className="h-4 w-4 text-ink-500" />
        <span className="flex-1 text-sm text-ink-500">Write a reply</span>
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-400/20 text-brand-300">
          <SendHorizontal className="h-4 w-4" />
        </span>
      </div>

      <div className="flex flex-wrap gap-1.5">
        <span className="label mr-1 self-center">FAQ links</span>
        <MockChip>Accounts</MockChip>
        <MockChip>Deposits</MockChip>
        <MockChip>Withdrawals</MockChip>
        <MockChip>Verification</MockChip>
      </div>
    </div>
  );
}
