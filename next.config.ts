import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // `cacheComponents` and the `partialPrefetching` that depends on it are both
  // off deliberately. They treat a page as cacheable until told otherwise, and
  // forbid the per-route `dynamic` escape hatch. Every page here reads a live
  // clinic, so a cached render would show one person the patients another
  // person saw. Freshness is the requirement; caching would have to earn its
  // place, one route at a time, against that.
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
