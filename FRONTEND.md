# FRONTEND.md — Frontend Architecture & Strategy

This file is the authoritative reference for all frontend work on this project.
Read this alongside CLAUDE.md before writing any frontend code. Decisions here
are intentional — do not deviate without explicit instruction.

---

## Stack

| Concern | Tool | Notes |
|---|---|---|
| Framework | Next.js 14 (App Router) | Server components where possible, client components for interactivity |
| Styling | Tailwind CSS | Utility classes only — no inline styles, no CSS modules |
| Components | shadcn/ui | Listed explicitly below — only install what's listed |
| Data fetching | SWR | GET requests only; mutations use plain `fetch` |
| API client | `lib/api.ts` | Typed wrapper — all fetch calls go through here |
| Types | `lib/types.ts` | All TypeScript interfaces live here |
| Hooks | `lib/hooks/` | One hook file per page/feature |

---

## Non-Negotiables

- No TypeScript `any` — every value must be typed
- No inline styles — Tailwind classes only
- No direct `fetch` in components — always go through `lib/api.ts`
- No SWR for mutations — use `fetch` + `mutate()` to update cache
- No `useEffect` for data fetching — use SWR hooks
- All shadcn components installed via `npx shadcn@latest add <component>` — never copy-paste manually
- Server components are the default — add `"use client"` only where interactivity requires it

---

## Folder Structure

```
frontend/
├── app/
│   ├── layout.tsx               ← Root layout: NavBar + Toaster
│   ├── page.tsx                 ← redirect("/dashboard")
│   ├── dashboard/
│   │   └── page.tsx             ← Stat cards + recent items
│   ├── documents/
│   │   └── page.tsx             ← Upload zone + document table + drawer
│   ├── chat/
│   │   └── page.tsx             ← Full chat interface
│   └── experiments/
│       ├── page.tsx             ← Generate dataset + experiment list
│       └── [id]/
│           └── page.tsx         ← Experiment detail
│
├── components/
│   ├── ui/                      ← shadcn auto-generated (do not hand-edit)
│   ├── documents/
│   │   ├── UploadZone.tsx           ← Drag-and-drop file uploader
│   │   ├── DocumentTable.tsx        ← Paginated document list with SWR polling
│   │   ├── DocumentDrawer.tsx       ← Sheet drawer: metadata + chunk inspector
│   │   ├── ChunkInspector.tsx       ← Paginated chunk table inside the drawer
│   │   └── PipelineStepBadge.tsx    ← Step progress indicator during ingestion
│   ├── chat/
│   │   ├── ConfigPanel.tsx          ← Strategy, top-k, document filter sidebar
│   │   ├── ChatThread.tsx           ← Scrollable message history
│   │   ├── MessageBubble.tsx        ← User and assistant message rendering
│   │   ├── SourceCard.tsx           ← Individual retrieved chunk card (with relative score bar)
│   │   ├── RetrievalExplainer.tsx   ← Collapsible "how retrieval worked" panel
│   │   └── ChatInput.tsx            ← Textarea + send button
│   ├── experiments/
│   │   ├── GenerateDatasetForm.tsx  ← Dataset generation form card
│   │   ├── CreateRunDialog.tsx      ← Dialog for creating an experiment run
│   │   ├── ExperimentTable.tsx      ← List with SWR polling + score display
│   │   ├── AggregateScores.tsx      ← Four stat tiles on detail page
│   │   ├── ResultsTable.tsx         ← Per-question results with expand + judge reasoning
│   │   └── CompareTable.tsx         ← Side-by-side multi-experiment comparison
│   └── shared/
│       ├── NavBar.tsx               ← Top navigation bar
│       ├── StatusBadge.tsx          ← Colored badge for document/experiment status
│       ├── ScoreBar.tsx             ← Horizontal bar + number for eval scores
│       ├── RelativeScoreBar.tsx     ← Score bar sized relative to set max (used in SourceCard)
│       ├── GlossaryTooltip.tsx      ← Tooltip wrapper for technical terms
│       └── ChunkCard.tsx            ← Reused in SourceCard and ChunkInspector
│
└── lib/
    ├── api.ts                   ← All typed fetch wrappers
    ├── types.ts                 ← All TypeScript interfaces
    ├── glossary.ts              ← Static GLOSSARY map: term → tooltip definition
    └── hooks/
        ├── useDocuments.ts      ← SWR hook, polling logic
        ├── useDocument.ts       ← Single document + chunks
        ├── useExperiments.ts    ← SWR hook, polling logic
        ├── useExperiment.ts     ← Single experiment + results
        └── useChat.ts           ← SSE stream state machine
```

