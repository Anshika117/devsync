# DevSync — AI-Powered DSA Tracker for FAANG Prep

<div align="center">

![DevSync Banner](https://img.shields.io/badge/DevSync-AI%20DSA%20Tracker-7F77DD?style=for-the-badge&logo=data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PHBhdGggZD0iTTEyIDJMMiA3bDEwIDUgMTAtNS0xMC01ek0yIDE3bDEwIDUgMTAtNS0xMC01eiIgZmlsbD0id2hpdGUiLz48L3N2Zz4=)

[![Live Demo](https://img.shields.io/badge/Live%20Demo-devsync--rho.vercel.app-1D9E75?style=for-the-badge&logo=vercel)](https://devsync-rho.vercel.app)
[![Next.js](https://img.shields.io/badge/Next.js-16.2.9-black?style=for-the-badge&logo=next.js)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?style=for-the-badge&logo=typescript)](https://typescriptlang.org)
[![Prisma](https://img.shields.io/badge/Prisma-7.x-2D3748?style=for-the-badge&logo=prisma)](https://prisma.io)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3ECF8E?style=for-the-badge&logo=supabase)](https://supabase.com)

**A full-stack platform that unifies your LeetCode and Codeforces problem history into a single intelligent workspace — with automatic topic classification, revision tracking, and AI-ready infrastructure.**

[Live Demo](https://devsync-rho.vercel.app) · [GitHub](https://github.com/Anshika117/devsync) · [Report Bug](https://github.com/Anshika117/devsync/issues)

</div>

---

## The Problem

Competitive programmers preparing for FAANG interviews face a fragmented workflow:

- LeetCode submissions live on LeetCode
- Codeforces solutions live on Codeforces  
- Notes live in Notion
- Revision schedules live in spreadsheets
- Nothing talks to anything else

**DevSync becomes the single source of truth** — pulling your entire problem history from multiple platforms, classifying it automatically by topic, and organizing it into a searchable, revisable workspace.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT LAYER                              │
│   Next.js 16 App Router · React 19 · Tailwind CSS v4            │
│   Server Components · Client Components · Route Handlers         │
└────────────────────────┬────────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────────┐
│                      API GATEWAY                                  │
│   NextAuth v5 Middleware · Session Validation · Route Guards     │
└────┬──────────────┬──────────────┬──────────────┬───────────────┘
     │              │              │              │
┌────▼────┐  ┌──────▼──────┐  ┌───▼────┐  ┌────▼────────┐
│  Sync   │  │   Folder    │  │Revision│  │  Profile    │
│ Service │  │   Engine    │  │ System │  │  Service    │
│         │  │             │  │        │  │             │
│ LC GQL  │  │ Tag Normal- │  │ Toggle │  │ Save LC/CF  │
│ CF REST │  │ izer        │  │ Stars  │  │ usernames   │
└────┬────┘  └──────┬──────┘  └───┬────┘  └────┬────────┘
     │              │              │              │
┌────▼──────────────▼──────────────▼──────────────▼───────────────┐
│                    DATA LAYER (Supabase PostgreSQL)               │
│   Prisma 7 ORM · PrismaPg Adapter · Connection Pooling           │
│   User · Folder · Problem · FolderProblem · ProblemProgress      │
│   ActivityLog · RevisionAlert · Goal · Account · Session         │
└─────────────────────────────────────────────────────────────────┘
```

---

## Core Engineering: The Sync Pipeline

The most technically interesting part of DevSync is the multi-platform sync pipeline. Here's the exact data flow:

```
User clicks "Sync LeetCode"
         │
         ▼
┌─────────────────────┐
│  Session Check      │  → 401 if not authenticated
│  auth() → user.id   │
└────────┬────────────┘
         │
         ▼
┌─────────────────────┐
│  LeetCode GraphQL   │  POST https://leetcode.com/graphql
│  recentAcSubmission │  → returns [{id, title, titleSlug, timestamp}]
│  List(limit: 50)    │
└────────┬────────────┘
         │
         ▼  (for each problem)
┌─────────────────────┐
│  Tag Fetch          │  POST https://leetcode.com/graphql
│  question(titleSlug)│  → returns [{topicTags: [{name}]}, difficulty]
└────────┬────────────┘
         │
         ▼
┌─────────────────────┐
│  Tag Normalizer     │  lib/tagNormalizer.ts
│  getPrimaryTag()    │  Priority: Advanced → Intermediate → Fundamental
│                     │  e.g. [Array, DP] → "Dynamic Programming"
└────────┬────────────┘
         │
         ▼
┌─────────────────────┐
│  Folder Engine      │  prisma.folder.upsert()
│  AUTO folder upsert │  WHERE userId_name_type (unique constraint)
│  CUSTOM preserved   │  type: AUTO | CUSTOM enum
└────────┬────────────┘
         │
         ▼
┌─────────────────────┐
│  Problem Upsert     │  prisma.problem.upsert()
│  + FolderProblem    │  WHERE url (unique)
│  join table write   │  M2M via FolderProblem join table
└────────┬────────────┘
         │
         ▼
┌─────────────────────┐
│  ActivityLog write  │  action: "LEETCODE_SYNC", status: "SUCCESS"
│  Observability      │  Enables: audit trail, rate limit checks,
│                     │  debugging sync failures per user
└─────────────────────┘
```

---

## Tag Classification System

The primary engineering decision in DevSync is how to assign a single folder to a problem with multiple tags.

**The Problem:** Two Sum has tags `[Array, Hash Table]`. Which folder?

**The Solution:** A 3-tier priority system mirroring LeetCode's own skill taxonomy:

```
Tag Priority Resolution
═══════════════════════

Input: ["Array", "Hash Table", "Dynamic Programming"]

Tier 1 — ADVANCED (highest priority)
┌─────────────────────────────────────────────┐
│ Dynamic Programming · Backtracking           │
│ Divide and Conquer · Quickselect             │
│ Segment Tree · Binary Indexed Tree           │
└─────────────────────────────────────────────┘
         ↓ match found → return "Dynamic Programming"

Tier 2 — INTERMEDIATE
┌─────────────────────────────────────────────┐
│ Sliding Window · Hash Table · Binary Search  │
│ Two Pointers · Stack · Queue · Greedy        │
│ DFS · BFS · Graph · Tree · Linked List       │
└─────────────────────────────────────────────┘
         ↓ no match at tier 1 → check here

Tier 3 — FUNDAMENTAL (fallback)
┌─────────────────────────────────────────────┐
│ Array · String · Sorting · Math · etc.       │
└─────────────────────────────────────────────┘
         ↓ use tags[0] as absolute fallback
```

**Why this design?**
- Mirrors LeetCode's own skill progression (Advanced > Intermediate > Fundamental)
- Deterministic — same tags always produce same folder
- No AI required — free, fast, consistent
- Users see folders organized by the same mental model they know from LeetCode

---

## Database Schema

11 tables with carefully considered relationships and indexes:

```
User
 ├── id, email, name, image, emailVerified
 ├── lcUsername, cfHandle          (platform identifiers)
 ├── → Folder[] (1:M)
 ├── → Problem[] (1:M)
 ├── → Goal[] (1:M)
 ├── → ProblemProgress[] (1:M)
 ├── → ActivityLog[] (1:M)
 ├── → RevisionAlert[] (1:M)
 └── → Account[], Session[]        (NextAuth tables)

Folder
 ├── id, name, userId
 ├── type: AUTO | CUSTOM            ← key design decision
 ├── @@unique([userId, name, type]) ← prevents duplicates per user
 └── → FolderProblem[] (M:M bridge)

Problem
 ├── id, title, platform, difficulty, tags[], url (unique), code, notes
 ├── userId, solvedAt, createdAt
 ├── @@index([userId])              ← fast user queries
 ├── @@index([platform])            ← filter by platform
 ├── @@index([difficulty])          ← filter by difficulty
 └── → FolderProblem[] (M:M bridge)

FolderProblem                       ← join table (many-to-many)
 ├── folderId, problemId
 ├── @@unique([folderId, problemId]) ← no duplicate assignments
 ├── @@index([folderId])
 └── @@index([problemId])

ProblemProgress                     ← revision intelligence
 ├── retentionScore, mistakeCount
 ├── lastViewedAt, lastRevisedAt
 └── revisionCount

ActivityLog                         ← observability
 └── action, status, error, createdAt

Goal                                ← weekly targets
 └── weeklyEasy, weeklyMed, weeklyHard, doneEasy, doneMed, doneHard
```

**Key schema decisions:**
- `FolderProblem` join table allows one problem to live in multiple folders (AUTO + Revision)
- `AUTO` vs `CUSTOM` folder type enforced at DB level — sync never overwrites user-created folders
- `ActivityLog` enables observability: "when did user X last sync, did it succeed?"
- Indexes on `userId`, `platform`, `difficulty` — the three most common filter dimensions

---

## Key Engineering Decisions

### 1. Why `FolderType` enum at the database level?

During sync, the system must update problem counts in AUTO folders without touching CUSTOM folders like "Google Interview Prep" or "Revision". Enforcing this at the schema level (not just application logic) means it's impossible to accidentally overwrite a user's custom organization — the unique constraint `@@unique([userId, name, type])` makes AUTO and CUSTOM namespaced separately.

### 2. Why two GraphQL calls per problem during sync?

LeetCode's `recentAcSubmissionList` returns submission metadata but **not** topic tags. A second call to `question(titleSlug)` fetches tags and difficulty. This is a known LeetCode API limitation. The tradeoff: 20 problems = 40 API calls. Acceptable at current scale; at 10,000 users this would need a queue with rate limiting and caching.

### 3. Why Prisma 7 with PrismaPg adapter?

Prisma 7 moved to a driver adapter model. `new PrismaClient()` without an adapter throws `PrismaClientInitializationError` on Supabase's connection pooler. The `PrismaPg` adapter passes the connection string explicitly, enabling compatibility with Supabase's pgBouncer pooler (port 6543) while using the direct connection (port 5432) for migrations.

### 4. Why the `globalThis` singleton for Prisma?

Next.js hot-reloads modules on every file save during development. Without storing the PrismaClient on `globalThis`, each reload opens a new database connection. PostgreSQL has a connection limit — exhausting it crashes the app. The singleton pattern stores one instance globally so hot reloads reuse the same connection.

### 5. Codeforces difficulty normalization

Codeforces uses a rating system (800–3500) rather than Easy/Medium/Hard labels. The normalization maps: `< 1200 → Easy`, `1200–1800 → Medium`, `≥ 1800 → Hard`. This creates a unified difficulty language across platforms so users can filter by difficulty regardless of where a problem came from.

---

## Tech Stack

| Layer | Technology | Version | Why |
|-------|-----------|---------|-----|
| Framework | Next.js App Router | 16.2.9 | RSC reduces client JS; API routes colocated; single Vercel deploy |
| Language | TypeScript | ^5 | End-to-end type safety from DB schema to UI |
| Auth | NextAuth v5 + PrismaAdapter | beta.25 | Google OAuth in one config file; auto user creation via adapter |
| ORM | Prisma | 7.8.0 | Schema-first, single source of truth for types |
| DB Adapter | PrismaPg | 7.8.0 | Required for Prisma 7 with Supabase connection pooler |
| Database | Supabase PostgreSQL | — | Managed Postgres with pgvector ready for v2 RAG pipeline |
| Styling | Tailwind CSS | v4 | Utility-first, no runtime CSS |
| Deployment | Vercel | — | Zero-config Next.js deploy, auto deploys on push |

---

## Features

### ✅ Implemented (v1)
- **Google OAuth** — one-click sign in, user row auto-created via PrismaAdapter
- **LeetCode Sync** — GraphQL API, fetches accepted submissions with topic tags
- **Codeforces Sync** — REST API, rating-to-difficulty normalization
- **Auto Folder Creation** — 3-tier tag priority classifier creates topic folders during sync
- **Custom Folders** — user-created folders (Revision, Google Prep, etc.) never touched by sync
- **Problem Cards** — title links to original platform, difficulty badge, topic tags
- **Search & Filter** — client-side real-time search + difficulty filter per folder
- **Revision Stars** — star a problem → added to Revision CUSTOM folder
- **Profile Page** — save LC username and CF handle, trigger syncs
- **ActivityLog** — every sync logged with status for observability
- **Dashboard** — real-time problem count, folder count, weekly goal placeholder

### 🔲 Roadmap (v2)
- **RAG Pipeline** — embed notes with OpenAI text-embedding-3-small, store in pgvector, personalized hints via GPT-4o
- **SM-2 Spaced Repetition** — scientifically optimal revision scheduling (same algorithm as Anki)
- **AI Problem Visualizer** — paste problem statement → animated visual breakdown via GPT-4o
- **Real-time Collab Rooms** — Socket.IO rooms for pair problem-solving, ephemeral state with DB persistence
- **Redis Caching** — sync results cached 10min, rate limiting per user, last-sync timestamp
- **Revision Intelligence** — scoring function: time since last seen × difficulty × topic weakness ratio

---

## Local Setup

```bash
# 1. Clone
git clone https://github.com/Anshika117/devsync.git
cd devsync

# 2. Install
npm install --legacy-peer-deps

# 3. Environment variables
cp .env.example .env.local
# Fill in: DATABASE_URL, DIRECT_URL, AUTH_SECRET, AUTH_GOOGLE_ID, AUTH_GOOGLE_SECRET

# 4. Database
npx prisma migrate dev
npx prisma generate

# 5. Run
npm run dev
# → http://localhost:3000
```

### Required Environment Variables

```env
DATABASE_URL=          # Supabase pooled connection (port 6543)
DIRECT_URL=            # Supabase direct connection (port 5432)
AUTH_SECRET=           # Random secret: openssl rand -base64 32
AUTH_GOOGLE_ID=        # Google OAuth client ID
AUTH_GOOGLE_SECRET=    # Google OAuth client secret
NEXTAUTH_URL=          # http://localhost:3000 (local) or your Vercel URL
AUTH_TRUST_HOST=true
```

---

## Project Structure

```
devsync/
├── app/
│   ├── api/
│   │   ├── auth/[...nextauth]/    # NextAuth handler
│   │   ├── sync/
│   │   │   ├── leetcode/          # POST /api/sync/leetcode
│   │   │   └── codeforces/        # POST /api/sync/codeforces
│   │   ├── revision/toggle/       # POST /api/revision/toggle
│   │   └── profile/update/        # POST /api/profile/update
│   ├── dashboard/                 # Main dashboard (server component)
│   ├── folders/[folderId]/        # Dynamic folder detail page
│   ├── profile/                   # Profile + sync controls
│   └── login/                     # Google OAuth entry point
├── components/
│   ├── Navbar.tsx                 # Top navigation
│   ├── ProblemList.tsx            # Client component: search + filter + cards
│   └── ProfileForm.tsx            # Client component: username inputs + sync buttons
├── lib/
│   ├── prisma.ts                  # Singleton PrismaClient with PrismaPg adapter
│   └── tagNormalizer.ts           # 3-tier priority tag → folder classifier
├── prisma/
│   ├── schema.prisma              # 11-table schema, source of truth for all types
│   └── migrations/                # Migration history
├── auth.ts                        # NextAuth config: Google provider + PrismaAdapter
├── prisma.config.ts               # Prisma 7 config: schema path + datasource URLs
└── DECISIONS.md                   # Architectural decision log (interview prep)
```

---

## What I Learned Building This

This project taught me things no tutorial covers:

1. **Prisma 7 breaking change** — The move to driver adapters is not well-documented. Debugging `PrismaClientInitializationError` on Supabase's pooler taught me how connection poolers work and why Prisma abstracted the driver layer.

2. **NextAuth v5 adapter requirements** — The `emailVerified DateTime?` field must exist on the User model or PrismaAdapter throws a cryptic `AdapterError`. Understanding why (NextAuth v5 supports magic links which need email verification state) deepened my understanding of auth flows.

3. **LeetCode API limitations** — The public GraphQL API caps `recentAcSubmissionList` at 20 regardless of the `limit` parameter. Real-world APIs have undocumented constraints. The right response is to design around it (incremental sync) not fight it.

4. **TypeScript strictness in production** — Local `tsc --noEmit` passes but Vercel's build fails on implicit `any` types. Production build pipelines are stricter than development. Every parameter needs explicit types.

---

## Author

**Anshika Sinha** — 2nd year CS student at BIT Mesra.

- GitHub: [@Anshika117](https://github.com/Anshika117)
- LeetCode: [Anna023](https://leetcode.com/u/Anna023)
- Codeforces: [Anshika117](https://codeforces.com/profile/Anshika117)

---

<div align="center">
<sub>Built with Next.js, Prisma, Supabase, and a lot of debugging. Star this repo if it helped you.</sub>
</div>
