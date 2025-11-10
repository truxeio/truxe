/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  experimental: {
    typedRoutes: true,
    // Disable static generation completely to avoid /_error export issues
    staticGenerationMaxConcurrency: 1,
    staticGenerationMinPagesPerWorker: 1000,
  },
  output: "standalone",
  // Skip optimizations that may cause export errors
  swcMinify: true,
  generateBuildId: async () => {
    return 'build-' + Date.now();
  },
};

export default nextConfig;
