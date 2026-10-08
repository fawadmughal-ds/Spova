'use client';

import Link from 'next/link';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, Check, Link2, Plus, Search, SearchX, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Pending } from '@/components/marketing/page-hero';
import { FAQ_COUNT, FAQ_TOPICS, faqSlug, type FaqItem } from '@/components/marketing/company-faq-data';

interface Row extends FaqItem {
  id: string;
  topicId: string;
  topicLabel: string;
}

const ALL: Row[] = FAQ_TOPICS.flatMap((t) => t.items.map((it) => ({ ...it, id: faqSlug(it.q), topicId: t.id, topicLabel: t.label })));

/** Wraps the matched part of `text` so search hits are easy to spot. */
function Highlight({ text, query }: { text: string; query: string }) {
  const i = query ? text.toLowerCase().indexOf(query) : -1;
  if (i < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, i)}
      <mark className="rounded bg-brand-400/25 px-0.5 text-white">{text.slice(i, i + query.length)}</mark>
      {text.slice(i + query.length)}
    </>
  );
}

/**
 * Topic rail + search + accordion. The URL hash always points at the open question
 * (or `#topic-<id>`), so any answer can be linked to directly.
 */
export function FaqExplorer() {
  const [topic, setTopic] = useState(FAQ_TOPICS[0].id);
  const [open, setOpen] = useState<string | null>(ALL[0].id);
  const [query, setQuery] = useState('');
  const [copied, setCopied] = useState<string | null>(null);
  const tabs = useRef<Record<string, HTMLButtonElement | null>>({});
  const input = useRef<HTMLInputElement>(null);
  const [pill, setPill] = useState({ left: 0, top: 0, width: 0, height: 0 });

  const q = query.trim().toLowerCase();
  const rows = useMemo(() => (q ? ALL.filter((r) => r.q.toLowerCase().includes(q) || r.a.toLowerCase().includes(q)) : ALL.filter((r) => r.topicId === topic)), [q, topic]);
  const active = FAQ_TOPICS.find((t) => t.id === topic) ?? FAQ_TOPICS[0];

  // slide the marker to the active topic (vertical rail on desktop, horizontal strip on mobile)
  useLayoutEffect(() => {
    const place = () => {
      const el = tabs.current[topic];
      if (el) setPill({ left: el.offsetLeft, top: el.offsetTop, width: el.offsetWidth, height: el.offsetHeight });
    };
    place();
    window.addEventListener('resize', place);
    return () => window.removeEventListener('resize', place);
  }, [topic]);

  // deep links: #<question-slug> or #topic-<id>
  useEffect(() => {
    const fromHash = () => {
      const hash = decodeURIComponent(window.location.hash.slice(1));
      if (!hash) return;
      if (hash.startsWith('topic-')) {
        const t = FAQ_TOPICS.find((x) => x.id === hash.slice(6));
        if (t) {
          setQuery('');
          setTopic(t.id);
          setOpen(faqSlug(t.items[0].q));
          requestAnimationFrame(() => document.getElementById('faq-explorer')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
        }
        return;
      }
      const row = ALL.find((r) => r.id === hash);
      if (!row) return;
      setQuery('');
      setTopic(row.topicId);
      setOpen(row.id);
      // wait for the topic's list to render before scrolling to the item
      setTimeout(() => document.getElementById(row.id)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 80);
    };
    fromHash();
    window.addEventListener('hashchange', fromHash);
    return () => window.removeEventListener('hashchange', fromHash);
  }, []);

  // "/" focuses the search box
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (e.key === '/' && el?.tagName !== 'INPUT' && el?.tagName !== 'TEXTAREA') {
        e.preventDefault();
        input.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const pickTopic = (id: string) => {
    setQuery('');
    setTopic(id);
    const first = FAQ_TOPICS.find((t) => t.id === id)?.items[0];
    setOpen(first ? faqSlug(first.q) : null);
    window.history.replaceState(null, '', `#topic-${id}`);
  };
  const toggle = (id: string) => {
    const next = open === id ? null : id;
    setOpen(next);
    window.history.replaceState(null, '', next ? `#${next}` : window.location.pathname);
  };
  const copyLink = async (id: string) => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${window.location.pathname}#${id}`);
      setCopied(id);
      setTimeout(() => setCopied((c) => (c === id ? null : c)), 1800);
    } catch {
      /* clipboard unavailable: the hash in the address bar already is the link */
    }
  };

  return (
    <div id="faq-explorer" className="grid scroll-mt-28 gap-8 lg:grid-cols-[300px_1fr] lg:gap-10">
      {/* topics */}
      <div className="min-w-0 lg:sticky lg:top-28 lg:self-start">
        <p className="label mb-3 px-1">Topics</p>
        <div className={cn('relative flex gap-1 overflow-x-auto pb-1 transition-opacity duration-300 [scrollbar-width:none] lg:flex-col lg:overflow-visible lg:pb-0', q && 'opacity-45')}>
          <span
            aria-hidden
            className={cn('absolute rounded-2xl bg-brand-400/[0.1] ring-1 ring-inset ring-brand-400/30 transition-all duration-500 ease-out-expo', q && 'opacity-0')}
            style={{ left: pill.left, top: pill.top, width: pill.width, height: pill.height }}
          />
          {FAQ_TOPICS.map((t) => {
            const on = t.id === topic && !q;
            return (
              <button
                key={t.id}
                ref={(el) => {
                  tabs.current[t.id] = el;
                }}
                onClick={() => pickTopic(t.id)}
                aria-pressed={on}
                className={cn('group relative flex shrink-0 items-center gap-3 rounded-2xl px-3.5 py-3 text-left transition-colors duration-300', on ? 'text-white' : 'text-ink-300 hover:text-white')}
              >
                <t.icon className={cn('h-4 w-4 shrink-0 transition-all duration-500 ease-spring group-hover:-rotate-12 group-hover:scale-125', on ? 'text-brand-300' : 'text-ink-500')} />
                <span className="whitespace-nowrap text-sm font-medium lg:flex-1">{t.label}</span>
                <span className={cn('tabular font-mono text-[10px] transition-colors', on ? 'text-brand-300' : 'text-ink-500')}>{String(t.items.length).padStart(2, '0')}</span>
              </button>
            );
          })}
        </div>

        <div className="card corners mt-6 hidden overflow-hidden p-6 lg:block">
          <h2 className="font-display text-xl font-bold tracking-tight">Still have a question?</h2>
          <p className="mt-2 text-sm leading-relaxed text-ink-400">Support is on live chat 24/5 from the client area, or by email.</p>
          <Link href="/contact-us" className="group mt-4 inline-flex items-center gap-2 text-sm font-medium text-brand-300">
            <span className="link-underline">Contact support</span>
            <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
          </Link>
        </div>
      </div>

      {/* search + answers */}
      <div className="min-w-0">
        <label className="group relative block">
          <Search className="pointer-events-none absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-400 transition-colors group-focus-within:text-brand-300" />
          <input
            ref={input}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Search all ${FAQ_COUNT} answers`}
            aria-label="Search the FAQ"
            className="h-14 w-full rounded-2xl border border-white/10 bg-white/[0.03] pl-14 pr-24 text-base text-white placeholder:text-ink-500 transition-[border-color,box-shadow,background-color] duration-300 hover:border-white/20 focus:border-brand-400/60 focus:bg-ink-900 focus:outline-none focus:ring-4 focus:ring-brand-400/15 [&::-webkit-search-cancel-button]:hidden"
          />
          {query ? (
            <button type="button" onClick={() => setQuery('')} aria-label="Clear search" className="absolute right-4 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-white/[0.07] text-ink-200 transition-colors hover:bg-white/15 hover:text-white">
              <X className="h-4 w-4" />
            </button>
          ) : (
            <kbd className="pointer-events-none absolute right-5 top-1/2 hidden -translate-y-1/2 rounded-md border border-white/10 bg-white/[0.04] px-2 py-0.5 font-mono text-[11px] text-ink-400 sm:block">/</kbd>
          )}
        </label>

        <div className="mb-5 mt-7 flex flex-wrap items-end justify-between gap-3" aria-live="polite">
          {q ? (
            <h2 className="font-display text-2xl font-bold tracking-tight">
              {rows.length} {rows.length === 1 ? 'answer' : 'answers'} for <span className="accent text-3xl">&ldquo;{query.trim()}&rdquo;</span>
            </h2>
          ) : (
            <div key={active.id} className="animate-page-in">
              <h2 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">{active.label}</h2>
              <p className="mt-1 text-sm text-ink-400">{active.blurb}</p>
            </div>
          )}
          <span className="label">{q ? 'all topics' : `${rows.length} questions`}</span>
        </div>

        {rows.length === 0 ? (
          <div className="bg-dots animate-pop-in flex flex-col items-center gap-4 rounded-2xl border border-dashed border-white/10 px-6 py-16 text-center">
            <SearchX className="h-8 w-8 text-ink-500" />
            <p className="max-w-sm text-ink-300">Nothing matches that yet. Try a single word such as &ldquo;withdraw&rdquo; or &ldquo;margin&rdquo;, or ask support directly.</p>
            <Link href="/contact-us" className="group inline-flex items-center gap-2 text-sm font-medium text-brand-300">
              <span className="link-underline">Contact support</span>
              <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
            </Link>
          </div>
        ) : (
          <ul key={q ? `s-${q}` : topic} className="space-y-3">
            {rows.map((it, i) => {
              const on = open === it.id;
              return (
                <li
                  key={it.id}
                  id={it.id}
                  style={{ animationDelay: `${Math.min(i, 10) * 45}ms` }}
                  className={cn(
                    'card animate-page-in scroll-mt-32 overflow-hidden transition-[border-color,box-shadow,background-color] duration-500',
                    on ? 'border-brand-400/35 shadow-[0_30px_80px_-50px_rgb(var(--brand-rgb)/0.7)]' : 'hover:border-white/15',
                  )}
                >
                  <h3>
                    <button onClick={() => toggle(it.id)} aria-expanded={on} aria-controls={`${it.id}-panel`} className="group flex w-full items-center gap-4 p-5 text-left sm:gap-5 sm:p-6">
                      <span className={cn('tabular font-mono text-xs transition-colors duration-300', on ? 'text-brand-300' : 'text-ink-500')}>{String(i + 1).padStart(2, '0')}</span>
                      <span className="min-w-0 flex-1">
                        {q && <span className="label mb-1 block !text-brand-300/80">{it.topicLabel}</span>}
                        <span className={cn('block font-display text-lg font-semibold tracking-tight transition-colors duration-300 sm:text-xl', on ? 'text-white' : 'text-ink-100 group-hover:text-white')}>
                          <Highlight text={it.q} query={q} />
                        </span>
                      </span>
                      <span
                        className={cn(
                          'flex h-9 w-9 shrink-0 items-center justify-center rounded-full border transition-all duration-500 ease-spring',
                          on ? 'rotate-[135deg] border-brand-400 bg-brand-400 text-ink-950' : 'border-white/15 text-ink-300 group-hover:border-brand-400/50 group-hover:text-brand-300',
                        )}
                      >
                        <Plus className="h-4 w-4" />
                      </span>
                    </button>
                  </h3>
                  <div id={`${it.id}-panel`} role="region" className={cn('grid transition-[grid-template-rows] duration-500 ease-out-expo', on ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]')}>
                    <div className="overflow-hidden">
                      <div className={cn('pb-6 pl-5 pr-5 transition-all duration-500 sm:pl-[4.1rem] sm:pr-20', on ? 'translate-y-0 opacity-100' : '-translate-y-2 opacity-0')}>
                        <p className="leading-relaxed text-ink-300">
                          <Highlight text={it.a} query={q} />
                        </p>
                        {it.pending && <Pending className="mt-4">{it.pending}</Pending>}
                        <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-3">
                          {it.link && (
                            <Link href={it.link.href} tabIndex={on ? 0 : -1} className="group/l inline-flex items-center gap-2 text-sm font-medium text-brand-300">
                              <span className="link-underline">{it.link.label}</span>
                              <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover/l:translate-x-1" />
                            </Link>
                          )}
                          <button
                            type="button"
                            onClick={() => void copyLink(it.id)}
                            tabIndex={on ? 0 : -1}
                            className={cn('inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.14em] transition-colors', copied === it.id ? 'text-up' : 'text-ink-500 hover:text-ink-200')}
                          >
                            {copied === it.id ? <Check className="h-3.5 w-3.5" /> : <Link2 className="h-3.5 w-3.5" />}
                            {copied === it.id ? 'Link copied' : 'Copy link'}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
