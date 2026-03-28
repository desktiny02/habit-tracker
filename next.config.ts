import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Restore default build output to avoid environment-specific issues
  // reactStrictMode: true,
  
  // Disable x-powered-by header
  poweredByHeader: false,
};

export default nextConfig;
