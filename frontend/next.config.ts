import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep long-running dev servers isolated from production and E2E builds.
  // Concurrent Next.js processes must never write to the same dist directory.
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  output: "standalone",
};

export default nextConfig;
