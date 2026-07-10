import type { NextConfig } from 'next'
 
const nextConfig: NextConfig = {
  experimental: {
    viewTransition: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'assets.tina.io',
        port: '',
      },
      {
        protocol: 'https',
        hostname: 'res.cloudinary.com',
        port: '',
      }
    ],
  },
  async headers() {
    // these are also defined in the root layout since github pages doesn't support headers
    const headers = [
      {
        key: 'X-Frame-Options',
        value: 'SAMEORIGIN',
      },
      {
        key: 'Content-Security-Policy',
        value: "frame-ancestors 'self'",
      },
    ];
    return [
      {
        source: '/(.*)',
        headers,
      },
    ];
  },
  async rewrites() {
    return [
      {
        source: '/admin',
        destination: '/admin/index.html',
      },
    ];
  },
  async redirects() {
    return [
      // Posts were flattened to single-segment slugs so intercepting-route
      // modals work on Vercel (catch-all interceptors break in production).
      // Keep old nested URLs alive.
      {
        source: '/posts/june/:slug',
        destination: '/posts/:slug',
        permanent: true,
      },
    ];
  },
};

export default nextConfig