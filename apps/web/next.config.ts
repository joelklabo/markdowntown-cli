import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";
import withBundleAnalyzer from "@next/bundle-analyzer";

const analyzer = withBundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
});

if (process.env.NODE_ENV === "development") {
  process.env.SENTRY_SUPPRESS_TURBOPACK_WARNING ??= "1";
}

const staticAssetCacheControl =
  process.env.NODE_ENV === "development"
    ? "no-store"
    : "public, max-age=31536000, immutable";

const scriptSrcDirective =
  process.env.NODE_ENV === "development"
    ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
    : "script-src 'self' 'unsafe-inline'";

const cspDirectives = [
  "default-src 'self'",
  scriptSrcDirective,
  "connect-src 'self' https://app.posthog.com https://*.sentry.io https://sentry.io",
  "img-src 'self' data: blob: https://avatars.githubusercontent.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "object-src 'none'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
];

const securityHeaders = [
  { key: "Content-Security-Policy", value: cspDirectives.join("; ") },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "geolocation=()" },
];

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "avatars.githubusercontent.com",
      },
    ],
  },
  outputFileTracingIncludes: {
    "/atlas/**": ["./atlas/**"],
    "/api/atlas/**": ["./atlas/**"],
  },
  async headers() {
    return [
      {
        source: "/_next/static/:path*",
        headers: [
          { key: "Cache-Control", value: staticAssetCacheControl },
        ],
      },
      {
        source: "/:path*.svg",
        headers: [
          { key: "Cache-Control", value: staticAssetCacheControl },
        ],
      },
      {
        source: "/:path*.ico",
        headers: [
          { key: "Cache-Control", value: staticAssetCacheControl },
        ],
      },
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
  // Keep Turbopack config available for opt-in dev:turbo runs (default dev disables it).
  turbopack: {},
  webpack: (config, { dev }) => {
    if (dev && process.env.WATCHPACK_POLLING === "true") {
      const pollInterval = Number(process.env.WATCHPACK_POLLING_INTERVAL) || 1000;
      config.watchOptions = {
        ...(config.watchOptions ?? {}),
        poll: pollInterval,
        aggregateTimeout: 300,
      };
    }
    return config;
  },
};

export default withSentryConfig(analyzer(nextConfig), {
  silent: true,
  disableLogger: true,
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  sourcemaps: { deleteSourcemapsAfterUpload: true },
});
