// Alias for /api/hint/rag. This used to be a separate, older implementation
// (no similar-problem retrieval, and it briefly pointed at gemini-2.0-flash,
// which was retired June 2026 — gemini-3.5-flash is the correct model). Kept
// as a re-export so any old client still pointed at /api/hint keeps working,
// without maintaining two copies of the same logic.
export { POST } from "@/app/api/hint/rag/route"
