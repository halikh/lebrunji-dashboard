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
  async headers() {
    return [
      {
        // Every route, `/i` included.
        source: "/:path*",
        headers: [
          // Nothing here is meant to be shown inside another site's frame; an
          // operator's screen behind somebody else's page is how clickjacking
          // starts. The CSP is the modern form, `X-Frame-Options` the one older
          // browsers read.
          //
          // Only `frame-ancestors` for now. A script and style policy needs a
          // nonce threaded through Next's own inline scripts, and a CSP that
          // allows `'unsafe-inline'` to get around that protects little.
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
          { key: "X-Frame-Options", value: "DENY" },
          // `/i` streams whatever type the bucket stored; a browser must not
          // second-guess it into HTML.
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Dashboard paths carry ids, and the reset flow carries more than
          // that. None of it is any other origin's business.
          { key: "Referrer-Policy", value: "same-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
