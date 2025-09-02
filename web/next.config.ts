import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['pino', 'thread-stream', 'playwright-core', '@browserbasehq/stagehand'],
};

export default nextConfig;
