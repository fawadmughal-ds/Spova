import Link from 'next/link';
import type { CSSProperties } from 'react';
import { ArrowRight, ArrowUpRight, Check, FileSearch, Gavel, Inbox, MailCheck, MessagesSquare, PenLine, type LucideIcon } from 'lucide-react';
import { BRAND, cn } from '@/lib/utils';
import { buttonClass } from '@/lib/button';
import { Reveal, Spotlight } from '@/components/motion';
import { PageHero, Pending } from '@/components/marketing/page-hero';
import { SectionHead } from '@/components/marketing/section-head';
import { CtaBand } from '@/components/marketing/cta-band';

const vars = (v: Record<string, string | number>) => v as CSSProperties;

interface Stage {
  icon: LucideIcon;
  tag: string;
  title: string;
  body: string;
  pending?: string;
  link?: { href: string; label: string };
}

const STAGES: Stage[] = [
  {
    icon: MessagesSquare,
    tag: 'Before you file',
    title: 'Talk to support',
    body: 'Most problems are a misunderstanding or a fix away. Tell the support team what happened; if they can put it right there and then, you are done.',
    link: { href: '/contact-us', label: 'Contact support' },
  },
  {
    icon: PenLine,
    tag: 'Step 1',
    title: 'Submit your complaint',
    body: 'If support could not resolve it, put the complaint in writing with the details listed below. A written complaint is what starts the formal procedure.',
    pending: 'Email info@zerventa.com or open a support ticket from your client area.',
  },
  {
    icon: MailCheck,
    tag: 'Step 2',
    title: 'Acknowledgement',
    body: 'We confirm that the complaint has been received and give you a reference to quote in any follow-up.',
  },
  {
    icon: FileSearch,
    tag: 'Step 3',
    title: 'Investigation',
    body: 'The complaint is reviewed against your account records: orders, prices at the time, the statement and any correspondence. We may ask you for more information while this is under way.',
  },
  {
    icon: Inbox,
    tag: 'Step 4',
    title: 'Outcome',
    body: 'You receive a written answer that explains what was found, the decision and, where the complaint is upheld, what will be done to put it right.',
  },
  {
    icon: Gavel,
    tag: 'If you disagree',
    title: 'Escalation',
    body: 'If the answer does not settle the matter, you can ask for it to be reviewed again, and you may have the right to take it to an independent body.',
  },
];

const INCLUDE = [
  'Your full name and the email address you registered with',
  'The login number of the trading account concerned',
  'The date and time of what happened, with your time zone',
  'The instrument, order or payment it relates to',
  'A clear description of the problem, in the order it happened',
  'What you would like us to do to resolve it',
  'Screenshots, statements or messages that support it',
];

/** Hero prop: a case file that gets filled in, stamped and filed. */
function CaseFile() {
  return (
    <div className="relative mx-auto h-[380px] w-full max-w-[440px]" aria-hidden>
      <span className="absolute left-1/2 top-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand-500/15 blur-3xl" />
      <div className="absolute left-8 top-8 h-[300px] w-[300px] rotate-[7deg] rounded-3xl border border-white/[0.06] bg-white/[0.02]" />
      <div className="animate-float-slow absolute left-2 top-2 w-[330px] -rotate-3">
        <div className="glass corners overflow-hidden rounded-3xl p-6 shadow-lift">
          <div className="flex items-center justify-between">
            <span className="label">Case file</span>
            <span className="tabular font-mono text-[11px] text-ink-400">REF · — — — —</span>
          </div>
          <div className="mt-5 space-y-3">
            {[
              ['Account', 62],
              ['Date', 44],
              ['Subject', 80],
            ].map(([k, w], i) => (
              <div key={k as string} className="grid grid-cols-[64px_1fr] items-center gap-3">
                <span className="font-mono text-[10px] uppercase tracking-widest text-ink-500">{k}</span>
                <span className="grow-x block h-2 rounded-full bg-white/15" style={vars({ width: `${w}%`, '--d': `${500 + i * 160}ms` })} />
              </div>
            ))}
          </div>
          <div className="mt-5 space-y-2 border-t border-white/[0.07] pt-5">
            {[100, 92, 97, 58].map((w, i) => (
              <span key={i} className="grow-x block h-1.5 rounded-full bg-white/[0.09]" style={vars({ width: `${w}%`, '--d': `${1000 + i * 120}ms` })} />
            ))}
          </div>
          <div className="mt-6 flex items-center gap-2">
            {['Received', 'Review', 'Answered'].map((s, i) => (
              <span key={s} className="complaint-step flex-1 rounded-lg border border-white/10 py-1.5 text-center font-mono text-[9px] uppercase tracking-[0.14em] text-ink-500" style={{ animationDelay: `${i * 1.6}s` }}>
                {s}
              </span>
            ))}
          </div>
        </div>
        <span className="complaint-stamp absolute -right-9 top-24 rotate-[14deg] rounded-xl border-2 border-brand-400/80 px-4 py-1.5 font-display text-lg font-extrabold uppercase tracking-widest text-brand-300">
          Logged
        </span>
      </div>
    </div>
  );
}

