const ADVANCED = [
    "Dynamic Programming", "Backtracking", "Divide and Conquer",
    "Quickselect", "Recursion", "Segment Tree", "Binary Indexed Tree"
  ]
  
  const INTERMEDIATE = [
    "Sliding Window", "Hash Table", "Math", "Binary Search",
    "Two Pointers", "Stack", "Queue", "Heap (Priority Queue)",
    "Greedy", "Depth-First Search", "Breadth-First Search",
    "Graph", "Tree", "Linked List", "Matrix"
  ]
  
  export function getPrimaryTag(tags: string[]): string {
    if (!tags || tags.length === 0) return "Uncategorized"
    const advanced = tags.find(t => ADVANCED.includes(t))
    if (advanced) return advanced
    const intermediate = tags.find(t => INTERMEDIATE.includes(t))
    if (intermediate) return intermediate
    return tags[0]
  }