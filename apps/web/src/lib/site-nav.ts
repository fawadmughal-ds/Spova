import {
  BadgeDollarSign,
  BookOpen,
  BookOpenText,
  CalendarClock,
  CalendarDays,
  CandlestickChart,
  Cookie,
  GraduationCap,
  Handshake,
  HelpCircle,
  Info,
  Layers,
  LibraryBig,
  ListOrdered,
  Mail,
  MessageSquareWarning,
  MoonStar,
  Newspaper,
  PlayCircle,
  Radio,
  Scale,
  ShieldHalf,
  TimerReset,
  type LucideIcon,
} from 'lucide-react';

/** Every public page outside the six markets, grouped the way the header and footer present them. */
export interface NavLink {
  href: string;
  label: string;
  blurb: string;
  icon: LucideIcon;
}

export const TIER_SLUGS = ['classic', 'silver', 'gold', 'platinum', 'vip'] as const;
export type TierSlug = (typeof TIER_SLUGS)[number];
export const tierHref = (tier: string) => `/${tier}-account`;

export const TRADING_LINKS: NavLink[] = [
  { href: '/trading-account', label: 'Trading accounts', blurb: 'Compare all five tiers', icon: Layers },
  { href: '/cfds-list', label: 'CFD list', blurb: 'Every instrument and its contract spec', icon: ListOrdered },
  { href: '/swap-fees', label: 'Swap fees', blurb: 'Overnight financing per instrument', icon: MoonStar },
  { href: '/market-holidays', label: 'Market holidays', blurb: 'Trading hours and closures', icon: CalendarDays },
  { href: '/cfd-expiries', label: 'CFD expiries', blurb: 'Contract rollover dates', icon: TimerReset },
];

export const EDUCATION_LINKS: NavLink[] = [
  { href: '/education', label: 'Education center', blurb: 'Start here', icon: GraduationCap },
  { href: '/trading-education', label: 'Trading education', blurb: 'How CFDs work, from the first pip', icon: BookOpenText },
  { href: '/glossary', label: 'Glossary', blurb: 'Trading terms in plain English', icon: BookOpen },
  { href: '/chart-analysis', label: 'Chart analysis', blurb: 'Reading candles, trends and levels', icon: CandlestickChart },
  { href: '/risk-management-tools', label: 'Risk management', blurb: 'Stops, sizing and margin', icon: ShieldHalf },
  { href: '/economic-calendar', label: 'Economic calendar', blurb: 'Scheduled market-moving events', icon: CalendarClock },
  { href: '/signals', label: 'Signals', blurb: 'Trade ideas for clients', icon: Radio },
  { href: '/ebooks', label: 'eBooks', blurb: 'Longer reads to download', icon: LibraryBig },
  { href: '/daily-market-videos', label: 'Daily market videos', blurb: 'The session in a few minutes', icon: PlayCircle },
  { href: '/latest-market-news', label: 'Latest market news', blurb: 'Headlines that move prices', icon: Newspaper },
];

export const COMPANY_LINKS: NavLink[] = [
  { href: '/about-us', label: 'About us', blurb: 'Who we are and what we stand for', icon: Info },
  { href: '/become-a-partner', label: 'Become a partner', blurb: 'Affiliate programme', icon: Handshake },
  { href: '/faq', label: 'FAQ', blurb: 'Quick answers by topic', icon: HelpCircle },
  { href: '/contact-us', label: 'Contact us', blurb: 'Reach the support team', icon: Mail },
  { href: '/legal', label: 'Legal documents', blurb: 'Agreements and policies', icon: Scale },
  { href: '/complaints', label: 'Complaints', blurb: 'How we handle a complaint', icon: MessageSquareWarning },
  { href: '/cookies-privacy', label: 'Cookies & privacy', blurb: 'How your data is used', icon: Cookie },
];

/** Tier name + audience label, shown in menus and on the tier pages. */
export const TIER_LINKS: { tier: TierSlug; label: string; level: string; icon: LucideIcon }[] = [
  { tier: 'classic', label: 'Classic', level: 'Beginner', icon: BadgeDollarSign },
  { tier: 'silver', label: 'Silver', level: 'Intermediate', icon: BadgeDollarSign },
  { tier: 'gold', label: 'Gold', level: 'Advanced', icon: BadgeDollarSign },
  { tier: 'platinum', label: 'Platinum', level: 'Professional', icon: BadgeDollarSign },
  { tier: 'vip', label: 'VIP', level: 'Expert', icon: BadgeDollarSign },
];
