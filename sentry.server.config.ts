import * as Sentry from "@sentry/nextjs"

Sentry.init({
  dsn: process.env.SENTRY_DSN,

  // Low but non-zero: this app has no existing performance monitoring, and
  // 100% tracing on every request is unnecessary cost/noise for a personal
  // project. 10% still gives a representative sample if response times ever
  // need investigating, without the overhead of tracing every single request.
  tracesSampleRate: 0.1,

  // Sentry no-ops safely with an empty DSN (nothing gets sent, no crash) —
  // so this file is safe to ship even before a real Sentry project/DSN
  // exists yet; it just does nothing until SENTRY_DSN is set in .env.
  debug: false,
})
