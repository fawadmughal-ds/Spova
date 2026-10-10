import Link from 'next/link';
import type { CSSProperties, ReactNode } from 'react';
import { Activity, ArrowRight, ArrowUpRight, Building2, Crosshair, Download, FileText, Gauge, Globe, GraduationCap, Headset, HeartHandshake, Landmark, ListChecks, LockKeyhole, Mail, MessageCircle, MessageSquareText, Monitor, MousePointerClick, PhoneCall, Scale, ShieldAlert, ShieldCheck, Timer, type LucideIcon } from 'lucide-react';
import { BRAND, cn } from '@/lib/utils';
import { PageHero, Pending } from '@/components/marketing/page-hero';
import { LEGAL_DOCS, legalText } from '@spova/shared';
import { buttonClass } from '@/lib/button';
import type { PublicSymbol } from '@/lib/server-api';
import { CountUp, Reveal, Spotlight, Words } from '@/components/motion';
import { SectionHead } from '@/components/marketing/section-head';
import { HeroTerminal } from '@/components/marketing/hero-terminal';
import { FaqExplorer } from '@/components/marketing/company-faq';
import { FAQ_COUNT, FAQ_TOPICS } from '@/components/marketing/company-faq-data';
import { Button, Input, Select } from '@/components/ui';
import { CtaBand } from '@/components/marketing/cta-band';

export interface ContentCopy {
  title: string;
  paragraphs: string[];
}

const vars = (v: Record<string, string | number>) => v as CSSProperties;
/** "Body text. [PLACEHOLDER - note]" -> ["Body text.", "[PLACEHOLDER - note]"] */
const splitPlaceholder = (p: string): [string, string | null] => {
  const i = p.indexOf('[PLACEHOLDER');
  return i < 0 ? [p, null] : [p.slice(0, i).trim(), p.slice(i).trim()];
};

/** Dispatches the simple content routes to their own layouts. Copy stays in the route's CONTENT map. */
export function ContentPage({ slug, copy, symbols }: { slug: string; copy: ContentCopy; symbols: PublicSymbol[] }) {
  switch (slug) {
    case 'platform':
      return <Platform copy={copy} symbols={symbols} />;
    case 'about-us':
      return <About copy={copy} />;
    case 'contact-us':
      return <Contact copy={copy} />;
    case 'faq':
      return <Faq copy={copy} />;
    case 'legal':
      return <Legal copy={copy} />;
    default:
      return (
        <Hero eyebrow={BRAND} title={copy.title}>
          {null}
        </Hero>
      );
  }
}

// ---------------------------------------------------------------- shared
const Hero = PageHero;

function Tile({ className, icon: Icon, title, body, children }: { className?: string; icon: LucideIcon; title: string; body: string; children: ReactNode }) {
  return (
    <Spotlight className={cn('card card-hover group flex flex-col overflow-hidden', className)}>
      <div className="relative flex min-h-[180px] flex-1 items-center justify-center overflow-hidden border-b border-white/[0.05] bg-ink-900/40">{children}</div>
      <div className="p-6">
        <h3 className="flex items-center gap-2.5 text-lg font-semibold">
          <Icon className="h-5 w-5 text-brand-400 transition-transform duration-500 ease-spring group-hover:-rotate-12 group-hover:scale-125" />
          {title}
        </h3>
        <p className="mt-2 text-sm leading-relaxed text-ink-400">{body}</p>
      </div>
    </Spotlight>
  );
}

const demoCta = (
  <>
    <Link href="/register" className={buttonClass('primary', 'lg', 'group h-14 rounded-2xl px-7')}>
      Open free demo <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
    </Link>
    <Link href="/login" className={buttonClass('outline', 'lg', 'h-14 rounded-2xl px-7')}>
      Log in
    </Link>
  </>
);

// ---------------------------------------------------------------- platform
const TIMEFRAMES = ['M1', 'M5', 'M15', 'H1', 'H4', 'D1'];
const CHART_LINE = 'M0 96 C40 80 60 104 100 84 S160 44 200 62 S270 18 320 40 S400 30 460 10';

