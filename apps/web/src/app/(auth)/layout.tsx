import Link from 'next/link';
import { Logo } from '@/components/logo';
import { BRAND } from '@/lib/utils';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <aside className="relative hidden overflow-hidden bg-ink-900 lg:block">
        <div className="bg-grid absolute inset-0" />
        <div className="absolute -bottom-40 -left-20 h-[480px] w-[480px] rounded-full bg-brand-500/20 blur-3xl" />
        <div className="relative flex h-full flex-col justify-between p-12">
          <Link href="/" className="flex items-center gap-2">
            <Logo />
            <span className="text-lg font-bold">{BRAND}</span>
          </Link>
          <div>
            <h2 className="text-4xl font-bold leading-tight">
              One account.
              <br />
              Every market.
            </h2>
            <p className="mt-4 max-w-md text-ink-300">Forex, indices, commodities, shares, crypto and metals with live pricing and instant execution.</p>
            <dl className="mt-10 grid grid-cols-3 gap-6">
              {[
                ['$10,000', 'Demo funds'],
                ['1:400', 'Leverage'],
                ['24/7', 'Crypto'],
              ].map(([v, l]) => (
                <div key={l}>
                  <dt className="text-2xl font-bold tabular">{v}</dt>
                  <dd className="text-xs uppercase tracking-wider text-ink-400">{l}</dd>
                </div>
              ))}
            </dl>
          </div>
          <p className="text-xs text-ink-500">CFDs are complex instruments and come with a high risk of losing money rapidly due to leverage.</p>
        </div>
      </aside>
      <main className="flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-md">
          <Link href="/" className="mb-8 flex items-center gap-2 lg:hidden">
            <Logo />
            <span className="text-lg font-bold">{BRAND}</span>
          </Link>
          {children}
        </div>
      </main>
    </div>
  );
}