---

## shadcn Components

Install exactly these — no others unless explicitly added to this list:

| Component | Used for |
|---|---|
| `button` | All interactive buttons |
| `card` | Stat tiles, form cards, source cards |
| `table` | Document list, chunk inspector, experiment results |
| `badge` | Status badges, strategy labels |
| `sheet` | Document detail drawer |
| `dialog` | Create experiment run modal, delete confirmation |
| `input` | Text fields in forms |
| `textarea` | Chat input |
| `select` | Document selector in generate form, strategy selector |
| `slider` | Top-k slider in chat config |
| `checkbox` | Document filter multi-select in chat config |
| `radio-group` | Strategy selector in chat config panel |
| `label` | Form labels |
| `scroll-area` | Chat thread, chunk inspector |
| `skeleton` | Loading states throughout |
| `tooltip` | Error message on failed-status badges |
| `collapsible` | Chunk content expand/collapse, experiment config block |
| `separator` | Layout dividers |
| `sonner` | Toast notifications (upload success, errors, eval complete) |
| `tabs` | Experiment detail: Overview tab vs Per-Question tab |

---

## API Client (`lib/api.ts`)

All backend communication goes through typed functions in `lib/api.ts`. Components
never call `fetch` directly.

### Pattern

```typescript
// Every function returns typed data or throws an ApiError.
// Callers handle errors — api.ts does not swallow them.

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, init);
  if (!res.ok) {
    const detail = await res.json().catch(() => ({ detail: res.statusText }));
    throw new ApiError(res.status, detail.detail ?? res.statusText);
  }
  return res.json() as Promise<T>;
}
```

### Exposed functions (one per backend endpoint)

```typescript
// Documents
uploadDocument(file: File): Promise<DocumentUploadResponse>
listDocuments(params?: { status?: DocumentStatus; limit?: number; offset?: number }): Promise<DocumentListItem[]>
getDocument(id: string): Promise<DocumentDetail>
listChunks(documentId: string, params?: { limit?: number; offset?: number }): Promise<ChunkListResponse>
deleteDocument(id: string): Promise<void>           // not yet in backend — placeholder

// Search
search(request: SearchRequest): Promise<SearchResponse>

// Chat — returns a ReadableStream, not JSON (SSE)
chatStream(request: ChatRequest): Promise<ReadableStream<Uint8Array>>

// Evals
generateDataset(request: GenerateDatasetRequest): Promise<GenerateDatasetResponse>
createExperiment(request: CreateExperimentRequest): Promise<ExperimentListItem>
listExperiments(params?: { status?: ExperimentStatus; limit?: number; offset?: number }): Promise<ExperimentListItem[]>
getExperiment(id: string): Promise<ExperimentDetail>
```

---

## TypeScript Types (`lib/types.ts`)

All interfaces mirror the Pydantic response models exactly. If a backend field
changes, update here first and let TypeScript errors guide the component fixes.

Key types to define (matching backend):

```typescript
// Enums
type DocumentStatus = "pending" | "processing" | "ready" | "failed"
type ExperimentStatus = "pending" | "running" | "complete" | "failed"
type RetrievalStrategy = "vector" | "bm25" | "hybrid"

// Documents
interface DocumentListItem { ... }
interface DocumentDetail extends DocumentListItem { chunk_count: number }
interface ChunkItem { ... }
interface ChunkListResponse { document_id: string; total_chunks: number; chunks: ChunkItem[] }

// Chat
interface ChatRequest {
  query: string
  strategy: RetrievalStrategy
  top_k: number
  document_ids?: string[]
}

// SSE events (parsed from the stream)
type SSEEvent =
  | { type: "sources"; chunks: RetrievedChunk[] }
  | { type: "token"; text: string }
  | { type: "done" }
  | { type: "error"; detail: string }

// Evals
interface ExperimentListItem { ... }
interface ExperimentDetail extends ExperimentListItem { config: Record<string, unknown>; eval_results: EvalResultItem[] }
interface EvalResultItem { ... }
```

