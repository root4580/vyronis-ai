// UNUSED — superseded by instrumentation-client.ts at the project root.
//
// This file is the old Sentry convention that only got loaded via
// @sentry/nextjs's withSentryConfig webpack plugin. We removed that wrapper
// (it conflicts with Next 16's Turbopack production builds), so this file is
// never imported by anything and does nothing. Client-side Sentry init now
// lives in instrumentation-client.ts, which Next.js loads automatically
// regardless of bundler. Safe to delete this file if you want to clean it up.