function Platform({ copy, symbols }: { copy: ContentCopy; symbols: PublicSymbol[] }) {
  const [p1, p2, p3] = copy.paragraphs;
  return (
    <>
      <Hero eyebrow="Platform" title="Web trading *platform*" lead={p1} actions={demoCta}>
        <div className="mx-auto w-full max-w-xl lg:max-w-none">
          <HeroTerminal symbols={symbols} />
        </div>
      </Hero>

      <section className="relative border-y border-white/[0.06] bg-ink-900/40">
        <div className="bg-dots absolute inset-0 opacity-50" />
        <div className="relative mx-auto max-w-7xl px-4 py-24 sm:px-6 sm:py-28">
          <SectionHead eyebrow="01 — Toolkit" title="Everything on *one screen*" sub={p2} />
          <Reveal variant="stagger" step={90} className="grid gap-4 md:grid-cols-6">
            <Tile className="md:col-span-4" icon={Timer} title="Real-time charts, six timeframes" body="From one-minute candles to the daily view, streaming as the market moves.">
              <div className="bg-grid absolute inset-0 opacity-70" />
              <svg viewBox="0 0 460 110" preserveAspectRatio="none" className="absolute inset-x-0 bottom-0 h-28 w-full" fill="none">
                <defs>
                  <linearGradient id="pf-area" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor="var(--color-brand-400)" stopOpacity="0.25" />
                    <stop offset="1" stopColor="var(--color-brand-400)" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path d={`${CHART_LINE} V110 H0 Z`} fill="url(#pf-area)" />
                <path d={CHART_LINE} pathLength={1} stroke="var(--color-brand-400)" strokeWidth="2.5" className="draw" />
              </svg>
              <div className="relative -mt-14 flex gap-1.5 rounded-xl bg-ink-950/70 p-1.5 ring-1 ring-inset ring-white/10 backdrop-blur">
                {TIMEFRAMES.map((t, i) => (
                  <span key={t} className="animate-pulse rounded-lg bg-white/[0.07] px-3 py-1.5 font-mono text-xs font-semibold text-white" style={{ animationDelay: `${i * 0.35}s`, animationDuration: '2.1s' }}>
                    {t}
                  </span>
                ))}
              </div>
            </Tile>

            <Tile className="md:col-span-2" icon={MousePointerClick} title="One-click market orders" body="Hit buy or sell and the order goes out at the live price.">
              <div className="grid w-full max-w-[250px] grid-cols-2 gap-2 px-6">
                <div className="rounded-xl bg-down/10 py-4 text-center font-mono text-sm font-bold text-down ring-1 ring-inset ring-down/25">SELL</div>
                <div className="relative rounded-xl bg-up/15 py-4 text-center font-mono text-sm font-bold text-up ring-1 ring-inset ring-up/40">
                  BUY
                  <span className="absolute -bottom-2 -right-2 flex h-7 w-7 items-center justify-center">
                    <span className="absolute inset-0 animate-pulse-ring rounded-full bg-white/50" />
                    <MousePointerClick className="relative h-5 w-5 text-white drop-shadow" />
                  </span>
                </div>
              </div>
            </Tile>

            <Tile className="md:col-span-2" icon={Crosshair} title="Pending limit and stop orders" body="Name your price and let the platform wait for it.">
              <svg viewBox="0 0 280 150" className="w-full max-w-[300px] px-4" fill="none">
                <line x1="0" y1="38" x2="280" y2="38" stroke="var(--color-gold)" strokeWidth="1.5" strokeDasharray="4 8" className="animate-dash" />
                <line x1="0" y1="116" x2="280" y2="116" stroke="var(--color-iris)" strokeWidth="1.5" strokeDasharray="4 8" className="animate-dash" />
                <path d="M0 84 L40 70 L70 92 L110 60 L150 80 L190 54 L230 76 L262 62" pathLength={1} stroke="var(--color-white)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" className="draw" />
                <circle cx="262" cy="62" r="4" fill="var(--color-brand-400)" className="crash-dot" />
                <rect x="6" y="20" width="52" height="18" rx="5" fill="var(--color-gold)" />
                <text x="32" y="33" textAnchor="middle" className="fill-ink-950 font-mono text-[10px] font-bold">
                  STOP
                </text>
                <rect x="6" y="116" width="52" height="18" rx="5" fill="var(--color-iris)" />
                <text x="32" y="129" textAnchor="middle" className="fill-white font-mono text-[10px] font-bold">
                  LIMIT
                </text>
              </svg>
            </Tile>

            <Tile className="md:col-span-2" icon={Activity} title="Live P/L on every position" body="Each open position reprices with the market, tick by tick.">
              <div className="w-full max-w-[270px] space-y-2 px-6">
                {symbols.slice(0, 3).map((s, i) => (
                  <div key={s.id} className="flex items-center gap-3 rounded-xl bg-white/[0.04] px-3 py-2">
                    <span className={cn('rounded px-1.5 py-0.5 font-mono text-[9px] font-bold', i === 1 ? 'bg-down/15 text-down' : 'bg-up/15 text-up')}>{i === 1 ? 'SELL' : 'BUY'}</span>
                    <span className="font-mono text-xs font-semibold text-white">{s.id}</span>
                    <span className="ml-auto flex h-4 items-end gap-0.5">
                      {[10, 14, 9, 16, 12].map((h, k) => (
                        <span key={k} className={cn('bar-breathe w-1 rounded-full', i === 1 ? 'bg-down' : 'bg-up')} style={vars({ height: `${h}px`, '--dur': `${1.4 + ((k + i) % 3) * 0.4}s`, '--s': 0.45 })} />
                      ))}
                    </span>
                  </div>
                ))}
              </div>
            </Tile>

            <Tile className="md:col-span-2" icon={ShieldAlert} title="SL / TP and margin preview" body="Set stop-loss and take-profit on the ticket, edit them later, and see the margin before you confirm.">
              <div className="w-full max-w-[250px] space-y-2 px-6">
                {[
                  ['Stop loss', 'bg-down/60'],
                  ['Take profit', 'bg-up/60'],
                  ['Margin required', 'bg-white/40'],
                ].map(([label, tone], i) => (
                  <div key={label} className="flex items-center justify-between gap-3 rounded-xl bg-white/[0.04] px-3 py-2.5">
                    <span className="label">{label}</span>
                    <span className="h-1.5 w-14 shrink-0 overflow-hidden rounded-full bg-white/[0.07]">
                      <span className={cn('grow-x block h-full rounded-full', tone)} style={vars({ '--d': `${400 + i * 200}ms`, width: `${[55, 80, 40][i]}%` })} />
                    </span>
                  </div>
                ))}
              </div>
            </Tile>

            <Spotlight className="card card-hover group grid items-center gap-6 overflow-hidden p-6 md:col-span-6 md:grid-cols-[1fr_1.3fr]">
              <div>
                <h3 className="flex items-center gap-2.5 text-lg font-semibold">
                  <Monitor className="h-5 w-5 text-brand-400 transition-transform duration-500 ease-spring group-hover:-rotate-12 group-hover:scale-125" />
                  Any device, no download
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-400">The terminal runs in the browser. Open it on a desktop, a tablet or a phone and pick up where you left off.</p>
              </div>
              <svg viewBox="0 0 520 150" className="w-full" fill="none">
                <rect x="10" y="10" width="250" height="118" rx="10" stroke="rgb(var(--tint) / 0.25)" strokeWidth="1.5" />
                <path d="M100 142h70M135 128v14" stroke="rgb(var(--tint) / 0.25)" strokeWidth="1.5" strokeLinecap="round" />
                <rect x="300" y="24" width="110" height="118" rx="10" stroke="rgb(var(--tint) / 0.25)" strokeWidth="1.5" />
                <rect x="450" y="50" width="56" height="92" rx="9" stroke="rgb(var(--tint) / 0.25)" strokeWidth="1.5" />
                <path d="M24 100 L60 78 L92 92 L130 54 L170 70 L210 40 L246 52" pathLength={1} stroke="var(--color-brand-400)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="draw" />
                <path d="M312 112 L332 94 L352 104 L374 72 L398 82" pathLength={1} stroke="var(--color-brand-400)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="draw" style={vars({ '--d': '500ms' })} />
                <path d="M460 120 L472 106 L484 112 L496 90" pathLength={1} stroke="var(--color-brand-400)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="draw" style={vars({ '--d': '900ms' })} />
                <path d="M262 70h36M412 96h36" stroke="var(--color-brand-400)" strokeWidth="1.5" strokeDasharray="3 6" className="animate-dash" />
              </svg>
            </Spotlight>
          </Reveal>
        </div>
      </section>

      {/* demo == live statement */}
      <section className="relative overflow-hidden">
        <div className="aurora-blob left-1/2 top-10 h-[360px] w-[760px] -translate-x-1/2 bg-brand-500/10" />
        <Reveal variant="none" className="relative mx-auto max-w-5xl px-4 py-28 text-center sm:px-6 sm:py-36">
          <Reveal variant="scale" className="inline-flex items-center gap-3 rounded-full border border-white/10 bg-white/[0.04] p-1.5 font-mono text-xs font-semibold uppercase tracking-[0.16em]">
            <span className="rounded-full bg-sky-400/15 px-4 py-1.5 text-sky-700">Demo</span>
            <span className="relative h-px w-10 overflow-hidden bg-white/15">
              <span className="absolute inset-y-0 w-1/2 animate-sweep bg-brand-300" />
            </span>
            <span className="rounded-full bg-up/15 px-4 py-1.5 text-up">Live</span>
          </Reveal>
          <p className="mt-10 font-display text-4xl font-bold leading-[1.04] tracking-tight sm:text-6xl">
            <Words text={p3.replace('exactly what you trade.', '*exactly what you trade.*')} delay={200} />
          </p>
        </Reveal>
      </section>

      <CtaBand title="Open the terminal *on a demo*" secondary={{ href: '/trading-account', label: 'Compare accounts' }} />
    </>
  );
}

