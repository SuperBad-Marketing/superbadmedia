# Spec Amendment — Braindump v2 (Type-Aware + Content Pipeline)

**Amends: `docs/specs/task-manager.md` § Braindump primitive.**
**Locked: 2026-05-02 brainstorm with Andy. 11 questions resolved.**

> This amendment adds a type selector, content-to-blog pipeline, and post-commit acknowledgment to the existing braindump primitive. The original braindump spec in task-manager.md remains authoritative for everything not overridden here.

---

## Summary of changes

1. **Type selector** — dropdown above textarea, four types with distinct parser behaviour.
2. **Content braindump pipeline** — Opus-tier, full blog draft at parse time, static social post derivation, progressive reveal UX.
3. **To-do mode** — Haiku-tier, tasks only, streamlined fast parse.
4. **Ideas mode** — Haiku-tier, creates project drafts on the Projects page.
5. **Post-commit acknowledgment** — receipt + dry one-liner via `generateInVoice()`, auto-closes after ~2 seconds.

---

## Type selector

Dropdown rendered above the textarea in the braindump modal. Closed list of 4 values:

```ts
export const BRAINDUMP_TYPES = ["general", "content", "todo", "ideas"] as const;
export type BraindumpType = (typeof BRAINDUMP_TYPES)[number];
```

| Type | Label | Parser tier | Outputs |
|---|---|---|---|
| `general` | General | Haiku | Tasks + Instagram content + video scripts (unchanged v1 behaviour) |
| `content` | Content | Opus | Blog drafts (full, keyword-optimised) + static social posts/carousels. No video scripts. |
| `todo` | To-do | Haiku | Tasks only. Content/script classification turned off. |
| `ideas` | Ideas | Haiku | Project drafts on the Projects page with status `"idea"`. |

Default selection: **`general`**. Persisted in `braindumps.type` column.

The dropdown is the only structural addition to the input phase. Textarea placeholder text adapts per type:
- `general`: "dump it. tasks, content ideas, video topics — we'll sort it."
- `content`: "dump your content ideas. we'll turn them into blog posts and social content."
- `todo`: "what needs doing?"
- `ideas`: "half-baked is fine. we'll file it."

---

## Type: General (unchanged)

Identical to the v1 braindump behaviour defined in task-manager.md. Haiku-tier parse into tasks, Instagram content ideas, and talking-head script ideas. No changes to prompt, output types, or commit flow.

---

## Type: Content

### Overview

Content braindumps fan out into two output channels:

1. **Blog posts** — full Opus draft, keyword-optimised, queued for approval via the Content Engine review surface.
2. **Static social posts & carousels** — derived from the blog, queued in Content Studio. No video, no motion.

No video scripts are generated from content braindumps. Script Studio is only fed from general braindumps.

### Split vs. bundle

The parser decides per-braindump whether to split multiple ideas into separate blog posts or bundle thematically related ideas into one. Decision criteria:

- **Split** when ideas target different keywords or distinct topics.
- **Bundle** when ideas share a theme and would produce a stronger single post.

The parser includes a one-line `split_rationale` explaining its decision. If the user disagrees, they use the existing Re-parse button with adjusted text. No inline split/merge UI.

### Progressive reveal

Content braindumps use a multi-stage progressive reveal during the parse phase. Each stage appears in the modal as it completes:

```
Stage 1 — "analysing ideas…"
  → Idea segmentation: how many blog posts, split/bundle rationale.
  → Visible: idea count + rationale text.

Stage 2 — "researching keywords…" (per idea)
  → LLM-inferred keyword target per idea.
  → Visible: keyword badge appears on each idea card.

Stage 3 — "outlining…" (per idea)
  → Haiku generates section outline, estimated word count.
  → Visible: collapsed outline appears on each blog card.

Stage 4 — "drafting…" (per idea)
  → Opus generates full blog post from outline + Brand DNA.
  → Visible: "Read draft" expand button becomes active.

Stage 5 — "creating social posts…" (per idea)
  → Social posts/carousels derived from each blog.
  → Visible: social cards appear below each blog card.
```

Each stage fires as a separate server action call from the client. The client orchestrates the sequence and updates the modal after each response. This is not SSE — it's sequential action calls with UI updates between them.

### Blog card (review phase)

Each blog idea renders as a card showing:

- Title (editable)
- Keyword target (editable text input)
- Section headings (read-only list from outline)
- Word count
- "Read draft" expand button — opens full markdown body inline
- Channel toggle: blog on/off (default on)

### Social derivation cards

Below each blog card, derived social posts appear as standard Content Studio cards (reusing the existing `ContentIdeaCard` component):

- Brief (derived from blog content — editable)
- Content type (editable dropdown)
- Slide count (editable)
- Channel toggle: social on/off (default on)

