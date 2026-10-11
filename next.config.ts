import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Off for `next build`. Railway keeps `.next/cache` between deploys, and a
    // build killed part-way leaves a truncated cache file behind — Turbopack
    // then panics reading it ("range start index … out of range") and every
    // later deploy fails the same way until the cache is cleared. A clean
    // build each time costs some seconds; a poisoned cache costs the deploy.
    turbopackFileSystemCacheForBuild: false,
  },
};

export default nextConfig;
