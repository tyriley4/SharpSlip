const { withSentryConfig } = require('@sentry/nextjs')

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Required on Next 13.5 for instrumentation.ts (Sentry server/edge setup).
  experimental: { instrumentationHook: true },
}

// Source-map upload is skipped (no auth token configured) and the build stays quiet; reporting itself only turns on when a DSN is set.
module.exports = withSentryConfig(nextConfig, {
  silent: true,
  telemetry: false,
  disableLogger: true,
  sourcemaps: { disable: true },
})
