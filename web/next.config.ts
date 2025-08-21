import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Disable server-side logging that might use worker threads
  serverExternalPackages: ['pino', 'thread-stream'],
};

export default nextConfig;
