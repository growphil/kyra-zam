import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here - triggered reload */
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  }
};

export default nextConfig;
