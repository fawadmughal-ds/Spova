import Link from 'next/link';
import type { CSSProperties, ReactNode } from 'react';
import { ArrowRight, BellRing, Cookie, Database, Eye, Hourglass, Mail, Share2, UserCheck, type LucideIcon } from 'lucide-react';
import { BRAND, cn } from '@/lib/utils';
import { Reveal } from '@/components/motion';
import { PageHero, Pending } from '@/components/marketing/page-hero';
import { PolicyToc } from '@/components/marketing/company-toc';
import { CtaBand } from '@/components/marketing/cta-band';

const vars = (v: Record<string, string | number>) => v as CSSProperties;
const LEGAL_NOTE = '[PLACEHOLDER - legal text to be approved by the client]';

/** The cookies the application sets today (see apps/api auth cookies). */
const COOKIES = [
  { name: 'sp_at', purpose: 'Access token. Proves you are signed in on each request.', life: 'About 15 minutes', ring: 0.22 },
  { name: 'sp_rt', purpose: 'Refresh token. Renews the access token so you stay signed in.', life: 'About 7 days', ring: 0.86 },
];

const SECTIONS: { id: string; label: string; icon: LucideIcon }[] = [
  { id: 'overview', label: 'Overview', icon: Eye },
  { id: 'what-we-collect', label: 'What we collect', icon: Database },
  { id: 'how-we-use-it', label: 'How we use it', icon: UserCheck },
  { id: 'cookies', label: 'Cookies', icon: Cookie },
  { id: 'sharing', label: 'Sharing', icon: Share2 },
  { id: 'retention', label: 'Retention', icon: Hourglass },
  { id: 'your-rights', label: 'Your rights', icon: BellRing },
  { id: 'contact', label: 'Contact', icon: Mail },
];

function Section({ id, title, children, note = LEGAL_NOTE }: { id: string; title: string; children: ReactNode; note?: string }) {
  const i = SECTIONS.findIndex((s) => s.id === id);
  const Icon = SECTIONS[i].icon;
  return (
    <Reveal as="section" id={id} className="scroll-mt-28 border-t border-white/[0.07] py-12 first:border-t-0 first:pt-0">
      <div className="flex items-center gap-4">
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-400/10 text-brand-300 ring-1 ring-inset ring-brand-400/25">
          <Icon className="h-5 w-5" />
        </span>
        <span className="tabular font-mono text-xs text-ink-500">{String(i + 1).padStart(2, '0')}</span>
      </div>
      <h2 className="mt-5 font-display text-3xl font-bold tracking-tight sm:text-4xl">{title}</h2>
      <div className="mt-5 space-y-4 leading-relaxed text-ink-300">{children}</div>
      <Pending className="mt-6">{note}</Pending>
    </Reveal>
  );
}

function Bullets({ items }: { items: [title: string, body: string][] }) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {items.map(([t, b]) => (
        <li key={t} className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4 transition-colors duration-300 hover:border-white/15 hover:bg-white/[0.04]">
          <div className="text-sm font-semibold text-white">{t}</div>
          <div className="mt-1 text-sm leading-relaxed text-ink-400">{b}</div>
        </li>
      ))}
    </ul>
  );
}

