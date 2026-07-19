// WARNING: this hits real Postgres queries, real Redis commands, and (for
// the hint request) the real Gemini API. Run this at LOW volume deliberately
// — the "vus" (virtual users) below are intentionally small. Raise them
// gradually and watch your Upstash/Supabase/Vercel dashboards while it runs;
// that's where you'll see the real ceiling, not in k6's own output.
//
// Requires a real logged-in session cookie — see load-test/README.md for how
// to grab one from your browser. Never commit a real cookie value.
//
// Run: k6 run load-test/authenticated-load.js
import http from "k6/http"
import { check, sleep } from "k6"

const BASE_URL = __ENV.BASE_URL || "https://devsync-rho.vercel.app"

// Paste a real session cookie value here before running (see README).
// Using the non-"__Secure-" prefixed name for local/http testing; swap to
// "__Secure-authjs.session-token" for the production HTTPS domain.
const SESSION_COOKIE = __ENV.SESSION_COOKIE || "REPLACE_ME"

const params = {
  headers: {
    Cookie: `authjs.session-token=${SESSION_COOKIE}`,
    "Content-Type": "application/json",
  },
}

export const options = {
  // Deliberately tiny — this is the expensive path (DB + Redis + Gemini).
  vus: 3,
  duration: "20s",
}

export default function () {
  // A plain dashboard-adjacent read — mostly Postgres + Redis cache-aside.
  const dashboardRes = http.get(`${BASE_URL}/dashboard`, params)
  check(dashboardRes, { "dashboard status is 200": (r) => r.status === 200 })

  sleep(2)

  // The expensive one: classification + retrieval + a real Gemini call.
  // Every unique problemStatement burns real Gemini quota and a Redis
  // write — keep this scenario short and don't crank vus up carelessly.
  const hintRes = http.post(
    `${BASE_URL}/api/hint/rag`,
    JSON.stringify({
      problemStatement: `Load test statement ${Date.now()}-${__VU}-${__ITER}`,
      problemTitle: "Load Test Problem",
      tags: ["Array"],
    }),
    params
  )
  check(hintRes, {
    "hint status is 200 or 429": (r) => r.status === 200 || r.status === 429, // 429 = rate limit doing its job
  })

  sleep(3)
}
