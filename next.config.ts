import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Lets a second role sign in locally at 127.0.0.1 alongside localhost.
  allowedDevOrigins: ["127.0.0.1"],
};

export default nextConfig;
