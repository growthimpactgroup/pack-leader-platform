import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Lets a second role sign in locally at 127.0.0.1 alongside localhost.
  allowedDevOrigins: ["127.0.0.1"],
  experimental: {
    // PDF uploads to the Problem Bank. Vercel caps request bodies at 4.5 MB.
    serverActions: { bodySizeLimit: "4mb" },
  },
};

export default nextConfig;
