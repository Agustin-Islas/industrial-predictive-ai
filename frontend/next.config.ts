import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Solo usar 'standalone' si se compila para Docker. Vercel nativo usa el default.
  output: process.env.BUILD_STANDALONE === "true" ? "standalone" : undefined,
  /* config options here */
};

export default nextConfig;
