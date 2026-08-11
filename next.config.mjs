import { withSentryConfig } from "@sentry/nextjs"

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    unoptimized: true,
  },
  experimental: {
    optimizePackageImports: ["lucide-react", "recharts", "date-fns"],
  },
}

export default withSentryConfig(nextConfig, {
  silent: true,
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  // Skip Sentry's build-time steps (source map upload) entirely when not configured,
  // so local/dev builds without Sentry env vars are unaffected.
  disableLogger: true,
  widenClientFileUpload: false,
  sourcemaps: {
    disable: !process.env.SENTRY_AUTH_TOKEN,
  },
})
