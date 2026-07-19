import { describe, it, expect } from "vitest"
import { normalizeTag, getPrimaryTag, getFolderTier } from "@/lib/tagNormalizer"

describe("normalizeTag", () => {
  // The bug this whole fix was for: Codeforces sends lowercase/differently
  // worded tags, LeetCode sends Title Case official tags. Both must collapse
  // to the exact same string or a user ends up with two folders for one topic.
  it("maps Codeforces-style aliases to the same canonical name LeetCode uses", () => {
    expect(normalizeTag("dp")).toBe("Dynamic Programming")
    expect(normalizeTag("dynamic programming")).toBe("Dynamic Programming")
    expect(normalizeTag("Dynamic Programming")).toBe("Dynamic Programming")
  })

  it("normalizes 'binary search' and 'Binary Search' to one identical string", () => {
    expect(normalizeTag("binary search")).toBe(normalizeTag("Binary Search"))
    expect(normalizeTag("BINARY SEARCH")).toBe(normalizeTag("Binary Search"))
  })

  it("is whitespace-tolerant", () => {
    expect(normalizeTag("  dp  ")).toBe("Dynamic Programming")
  })

  it("maps differently-worded Codeforces tags to LeetCode's wording", () => {
    expect(normalizeTag("graphs")).toBe("Graph")
    expect(normalizeTag("trees")).toBe("Tree")
    expect(normalizeTag("dfs and similar")).toBe("Depth-First Search")
  })

  it("falls back to title-casing an unrecognized tag rather than leaving it verbatim", () => {
    // Not in the alias table at all - should still get consistent casing
    // instead of whatever case the source API happened to send.
    expect(normalizeTag("some brand new topic")).toBe("Some Brand New Topic")
  })
})

describe("getPrimaryTag", () => {
  it("prefers an Advanced-tier tag over Intermediate or Fundamental tags", () => {
    expect(getPrimaryTag(["Array", "Dynamic Programming", "Hash Table"])).toBe(
      "Dynamic Programming"
    )
  })

  it("prefers an Intermediate-tier tag over a plain Fundamental tag", () => {
    expect(getPrimaryTag(["Array", "Binary Search"])).toBe("Binary Search")
  })

  it("picks the same folder for equivalent tags regardless of source casing", () => {
    // Simulates a LeetCode-sourced problem and a Codeforces-sourced problem
    // on the same topic - both must resolve to the same primary tag so they
    // land in the same AUTO folder instead of two duplicate ones.
    const fromLeetCode = getPrimaryTag(["Dynamic Programming", "Array"])
    const fromCodeforces = getPrimaryTag(["dp", "arrays"])
    expect(fromLeetCode).toBe(fromCodeforces)
  })

  it("falls back to the first normalized tag when nothing matches a tier", () => {
    expect(getPrimaryTag(["Simulation", "Implementation"])).toBe("Simulation")
  })

  it("returns Uncategorized for an empty tag list", () => {
    expect(getPrimaryTag([])).toBe("Uncategorized")
  })
})

describe("getFolderTier", () => {
  it("classifies known Advanced/Intermediate folder names correctly", () => {
    expect(getFolderTier("Dynamic Programming")).toBe("advanced")
    expect(getFolderTier("Binary Search")).toBe("intermediate")
  })

  it("falls back to fundamentals for anything not in either tier list", () => {
    expect(getFolderTier("Array")).toBe("fundamentals")
    expect(getFolderTier("Uncategorized")).toBe("fundamentals")
  })

  // Folders created before the case-normalization fix (or not yet run
  // through the merge-duplicates tool) may still have lowercase names in
  // the database - classification must not silently dump those into
  // "Fundamentals" just because of casing.
  it("classifies case-insensitively so pre-fix duplicate folders still land in the right section", () => {
    expect(getFolderTier("binary search")).toBe("intermediate")
    expect(getFolderTier("dynamic programming")).toBe("advanced")
  })
})