// ---------------------------------------------------------------- about
const ABOUT_VALUES: { icon: LucideIcon; title: string; body: string }[] = [
  { icon: MessageSquareText, title: 'Say it plainly', body: 'Contract sizes, leverage, swap rates and margin rules are stated per instrument and per tier, in numbers rather than adjectives.' },
  { icon: HeartHandshake, title: 'Traders first', body: 'Negative balance protection on every account, a margin call at 100% and a stop-out at 20% that acts before an account goes under.' },
  { icon: GraduationCap, title: 'Teach, then trade', body: 'A demo account that follows the same rules as live, and an education section that starts from the first pip.' },
];
const ABOUT_PROOF: { icon: LucideIcon; title: string; body: string; href: string; link: string }[] = [
  { icon: Monitor, title: 'A terminal in your browser', body: 'Charts, orders and positions on any device, with nothing to download.', href: '/platform', link: 'See the platform' },
  { icon: ListChecks, title: 'Payments you can follow', body: 'Deposit and withdrawal requests are made from your client area and land on your statement when they are approved.', href: '/faq#topic-deposits', link: 'How deposits work' },
  { icon: ShieldCheck, title: 'Protection built in', body: 'You cannot lose more than your balance, whichever tier you are on.', href: '/risk-management-tools', link: 'Risk management' },
  { icon: Gauge, title: 'Conditions in the open', body: 'Every instrument, its contract spec and its overnight rate are public pages.', href: '/cfds-list', link: 'Open the CFD list' },
];

