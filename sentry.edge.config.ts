import * as Sentry from "@sentry/nextjs"

// This app has no custom middleware.ts today, so the edge runtime rarely
// executes any of this app's own code — but Next.js can still invoke edge
// for things outside this app's control (next-auth's own middleware
// internals, for instance), and this file is what Sentry's Next.js SDK
// expects to exist so instrumentation.ts's edge branch has something to
// import. Cheap to keep in place now rather than needing to add it later
// the moment a real middleware.ts shows up.
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: 0.1,
  debug: false,
})
