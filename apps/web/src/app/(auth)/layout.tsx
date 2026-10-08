import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Wordmark } from '@/components/logo';
import { BrandPanel } from '@/components/auth/brand-panel';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      <BrandPanel />
      <main className="relative flex min-h-screen flex-col overflow-hidden">
        <div className="bg-dots absolute inset-0 opacity-40" />
        <div className="aurora-blob -right-40 -top-40 h-[380px] w-[420px] bg-brand-500/10" />

        <div className="relative flex items-center justify-between px-6 pt-6 sm:px-10">
          <Link href="/" aria-label="Home" className="animate-page-in lg:invisible">
            <Wordmark />
          </Link>
          <Link href="/" className="animate-page-in group inline-flex items-center gap-2 rounded-full border border-white/[0.08] px-3.5 py-1.5 text-xs text-ink-300 transition-colors hover:border-white/20 hover:text-white">
            <ArrowLeft className="h-3.5 w-3.5 transition-transform duration-300 group-hover:-translate-x-0.5" />
            Back to site
          </Link>
        </div>

        <div className="relative flex flex-1 items-center justify-center px-6 py-10 sm:px-10">
          <div className="w-full max-w-md">{children}</div>
        </div>
      </main>
    </div>
  );
}
