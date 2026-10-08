'use client';

import { createElement, Fragment, useEffect, useRef, useState, type CSSProperties, type MouseEvent, type ReactNode } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

/** Motion primitives shared by every surface. CSS lives in globals.css (scroll reveal, marquee, spotlight). */

const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const easeOutQuart = (p: number) => 1 - Math.pow(1 - p, 4);

export function useInView<T extends Element>({ once = true, margin = '0px 0px -8% 0px' }: { once?: boolean; margin?: string } = {}) {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') {
      setInView(true);
      return;
    }
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setInView(true);
          if (once) io.disconnect();
        } else if (!once) setInView(false);
      },
      { rootMargin: margin },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [once, margin]);
  return [ref, inView] as const;
}

// ---------------------------------------------------------------- Reveal
type RevealVariant = 'up' | 'left' | 'right' | 'scale' | 'fade' | 'stagger' | 'none';
type RevealTag = 'div' | 'section' | 'ul' | 'ol' | 'li' | 'span' | 'header' | 'footer' | 'article' | 'aside' | 'p' | 'dl' | 'h1' | 'h2' | 'h3';

export interface RevealProps {
  as?: RevealTag;
  /** `stagger` animates direct children one after another; `none` only flips data-in for .word/.draw/.grow-* descendants. */
  variant?: RevealVariant;
  delay?: number;
  /** ms between staggered children */
  step?: number;
  className?: string;
  style?: CSSProperties;
  id?: string;
  children?: ReactNode;
}

/** Plays its entrance once it scrolls into view. */
export function Reveal({ as = 'div', variant = 'up', delay = 0, step, className, style, id, children }: RevealProps) {
  const [ref, inView] = useInView<HTMLElement>();
  const vars = { '--d': `${delay}ms`, ...(step ? { '--step': `${step}ms` } : null) } as CSSProperties;
  // data-in may already be "true" in the DOM: the inline script in the root layout reveals in-view elements before hydration.
  return createElement(as, { ref, id, 'data-reveal': variant, 'data-in': inView, suppressHydrationWarning: true, className, style: { ...vars, ...style } }, children);
}

/** Headline that rises word by word when a <Reveal> ancestor enters. Wrap a phrase in *asterisks* for the serif accent. */
export function Words({ text, className, delay = 0 }: { text: string; className?: string; delay?: number }) {
  let i = 0;
  return (
    <span className={className} style={{ '--d': `${delay}ms` } as CSSProperties}>
      {text.split('*').map((part, p) =>
        part
          .split(' ')
          .filter(Boolean)
          .map((w, k) => (
            <Fragment key={`${p}-${k}`}>
              <span className="word">
                <span className={p % 2 ? 'accent' : undefined} style={{ '--i': i++ } as CSSProperties}>
                  {w}
                </span>
              </span>{' '}
            </Fragment>
          )),
      )}
    </span>
  );
}

// ---------------------------------------------------------------- numbers
/** Counts from `from` to `to` the first time it is seen. Server-renders the final value. */
export function CountUp({
  to,
  from = 0,
  decimals = 0,
  duration = 1700,
  prefix = '',
  suffix = '',
  className,
}: {
  to: number;
  from?: number;
  decimals?: number;
  duration?: number;
  prefix?: string;
  suffix?: string;
  className?: string;
}) {
  const [ref, inView] = useInView<HTMLSpanElement>();
  const [val, setVal] = useState(to);
  useEffect(() => {
    if (!inView || reducedMotion()) return;
    let raf = 0;
    const t0 = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / duration);
      setVal(from + (to - from) * easeOutQuart(p));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    setVal(from);
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, to, from, duration]);
  return (
    <span ref={ref} className={cn('tabular', className)}>
      {prefix}
      {val.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}
      {suffix}
    </span>
  );
}

const money = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Live value: tweens to each new `value` and flashes green/red in the direction of the change. */
export function AnimatedNumber({
  value,
  format = (n) => money.format(n),
  mountFrom,
  duration = 800,
  flash = true,
  className,
}: {
  value: string | number | null | undefined;
  format?: (n: number) => string;
  /** start value for the first render (e.g. 0 to count up on mount) */
  mountFrom?: number;
  duration?: number;
  flash?: boolean;
  className?: string;
}) {
  const target = value === null || value === undefined || value === '' ? NaN : Number(value);
  const [shown, setShown] = useState(Number.isFinite(target) ? (mountFrom ?? target) : NaN);
  const current = useRef(shown);
  const settled = useRef(mountFrom === undefined);
  const [pulse, setPulse] = useState<{ dir: 'up' | 'down'; n: number } | null>(null);

  useEffect(() => {
    if (!Number.isFinite(target)) {
      current.current = NaN;
      setShown(NaN);
      return;
    }
    const from = Number.isFinite(current.current) ? current.current : target;
    if (from === target || reducedMotion()) {
      current.current = target;
      setShown(target);
      settled.current = true;
      return;
    }
    if (flash && settled.current) setPulse((p) => ({ dir: target > from ? 'up' : 'down', n: (p?.n ?? 0) + 1 }));
    settled.current = true;
    let raf = 0;
    const t0 = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / duration);
      current.current = from + (target - from) * easeOutQuart(p);
      setShown(current.current);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration, flash]);

  return (
    <span key={pulse?.n ?? 0} className={cn('tabular', pulse && (pulse.dir === 'up' ? 'animate-flash-up' : 'animate-flash-down'), className)}>
      {Number.isFinite(shown) ? format(shown) : '—'}
    </span>
  );
}

