import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Turbopack is the default bundler in Next.js 16.
  // Add an empty turbopack config to suppress the "no turbopack config" error
  // when a webpack config is also present.
  turbopack: {},

  // Keep webpack config for explicit --webpack builds.
  // face-api.js references Node.js built-ins (fs, path, crypto)
  // that need to be stubbed in the browser bundle.
  webpack: (config) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      path: false,
      crypto: false,
    };
    return config;
  },
};

export default nextConfig;