function About({ copy }: { copy: ContentCopy }) {
  const [text, pending] = splitPlaceholder(copy.paragraphs[0]);
  const manifesto = text.replace('fair pricing,', '*fair pricing,*').replace('fast support.', '*fast support.*');
  const pillars = [
    { title: 'Fair pricing', body: 'Spreads from 0.0 pips, with tier discounts of up to 40% as your balance grows.', href: '/trading-account', link: 'See the tiers' },
    { title: 'Straightforward account conditions', body: 'Five tiers on one platform. Margin call at 100%, stop-out at 20% and negative balance protection on every one.', href: '/trading-account', link: 'Compare accounts' },
    { title: 'Fast support', body: 'Real people, via chat, email and phone.', href: '/contact-us', link: 'Contact us' },
  ];
  return (
    <>
      <Hero eyebrow={`About ${BRAND}`} title={manifesto} wide />

      <div className="relative border-y border-white/[0.06] bg-ink-900/50">
        <Reveal as="dl" variant="stagger" className="mx-auto grid max-w-7xl grid-cols-2 px-4 sm:px-6 lg:grid-cols-5">
          {[
            { label: 'Instruments', node: <CountUp to={250} suffix="+" /> },
            { label: 'Asset classes', node: <CountUp to={6} /> },
            { label: 'Account tiers', node: <CountUp to={5} /> },
            { label: 'Max leverage', node: <CountUp to={400} prefix="1:" /> },
            { label: 'Min deposit', node: <CountUp to={200} prefix="$" /> },
          ].map((s, i) => (
            <div key={s.label} className={cn('py-10 lg:border-l lg:border-white/[0.06] lg:pl-8 lg:first:border-l-0 lg:first:pl-0', i === 4 && 'max-lg:col-span-2')}>
              <dt className="label">{s.label}</dt>
              <dd className="tabular mt-2 font-display text-4xl font-bold tracking-tight sm:text-5xl">{s.node}</dd>
            </div>
          ))}
        </Reveal>
      </div>

      <section className="mx-auto max-w-7xl px-4 py-24 sm:px-6 sm:py-28">
        <SectionHead eyebrow="01 — What we focus on" title="Three promises, *kept simple*" />
        <Reveal variant="stagger" step={130} className="border-t border-white/[0.08]">
          {pillars.map((p, i) => (
            <Link key={p.title} href={p.href} className="group relative grid items-center gap-4 overflow-hidden border-b border-white/[0.08] py-9 transition-[padding] duration-500 ease-out-expo hover:px-4 md:grid-cols-[110px_1.1fr_1fr_170px] sm:hover:px-6">
              <span className="absolute inset-0 -z-10 origin-left scale-x-0 bg-gradient-to-r from-brand-400/[0.09] to-transparent transition-transform duration-700 ease-out-expo group-hover:scale-x-100" />
              <span className="text-outline font-display text-6xl font-extrabold leading-none transition-all duration-500 group-hover:[-webkit-text-stroke-color:rgb(var(--brand-rgb)/0.7)]">0{i + 1}</span>
              <h3 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">{p.title}</h3>
              <p className="text-sm leading-relaxed text-ink-400">{p.body}</p>
              <span className="inline-flex items-center gap-2 text-sm font-medium text-brand-300 md:justify-end">
                <span className="link-underline">{p.link}</span>
                <ArrowUpRight className="h-4 w-4 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
              </span>
            </Link>
          ))}
        </Reveal>
      </section>

      {/* values + vision */}
      <section className="relative overflow-x-clip border-y border-white/[0.06] bg-ink-900/40">
        <div className="bg-dots absolute inset-0 opacity-40" />
        <div className="relative mx-auto max-w-7xl px-4 py-24 sm:px-6 sm:py-28">
          <SectionHead eyebrow="02 — Values and vision" title="What we *hold ourselves to*" action={<Pending>[PLACEHOLDER - values and vision wording to be approved by the client]</Pending>} />
          <div className="grid gap-4 lg:grid-cols-[1.15fr_1fr]">
            <Reveal variant="stagger" step={110} className="grid gap-4">
              {ABOUT_VALUES.map((v) => (
                <Spotlight key={v.title} className="card card-hover group flex items-start gap-5 overflow-hidden p-6 sm:p-7">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand-400/10 text-brand-300 ring-1 ring-inset ring-brand-400/25 transition-transform duration-500 ease-spring group-hover:-rotate-12 group-hover:scale-110">
                    <v.icon className="h-6 w-6" />
                  </span>
                  <div>
                    <h3 className="font-display text-xl font-bold tracking-tight">{v.title}</h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-ink-400">{v.body}</p>
                  </div>
                </Spotlight>
              ))}
            </Reveal>
            <Reveal variant="right" delay={150}>
              <div className="card corners relative isolate flex h-full flex-col justify-between overflow-hidden p-8 sm:p-10">
                {/* compass: two counter-rotating rings behind the statement */}
                <div className="pointer-events-none absolute -right-24 -top-24 -z-10 h-80 w-80" aria-hidden>
                  <span className="absolute inset-0 animate-spin-slow rounded-full border border-dashed border-brand-400/30" />
                  <span className="absolute inset-10 animate-spin-slow rounded-full border border-dashed border-white/15 [animation-direction:reverse] [animation-duration:34s]" />
                  <span className="absolute inset-24 rounded-full bg-brand-500/15 blur-2xl" />
                </div>
                <span className="eyebrow">Our vision</span>
                <p className="mt-10 font-serif text-4xl italic leading-[1.1] text-white sm:text-5xl">
                  A market anyone can <span className="accent">understand</span> before they trade it.
                </p>
                <p className="mt-8 max-w-md text-sm leading-relaxed text-ink-400">
                  That is why the demo account follows live rules, why margin is shown before you confirm an order, and why the numbers that decide a trade are on public pages.
                </p>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* what you get */}
      <section className="mx-auto max-w-7xl px-4 py-24 sm:px-6 sm:py-28">
        <SectionHead eyebrow="03 — Trading starts here" title="Four things you can *check for yourself*" />
        <Reveal variant="stagger" step={90} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {ABOUT_PROOF.map((t, i) => (
            <Link key={t.title} href={t.href} className="card card-hover group relative isolate flex flex-col overflow-hidden p-7">
              <span className="text-outline pointer-events-none absolute -right-1 -top-4 -z-10 font-display text-8xl font-extrabold leading-none transition-all duration-700 group-hover:[-webkit-text-stroke-color:rgb(var(--brand-rgb)/0.5)]">0{i + 1}</span>
              <t.icon className="h-6 w-6 text-brand-400 transition-transform duration-500 ease-spring group-hover:-rotate-12 group-hover:scale-125" />
              <h3 className="mt-8 font-display text-xl font-bold tracking-tight">{t.title}</h3>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-ink-400">{t.body}</p>
              <span className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-brand-300">
                <span className="link-underline">{t.link}</span>
                <ArrowUpRight className="h-4 w-4 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
              </span>
            </Link>
          ))}
        </Reveal>
      </section>

      {/* regulation + safeguards: both blocks wait for the client */}
      <section className="mx-auto max-w-7xl px-4 pb-24 sm:px-6">
        <SectionHead eyebrow="04 — Regulation and safeguards" title="The part that must be *exactly right*" sub="These statements are published only once the client has confirmed them." />
        <Reveal variant="stagger" step={120} className="grid gap-4 md:grid-cols-2">
          <div className="corners rounded-3xl border border-dashed border-gold/30 bg-gold/[0.03] p-8 sm:p-10">
            <Scale className="h-7 w-7 text-gold" />
            <h3 className="mt-6 font-display text-2xl font-bold tracking-tight">Regulatory commitment</h3>
            <p className="mt-3 text-sm leading-relaxed text-ink-300">Regulatory and legal entity details will be published here once confirmed.</p>
            {pending && <p className="mt-5 font-mono text-xs leading-relaxed text-gold/90">{pending}</p>}
          </div>
          <div className="corners rounded-3xl border border-dashed border-gold/30 bg-gold/[0.03] p-8 sm:p-10">
            <Landmark className="h-7 w-7 text-gold" />
            <h3 className="mt-6 font-display text-2xl font-bold tracking-tight">Segregated client funds</h3>
            <p className="mt-3 text-sm leading-relaxed text-ink-300">Client money is held separately from company funds.</p>
            <p className="mt-5 font-mono text-xs leading-relaxed text-gold/90">[PLACEHOLDER - confirm wording]</p>
            {/* two vaults that never touch */}
            <div className="mt-7 grid grid-cols-[1fr_auto_1fr] items-center gap-3" aria-hidden>
              <div className="rounded-xl border border-brand-400/25 bg-brand-400/[0.07] p-3">
                <div className="label !text-brand-300">Client funds</div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                  <div className="grow-x h-full rounded-full bg-gradient-to-r from-brand-500 to-brand-300" style={vars({ '--d': '400ms' })} />
                </div>
              </div>
              <LockKeyhole className="h-4 w-4 text-ink-400" />
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                <div className="label">Company funds</div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                  <div className="grow-x h-full w-3/5 rounded-full bg-ink-500" style={vars({ '--d': '550ms' })} />
                </div>
              </div>
            </div>
          </div>
        </Reveal>
      </section>

      <CtaBand />
    </>
  );
}

