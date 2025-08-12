import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_SERVER_URL: process.env.SERVER_URL,
  },
};

export default nextConfig;