---

## SSE Handling Strategy

The chat endpoint is `POST /api/v1/chat`, so `EventSource` (GET-only) cannot be used.
Instead: `fetch` → `response.body` (ReadableStream) → decode lines → parse events.

### `useChat` hook state machine

```
idle → sending → streaming_sources → streaming_tokens → done
                                                       → error
```

States:
- `idle` — input enabled, send button enabled
- `sending` — POST in flight, input disabled, spinner on send button
- `streaming_sources` — sources SSE event received, source cards rendered, waiting for first token
- `streaming_tokens` — token events arriving, text building up, blinking cursor
- `done` — complete, copy button visible, input re-enabled
- `error` — toast notification, input re-enabled

### SSE line parsing

Each SSE event is:
```
data: {"type": "sources", "chunks": [...]}
data: {"type": "token", "text": "The"}
data: {"type": "done"}
```

Parse: split stream by `\n`, filter lines starting with `data: `, strip prefix, `JSON.parse`.

---

## SWR Polling Strategy

Only poll when there are in-flight items. Do not poll completed items.

```typescript
// In useDocuments hook:
const hasInFlight = documents?.some(
  d => d.status === "pending" || d.status === "processing"
)

useSWR("/api/v1/documents", fetcher, {
  refreshInterval: hasInFlight ? 3000 : 0,
})
```

Same pattern in `useExperiments` — poll every 5s when any experiment is `pending` or `running`.

After a mutation (upload, delete, create run), call `mutate()` immediately to
refresh the cache without waiting for the next interval.

---

## Page Details

### `/` → redirect to `/dashboard`

```typescript
// app/page.tsx
import { redirect } from "next/navigation"
export default function Home() { redirect("/dashboard") }
```

---

### `/dashboard`

**Server component.** Fetches initial data server-side, passes to client components.

Layout: full-width, single column.

**Stat cards row** (4 × `Card`):
- Total Documents
- Documents Ready
- Total Chunks (sum across all ready docs — derive from document list, or add a future `/stats` endpoint)
- Experiments Run

**Two-column grid:**
- Left: Recent Documents (last 5) — filename, StatusBadge, relative time. Link to `/documents`.
- Right: Recent Experiments (last 5) — name, strategy badge, aggregate scores. Link to `/experiments/{id}`.

**Quick action buttons:**
- "Upload a document" → `/documents`
- "Start chatting" → `/chat`
- "Run an eval" → `/experiments`

---

### `/documents`

**Client component** (needs SWR + interactivity).

**UploadZone** (top):
- Drag-and-drop area using browser drag events — no external DnD library
- Shows file name + size on file select
- On submit: `uploadDocument(file)` → toast "Upload started" → `mutate()` to refresh list
- Accept: `.pdf,.txt,.md`
- Disabled + spinner while in-flight

**DocumentTable** (below upload zone):
- Columns: Filename | Type | Size | Status | Chunks | Uploaded | Actions
- Status column: `PipelineStepBadge` while `processing`, `StatusBadge` for all other states
- `Tooltip` on `failed` badge showing `error_message`
- Chunks column: shows count when `ready`, dash otherwise
- Actions: "Inspect" button (opens drawer), delete icon button (opens confirm Dialog)
- SWR polling: 3s interval when any doc is pending/processing
- Pagination: 20 per page, Previous/Next buttons

**DocumentDrawer** (Sheet, opens from right):
- Trigger: "Inspect" button on a row
- Width: `w-2/3` or `max-w-2xl`
- Header: filename + StatusBadge
- Metadata section: mime type, file size, uploaded at, chunk count
- **ChunkInspector** (below metadata):
  - Paginated table: Index | Page | Chars | Strategy | Content (preview)
  - Content cell: first 120 chars, "Show more" Collapsible to expand full text
  - 10 chunks per page