// ---------------------------------------------------------------- contact
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function Contact({ copy }: { copy: ContentCopy }) {
  const [text, pending] = splitPlaceholder(copy.paragraphs[0]);
  // "Support: support@[domain] - 24/5 live chat from the client area."
  const email = text.match(/\S+@\S+/)?.[0] ?? 'support@[domain]';
  return (
    <>
      <Hero eyebrow="Contact us" title="Talk to *real people*" lead={<p>{text}</p>}>
        <div className="relative mx-auto flex h-[380px] w-full max-w-[460px] items-center justify-center" aria-hidden>
          {[0, 1, 2, 3].map((i) => (
            <span key={i} className="absolute h-40 w-40 animate-pulse-ring rounded-full border border-brand-400/40" style={{ animationDelay: `${i * 0.65}s` }} />
          ))}
          <span className="relative flex h-28 w-28 items-center justify-center rounded-[2rem] bg-gradient-to-b from-brand-300 to-brand-600 text-ink-950 shadow-glow">
            <Headset className="h-12 w-12" />
          </span>
          <div className="glass animate-float absolute left-0 top-10 rounded-2xl rounded-bl-md px-4 py-2.5 text-sm font-medium shadow-lift">How can we help?</div>
          <div className="glass animate-float-slow absolute bottom-16 right-0 flex items-center gap-1 rounded-2xl rounded-br-md px-4 py-3.5 shadow-lift">
            {[0, 1, 2].map((i) => (
              <span key={i} className="h-1.5 w-1.5 animate-bounce rounded-full bg-brand-300" style={{ animationDelay: `${i * 0.15}s` }} />
            ))}
          </div>
          <div className="absolute inset-x-6 bottom-0 grid grid-cols-7 gap-1.5">
            {DAYS.map((d, i) => (
              <div key={d} className="text-center">
                <span className={cn('grow-y block h-6 rounded-md', i < 5 ? 'bg-brand-400' : 'bg-white/[0.07]')} style={vars({ '--d': `${700 + i * 70}ms` })} />
                <span className="mt-1.5 block font-mono text-[9px] uppercase text-ink-500">{d}</span>
              </div>
            ))}
          </div>
        </div>
      </Hero>

      <section className="mx-auto max-w-7xl px-4 pb-24 sm:px-6 sm:pb-28">
        <Reveal variant="stagger" step={90} className="grid gap-4 md:grid-cols-2">
          <Spotlight className="card card-hover corners group overflow-hidden p-8">
            <ChannelIcon icon={Mail} />
            <div className="label mt-8">Email support</div>
            <div className="mt-2 break-all font-display text-3xl font-bold tracking-tight sm:text-4xl">{email}</div>
            <p className="mt-3 text-sm text-ink-400">For anything you would rather put in writing.</p>
          </Spotlight>

          <Spotlight className="card card-hover corners group overflow-hidden p-8">
            <div className="flex items-start justify-between">
              <ChannelIcon icon={MessageCircle} />
              <span className="inline-flex items-center gap-2 rounded-full bg-up/10 px-3 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-up ring-1 ring-inset ring-up/30">
                <span className="live-dot !h-1.5 !w-1.5" /> 24/5
              </span>
            </div>
            <div className="label mt-8">Live chat</div>
            <div className="mt-2 font-display text-3xl font-bold tracking-tight sm:text-4xl">From the client area</div>
            <Link href="/login" className="group/l mt-4 inline-flex items-center gap-2 text-sm font-medium text-brand-300">
              <span className="link-underline">Open the client area</span>
              <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover/l:translate-x-1" />
            </Link>
          </Spotlight>

        </Reveal>

        {/* phone lines and office: all waiting on the client */}
        <div className="mt-16">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
            <Reveal variant="stagger">
              <span className="eyebrow">International support</span>
              <h2 className="mt-4 font-display text-3xl font-bold tracking-tight sm:text-4xl">
                Prefer to <span className="accent text-4xl sm:text-5xl">call?</span>
              </h2>
            </Reveal>
            {pending && (
              <Reveal variant="fade" delay={200}>
                <Pending>{pending}</Pending>
              </Reveal>
            )}
          </div>
          <Reveal variant="stagger" step={90} className="grid gap-4 md:grid-cols-3">
            {[
              { icon: Globe, label: 'International line', note: 'One number that reaches the support desk from anywhere.', mark: '[PLACEHOLDER - international support number]' },
              { icon: PhoneCall, label: 'Local numbers', note: 'Country lines, listed here with their hours.', mark: '[PLACEHOLDER - local support numbers by country]' },
              { icon: Building2, label: 'Online broker', note: 'Every account matter is handled from the client area and by email. There is no walk-in office.', mark: '[PLACEHOLDER - support hours by region]' },
            ].map((c) => (
              <div key={c.label} className="group rounded-[1.25rem] border border-dashed border-white/12 p-7 transition-colors duration-300 hover:border-white/25">
                <ChannelIcon icon={c.icon} muted />
                <div className="mt-7 font-display text-xl font-bold tracking-tight">{c.label}</div>
                <p className="mt-1.5 text-sm text-ink-400">{c.note}</p>
                <Pending className="mt-4">{c.mark}</Pending>
              </div>
            ))}
          </Reveal>
        </div>

        {/* contact form: drawn but switched off until the support endpoint exists */}
        <Reveal variant="scale" className="mt-16">
          <div className="card corners overflow-hidden">
            <div className="grid lg:grid-cols-[1fr_1.25fr]">
              <div className="border-b border-white/[0.06] p-8 sm:p-10 lg:border-b-0 lg:border-r">
                <span className="eyebrow">Write to us</span>
                <h2 className="mt-5 font-display text-3xl font-bold tracking-tight sm:text-4xl">
                  Send a <span className="accent text-4xl sm:text-5xl">message</span>
                </h2>
                <p id="contact-form-note" className="mt-4 text-sm leading-relaxed text-ink-400">
                  This form will open a support ticket that you can follow from your client area. It is switched off until the support desk is live, so please use email or live chat for now.
                </p>
                <Pending className="mt-5">[PLACEHOLDER - contact form goes live with the support desk]</Pending>
                <div className="mt-9">
                  <div className="label mb-3">Or find it in the FAQ</div>
                  <div className="flex flex-wrap gap-2">
                    {FAQ_TOPICS.map((t) => (
                      <Link
                        key={t.id}
                        href={`/faq#topic-${t.id}`}
                        className="group/t inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-ink-200 transition-colors duration-300 hover:border-brand-400/40 hover:text-white"
                      >
                        <t.icon className="h-3.5 w-3.5 text-ink-500 transition-colors group-hover/t:text-brand-300" />
                        {t.label}
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
              <fieldset disabled aria-describedby="contact-form-note" className="bg-dots grid content-start gap-4 p-8 opacity-55 sm:grid-cols-2 sm:p-10">
                <legend className="sr-only">Contact form (not available yet)</legend>
                <Input label="Full name" name="name" autoComplete="off" />
                <Input label="Email" name="email" type="email" autoComplete="off" />
                <div className="sm:col-span-2">
                  <Select label="Topic" name="topic" defaultValue="">
                    <option value="" disabled>
                      Choose a topic
                    </option>
                    {FAQ_TOPICS.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.label}
                      </option>
                    ))}
                  </Select>
                </div>
                <label className="block sm:col-span-2">
                  <span className="label mb-1.5 block">Message</span>
                  <textarea name="message" rows={5} className="w-full resize-none rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-3 text-sm text-ink-100" />
                </label>
                <Button type="button" disabled size="lg" variant="secondary" className="sm:col-span-2">
                  Sending is not available yet
                </Button>
              </fieldset>
            </div>
          </div>
        </Reveal>

        <Reveal className="mt-4">
          <Link href="/faq" className="card card-hover group flex flex-wrap items-center justify-between gap-4 p-6 sm:px-8">
            <span className="font-display text-xl font-semibold tracking-tight">
              In a hurry? The answer may already be in the <span className="accent text-2xl">FAQ</span>
            </span>
            <span className="flex h-10 w-10 items-center justify-center rounded-full border border-white/15 transition-all duration-500 ease-spring group-hover:border-brand-400 group-hover:bg-brand-400 group-hover:text-ink-950">
              <ArrowRight className="h-4 w-4" />
            </span>
          </Link>
        </Reveal>
      </section>
    </>
  );
}