Social posts are **static only** — no motion, no video. `motion_enabled` is always `false`.

### Keyword validation

At parse time: LLM infers the best keyword target from training knowledge + SuperBad's vertical + idea content. Fast, no API call.

At commit time: a background `scheduled_tasks` job runs SerpAPI keyword research against the inferred keyword. If the keyword scores below the rankability threshold (defined in Content Engine spec), the blog draft is flagged in the approval queue with:
- A "keyword review" badge
- The original keyword + suggested alternatives from SerpAPI data

The user sees the flag when they review the draft in the Content Engine surface. The braindump itself never blocks on SerpAPI.

### Full blog draft generation

The Opus draft follows the Content Engine's existing two-pass pipeline:

1. **Haiku outline** — sections, key points, estimated word count, featured snippet opportunity flag. Brand DNA signal tags injected (Haiku tier).
2. **Opus draft** — full blog post from outline + Brand DNA full profile. Outputs: title, body (markdown), meta_description, suggested slug, internal linking suggestions, snippet_target_section.

Both passes happen during the progressive reveal (stages 3 and 4). The draft is complete and reviewable in the modal before commit.

AI search citation tuning applies: opening paragraphs use direct factual answer structure per Content Engine spec Q22.

### Parsed output types

```ts
export type ParsedBlogIdea = {
  id: string;
  title: string;
  keyword: string;
  outline: { section: string; key_points: string[] }[];
  word_count: number;
  body_markdown: string;
  meta_description: string;
  slug: string;
  snippet_target_section: string | null;
  enabled: boolean; // channel toggle
  social_posts: ParsedContentIdea[]; // derived, each with own enabled toggle
};

export type ContentParsedBraindump = {
  blog_ideas: ParsedBlogIdea[];
  split_rationale: string;
  global_confidence: number;
  mood_signal: MoodSignal | null;
};
```

### Commit flow

On commit:
1. For each enabled blog idea:
   - Create `content_topics` row (keyword, outline, status `"generated"`).
   - Create `blog_posts` row (full draft, status `"in_review"`, linked to topic).
   - Queue SerpAPI validation background job.
2. For each enabled social post:
   - Create `content_studio_posts` row via existing `commitContentIdeas()`.
3. Create `braindumps` row with `type = "content"`.
4. Revalidate: `/lite/tasks`, `/lite/content/studio`, `/lite/content/engine`, `/lite/cockpit`, `/lite/projects`.

---

## Type: To-do

Streamlined task-only mode. Haiku-tier parse.

- Parser prompt is simplified: tasks classification only, no content/script rules.
- Output: `ParsedTask[]` only — same type as v1.
- Modal renders task cards only — no section labels for content/scripts, no three-category shimmer.
- Same commit flow as v1 general braindump, just with empty content and script arrays.

### Parsed output type

```ts
export type TodoParsedBraindump = {
  tasks: ParsedTask[];
  global_confidence: number;
  mood_signal: MoodSignal | null;
};
```

---

## Type: Ideas

Haiku-tier parse that extracts project ideas and creates project drafts.