/** Hero prop: the two real cookies as tokens, each ring sized to its lifetime, next to the trackers that are not there. */
function CookieTokens() {
  return (
    <div className="relative mx-auto w-full max-w-[460px]" aria-hidden>
      <span className="absolute left-1/2 top-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand-500/15 blur-3xl" />
      <div className="relative grid grid-cols-2 gap-4">
        {COOKIES.map((c, i) => (
          <div key={c.name} className={cn('glass rounded-3xl p-5 shadow-lift', i ? 'animate-float-slow mt-10' : 'animate-float')}>
            <svg viewBox="0 0 120 120" className="mx-auto w-28">
              <circle cx="60" cy="60" r="50" fill="none" stroke="rgb(var(--tint) / 0.08)" strokeWidth="8" />
              <circle
                cx="60"
                cy="60"
                r="50"
                fill="none"
                stroke={i ? 'var(--color-volt)' : 'var(--color-brand-400)'}
                strokeWidth="8"
                strokeLinecap="round"
                pathLength={1}
                strokeDasharray={`${c.ring} 1`}
                transform="rotate(-90 60 60)"
                className="policy-ring"
                style={vars({ '--ring': c.ring, animationDelay: `${400 + i * 250}ms` })}
              />
              {/* cookie crumbs */}
              {[
                [46, 50, 5],
                [70, 46, 4],
                [62, 70, 5.5],
                [44, 72, 3.5],
                [76, 66, 3],
              ].map(([x, y, r]) => (
                <circle key={`${x}-${y}`} cx={x} cy={y} r={r} fill="rgb(var(--tint) / 0.16)" />
              ))}
            </svg>
            <div className="mt-4 text-center font-mono text-sm font-semibold text-white">{c.name}</div>
            <div className="label mt-1 text-center">{c.life}</div>
          </div>
        ))}
      </div>
      <div className="relative mt-4 grid grid-cols-2 gap-4">
        {['Analytics cookies', 'Marketing cookies'].map((l) => (
          <div key={l} className="rounded-2xl border border-dashed border-white/12 px-4 py-3 text-center">
            <div className="font-display text-2xl font-bold text-ink-400">0</div>
            <div className="label mt-0.5">{l}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function PrivacyPage() {
  return (
    <>
      <PageHero
        eyebrow="Cookies & privacy"
        title="Your data, *in plain words*"
        lead={
          <p>
            What {BRAND} collects when you open and use an account, what it is used for, and the cookies this site actually sets. Today that is two, and both exist only to keep you signed in.
          </p>
        }
      >
        <CookieTokens />
      </PageHero>

      <div className="mx-auto max-w-7xl px-4 pb-24 sm:px-6 sm:pb-28">
        <Reveal variant="scale" className="mb-12 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-dashed border-gold/30 bg-gold/[0.03] px-5 py-4">
          <p className="max-w-3xl text-sm leading-relaxed text-ink-300">
            This page summarises how the platform handles data. It is a working draft: the binding Privacy Policy will be the version approved by the client&apos;s legal team.
          </p>
          <Pending>[PLACEHOLDER - effective date and version]</Pending>
        </Reveal>

        <div className="grid gap-10 lg:grid-cols-[250px_1fr] lg:gap-16">
          <aside className="sticky top-[4.5rem] z-10 -mx-4 min-w-0 self-start border-b border-white/[0.06] bg-ink-950/95 px-4 py-2 backdrop-blur lg:top-28 lg:mx-0 lg:border-0 lg:bg-transparent lg:p-0 lg:backdrop-blur-none">
            <PolicyToc items={SECTIONS.map(({ id, label }) => ({ id, label }))} />
          </aside>

          <article className="min-w-0 max-w-3xl">
            <Section id="overview" title="Overview" note="[PLACEHOLDER - legal entity acting as data controller, and governing law]">
              <p>
                To give you a trading account we need to know who you are, how to reach you and what happens on your account. We collect that information, use it to run the service and keep it secure.
              </p>
              <p>The sections below go through each part in turn. Where the final wording is a legal matter, a marker shows that it is still to be approved.</p>
            </Section>

            <Section id="what-we-collect" title="What we collect">
              <Bullets
                items={[
                  ['Registration details', 'Name, email address, phone number, date of birth and country of residence.'],
                  ['Profile details', 'City, address and postal code, if you add them to your profile.'],
                  ['Verification documents', 'Proof of identity and proof of residence that you upload for account verification.'],
                  ['Account records', 'Trading accounts, deposits, withdrawals, adjustments, orders and positions.'],
                  ['Sign-in information', 'The time and IP address of your last login, and the browser used for each session.'],
                  ['Messages', 'What you send to support, so that we can answer and keep a record of it.'],
                ]}
              />
            </Section>

            <Section id="how-we-use-it" title="How we use it">
              <Bullets
                items={[
                  ['Running your account', 'Opening accounts, showing balances and statements, and executing your orders.'],
                  ['Verifying identity', 'Checking the documents you upload before live trading and withdrawals are enabled.'],
                  ['Processing payments', 'Reviewing and posting deposit and withdrawal requests.'],
                  ['Keeping accounts secure', 'Limiting repeated login attempts and signing out other devices when a password changes.'],
                  ['Contacting you', 'Service messages, and notifications by the channels you have switched on.'],
                  ['Meeting legal duties', 'Record-keeping and checks that financial services rules require.'],
                ]}
              />
            </Section>

            <Section id="cookies" title="Cookies" note="[PLACEHOLDER - cookie policy wording to be approved by the client; update this table if analytics or marketing tools are added]">
              <p>
                A cookie is a small file a website stores in your browser. This site sets two, both strictly necessary: without them you could not stay signed in. They are marked httpOnly, which means scripts running in the page cannot read
                them.
              </p>
              <div className="card overflow-x-auto">
                <table className="w-full min-w-[680px] text-left text-sm">
                  <thead>
                    <tr>
                      {['Cookie', 'What it does', 'Lifetime', 'Category'].map((h) => (
                        <th key={h} className="label px-5 py-3 font-medium">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {COOKIES.map((c) => (
                      <tr key={c.name} className="border-t border-white/[0.06] transition-colors duration-300 hover:bg-white/[0.03]">
                        <td className="px-5 py-4">
                          <code className="rounded-md bg-brand-400/10 px-2 py-1 font-mono text-xs text-brand-300 ring-1 ring-inset ring-brand-400/25">{c.name}</code>
                        </td>
                        <td className="min-w-[240px] px-5 py-4 text-ink-200">{c.purpose}</td>
                        <td className="tabular whitespace-nowrap px-5 py-4 font-mono text-xs text-ink-300">{c.life}</td>
                        <td className="px-5 py-4">
                          <span className="whitespace-nowrap rounded-full bg-white/[0.06] px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-ink-200">Strictly necessary · httpOnly</span>
                        </td>
                      </tr>
                    ))}
                    <tr className="border-t border-white/[0.06]">
                      <td colSpan={4} className="px-5 py-4 text-ink-400">
                        No analytics or marketing cookies are set by the application today. Your choice in the cookie notice is kept in your browser's local storage (key <code className="font-mono text-[11px]">xyz-cookie-consent</code>), not in a cookie, and is never sent to us.
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p>You can delete or block cookies in your browser settings. If you block these two, the public pages still work but you will not be able to log in.</p>
            </Section>

            <Section id="sharing" title="Sharing" note="[PLACEHOLDER - list of processors and recipients, and any transfers abroad, to be approved by the client]">
              <p>Personal data is shared only where the service needs it or the law requires it. The kinds of recipient this typically involves are:</p>
              <Bullets
                items={[
                  ['Payment providers', 'To process a deposit or a withdrawal you have requested.'],
                  ['Infrastructure providers', 'Hosting, file storage and email delivery that the platform runs on.'],
                  ['Authorities', 'Regulators, courts or law enforcement, when there is a legal obligation.'],
                  ['Advisers and auditors', 'Under confidentiality, where they need access to do their work.'],
                ]}
              />
            </Section>

            <Section id="retention" title="Retention" note="[PLACEHOLDER - retention periods per data category, to be approved by the client]">
              <p>Data is kept for as long as your account is open and, after that, for the period financial services rules require.</p>
              <p>
                One thing is true by design: the record of money movements on an account and the log of back-office actions are append-only. Entries can be added but not edited or deleted, which is what makes your statement reliable.
              </p>
            </Section>

            <Section id="your-rights" title="Your rights" note="[PLACEHOLDER - rights available by jurisdiction and how requests are handled, to be approved by the client]">
              <Bullets
                items={[
                  ['See and correct', 'Your personal details are visible in your profile and most can be edited there.'],
                  ['Choose your notifications', 'Email, SMS, push and phone-call notifications can each be switched off in Profile, under Settings.'],
                  ['Ask for a copy', 'You can ask what personal data is held about you.'],
                  ['Ask for deletion', 'You can ask for data to be erased, subject to the records the law obliges us to keep.'],
                ]}
              />
              <Link href="/login" className="group inline-flex items-center gap-2 text-sm font-medium text-brand-300">
                <span className="link-underline">Open your profile</span>
                <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
              </Link>
            </Section>

            <Section id="contact" title="Contact" note="[PLACEHOLDER - privacy contact email and postal address]">
              <p>Questions about this page or about your data go to the support team, who will pass them to the person responsible for privacy.</p>
              <div className="flex flex-wrap gap-x-8 gap-y-3">
                {[
                  ['/contact-us', 'Contact us'],
                  ['/legal', 'Legal documents'],
                  ['/complaints', 'Complaints procedure'],
                ].map(([href, label]) => (
                  <Link key={href} href={href} className="group inline-flex items-center gap-2 text-sm font-medium text-brand-300">
                    <span className="link-underline">{label}</span>
                    <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
                  </Link>
                ))}
              </div>
            </Section>
          </article>
        </div>
      </div>

      <CtaBand />
    </>
  );
}
