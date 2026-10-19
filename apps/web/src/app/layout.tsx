import type { Metadata } from 'next';
import Script from 'next/script';
import { Bricolage_Grotesque, Geist, Instrument_Serif, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';
import { BRAND } from '@/lib/utils';
import { OG_IMAGE, OG_IMAGE_H, OG_IMAGE_W, SITE_DESCRIPTION, SITE_URL, SOCIALS } from '@/lib/site';

/** Meta (Facebook) Pixel — site-wide ad/analytics tracking. */
const META_PIXEL_IDS = ['1482472313703037', '1652620199639918'];
const META_PIXEL = `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');${META_PIXEL_IDS.map((id) => `fbq('init','${id}');`).join('')}fbq('track','PageView');`;

const body = Geist({ subsets: ['latin'], variable: '--ff-body', display: 'swap' });
const display = Bricolage_Grotesque({ subsets: ['latin'], variable: '--ff-display', display: 'swap' });
const serif = Instrument_Serif({ subsets: ['latin'], weight: '400', style: ['normal', 'italic'], variable: '--ff-serif', display: 'swap' });
const mono = JetBrains_Mono({ subsets: ['latin'], variable: '--ff-mono', display: 'swap' });

const TITLE = `${BRAND} — Online Forex & CFD Trading`;

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: TITLE, template: `%s | ${BRAND}` },
  description: SITE_DESCRIPTION,
  applicationName: BRAND,
  keywords: ['forex trading', 'CFD trading', 'online trading', 'trade forex', 'indices', 'commodities', 'shares CFDs', 'crypto CFDs', 'metals', 'gold trading', 'web trading terminal', 'MetaTrader alternative', BRAND],
  authors: [{ name: BRAND }],
  creator: BRAND,
  publisher: BRAND,
  alternates: { canonical: '/' },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1 } },
  openGraph: {
    type: 'website',
    siteName: BRAND,
    url: SITE_URL,
    title: TITLE,
    description: SITE_DESCRIPTION,
    locale: 'en_US',
    images: [{ url: OG_IMAGE, width: OG_IMAGE_W, height: OG_IMAGE_H, alt: TITLE }],
  },
  twitter: { card: 'summary_large_image', title: TITLE, description: SITE_DESCRIPTION, images: [OG_IMAGE] },
  category: 'finance',
};

/** Organization + WebSite structured data for rich results. */
const JSON_LD = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      '@id': `${SITE_URL}/#organization`,
      name: BRAND,
      url: SITE_URL,
      logo: `${SITE_URL}/brand/zerventa-mark.png`,
      description: SITE_DESCRIPTION,
      sameAs: SOCIALS,
    },
    {
      '@type': 'WebSite',
      '@id': `${SITE_URL}/#website`,
      url: SITE_URL,
      name: BRAND,
      description: SITE_DESCRIPTION,
      publisher: { '@id': `${SITE_URL}/#organization` },
      inLanguage: 'en',
    },
  ],
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
        {/* structured data for search engines */}
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }} />
        {/* Meta Pixel */}
        <Script id="meta-pixel" strategy="afterInteractive">{META_PIXEL}</Script>
        <noscript>
          {META_PIXEL_IDS.map((id) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={id} height="1" width="1" style={{ display: 'none' }} src={`https://www.facebook.com/tr?id=${id}&ev=PageView&noscript=1`} alt="" />
          ))}
        </noscript>
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