- Parser prompt extracts: working title, raw idea text (cleaned up as the project's `brain_dump` field).
- Each distinct idea becomes one project draft.
- Projects are created with `status = "idea"` via the existing `createProjectAction()`.

### Parsed output types

```ts
export type ParsedProjectIdea = {
  id: string;
  title: string;
  description: string; // cleaned-up idea text, becomes project.brain_dump
  confidence: number;
};

export type IdeasParsedBraindump = {
  project_ideas: ParsedProjectIdea[];
  global_confidence: number;
  mood_signal: MoodSignal | null;
};
```

### Review phase

Project idea cards show:
- Title (editable)
- Description (editable textarea)
- Delete button

No entity linking, no due dates, no priority — projects are loose containers at the idea stage.

### Commit flow

On commit:
1. For each project idea:
   - Call `createProject({ title, brain_dump: description, created_by: userId })`.
2. Create `braindumps` row with `type = "ideas"`.
3. Revalidate: `/lite/projects`, `/lite/cockpit`.

---

## Post-commit acknowledgment

Replaces the current silent close. After successful commit:

1. Modal transitions to a **"committed" phase** (new `ModalPhase` value).
2. Shows a receipt summarising what was created:
   - General: "3 tasks, 2 posts, 1 script"
   - Content: "1 blog draft queued, 3 social posts created"
   - To-do: "4 tasks filed"
   - Ideas: "2 project ideas saved"
3. Below the receipt, a dry one-liner via `generateInVoice('braindump_acknowledgment', context)`.
   - Fallback (pre-Brand-DNA): static set — "your brain is lighter now.", "filed. forgotten. free.", "noted. now go outside."
4. Auto-closes after **2 seconds** (no user action needed).
5. If the user clicks anywhere or presses Escape during the 2-second window, modal closes immediately.

---

## Schema changes

### `braindumps` table — new columns

```sql
ALTER TABLE braindumps ADD COLUMN type TEXT NOT NULL DEFAULT 'general';
ALTER TABLE braindumps ADD COLUMN blog_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE braindumps ADD COLUMN project_count INTEGER NOT NULL DEFAULT 0;
```

### `blog_posts` table — new nullable FK

```sql
ALTER TABLE blog_posts ADD COLUMN source_braindump_id TEXT REFERENCES braindumps(id);
```

### `content_topics` table — new nullable FK

```sql
ALTER TABLE content_topics ADD COLUMN source_braindump_id TEXT REFERENCES braindumps(id);
```

---

## New primitives

### `parseContentBraindump(rawText) → staged results`

Five-stage pipeline, each stage is a separate function callable from the client:

1. `analyzeContentIdeas(rawText)` → `{ ideas: { id, summary }[], split_rationale }` (Haiku)
2. `inferKeywords(ideas)` → `{ id, keyword }[]` (Haiku)
3. `generateBlogOutlines(ideas, keywords)` → `{ id, outline, word_count }[]` (Haiku)
4. `generateBlogDrafts(ideas, keywords, outlines)` → `{ id, title, body, meta, slug, snippet }[]` (Opus)
5. `deriveSocialPosts(blogDrafts)` → `{ blog_id, social_posts: ParsedContentIdea[] }[]` (Haiku)

### `parseTodoBraindump(rawText, surfaceContext?) → TodoParsedBraindump`

Haiku-tier. Simplified prompt — tasks only.

### `parseIdeasBraindump(rawText) → IdeasParsedBraindump`

Haiku-tier. Extracts project titles and descriptions.

### `commitBlogIdeas(blogIdeas, braindumpId) → CommittedBlog[]`

Creates content_topics + blog_posts rows. Queues SerpAPI validation.

### `commitProjectIdeas(projectIdeas, userId) → string[]`

Creates project rows via existing `createProject()`.

---

## New build-time disciplines

Extending the numbered list from task-manager.md:

- **30.** Braindump type is persisted on the `braindumps` row and passed to the parser. The parser never infers the type — it's user-selected.
- **31.** Content braindump blog drafts go through the Content Engine's existing review surface for approval. The braindump modal is for capture and triage, not final editing.
- **32.** Social posts derived from content braindumps are always `motion_enabled = false`. No video, no motion from the content pipeline.
- **33.** SerpAPI keyword validation never blocks the braindump commit. It runs as a background job after commit.

---

## Cross-spec impacts

### `docs/specs/content-engine.md`

Content Engine gains a new topic/post source: braindump. Posts created via braindump enter the pipeline at `in_review` status (skipping the automated research → queue → generate stages, since the braindump already produced the draft). The Content Engine review surface handles these identically to auto-generated posts.

New flag on blog_posts: `source_braindump_id` nullable FK. Allows the review surface to show "from braindump" provenance.

### `docs/specs/content-studio.md` (existing)

No changes to Content Studio's data model. Social posts from content braindumps use the existing `source_braindump_id` FK already present on `content_studio_posts`.

### Projects page

No schema changes. Projects created via ideas braindump use the existing `createProject()` flow. The only difference: the braindump modal is the entry point instead of the Projects page create button.

---

## Success criteria

- Andy can select a braindump type before parsing.
- A content braindump with 2 ideas produces 2 blog drafts (or 1 bundled) with progressive reveal in under 60 seconds.
- Blog drafts appear in the Content Engine approval queue after commit.
- SerpAPI validation flags appear on posts with weak keywords within 5 minutes of commit.
- Social posts derived from blog content appear in Content Studio as drafts.
- To-do braindump parses in under 3 seconds and shows tasks only.
- Ideas braindump creates project drafts visible on the Projects page.
- Post-commit acknowledgment shows receipt + dry one-liner, auto-closes after 2 seconds.
- The type dropdown defaults to General, preserving backward compatibility.

---

## Files this spec references

- `docs/specs/task-manager.md` — parent spec for braindump primitive
- `docs/specs/content-engine.md` — blog pipeline, keyword research, review surface
- `docs/specs/content-studio.md` — social post creation
- `lib/ai/parse-braindump.ts` — existing parser (amended by this spec)
- `lib/braindump/commit-content.ts` — existing content commit helper
- `lib/content-engine/generate-blog-post.ts` — existing blog generation pipeline
- `lib/content-engine/research.ts` — SerpAPI keyword research
- `lib/content-engine/topic-queue.ts` — topic outline generation
- `app/lite/projects/actions.ts` — project creation
- Memory: `project_brand_dna_as_perpetual_context`, `feedback_no_content_authoring`, `project_content_studio`
