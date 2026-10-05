import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-32 text-center sm:px-6">
      <p className="text-6xl font-bold text-brand-500/40">404</p>
      <h1 className="mt-4 text-2xl font-bold">Page not found</h1>
      <Link href="/" className="mt-6 inline-block text-brand-300 hover:text-brand-200">
        Back to home →
      </Link>
    </div>
  );
}
