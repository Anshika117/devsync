export const ADVANCED = [
  "Dynamic Programming", "Backtracking", "Divide and Conquer",
  "Quickselect", "Recursion", "Segment Tree", "Binary Indexed Tree"
]

export const INTERMEDIATE = [
  "Sliding Window", "Hash Table", "Math", "Binary Search",
  "Two Pointers", "Stack", "Queue", "Heap (Priority Queue)",
  "Greedy", "Depth-First Search", "Breadth-First Search",
  "Graph", "Tree", "Linked List", "Matrix"
]

const ADVANCED_LOWER = ADVANCED.map((t) => t.toLowerCase())
const INTERMEDIATE_LOWER = INTERMEDIATE.map((t) => t.toLowerCase())

export type FolderTier = "advanced" | "intermediate" | "fundamentals"

// Classifies an AUTO folder's name into the same three tiers getPrimaryTag()
// already uses to pick a folder in the first place — reused here (rather
// than invented separately) so the dashboard's grouped sections (Advanced /
// Intermediate / Fundamentals) always agree with how folders were assigned
// during sync. Compares case-insensitively: folders created before the
// case-normalization fix (or not yet run through the merge-duplicates tool)
// shouldn't silently get miscategorized into "Fundamentals" just because
// their stored name happens to be lowercase.
export function getFolderTier(name: string): FolderTier {
  const key = name.trim().toLowerCase()
  if (ADVANCED_LOWER.includes(key)) return "advanced"
  if (INTERMEDIATE_LOWER.includes(key)) return "intermediate"
  return "fundamentals"
}

// LeetCode and Codeforces don't share a tag vocabulary. LeetCode's official
// tags are Title Case ("Dynamic Programming", "Binary Search"). Codeforces's
// REST API returns tags lowercase and sometimes worded completely
// differently ("dp" instead of "Dynamic Programming", "graphs" instead of
// "Graph"). Without normalizing both onto one canonical name before tier
// matching, getPrimaryTag()'s exact string comparison would never match a
// Codeforces tag against these tiers at all — it'd fall straight through to
// the raw-tag fallback and create a second, differently-named/-cased AUTO
// folder for the exact same topic (e.g. "Dynamic Programming" from a
// LeetCode sync sitting right next to "dp" from a Codeforces sync). Keys
// here are lowercase; values are this app's one canonical name per topic.
const TAG_ALIASES: Record<string, string> = {
  "dp": "Dynamic Programming",
  "dynamic programming": "Dynamic Programming",
  "backtracking": "Backtracking",
  "divide and conquer": "Divide and Conquer",
  "recursion": "Recursion",
  "sliding window": "Sliding Window",
  "hashing": "Hash Table",
  "hash table": "Hash Table",
  "math": "Math",
  "binary search": "Binary Search",
  "two pointers": "Two Pointers",
  "stack": "Stack",
  "queue": "Queue",
  "heap": "Heap (Priority Queue)",
  "priority queue": "Heap (Priority Queue)",
  "heap (priority queue)": "Heap (Priority Queue)",
  "greedy": "Greedy",
  "dfs and similar": "Depth-First Search",
  "depth-first search": "Depth-First Search",
  "dfs": "Depth-First Search",
  "breadth-first search": "Breadth-First Search",
  "bfs": "Breadth-First Search",
  "graphs": "Graph",
  "graph": "Graph",
  "trees": "Tree",
  "tree": "Tree",
  "linked list": "Linked List",
  "matrices": "Matrix",
  "matrix": "Matrix",
  "strings": "String",
  "string": "String",
  "sortings": "Sorting",
  "sorting": "Sorting",
  "arrays": "Array",
  "array": "Array",
}

// Normalizes one raw tag (whatever case or platform-specific wording it
// arrived in) to this app's one canonical name for that topic. Anything not
// in the alias table gets title-cased as a best-effort default, so even an
// unrecognized tag still produces consistent casing instead of whatever
// casing that platform happened to send.
export function normalizeTag(tag: string): string {
  const key = tag.trim().toLowerCase()
  if (TAG_ALIASES[key]) return TAG_ALIASES[key]
  return key.replace(/\b\w/g, (c) => c.toUpperCase())
}

export function getPrimaryTag(tags: string[]): string {
  if (!tags || tags.length === 0) return "Uncategorized"
  const normalized = tags.map(normalizeTag)
  const advanced = normalized.find(t => ADVANCED.includes(t))
  if (advanced) return advanced
  const intermediate = normalized.find(t => INTERMEDIATE.includes(t))
  if (intermediate) return intermediate
  return normalized[0]
}

// Phrasings that signal a topic without naming it outright — the literal-name
// case (someone's statement just says "binary search") is already covered by
// scanning TAG_ALIASES itself, below.
const TOPIC_SIGNAL_PHRASES: Record<string, string> = {
  "subsequence": "Dynamic Programming",
  "subset sum": "Dynamic Programming",
  "shortest path": "Graph",
  "palindrome": "String",
  "anagram": "Hash Table",
  "kth smallest": "Heap (Priority Queue)",
  "median of": "Heap (Priority Queue)",
}

// Guesses a problem's topic branch from its raw statement text. This is the
// only signal the AI hint route actually gets in practice — AIAssistant.tsx
// never supplies real tags — so classification has to work off free text
// instead of assuming a tags array. Reuses TAG_ALIASES as the vocabulary
// (rather than a separate list) so a guess always lands on the same
// canonical name folders are already grouped by. Longest phrases are
// checked first so e.g. "hash table" wins over a shorter substring.
export function classifyTopicFromText(text: string): string | null {
  const haystack = text.toLowerCase()
  const table: Record<string, string> = { ...TAG_ALIASES, ...TOPIC_SIGNAL_PHRASES }
  const phrase = Object.keys(table).sort((a, b) => b.length - a.length).find(p => haystack.includes(p))
  return phrase ? table[phrase] : null
}
