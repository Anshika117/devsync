import { describe, it, expect } from "vitest"
import {
  parseBody,
  folderCreateSchema,
  folderSetTierSchema,
  problemReviewSchema,
  profileUpdateSchema,
  hintRagSchema,
} from "@/lib/validation"

describe("parseBody", () => {
  it("returns { data } with the parsed (and coerced/defaulted) shape on success", () => {
    const result = parseBody(folderCreateSchema, { name: "  Graphs  " })
    expect("data" in result && result.data.name).toBe("Graphs") // trimmed by the schema
  })

  it("returns a 400 NextResponse on failure instead of throwing", async () => {
    const result = parseBody(folderCreateSchema, { name: "" })
    expect("error" in result).toBe(true)
    if ("error" in result) {
      expect(result.error.status).toBe(400)
      const body = await result.error.json()
      expect(body.error).toBeTruthy()
    }
  })

  it("rejects a request body that isn't even an object", () => {
    const result = parseBody(folderCreateSchema, "not an object")
    expect("error" in result).toBe(true)
  })
})

describe("folderSetTierSchema", () => {
  it("accepts the three real tiers", () => {
    for (const tier of ["ADVANCED", "INTERMEDIATE", "FUNDAMENTALS"]) {
      const result = parseBody(folderSetTierSchema, { folderId: "f1", tier })
      expect("data" in result).toBe(true)
    }
  })

  it("rejects a tier value that isn't one of the three — the exact bug class this replaces manual checks for", () => {
    const result = parseBody(folderSetTierSchema, { folderId: "f1", tier: "EXPERT" })
    expect("error" in result).toBe(true)
  })
})

describe("problemReviewSchema", () => {
  it("accepts quality 0 through 5", () => {
    for (const quality of [0, 1, 2, 3, 4, 5]) {
      const result = parseBody(problemReviewSchema, { problemId: "p1", quality })
      expect("data" in result).toBe(true)
    }
  })

  it("rejects out-of-range quality instead of letting it reach computeSM2()", () => {
    expect("error" in parseBody(problemReviewSchema, { problemId: "p1", quality: 6 })).toBe(true)
    expect("error" in parseBody(problemReviewSchema, { problemId: "p1", quality: -1 })).toBe(true)
  })

  it("rejects a non-number quality (e.g. the string \"5\") — a type check manual validation missed", () => {
    const result = parseBody(problemReviewSchema, { problemId: "p1", quality: "5" })
    expect("error" in result).toBe(true)
  })
})

describe("profileUpdateSchema", () => {
  it("allows lcUsername/cfHandle/bufferDay to be omitted entirely", () => {
    expect("data" in parseBody(profileUpdateSchema, {})).toBe(true)
  })

  it("still enforces bufferDay's 0-6 range", () => {
    expect("error" in parseBody(profileUpdateSchema, { bufferDay: 7 })).toBe(true)
    expect("data" in parseBody(profileUpdateSchema, { bufferDay: 6 })).toBe(true)
  })
})

describe("hintRagSchema", () => {
  it("defaults tags to [] when the caller omits it (matches AIAssistant.tsx's actual request shape)", () => {
    const result = parseBody(hintRagSchema, { problemStatement: "Given an array..." })
    expect("data" in result && result.data.tags).toEqual([])
  })

  it("rejects an empty/whitespace-only problem statement", () => {
    expect("error" in parseBody(hintRagSchema, { problemStatement: "   " })).toBe(true)
  })
})
