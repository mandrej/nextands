import type { NextConfig } from "next";

const buildId = new Date().valueOf().toString();

const nextConfig: NextConfig = {
  generateBuildId: () => buildId,
  env: {
    NEXT_PUBLIC_BUILD_ID: buildId,
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "firebasestorage.googleapis.com",
      },
      {
        protocol: "https",
        hostname: "storage.googleapis.com",
      },
      {
        protocol: "http",
        hostname: "127.0.0.1",
        port: "9199",
      },
    ],
  },
  transpilePackages: ["transliteration"],
};

export default nextConfig;
