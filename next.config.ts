import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {}

// withSentryConfig wraps the build to also upload source maps to Sentry
// (so a stack trace in the dashboard points at real source lines instead of
// minified bundle output) and auto-instrument a few things (like
// onRequestError). It only actually uploads anything if SENTRY_AUTH_TOKEN,
// SENTRY_ORG, and SENTRY_PROJECT are set — without them it's a no-op wrapper,
// so this is safe to ship before those secrets exist (e.g. in CI, which
// currently uses placeholder env vars — see DECISIONS.md's CI entry).
export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  silent: !process.env.CI,
  widenClientFileUpload: true,
  disableLogger: true,
})

