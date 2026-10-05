import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  transpilePackages: ['@spova/shared'],
  poweredByHeader: false,
  async headers() {
    return [
      {
        // Private surfaces must never be indexed.
        source: '/(app|trade|admin)(.*)',
        headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }],
      },
    ];
  },
};

export default nextConfig;
