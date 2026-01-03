import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@c2c-agents/shared', '@c2c-agents/config', '@c2c-agents/ui'],
  reactStrictMode: true,
};

export default nextConfig;
