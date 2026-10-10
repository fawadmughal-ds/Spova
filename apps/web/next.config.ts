import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  transpilePackages: ['@spova/shared'],
  poweredByHeader: false,
  async redirects() {
    return [
      // "Get started" entry point used by the public site and campaigns
      { source: '/onboarding', destination: '/register', permanent: false },
      { source: '/client-area/:path*', destination: '/login', permanent: false },
    ];
  },
  async headers() {
    const security = [
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'Permissions-Policy', value: 'camera=(self), microphone=(), geolocation=(), payment=(self "https://js.stripe.com"), usb=()' },
      { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
      { key: 'X-DNS-Prefetch-Control', value: 'on' },
    ];
    return [
      { source: '/(.*)', headers: security },
      {
        // Private surfaces must never be indexed.
        source: '/(app|trade|admin)(.*)',
        headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }],
      },
    ];
  },
};

export default nextConfig;
