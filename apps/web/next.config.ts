import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@c2c-agents/shared', '@c2c-agents/config', '@c2c-agents/ui'],
  reactStrictMode: true,
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // 客户端构建时，将 node:crypto 等 Node.js 模块设为空
      config.resolve.fallback = {
        ...config.resolve.fallback,
        crypto: false,
      };
    }
    return config;
  },
};

export default nextConfig;