---

### `/chat`

**Client component** — all state lives here.

**Layout:** `flex h-screen` — left panel fixed width, right panel fills remaining space.

**ConfigPanel** (left, `w-72`, sticky):
- **Strategy** — RadioGroup: vector | bm25 | hybrid (default: hybrid). Each label wrapped in `GlossaryTooltip`.
- **Top-k** — Slider 1–20 with numeric label (default: 5). Label wrapped in `GlossaryTooltip`.
- **Documents** — ScrollArea with Checkbox list of ready documents; "All documents" when none selected
- Config values held in React state, passed to `useChat`

**ChatThread** (center, ScrollArea, fills height):
- Scrolls to bottom on new content
- Empty state: "Ask a question about your documents."
- Message list: alternating user/assistant turns
- **User MessageBubble:** right-aligned, gray background
- **Assistant MessageBubble:** left-aligned, contains:
  1. **Source cards row** (horizontal ScrollArea) — rendered immediately on `sources` event, before any tokens arrive. Each `SourceCard`: document filename (bold), chunk index + page number, `RelativeScoreBar` (score sized relative to max score in set), 150-char content preview with Collapsible to expand.
  2. **RetrievalExplainer** — collapsed by default, sits between source cards and streaming text. See Educational Features § 2.
  3. **Streaming text** — builds token by token. Blinking cursor `|` using CSS animation while `streaming_tokens`. No cursor when `done`.
  4. **Copy button** — appears after `done`, copies full generated text to clipboard.

**ChatInput** (bottom, sticky):
- Textarea (auto-resize up to 4 lines)
- Character counter `{n}/2000`
- Send button — disabled when `status !== "idle"` or query empty
- Shift+Enter for newline, Enter to send

---

### `/experiments`

**Client component.**

**GenerateDatasetForm** (Card at top):
- Document Select (only ready documents)
- Chunks to sample: Input, default 20
- QA pairs per chunk: Input, default 1
- Generate button → `generateDataset()` → on success: green banner showing pair count + dataset filename
- Generated `dataset_file` is stored in React state and auto-populated in CreateRunDialog

**Experiment runs header row:**
- Title "Experiment Runs"
- "+ New Run" Button → opens CreateRunDialog
- "Compare" toggle button → enters compare mode (see below)

**ExperimentTable:**
- Columns: Name | Strategy | Status | Faithfulness | Relevance | Recall | Questions | Created | Actions
- Score column headers wrapped in `GlossaryTooltip`
- Score columns: colored number (green ≥ 0.8, yellow 0.5–0.8, red < 0.5), dash when not yet complete
- Recall column: shown as fraction e.g. `14/18` derived from `avg_recall × total_questions`
- StatusBadge with spinner animation for `running`
- SWR polling: 5s when any experiment is pending/running
- Click row → navigate to `/experiments/{id}` (normal mode) or toggle checkbox (compare mode)

**Compare mode** (toggled via "Compare" button):
- Rows show checkboxes; user selects 2–4 completed experiments
- `CompareTable` renders below the list showing selected runs side-by-side
- State is URL-driven: `?compare=id1,id2` — shareable links
- See Educational Features § 5 for full CompareTable spec

**CreateRunDialog** (Dialog):
- Name: Input
- Dataset file: Input (pre-filled from GenerateDatasetForm if available)
- Retrieval strategy: Select
- Top-k: Input, default 5
- Chunking strategy: Input, pre-filled `fixed_size_v1`
- Embedding model: Input, pre-filled `voyage-3`
- Document filter: same Checkbox list as chat config (optional)
- Submit → `createExperiment()` → close dialog → `mutate()` → toast "Experiment queued"

---

### `/experiments/[id]`

**Client component** (needs SWR for polling running experiments).

**Header:** experiment name (h1) + StatusBadge + strategy Badge

**AggregateScores** (4 × Card stat tiles, below header):
- Avg Faithfulness | Avg Relevance | Avg Recall | Total Questions
- Each tile: large number, color-coded (same green/yellow/red scale)
- Shown as `—` when experiment is not yet complete

