import { describe, it, expect } from "vitest"
import { computeSM2, QUALITY, type SM2State } from "@/lib/spacedRepetition"

const FRESH: SM2State = { easeFactor: 2.5, intervalDays: 0, repetitionCount: 0 }

function daysFromNow(n: number): Date {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + n)
  return d
}

describe("computeSM2", () => {
  it("schedules the first successful review 1 day out", () => {
    const result = computeSM2(FRESH, QUALITY.GOOD)
    expect(result.intervalDays).toBe(1)
    expect(result.repetitionCount).toBe(1)
    expect(result.nextReviewAt).toEqual(daysFromNow(1))
  })

  it("schedules the second consecutive successful review 6 days out", () => {
    const first = computeSM2(FRESH, QUALITY.GOOD)
    const second = computeSM2(first, QUALITY.GOOD)
    expect(second.intervalDays).toBe(6)
    expect(second.repetitionCount).toBe(2)
  })

  it("multiplies the interval by the ease factor from the third review onward", () => {
    const first = computeSM2(FRESH, QUALITY.GOOD)
    const second = computeSM2(first, QUALITY.GOOD)
    const third = computeSM2(second, QUALITY.GOOD)
    expect(third.intervalDays).toBe(Math.round(second.intervalDays * second.easeFactor))
    expect(third.repetitionCount).toBe(3)
  })

  // This is the case the "Needs Revision" list actually depends on getting
  // right: rating a problem "Again" after it had built up a long interval
  // must send it back to being reviewed almost immediately, not silently
  // keep the old long-interval schedule.
  it("resets repetitionCount and interval to 1 day on a failed recall (quality < 3)", () => {
    const first = computeSM2(FRESH, QUALITY.GOOD)
    const second = computeSM2(first, QUALITY.GOOD)
    const third = computeSM2(second, QUALITY.GOOD) // interval now several days out
    const failed = computeSM2(third, QUALITY.AGAIN)
    expect(failed.intervalDays).toBe(1)
    expect(failed.repetitionCount).toBe(0)
  })

  it("increases the ease factor on an Easy rating", () => {
    const result = computeSM2(FRESH, QUALITY.EASY)
    expect(result.easeFactor).toBeGreaterThan(FRESH.easeFactor)
  })

  it("leaves the ease factor unchanged on a Good rating", () => {
    const result = computeSM2(FRESH, QUALITY.GOOD)
    expect(result.easeFactor).toBeCloseTo(FRESH.easeFactor, 5)
  })

  it("decreases the ease factor on Again/Hard ratings", () => {
    const again = computeSM2(FRESH, QUALITY.AGAIN)
    const hard = computeSM2(FRESH, QUALITY.HARD)
    expect(again.easeFactor).toBeLessThan(FRESH.easeFactor)
    expect(hard.easeFactor).toBeLessThan(FRESH.easeFactor)
  })

  // SM-2's ease factor is defined to never go below 1.3 - without this
  // floor, a problem rated "Again" enough times would have its ease factor
  // spiral toward (or below) zero, eventually breaking the interval math
  // (a zero or negative ease factor makes intervals shrink to nothing or
  // go negative instead of just staying short).
  it("never lets the ease factor drop below the 1.3 floor", () => {
    let state: SM2State = FRESH
    for (let i = 0; i < 20; i++) {
      state = computeSM2(state, QUALITY.AGAIN)
    }
    expect(state.easeFactor).toBeGreaterThanOrEqual(1.3)
  })

  it("clamps out-of-range quality values into the valid 0-5 scale instead of producing garbage", () => {
    const tooHigh = computeSM2(FRESH, 99)
    const tooLow = computeSM2(FRESH, -10)
    expect(tooHigh.easeFactor).toBeCloseTo(computeSM2(FRESH, 5).easeFactor, 5)
    expect(tooLow.intervalDays).toBe(1) // still treated as a failed recall
  })
})
