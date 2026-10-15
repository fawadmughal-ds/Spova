import { BRAND } from './utils';

/** Canonical public origin. Set NEXT_PUBLIC_SITE_URL at build; falls back to the live domain. */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.zerventa.com').replace(/\/$/, '');
export const SITE_NAME = BRAND;
/** Default social-share image (1376×768). Pages can override with their own. */
export const OG_IMAGE = '/images/og-image.jpg';
export const OG_IMAGE_W = 1376;
export const OG_IMAGE_H = 768;

export const SITE_DESCRIPTION = `Trade Forex, Indices, Commodities, Shares, Crypto and Metals as CFDs with ${BRAND}. Tight spreads, leverage up to 1:400, fast execution and a web terminal that works on any device.`;

export const SOCIALS = ['https://www.facebook.com/zerventa', 'https://www.instagram.com/zerventa', 'https://x.com/zerventa'];
