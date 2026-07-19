// SM-2 (SuperMemo-2) — the same scheduling algorithm Anki uses. Given a
// 0-5 "how well did you recall this" rating, computes the next ease
// factor, the interval (in days) until the next review, and the repetition
// count. Pure function — no DB access — so it's trivially testable and the
// API route just persists whatever it returns.
export interface SM2State {
  easeFactor: number
  intervalDays: number
  repetitionCount: number
}

export interface SM2Result extends SM2State {
  nextReviewAt: Date
}

// UI-facing quality buckets (Anki-style "Again/Hard/Good/Easy" instead of
// asking users to pick a raw 0-5 number, which nobody intuitively knows how
// to answer). Mapped to the 0-5 scale SM-2 expects internally.
export const QUALITY = {
  AGAIN: 1,
  HARD: 3,
  GOOD: 4,
  EASY: 5,
} as const

export function computeSM2(prev: SM2State, quality: number): SM2Result {
  const q = Math.max(0, Math.min(5, quality))

  let { easeFactor, intervalDays, repetitionCount } = prev

  if (q < 3) {
    // Failed recall — restart the interval schedule. The ease factor still
    // takes its usual hit below, so a problem that keeps getting "Again"
    // converges toward being scheduled almost daily, but repetitionCount
    // resets so it goes through the 1-day -> 6-day ramp again rather than
    // jumping straight back to a long interval.
    repetitionCount = 0
    intervalDays = 1
  } else {
    if (repetitionCount === 0) intervalDays = 1
    else if (repetitionCount === 1) intervalDays = 6
    else intervalDays = Math.round(intervalDays * easeFactor)
    repetitionCount += 1
  }

  // Standard SM-2 ease update formula.
  easeFactor = easeFactor + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
  easeFactor = Math.max(1.3, easeFactor)

  const nextReviewAt = new Date()
  nextReviewAt.setHours(0, 0, 0, 0)
  nextReviewAt.setDate(nextReviewAt.getDate() + intervalDays)

  return { easeFactor, intervalDays, repetitionCount, nextReviewAt }
}
