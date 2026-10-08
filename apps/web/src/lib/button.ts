import { cn } from './utils';

// Kept outside the 'use client' UI kit so server components can style links as buttons.
export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline';
export type ButtonSize = 'sm' | 'md' | 'lg';

const variants: Record<ButtonVariant, string> = {
  primary: 'btn-shine bg-gradient-to-b from-brand-300 to-brand-500 text-ink-950 shadow-glow font-semibold',
  secondary: 'bg-white/[0.07] text-ink-100 ring-1 ring-inset ring-white/10 hover:bg-white/[0.12]',
  ghost: 'bg-transparent text-ink-200 hover:bg-white/[0.06] hover:text-white',
  danger: 'bg-down/90 text-paper hover:bg-down shadow-[0_10px_30px_-12px_rgb(var(--down-rgb)/0.7)]',
  outline: 'border border-white/15 text-ink-100 hover:border-brand-400/60 hover:bg-brand-400/[0.06] hover:text-white',
};
const sizes: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-xs rounded-lg',
  md: 'h-10 px-4 text-sm rounded-xl',
  lg: 'h-12 px-6 text-base rounded-xl',
};

/** Class string shared by <Button> and by links that should look like one. */
export const buttonClass = (variant: ButtonVariant = 'primary', size: ButtonSize = 'md', className?: string) =>
  cn('btn inline-flex items-center justify-center gap-2 whitespace-nowrap focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/60', variants[variant], sizes[size], className);