export function ComplaintsPage() {
  return (
    <>
      <PageHero
        eyebrow="Complaints"
        title="If something went wrong, *tell us*"
        lead={
          <p>
            We would rather hear about a problem than have you live with it. This page sets out how a complaint to {BRAND} is raised, what happens to it, and what you can do if you disagree with the answer.
          </p>
        }
        actions={
          <>
            <Link href="/contact-us" className={buttonClass('primary', 'lg', 'group h-14 rounded-2xl px-7')}>
              Contact support <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
            </Link>
            <Link href="#procedure" className={buttonClass('outline', 'lg', 'h-14 rounded-2xl px-7')}>
              See the procedure
            </Link>
          </>
        }
      >
        <CaseFile />
      </PageHero>

      {/* ------------------------------------------------------------ timeline */}
      <section id="procedure" className="relative scroll-mt-24 overflow-x-clip border-y border-white/[0.06] bg-ink-900/40">
        <div className="bg-dots absolute inset-0 opacity-40" />
        <div className="relative mx-auto max-w-5xl px-4 py-24 sm:px-6 sm:py-28">
          <SectionHead eyebrow="01 — Procedure" title="From first message to *final answer*" sub="Six stages, each with a clear hand-over to the next." align="center" />

          <Reveal variant="none" className="relative">
            {/* spine */}
            <div className="absolute bottom-6 left-[27px] top-6 w-px bg-white/[0.08] md:left-1/2 md:-translate-x-1/2">
              <div className="grow-y h-full origin-top bg-gradient-to-b from-brand-400 via-brand-300 to-volt [animation-duration:3.2s]" />
            </div>

            <ol className="space-y-8 md:space-y-4">
              {STAGES.map((s, i) => {
                const right = i % 2 === 1;
                return (
                  <li key={s.title} className="relative grid grid-cols-[56px_1fr] gap-4 md:grid-cols-[1fr_56px_1fr] md:gap-8">
                    <Reveal variant={right ? 'right' : 'left'} className={cn('col-start-2 row-start-1 md:row-start-1', right ? 'md:col-start-3' : 'md:col-start-1')}>
                      <Spotlight className="card card-hover group overflow-hidden p-6 sm:p-7">
                        <div className="flex items-center justify-between gap-4">
                          <span className="eyebrow">{s.tag}</span>
                          <s.icon className="h-5 w-5 text-ink-500 transition-all duration-500 ease-spring group-hover:-rotate-12 group-hover:scale-125 group-hover:text-brand-300" />
                        </div>
                        <h3 className="mt-4 font-display text-2xl font-bold tracking-tight">{s.title}</h3>
                        <p className="mt-2.5 text-sm leading-relaxed text-ink-300">{s.body}</p>
                        {s.pending && <Pending className="mt-4">{s.pending}</Pending>}
                        {s.link && (
                          <Link href={s.link.href} className="group/l mt-4 inline-flex items-center gap-2 text-sm font-medium text-brand-300">
                            <span className="link-underline">{s.link.label}</span>
                            <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover/l:translate-x-1" />
                          </Link>
                        )}
                      </Spotlight>
                    </Reveal>

                    <Reveal variant="scale" delay={120} className="col-start-1 row-start-1 flex justify-center pt-5 md:col-start-2">
                      <span className="relative flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-ink-900 font-display text-lg font-bold text-brand-300 shadow-lift">
                        <span className="absolute inset-0 animate-pulse-ring rounded-2xl border border-brand-400/40" style={{ animationDelay: `${i * 0.4}s` }} />
                        {String(i + 1).padStart(2, '0')}
                      </span>
                    </Reveal>
                  </li>
                );
              })}
            </ol>
          </Reveal>
        </div>
      </section>

      {/* ------------------------------------------------------------ checklist */}
      <section className="mx-auto max-w-7xl overflow-x-clip px-4 py-24 sm:px-6 sm:py-28">
        <div className="grid gap-10 lg:grid-cols-[1fr_1.1fr] lg:gap-16">
          <div>
            <SectionHead eyebrow="02 — What to include" title="Give us the facts, *we do the digging*" sub="A complete complaint is investigated faster, because nobody has to come back to you for the basics." className="mb-8" />
            <Reveal variant="stagger" step={90} className="space-y-3">
              <div className="rounded-2xl border border-dashed border-gold/30 bg-gold/[0.03] p-5">
                <div className="label !text-gold">Where to send it</div>
                <p className="mt-3 text-sm text-ink-300">Email <a href="mailto:info@zerventa.com" className="font-medium text-brand-300 hover:underline">info@zerventa.com</a>, or open a support ticket from your client area.</p>
              </div>
              <div className="rounded-2xl border border-dashed border-gold/30 bg-gold/[0.03] p-5">
                <div className="label !text-gold">How long it takes</div>
              </div>
            </Reveal>
          </div>

          <Reveal variant="none">
            <div className="card corners overflow-hidden p-2">
              <ul>
                {INCLUDE.map((line, i) => (
                  <Reveal as="li" key={line} variant="right" delay={i * 80} className="group flex items-center gap-4 rounded-2xl px-4 py-4 transition-colors duration-300 hover:bg-white/[0.04]">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-400/10 text-brand-300 ring-1 ring-inset ring-brand-400/25 transition-all duration-500 ease-spring group-hover:scale-110 group-hover:bg-brand-400 group-hover:text-ink-950">
                      <Check className="h-4 w-4" />
                    </span>
                    <span className="text-ink-100">{line}</span>
                    <span className="tabular ml-auto font-mono text-[10px] text-ink-600">{String(i + 1).padStart(2, '0')}</span>
                  </Reveal>
                ))}
              </ul>
            </div>
          </Reveal>
        </div>

        <Reveal variant="stagger" step={90} className="mt-16 grid gap-4 md:grid-cols-2">
          {[
            { href: '/legal', title: 'Legal documents', body: 'The Complaints Handling Procedure sits alongside the Client Agreement and the other documents that govern your account.' },
            { href: '/faq#topic-legal-compliance', title: 'Legal & compliance FAQ', body: 'Short answers on regulation, protection of funds and how your data is handled.' },
          ].map((c) => (
            <Link key={c.href} href={c.href} className="card card-hover group flex items-start justify-between gap-6 p-7">
              <div>
                <h3 className="font-display text-xl font-bold tracking-tight">{c.title}</h3>
                <p className="mt-2 max-w-md text-sm leading-relaxed text-ink-400">{c.body}</p>
              </div>
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/15 transition-all duration-500 ease-spring group-hover:border-brand-400 group-hover:bg-brand-400 group-hover:text-ink-950">
                <ArrowUpRight className="h-4 w-4" />
              </span>
            </Link>
          ))}
        </Reveal>
      </section>

      <CtaBand title="Rather just *talk it through?*" body="Support is on live chat 24/5 from the client area, or by email." primary={{ href: '/contact-us', label: 'Contact support' }} secondary={{ href: '/faq', label: 'Read the FAQ' }} />
    </>
  );
}
