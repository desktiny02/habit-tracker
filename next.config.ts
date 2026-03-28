import type { NextConfig } from 'next';

const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-XSS-Protection', value: '1; mode=block' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
];

const nextConfig: NextConfig = {
  // Optimize output for Vercel
  output: 'standalone',

  // Enable React strict mode for better development experience
  reactStrictMode: true,

  // Image optimization
  images: {
    formats: ['image/webp', 'image/avif'],
  },

  // Compiler optimizations
  compiler: {
    // Remove console.log in production
    removeConsole: process.env.NODE_ENV === 'production',
  },

  // Apply security headers at the Next.js level (belt-and-suspenders with vercel.json)
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
    ];
  },

  // Disable x-powered-by header
  poweredByHeader: false,
};

export default nextConfig;
