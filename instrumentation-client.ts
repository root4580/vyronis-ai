import * as Sentry from "@sentry/nextjs"

// Next.js auto-loads this file on the client (bundler-agnostic, works under
// Turbopack without needing @sentry/nextjs's withSentryConfig webpack plugin).
// See: https://nextjs.org/docs/app/api-reference/file-conventions/instrumentation-client
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.VERCEL_ENV || process.env.NODE_ENV,
  // Only trace/replay a slice of sessions to control cost; errors are always captured.
  tracesSampleRate: 0.1,
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 0.1,
  integrations: [Sentry.replayIntegration()],
  enabled: Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN),
})
