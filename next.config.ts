import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Every screen here is per-user, live ledger data; cache components add nothing but Suspense boundaries.
  cacheComponents: false,
  devIndicators: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
