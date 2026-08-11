/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    unoptimized: true,
  },
  experimental: {
    optimizePackageImports: ["lucide-react", "recharts", "date-fns"],
  },
}

// Note: intentionally NOT wrapping with @sentry/nextjs's withSentryConfig.
// That helper injects a webpack config for source-map upload, which conflicts
// with Next 16's Turbopack production builds (crashes the build worker).
// Error capturing itself doesn't need it — that's handled by
// sentry.client/server/edge.config.ts + instrumentation.ts. Revisit wrapping
// this once a Sentry SDK version with solid Turbopack build support lands,
// or if source-map upload (SENTRY_AUTH_TOKEN) becomes a priority.
export default nextConfig