**Config block** (Collapsible Card):
- Collapsed by default, "Show config" trigger
- Content: `<pre>` formatted JSON of `experiment.config`

**ResultsTable** (Tabs: "Results" | "Raw"):
- **Results tab:**
  - Columns: Question | Expected | Generated | Faithful | Relevant | Recall
  - Text columns: 80-char truncation, Collapsible to show full text
  - Score columns: `GlossaryTooltip` on header labels; colored number in cells
  - Recall: green checkmark (`✓`) for 1.0, red cross (`✗`) for 0.0 — header has `GlossaryTooltip`
  - Click row → expand inline detail:
    - Full question text
    - Expected answer vs generated answer side-by-side (two-column grid)
    - Faithfulness score + quoted judge reasoning block (italic, gray background)
    - Relevance score + quoted judge reasoning block
    - Recall result — no reasoning (pure Python binary check)
- **Raw tab:**
  - Full JSON of all `eval_results` in a `<pre>` block inside ScrollArea
  - Useful for exporting/debugging

SWR polling: 5s if `status === "running"`, stops when complete.

---

## Status Badge Color Map

Consistent across documents and experiments:

| Status | Color | Extra |
|---|---|---|
| `pending` | gray | static |
| `processing` / `running` | yellow | spinning dot |
| `ready` / `complete` | green | static |
| `failed` | red | Tooltip with error detail |

---

## Score Color Map

Used in ExperimentTable and ResultsTable:

| Range | Color |
|---|---|
| ≥ 0.8 | green (`text-green-600`) |
| 0.5 – 0.79 | yellow (`text-yellow-600`) |
| < 0.5 | red (`text-red-600`) |

---

## NavBar

Top-level horizontal nav. Rendered in `app/layout.tsx` (server component shell,
client component for active link highlighting).

Links: **Dashboard** | **Documents** | **Chat** | **Experiments**

Active link: underline or background highlight using `usePathname()`.

Logo/title: "RAG Platform" left-aligned.

---

## Error Handling

- API errors (non-2xx) → `sonner` toast with `error.message`
- Network errors → toast "Could not reach the server"
- SSE `error` event → inline error message in the chat thread below the source cards
- 404 on experiment detail → Next.js `notFound()` → default 404 page

---

## Loading States

- Document list: `Skeleton` rows (3 rows × full width) while SWR loads initial data
- Experiment list: same skeleton pattern
- Experiment detail scores: `Skeleton` tiles while loading
- Chat: no skeleton — empty state shown until first message

---

## Educational Features

A core goal of this platform is making the RAG pipeline legible and teachable.
The following features are first-class requirements, not nice-to-haves.

---

### Feature 1 — Ingestion Pipeline Step Tracker

**What it teaches:** What actually happens to a file after upload — the biggest black box for newcomers.

**Backend prerequisite:** Add a `pipeline_step: str | None` field to the Document API response,
updated by the Celery task as each step starts (`"parsing"`, `"chunking"`, `"embedding"`).
No migration needed — derive from existing `status` or add a column.

**Frontend:**
- `PipelineStepBadge` component replaces the static `processing` label while a doc is in flight
- Shows a step sequence: `Upload → Parse → Chunk → Embed → Store`
- Active step highlighted; completed steps grayed-out with checkmark
- Shown in both the `DocumentTable` status column and the `DocumentDrawer` header
- Uses existing `StatusBadge` for terminal states (`ready`, `failed`, `pending`)

---

### Feature 2 — Retrieval Explainer in Chat

**What it teaches:** How each retrieval strategy works; why these specific chunks were returned.

**Backend prerequisite:** None. All required data is already in the `SearchResponse`.

