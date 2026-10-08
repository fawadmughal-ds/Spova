import type { Metadata } from 'next';
import { Bricolage_Grotesque, Geist, Instrument_Serif, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';
import { BRAND } from '@/lib/utils';

const body = Geist({ subsets: ['latin'], variable: '--ff-body', display: 'swap' });
const display = Bricolage_Grotesque({ subsets: ['latin'], variable: '--ff-display', display: 'swap' });
const serif = Instrument_Serif({ subsets: ['latin'], weight: '400', style: ['normal', 'italic'], variable: '--ff-serif', display: 'swap' });
const mono = JetBrains_Mono({ subsets: ['latin'], variable: '--ff-mono', display: 'swap' });

export const metadata: Metadata = {
  title: { default: `${BRAND} - Online Forex & CFD Trading`, template: `%s | ${BRAND}` },
  description: `Trade Forex, Indices, Commodities, Shares, Crypto and Metals CFDs with ${BRAND}. Tight spreads, fast execution, 24/5 support.`,
};

/**
 * Reveals [data-reveal] elements as they enter the viewport without waiting for React to hydrate,
 * so above-the-fold content is never held invisible on a slow connection. <Reveal> takes over afterwards.
 */
const REVEAL_BOOT = `(function(){if(!('IntersectionObserver' in window)||!('MutationObserver' in window))return;var io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){e.target.setAttribute('data-in','true');io.unobserve(e.target)}})},{rootMargin:'0px 0px -8% 0px'});function scan(r){r.querySelectorAll('[data-reveal]').forEach(function(el){io.observe(el)})}var mo=new MutationObserver(function(ms){ms.forEach(function(m){m.addedNodes.forEach(function(n){if(n.nodeType!==1)return;if(n.matches('[data-reveal]'))io.observe(n);scan(n)})})});mo.observe(document.documentElement,{childList:true,subtree:true});window.addEventListener('load',function(){setTimeout(function(){mo.disconnect();io.disconnect()},5000)})})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-scroll-behavior="smooth" className={`${body.variable} ${display.variable} ${serif.variable} ${mono.variable}`}>
      <body className="min-h-screen">
        {/* scroll-reveal content must stay visible without JS */}
        <noscript>
          <style>{`[data-reveal],[data-reveal]>*,.word>span,.draw,.grow-x,.grow-y{animation:none!important}`}</style>
        </noscript>
        <script dangerouslySetInnerHTML={{ __html: REVEAL_BOOT }} />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
