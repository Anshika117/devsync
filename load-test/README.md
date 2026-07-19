# Load testing DevSync

## What "how many students can it handle" actually means

There's no single number — it depends which layer breaks first. For DevSync specifically, in rough order of how likely each is to be the actual bottleneck:

1. **Upstash Redis free tier** — capped at a fixed number of commands/day (check your current plan in the Upstash dashboard). Every dashboard load, every AI hint, every rate-limit check hits Redis. This is very likely the first thing to run out, long before Vercel or Postgres notice any load.
2. **Supabase connection pool** — the free tier's pooler (port 6543) allows a limited number of concurrent connections. Prisma's `PrismaPg` adapter holds connections per serverless function instance; enough concurrent requests can exhaust this before CPU is ever the issue.
3. **Gemini API quota** — the AI hint route calls Gemini directly. Free-tier Gemini quotas are requests-per-minute limited; this fails independently of everything else if many users request hints at once.
4. **Vercel serverless concurrency** — Vercel scales functions automatically, but each cold start adds latency, and the plan's execution/concurrency limits are a real ceiling on a free/hobby plan.
5. **LeetCode/Codeforces's own APIs** — not your infrastructure at all, but sync correctness depends on them not rate-limiting your server's IP if many users sync at the same moment.

So "max concurrent students" isn't one clean number — it's "which of the above fails first," and that depends on your current plan tiers on Upstash/Supabase/Vercel/Gemini, which only you can check (their dashboards show current usage against your plan's limit).

## How to actually test it

[k6](https://k6.io) is the standard tool for this — scriptable, free, runs from your own machine or CI. Install: `brew install k6` (Mac) or see k6.io/docs for other OSes — no signup needed for local runs.

Two scripts are provided:

- `unauthenticated-load.js` — hits the public login page repeatedly. Safe to run at high volume; tests raw Vercel/Next.js response capacity without touching your database or Redis budget.
- `authenticated-load.js` — hits `/api/hint/rag` and a dashboard-data endpoint as a logged-in user. This is the one that actually stresses Postgres/Redis/Gemini, so run it at low volume deliberately (see warnings inside the script) — it's easy to blow through a free-tier Redis/Gemini daily cap in seconds at real concurrency.

### Getting a session cookie for the authenticated script

The authenticated script needs a real logged-in session, since these routes require `auth()` to succeed:

1. Log into the live site (or localhost) in your browser.
2. Open DevTools → Application/Storage → Cookies → copy the value of `authjs.session-token` (or `__Secure-authjs.session-token` on the production HTTPS domain).
3. Paste it into the `SESSION_COOKIE` constant at the top of `authenticated-load.js`.

Never commit a real cookie value into git — treat it like a password, it's a live session.

### Running

```bash
k6 run load-test/unauthenticated-load.js
k6 run load-test/authenticated-load.js
```

k6 prints p95/p99 latency and error rate at the end. Watch your Vercel, Supabase, and Upstash dashboards *during* the run — that's where you'll actually see which one starts erroring or throttling first, which is your real answer to "how many concurrent users."

### Important

- Never point a load test at LeetCode's or Codeforces's actual APIs — that's hammering someone else's production service from a script, not your own infrastructure. Both provided scripts only hit your own DevSync deployment.
- Start small (`vus: 5`) and step up. A demo/free-tier setup will likely show real limits well under 50 concurrent users — that's expected and fine to say honestly if asked; it reflects a demo deployment, not the architecture's ceiling.