**Frontend (`RetrievalExplainer` component):**
- Rendered inside each assistant `MessageBubble`, between source cards and streaming text
- Collapsible (collapsed by default, "How retrieval worked ▾" trigger)
- Content:
  - Strategy badge + one-sentence plain-English description:
    - `vector` → "Chunks were ranked by cosine similarity between your query embedding and document embeddings."
    - `bm25` → "Chunks were ranked by BM25 keyword frequency — no embeddings used."
    - `hybrid` → "Vector and BM25 rankings were fused using Reciprocal Rank Fusion (RRF, k=60). Each chunk's RRF score = 1/(k + vector_rank) + 1/(k + bm25_rank)."
  - Stat row: `{top_k} chunks returned` · `score range {min}–{max}`
  - For hybrid only: a small table showing top-5 chunks with their vector rank, BM25 rank, and final RRF rank side by side

---

### Feature 3 — Inline Glossary Tooltips

**What it teaches:** RAG terminology in context, without requiring the user to leave the page.

**Backend prerequisite:** None.

**Frontend (`GlossaryTooltip` component):**
```tsx
<GlossaryTooltip term="cosine similarity">
  Cosine similarity
</GlossaryTooltip>
```
Wraps any text node with a `Tooltip` (shadcn). The tooltip content is a short definition
stored in a static `GLOSSARY` map in `lib/glossary.ts`.

Terms to cover (at minimum):

| Term | Tooltip text |
|---|---|
| cosine similarity | A score (0–1) measuring the angle between two embedding vectors. 1 = identical meaning, 0 = unrelated. |
| BM25 | A keyword ranking algorithm based on term frequency and document length. No embeddings — fast and interpretable. |
| Reciprocal Rank Fusion (RRF) | A fusion method: score = Σ 1/(k + rank_i). Combines rankings from multiple retrievers without needing comparable scores. |
| top-k | The number of chunks returned by retrieval. Higher k = more context for the LLM, but also more noise. |
| chunking strategy | How a document is split into pieces. Chunk size and overlap affect what fits in a single retrieved result. |
| embedding | A fixed-length vector of numbers representing the semantic meaning of a piece of text. Similar texts have similar vectors. |
| faithfulness | Does the generated answer only contain information present in the retrieved chunks? LLM-as-judge scores 1–5. |
| relevance | Are the retrieved chunks actually relevant to the question? LLM-as-judge scores 1–5. |
| recall | Did retrieval return the chunk that was used to generate the ground-truth answer? Binary: 1 or 0. |
| LLM-as-judge | Using a language model (Claude Haiku) to score answer quality on a numeric scale, instead of exact-match metrics. |

Apply `GlossaryTooltip` in:
- `ConfigPanel` (strategy labels, top-k label)
- `RetrievalExplainer` (all strategy names)
- `AggregateScores` tile labels
- `ResultsTable` column headers
- `ExperimentTable` score column headers

---

### Feature 4 — Judge Reasoning Visibility

**What it teaches:** Why a score was given — makes eval results genuinely informative rather than opaque numbers.

**Backend prerequisite (required before building this UI):**
- Update `score_faithfulness` and `score_relevance` in `backend/services/evaluation/metrics.py`
  to return `(score: float, reasoning: str)` tuples.
  The LLM-as-judge prompt should ask for JSON: `{"rating": 3, "reasoning": "..."}`
- Add `faithfulness_reasoning: str | None` and `relevance_reasoning: str | None`
  columns to `eval_results` table via Alembic migration.
- Populate in `backend/workers/tasks/eval.py`.

**Frontend:**
- In `ResultsTable`, the per-question expanded row (click to expand) includes:
  - Full question text
  - Expected answer vs generated answer side-by-side
  - **Faithfulness score + judge reasoning** in a quoted block
  - **Relevance score + judge reasoning** in a quoted block
  - Recall result (checkmark/cross) — no reasoning needed (pure Python)

---

### Feature 5 — Experiment Comparison View

**What it teaches:** How retrieval strategy, top-k, or chunking strategy changes affect quality scores.

**Backend prerequisite:** None. Uses existing `listExperiments` + `getExperiment` API calls.

**Frontend:**
- On `/experiments`, add a **"Compare" toggle** button in the header row.
- In compare mode, experiment table rows get checkboxes; select 2–4 runs.
- A `CompareTable` appears below (or replaces the list) showing:
  - Row per selected experiment, columns: Name | Strategy | Top-k | Faithfulness | Relevance | Recall | Questions
  - Score cells color-coded as usual
  - A delta column for the 2nd+ experiment: `+0.12` green / `-0.05` red vs the first selected run
