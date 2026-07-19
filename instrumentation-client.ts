import * as Sentry from "@sentry/nextjs"

// Client-side init — catches errors thrown in the browser (a React render
// error in a Client Component, a rejected fetch a component didn't handle,
// etc.), which is a genuinely different failure surface from
// sentry.server.config.ts: a broken "Rate Recall" button click never hits
// the server at all if the bug is purely client-side, so server-only error
// tracking would still miss it entirely.
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,

  // Session Replay is a Sentry feature that records DOM snapshots around an
  // error for visual playback — powerful, but it's an opt-in cost (extra
  // client JS, and it's recording user sessions) this app doesn't need yet.
  // Left at 0 rather than removed, so turning it on later is a one-line
  // change instead of relearning the API.
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 0,
})
