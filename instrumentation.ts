import * as Sentry from "@sentry/nextjs"

// Next.js's instrumentation hook — runs once when the server starts, before
// any request is handled. Splitting server vs edge config into separate
// files (rather than one Sentry.init() call here) matches Sentry's own
// Next.js SDK convention, since the two runtimes need different
// integrations under the hood.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config")
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config")
  }
}

// Captures errors thrown inside Server Components / Server Actions that
// Next.js's own error boundary would otherwise swallow into a generic
// "Application error" with nothing in Sentry. This is exactly the class of
// failure this app had zero visibility into before — a broken dashboard
// render, a Prisma error inside a page component — since only a couple of
// API routes (sync) had any error logging at all (see DECISIONS.md).
export const onRequestError = Sentry.captureRequestError