- "Exit compare" button returns to normal list view.
- State is URL-driven: `/experiments?compare=id1,id2` so it's shareable.

---

### Feature 6 — Relative Score Bar in Source Cards

**What it teaches:** Whether the top chunk was dramatically more relevant or only marginally better than the others.

**Backend prerequisite:** None. All scores are in the `sources` SSE event.

**Frontend (`RelativeScoreBar` component):**
- Replaces the raw score badge in `SourceCard`
- A thin horizontal bar (`h-1.5`) inside each card whose filled width = `score / max_score_in_set × 100%`
- The raw score number shown to the right of the bar
- The max-scoring chunk gets a full-width bar; all others are proportional
- Color follows the score color map (green/yellow/red based on absolute score value)
- Passed `score` and `maxScore` as props; `maxScore` computed in `MessageBubble` before rendering cards

---

### Feature 7 — Enhanced Chunk Metadata in ChunkInspector

**What it teaches:** Why chunk boundaries are where they are; how chunking parameters translate to real output.

**Backend prerequisite:** None. The chunk API already returns `char_count`, `chunk_strategy`, metadata.

**Frontend enhancements to `ChunkInspector`:**
- **Char count column:** show as `{char_count} / 1000 chars` with a mini inline bar (same `RelativeScoreBar` pattern, max=1000)
- **Overlap indicator:** for consecutive chunks, show a small badge `~{n} chars overlap` derived by
  comparing the end of chunk N with the start of chunk N+1 (client-side string match, best-effort)
- **Embedding model badge:** show the model name from chunk metadata (e.g., `voyage-3`) as a small gray Badge
- **Strategy tooltip:** the strategy name cell gets a `GlossaryTooltip` wrapping `"chunking strategy"`

---

## Build Order (within Phase 7)

Build in this sequence so each step is independently testable.
Steps marked **[BACKEND]** require backend changes before the frontend step can be completed.

### Prerequisites (backend changes, do these first)

**P1 — Pipeline step field**
- Add `pipeline_step: str | None` to `Document` ORM model + API response schema
- Update `backend/workers/tasks/ingest.py` to set the field at each pipeline step
- Alembic migration required

**P2 — Judge reasoning columns**
- Add `faithfulness_reasoning: str | None` and `relevance_reasoning: str | None` to `EvalResult`
- Update `backend/services/evaluation/metrics.py` to parse reasoning from judge response JSON
- Update `backend/workers/tasks/eval.py` to persist reasoning
- Alembic migration required

---

### Frontend build steps

1. **`lib/glossary.ts`** — static GLOSSARY map (all term definitions); no deps
2. **`lib/types.ts` + `lib/api.ts`** — add `pipeline_step` to `DocumentListItem`; add reasoning fields to `EvalResultItem`
3. **`components/shared/GlossaryTooltip.tsx`** — thin wrapper, depends only on glossary + shadcn Tooltip
4. **`components/shared/ScoreBar.tsx` + `RelativeScoreBar.tsx`** — shared scoring visuals
5. **`lib/hooks/useDocuments.ts`** — SWR + polling logic
6. **`components/documents/PipelineStepBadge.tsx`** — step sequence component [requires P1]
7. **`/documents` page** — upload + list (with PipelineStepBadge) + drawer (with enhanced ChunkInspector + GlossaryTooltip)
8. **`lib/hooks/useChat.ts`** — SSE state machine
9. **`/chat` page** — ConfigPanel (with GlossaryTooltips), ChatThread, SourceCards (with RelativeScoreBar), RetrievalExplainer
10. **`lib/hooks/useExperiments.ts` + `useExperiment.ts`**
11. **`/experiments` page** — generate + create run + list + CompareTable (URL-driven compare mode)
12. **`/experiments/[id]` page** — detail + results table with judge reasoning expand rows [requires P2]
13. **`/dashboard` page** — pulls from hooks already built
14. **NavBar + layout** — wire navigation, test full flow
