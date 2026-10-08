import Link from 'next/link';
import type { CSSProperties } from 'react';
import { ArrowRight } from 'lucide-react';
import { buttonClass } from '@/lib/button';
import { MARKET_LIST } from '@/lib/markets';
import { Reveal, Words } from '@/components/motion';

const CRASH = 'M0 210 L70 188 L130 200 L210 150 L270 164 L350 104 L410 122 L480 62 L530 78 L575 40 L640 330';

/** 404 told as a chart: the line climbs, then falls off the page; the digits glitch like a bad tick. */
export default function NotFound() {
  return (
    <section className="noise relative overflow-hidden pt-32 sm:pt-40">
      <div className="bg-grid absolute inset-0" />
      <div className="aurora-blob -top-40 left-1/2 h-[460px] w-[760px] -translate-x-1/2 bg-down/10" />
      <Reveal variant="none" className="relative mx-auto max-w-5xl px-4 pb-28 text-center sm:px-6 sm:pb-36">
        <div className="relative mx-auto w-fit">
          <svg viewBox="0 0 640 340" className="absolute inset-x-[-8%] top-[8%] h-[84%] w-[116%] overflow-visible" fill="none" aria-hidden>
            <defs>
              <linearGradient id="crash-line" x1="0" x2="1">
                <stop stopColor="var(--color-brand-400)" stopOpacity="0" />
                <stop offset="0.55" stopColor="var(--color-brand-400)" />
                <stop offset="0.9" stopColor="var(--color-down)" />
              </linearGradient>
            </defs>
            <path d={CRASH} pathLength={1} stroke="url(#crash-line)" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" className="draw" style={{ '--d': '500ms', animationDuration: '2.4s' } as CSSProperties} />
            <circle cx="640" cy="330" r="7" fill="var(--color-down)" className="crash-dot" />
          </svg>
          <div className="relative select-none font-display text-[clamp(9rem,36vw,25rem)] font-extrabold leading-[0.85] tracking-tighter">
            <span className="text-outline [-webkit-text-stroke-color:rgb(var(--tint)/0.35)]">404</span>
            <span aria-hidden className="glitch absolute inset-0 text-brand-400">
              404
            </span>
            <span aria-hidden className="glitch absolute inset-0 text-down [animation-delay:-1.7s]">
              404
            </span>
          </div>
        </div>

        <p className="mt-8 font-mono text-sm text-ink-400">
          &gt; symbol not found<span className="animate-blink text-brand-300">_</span>
        </p>
        <h1 className="mt-4 font-display text-4xl font-extrabold tracking-tighter sm:text-6xl">
          <Words text="This market *isn't listed*" delay={200} />
        </h1>
        <Reveal delay={600}>
          <p className="mx-auto mt-5 max-w-md text-lg text-ink-300">The page you were after has moved or never existed. These ones are open for trading.</p>
        </Reveal>

        <Reveal variant="stagger" step={60} delay={750} className="mt-8 flex flex-wrap justify-center gap-2">
          {MARKET_LIST.map((m) => (
            <Link
              key={m.slug}
              href={`/${m.slug}`}
              style={{ '--c': m.rgb } as CSSProperties}
              className="group inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-sm text-ink-200 transition-all duration-300 hover:-translate-y-0.5 hover:border-[rgb(var(--c)/0.5)] hover:bg-[rgb(var(--c)/0.08)] hover:text-white"
            >
              <m.icon className="h-4 w-4 text-[rgb(var(--c))] transition-transform duration-500 ease-spring group-hover:-rotate-12 group-hover:scale-125" />
              {m.label}
            </Link>
          ))}
        </Reveal>

        <Reveal delay={1000} className="mt-10">
          <Link href="/" className={buttonClass('primary', 'lg', 'group h-14 rounded-2xl px-8')}>
            Back to home <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
          </Link>
        </Reveal>
      </Reveal>
    </section>
  );
}
