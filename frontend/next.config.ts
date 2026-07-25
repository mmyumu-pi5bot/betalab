import type { NextConfig } from "next";

// Restrict Server Action / RSC invocation to trusted origins (defense in depth).
// Set NEXT_SERVER_ACTIONS_ORIGINS to a comma-separated list of production hosts,
// e.g. "app.example.com,www.example.com". Falls back to same-origin only.
const serverActionsAllowedOrigins = (process.env.NEXT_SERVER_ACTIONS_ORIGINS ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const nextConfig: NextConfig = {
  // Keep long-running dev servers isolated from production and E2E builds.
  // Concurrent Next.js processes must never write to the same dist directory.
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  output: "standalone",
  // Do not advertise the framework/version to attackers.
  poweredByHeader: false,
  experimental: {
    serverActions: {
      // Keep the request body limit tight; this app defines no Server Actions.
      bodySizeLimit: "1mb",
      ...(serverActionsAllowedOrigins.length > 0
        ? { allowedOrigins: serverActionsAllowedOrigins }
        : {}),
    },
  },
};

export default nextConfig;