// ---------------------------------------------------------------- pointer
type BoxTag = 'div' | 'li' | 'article' | 'section';

/** Adds a cursor-following glow (see .spotlight). Renders a <Link> when `href` is set. Set `--spot` to an "r g b" triplet to recolour. */
export function Spotlight({
  as = 'div',
  href,
  className,
  style,
  children,
  id,
}: {
  as?: BoxTag;
  href?: string;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
  id?: string;
}) {
  const onMouseMove = (e: MouseEvent<HTMLElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty('--mx', `${e.clientX - r.left}px`);
    e.currentTarget.style.setProperty('--my', `${e.clientY - r.top}px`);
  };
  const props = { id, className: cn('spotlight', className), style, onMouseMove };
  return href ? (
    <Link href={href} {...props}>
      {children}
    </Link>
  ) : (
    createElement(as, props, children)
  );
}

/** 3D tilt toward the cursor. `rest` is the transform applied while idle. */
export function Tilt({ max = 6, rest = '', className, children }: { max?: number; rest?: string; className?: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const onMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el || reducedMotion()) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    el.style.transform = `perspective(1200px) rotateX(${(-py * max).toFixed(2)}deg) rotateY(${(px * max).toFixed(2)}deg)`;
  };
  const onMouseLeave = () => {
    if (ref.current) ref.current.style.transform = rest;
  };
  return (
    <div
      ref={ref}
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
      style={{ transform: rest, transformStyle: 'preserve-3d' }}
      className={cn('transition-transform duration-500 ease-out will-change-transform', className)}
    >
      {children}
    </div>
  );
}

// ---------------------------------------------------------------- loops
/** Seamless horizontal loop; children are rendered twice. */
export function Marquee({
  children,
  duration = 40,
  reverse,
  pauseOnHover = true,
  className,
}: {
  children: ReactNode;
  duration?: number;
  reverse?: boolean;
  pauseOnHover?: boolean;
  className?: string;
}) {
  return (
    <div className={cn('marquee', className)} data-reverse={reverse ? 'true' : undefined} data-pause={pauseOnHover ? 'true' : undefined} style={{ '--marquee-dur': `${duration}s` } as CSSProperties}>
      <div className="marquee-track">
        <div className="flex shrink-0 items-center">{children}</div>
        <div className="flex shrink-0 items-center" aria-hidden>
          {children}
        </div>
      </div>
    </div>
  );
}

/** Cycles through words in place (each one pops in). */
export function RotatingWords({ words, interval = 2200, className }: { words: string[]; interval?: number; className?: string }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (reducedMotion() || words.length < 2) return;
    const t = setInterval(() => setI((v) => (v + 1) % words.length), interval);
    return () => clearInterval(t);
  }, [words.length, interval]);
  return (
    <span className={cn('inline-grid', className)}>
      <span key={i} className="animate-pop-in col-start-1 row-start-1">
        {words[i]}
      </span>
      {/* widest word reserves the space so the line never jumps */}
      <span className="invisible col-start-1 row-start-1" aria-hidden>
        {words.reduce((a, b) => (b.length > a.length ? b : a), '')}
      </span>
    </span>
  );
}

/** Thin reading-progress bar pinned to the top of the viewport. */
export function ScrollProgress({ className }: { className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let raf = 0;
    const update = () => {
      raf = 0;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      if (ref.current) ref.current.style.transform = `scaleX(${max > 0 ? Math.min(1, window.scrollY / max) : 0})`;
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);
  return (
    <div
      ref={ref}
      aria-hidden
      style={{ transform: 'scaleX(0)' }}
      className={cn('pointer-events-none fixed inset-x-0 top-0 z-[60] h-0.5 origin-left bg-gradient-to-r from-brand-500 via-brand-300 to-volt', className)}
    />
  );
}
