import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "kyra-zam-media-prod.s3.ap-south-1.amazonaws.com",
      },
      {
        protocol: "https",
        hostname: "*.s3.ap-south-1.amazonaws.com",
      },
      {
        protocol: "https",
        hostname: "*.amazonaws.com",
      },
    ],
  },
  async rewrites() {
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
    return [
      {
        source: "/media/:path*",
        destination: `${backendUrl.replace(/\/+$/, "")}/media/:path*`,
      },
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
