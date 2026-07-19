// Safe to run at higher volume — tests raw Next.js/Vercel response capacity
// on a public page. Doesn't touch Postgres, Redis, or Gemini quota.
//
// Run: k6 run load-test/unauthenticated-load.js
import http from "k6/http"
import { check, sleep } from "k6"

const BASE_URL = __ENV.BASE_URL || "https://devsync-rho.vercel.app"

export const options = {
  stages: [
    { duration: "30s", target: 10 },  // ramp up to 10 virtual users
    { duration: "1m", target: 10 },   // hold at 10
    { duration: "30s", target: 30 },  // step up to 30
    { duration: "1m", target: 30 },   // hold at 30
    { duration: "30s", target: 0 },   // ramp down
  ],
  thresholds: {
    http_req_duration: ["p(95)<1500"], // flag if 95th percentile exceeds 1.5s
    http_req_failed: ["rate<0.05"],    // flag if more than 5% of requests fail
  },
}

export default function () {
  const res = http.get(`${BASE_URL}/login`)
  check(res, {
    "status is 200": (r) => r.status === 200,
  })
  sleep(1)
}
