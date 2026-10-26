import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here - triggered reload */
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  async rewrites() {
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
    return [
      {
        source: "/public/uploads/:path*",
        destination: `${backendUrl.replace(/\/+$/, "")}/public/uploads/:path*`,
      },
      {
        source: "/uploads/:path*",
        destination: `${backendUrl.replace(/\/+$/, "")}/public/uploads/:path*`,
      },
    ];
  },
};

export default nextConfig;