function ChannelIcon({ icon: Icon, muted }: { icon: LucideIcon; muted?: boolean }) {
  return (
    <span
      className={cn(
        'flex h-12 w-12 items-center justify-center rounded-2xl ring-1 ring-inset transition-transform duration-500 ease-spring group-hover:-rotate-12 group-hover:scale-110',
        muted ? 'bg-white/[0.04] text-ink-400 ring-white/10' : 'bg-brand-400/10 text-brand-300 ring-brand-400/25',
      )}
    >
      <Icon className="h-6 w-6" />
    </span>
  );
}

// ---------------------------------------------------------------- faq
function Faq({ copy }: { copy: ContentCopy }) {
  // structured data so each answer can surface in search results
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQ_TOPICS.flatMap((t) => t.items.map((it) => ({ '@type': 'Question', name: it.q, acceptedAnswer: { '@type': 'Answer', text: it.a } }))),
  };
  return (
    <>
      <Hero
        eyebrow="FAQ"
        title="Frequently asked *questions*"
        lead={<p>{copy.paragraphs[0]}</p>}
        actions={
          <dl className="flex gap-10">
            {[
              { label: 'Answers', node: <CountUp to={FAQ_COUNT} /> },
              { label: 'Topics', node: <CountUp to={FAQ_TOPICS.length} /> },
            ].map((s) => (
              <div key={s.label} className="border-l border-white/10 pl-4 first:border-l-0 first:pl-0">
                <dt className="tabular font-display text-4xl font-bold tracking-tight">{s.node}</dt>
                <dd className="label mt-1">{s.label}</dd>
              </div>
            ))}
          </dl>
        }
      >
        <div className="relative mx-auto flex h-[340px] w-full max-w-[420px] items-center justify-center" aria-hidden>
          <span className="absolute h-64 w-64 rounded-full bg-brand-500/15 blur-3xl" />
          <span className="animate-float accent font-display text-[19rem] !font-extrabold not-italic leading-none">?</span>
          <span className="text-outline animate-float-slow absolute -right-2 top-2 font-display text-[9rem] font-extrabold leading-none">?</span>
          <span className="text-outline animate-float absolute bottom-0 left-2 font-display text-[6rem] font-extrabold leading-none [animation-delay:-3s]">?</span>
        </div>
      </Hero>

      <section className="mx-auto max-w-7xl px-4 pb-24 sm:px-6 sm:pb-32">
        <Reveal>
          <FaqExplorer />
        </Reveal>
      </section>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <CtaBand />
    </>
  );
}

