'use client';

import { useMemo, useState } from 'react';
import { Hash, Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TERMS, termId, type Term } from '@/components/education/glossary-data';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

/** Wraps the matched part of a term in <mark>. */
function Hit({ text, needle }: { text: string; needle: string }) {
  const at = needle ? text.toLowerCase().indexOf(needle) : -1;
  if (at < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, at)}
      <mark className="rounded bg-brand-400/25 px-0.5 text-brand-100">{text.slice(at, at + needle.length)}</mark>
      {text.slice(at + needle.length)}
    </>
  );
}

/** Searchable A-Z glossary. Every term is rendered on the server, so #anchors work without JS. */
export function GlossaryBrowser() {
  const [q, setQ] = useState('');
  const [letter, setLetter] = useState<string | null>(null);
  const needle = q.trim().toLowerCase();

  const matches = useMemo(() => TERMS.filter((t) => !needle || t.term.toLowerCase().includes(needle) || t.def.toLowerCase().includes(needle)), [needle]);
  const lit = useMemo(() => new Set(matches.map((t) => t.term[0].toUpperCase())), [matches]);
  const shown = letter ? matches.filter((t) => t.term[0].toUpperCase() === letter) : matches;
  const groups = useMemo(() => {
    const by = new Map<string, Term[]>();
    for (const t of shown) by.set(t.term[0].toUpperCase(), [...(by.get(t.term[0].toUpperCase()) ?? []), t]);
    return [...by.entries()];
  }, [shown]);

  const reset = () => {
    setQ('');
    setLetter(null);
  };

  return (
    <div>
      {/* toolbar */}
      <div className="glass sticky top-20 z-30 rounded-3xl p-3 shadow-lift">
        <div className="flex flex-wrap items-center gap-3">
          <label className="group/field relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400 transition-colors group-focus-within/field:text-brand-300" />
            <input
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setLetter(null);
              }}
              placeholder="Search a term or a word in its definition"
              aria-label="Search the glossary"
              className="h-12 w-full rounded-2xl border border-white/10 bg-white/[0.03] pl-11 pr-11 text-sm text-ink-100 placeholder:text-ink-500 transition-[border-color,box-shadow] duration-300 focus:border-brand-400/70 focus:outline-none focus:ring-4 focus:ring-brand-400/15"
            />
            {q && (
              <button onClick={() => setQ('')} aria-label="Clear search" className="absolute right-3 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-ink-200 transition-colors hover:bg-white/20">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </label>
          <span className="tabular px-2 font-mono text-xs text-ink-400" aria-live="polite">
            <span className="text-white">{shown.length}</span> / {TERMS.length} terms
          </span>
        </div>
        <div className="mt-3 flex gap-1 overflow-x-auto pb-0.5 [scrollbar-width:none]" role="group" aria-label="Filter by first letter">
          <button
            onClick={() => setLetter(null)}
            className={cn('shrink-0 rounded-lg px-2.5 py-1.5 font-mono text-[11px] transition-all duration-300', !letter ? 'bg-white text-ink-950' : 'bg-white/[0.04] text-ink-300 hover:bg-white/[0.08] hover:text-white')}
          >
            All
          </button>
          {ALPHABET.map((l) => {
            const on = lit.has(l);
            return (
              <button
                key={l}
                disabled={!on}
                onClick={() => setLetter(letter === l ? null : l)}
                aria-pressed={letter === l}
                className={cn(
                  'h-8 w-8 shrink-0 rounded-lg font-mono text-[11px] transition-all duration-300',
                  letter === l ? 'bg-brand-400 font-bold text-ink-950 shadow-glow' : on ? 'bg-white/[0.04] text-ink-200 hover:-translate-y-0.5 hover:bg-brand-400/15 hover:text-brand-300' : 'text-ink-600',
                )}
              >
                {l}
              </button>
            );
          })}
        </div>
      </div>

      {/* results */}
      {groups.length === 0 ? (
        <div className="animate-pop-in bg-dots mt-8 flex flex-col items-center gap-4 rounded-3xl border border-dashed border-white/10 px-6 py-20 text-center">
          <span className="text-outline font-display text-7xl font-extrabold leading-none">?</span>
          <p className="text-ink-300">
            No term matches <span className="font-mono text-white">“{q.trim()}”</span>.
          </p>
          <button onClick={reset} className="text-sm font-medium text-brand-300">
            <span className="link-underline">Show every term</span>
          </button>
        </div>
      ) : (
        <div key={`${letter}-${needle}`} className="mt-10 space-y-12">
          {groups.map(([l, terms], g) => (
            <section key={l} className="grid gap-4 md:grid-cols-[110px_1fr]" aria-labelledby={`letter-${l}`}>
              <div className="md:sticky md:top-56 md:self-start">
                <h2 id={`letter-${l}`} className="text-outline animate-page-in font-display text-7xl font-extrabold leading-none [-webkit-text-stroke-color:rgb(var(--brand-rgb)/0.5)] md:text-8xl" style={{ animationDelay: `${Math.min(g, 6) * 60}ms` }}>
                  {l}
                </h2>
                <p className="label mt-2">
                  {terms.length} {terms.length === 1 ? 'term' : 'terms'}
                </p>
              </div>
              <div className="grid gap-px overflow-hidden rounded-3xl border border-white/[0.07] bg-white/[0.07] sm:grid-cols-2">
                {terms.map((t, n) => (
                  <article
                    key={t.term}
                    id={termId(t.term)}
                    className="animate-page-in group scroll-mt-60 bg-ink-950 p-6 sm:[&:last-child:nth-child(odd)]:col-span-2 transition-colors duration-500 hover:bg-ink-900 target:bg-brand-400/[0.08]"
                    style={{ animationDelay: `${Math.min(g * 2 + n, 12) * 45}ms` }}
                  >
                    <h3 className="flex items-center justify-between gap-3 font-display text-xl font-bold tracking-tight transition-colors duration-300 group-hover:text-brand-300">
                      <span>
                        <Hit text={t.term} needle={needle} />
                      </span>
                      <a href={`#${termId(t.term)}`} aria-label={`Link to ${t.term}`} className="text-ink-600 opacity-0 transition-all duration-300 hover:text-brand-300 focus:opacity-100 group-hover:opacity-100">
                        <Hash className="h-4 w-4" />
                      </a>
                    </h3>
                    <p className="mt-2.5 text-sm leading-relaxed text-ink-400 transition-colors duration-300 group-hover:text-ink-200">{t.def}</p>
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

const FLASH = ['Spread', 'Leverage', 'Margin', 'Pip', 'Stop loss', 'Swap', 'Equity', 'Slippage'];

/** Hero card that keeps flipping to another definition. */
export function TermFlash() {
  const picks = useMemo(() => FLASH.map((name) => TERMS.find((t) => t.term === name)).filter((t): t is Term => !!t), []);
  const [n, setN] = useState(0);
  const t = picks[n % picks.length];
  return (
    <div className="relative mx-auto max-w-md">
      <div className="absolute -inset-8 -z-10 rounded-[3rem] bg-brand-500/15 blur-3xl" />
      {/* the stack behind the top card */}
      <div className="absolute inset-x-6 -bottom-5 h-full rounded-3xl border border-white/[0.06] bg-ink-900/60" />
      <div className="absolute inset-x-3 -bottom-2.5 h-full rounded-3xl border border-white/[0.07] bg-ink-900/80" />
      <button
        onClick={() => setN((v) => v + 1)}
        className="beam card-solid corners relative block w-full overflow-hidden rounded-3xl p-8 text-left"
        aria-label="Show another term"
      >
        <span className="edu-progress absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-brand-500 to-volt [animation-duration:5s]" onAnimationIteration={() => setN((v) => v + 1)} />
        <span className="flex items-center justify-between">
          <span className="label">
            {String((n % picks.length) + 1).padStart(2, '0')} / {String(picks.length).padStart(2, '0')}
          </span>
          <span className="label !text-brand-300">noun</span>
        </span>
        <span key={t.term} className="animate-pop-in mt-8 block">
          <span className="block font-serif text-6xl italic leading-none text-white">{t.term}</span>
          <span className="mt-6 block min-h-[7.5rem] text-base leading-relaxed text-ink-300">{t.def}</span>
        </span>
        <span className="label mt-4 block">Tap for another</span>
      </button>
    </div>
  );
}