// ---------------------------------------------------------------- legal
function Legal({ copy }: { copy: ContentCopy }) {
  const [, pending] = splitPlaceholder(copy.paragraphs[0]);
  const docs = LEGAL_DOCS;
  return (
    <>
      <Hero eyebrow="Legal" title="Legal *documents*" lead={<p>The documents that set out how your account works. Read them online or download the PDF. Read them before you trade.</p>}>
        <div className="relative mx-auto h-[360px] w-full max-w-[420px]" aria-hidden>
          {[
            { rotate: '-11deg', x: -70, delay: '0s' },
            { rotate: '-2deg', x: 0, delay: '-2s' },
            { rotate: '8deg', x: 70, delay: '-4s' },
          ].map((s, i) => (
            <div key={i} className="absolute left-1/2 top-6" style={{ translate: `${s.x - 105}px 0`, rotate: s.rotate, zIndex: i }}>
              <div className="animate-float-slow" style={{ animationDelay: s.delay }}>
                <Sheet lines={[80, 100, 92, 60, 100, 84, 96, 40]} className="h-[290px] w-[210px]" title={docs[i]?.title ?? 'Document'} />
              </div>
            </div>
          ))}
        </div>
      </Hero>

      <section className="mx-auto max-w-7xl px-4 pb-20 sm:px-6">
        <Reveal variant="stagger" step={80} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {docs.map((d, i) => (
            <Spotlight key={d.slug} className="card card-hover group flex gap-5 overflow-hidden p-6 hover:!border-brand-400/40">
              <Sheet lines={[70, 100, 86, 50]} className="h-[104px] w-[78px] shrink-0 transition-transform duration-500 ease-spring group-hover:-translate-y-1 group-hover:-rotate-6" small />
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="flex items-center justify-between gap-2 font-mono text-[10px] text-ink-500">
                  <span>DOC {String(i + 1).padStart(2, '0')}</span>
                  <span className="uppercase tracking-[0.14em]">{d.group}</span>
                </span>
                <h3 className="mt-1 font-display text-xl font-bold leading-tight tracking-tight">{d.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-400">{legalText(d.note, BRAND)}</p>
                <span className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-1 pt-4">
                  <a href={`/legal/${d.slug}.pdf`} download className="label inline-flex items-center gap-2 !text-brand-300 hover:!text-white">
                    <Download className="h-3.5 w-3.5" /> PDF
                  </a>
                  <Link href={`/legal/${d.slug}`} className="inline-flex items-center gap-1.5 text-xs font-medium text-brand-300">
                    <span className="link-underline">Read online</span>
                    <ArrowRight className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-1" />
                  </Link>
                  <span className="ml-auto font-mono text-[10px] text-ink-500">{d.version}</span>
                </span>
              </div>
            </Spotlight>
          ))}
        </Reveal>
        {pending && (
          <Reveal variant="fade" className="mt-6">
            <Pending>{pending}</Pending>
          </Reveal>
        )}
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-6 sm:px-6">
        <Reveal variant="scale" className="corners rounded-3xl border border-dashed border-gold/30 bg-gold/[0.03] p-8 sm:p-12">
          <div className="grid gap-6 md:grid-cols-[auto_1fr] md:gap-10">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gold/10 text-gold ring-1 ring-inset ring-gold/30">
              <Scale className="h-7 w-7" />
            </span>
            <div>
              <h2 className="font-display text-2xl font-bold tracking-tight">Regulation and legal entity</h2>
              <p className="mt-3 max-w-3xl leading-relaxed text-ink-300">Regulatory and legal entity details will be published here once confirmed.</p>
              <Pending className="mt-4">[PLACEHOLDER - regulator, licence number and legal entity name to be supplied]</Pending>
            </div>
          </div>
        </Reveal>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-24 sm:px-6 sm:pb-32">
        <Reveal variant="scale" className="relative overflow-hidden rounded-3xl border border-down/20 bg-down/[0.04] p-8 sm:p-12">
          <div className="grid gap-6 md:grid-cols-[auto_1fr] md:gap-10">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-down/10 text-down ring-1 ring-inset ring-down/30">
              <ShieldAlert className="h-7 w-7" />
            </span>
            <div>
              <h2 className="font-display text-2xl font-bold tracking-tight">Risk warning</h2>
              <p className="mt-3 max-w-3xl leading-relaxed text-ink-300">
                CFDs are complex instruments and come with a high risk of losing money rapidly due to leverage. You should consider whether you understand how CFDs work and whether you can afford to
                take the high risk of losing your money. Past performance is not a reliable indicator of future results.
              </p>
            </div>
          </div>
        </Reveal>
      </section>
    </>
  );
}

/** A paper sheet with a folded corner and ruled lines. */
function Sheet({ lines, className, title, small }: { lines: number[]; className?: string; title?: string; small?: boolean }) {
  return (
    <div className={cn('relative overflow-hidden rounded-xl bg-gradient-to-b from-ink-50 to-ink-200 shadow-lift [clip-path:polygon(0_0,calc(100%-22px)_0,100%_22px,100%_100%,0_100%)]', small && 'rounded-lg [clip-path:polygon(0_0,calc(100%-14px)_0,100%_14px,100%_100%,0_100%)]', className)}>
      <span className={cn('absolute right-0 top-0 bg-ink-300', small ? 'h-[14px] w-[14px]' : 'h-[22px] w-[22px]')} />
      <span className="absolute inset-y-0 left-0 w-1/2 animate-sweep bg-gradient-to-r from-transparent via-paper/80 to-transparent" />
      <div className={cn('relative', small ? 'p-3' : 'p-5')}>
        {title && <div className="mb-4 font-display text-sm font-extrabold leading-tight tracking-tight text-ink-950">{title}</div>}
        <div className={cn(small ? 'space-y-1.5 pt-3' : 'space-y-2.5')}>
          {lines.map((w, i) => (
            <span key={i} className={cn('grow-x block rounded-full bg-ink-400/50', small ? 'h-1' : 'h-1.5')} style={vars({ width: `${w}%`, '--d': `${300 + i * 90}ms` })} />
          ))}
        </div>
        {!small && <span className="mt-6 block h-7 w-20 rounded-md border-2 border-brand-600/70" />}
      </div>
    </div>
  );
}
