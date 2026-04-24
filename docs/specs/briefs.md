# Shoot / Edit Briefs

> Locked: 2026-04-25. Owner: Andy Robinson.

Client-facing brief forms for video production work. Two tiers: **Lean** (quick jobs) and **Structured** (complex shoots). Briefs auto-match to existing clients via AI, auto-create delivery tasks, and feed into the admin workflow.

---

## §1 Brief Types

### §1.1 Lean Brief
Quick turnaround jobs. Five fields:
- **Business name** (text, required)
- **Contact name** (text, required)
- **Contact email** (email, required)
- **What do you need?** (textarea, required — free-form description)
- **When does this need to be delivered?** (date picker, required)

### §1.2 Structured Brief
Complex shoots with full context. All Lean fields plus:
- **Project title** (text)
- **Brief type** (select: shoot / edit / shoot + edit)
- **Style references** (textarea — links, descriptions, mood)
- **Key messages** (textarea — what must come through)
- **Target audience** (textarea)
- **Deliverables breakdown** (textarea — e.g. "3x 30s reels, 1x 60s hero")
- **Location details** (textarea — shoot briefs only)
- **Talent / on-screen** (textarea — shoot briefs only)
- **Budget range** (select: under $1k / $1k–$3k / $3k–$5k / $5k–$10k / $10k+)
- **Additional notes** (textarea)
- **File attachments** (multi-file upload — reference images, scripts, brand guides)

---

## §2 Surfaces

### §2.1 Public Pages
Two public pages on the marketing site path:
- `/brief/lean` — Lean brief form
- `/brief/structured` — Structured brief form

No auth required. Standalone pages with SuperBad branding. After submission: confirmation screen with reference number.

### §2.2 Client Portal
Retainer clients and clients with portal access see a **"Submit a brief"** entry point in their portal. Opens a chooser:
- "Quick brief" → Lean form (pre-filled: business name, contact name, contact email from their profile)
- "Detailed brief" → Structured form (same pre-fills)

Portal submissions are auto-matched to the client (no AI matching needed — we know who they are).

### §2.3 Admin Internal
Admins can create briefs manually from the master briefs database or from a company's briefs tab.

---

## §3 AI Client Matching

When a brief arrives from a public page (not portal, not admin-created), the AI attempts to match it to an existing company.

### §3.1 Three-Tier Confidence
- **High (≥0.9)**: Auto-attach to the company. Brief appears in the company's briefs tab. No admin action needed.
- **Medium (0.6–0.9)**: Brief marked as "suggested match" with the top candidate. Appears in master database with a suggestion badge. Admin confirms or reassigns.
- **Low (<0.6)**: Unmatched. Appears in master database as "unmatched". Admin manually assigns or creates a new company.

### §3.2 Matching Signals
- `business_name` fuzzy matched against `companies.name` and `companies.name_normalised`
- `contact_email` domain matched against existing contact emails
- `contact_name` matched against existing contacts

### §3.3 Match Override
Admin can always reassign a brief to a different company, or detach it entirely.

---

## §4 Data Model

### §4.1 `briefs` Table
```
id                  TEXT PK
reference_number    TEXT NOT NULL UNIQUE  -- e.g. "BRF-2026-0042"
brief_type          TEXT NOT NULL         -- "lean" | "structured"
status              TEXT NOT NULL DEFAULT "pending"
                    -- "pending" | "matched" | "unmatched" | "in_progress" | "completed" | "cancelled"
source              TEXT NOT NULL         -- "public" | "portal" | "admin"

-- Submitter info (always present)
business_name       TEXT NOT NULL
contact_name        TEXT NOT NULL
contact_email       TEXT NOT NULL

-- Matching
company_id          TEXT FK → companies.id (nullable)
match_confidence    REAL (nullable)       -- 0.0–1.0 from AI
match_method        TEXT (nullable)       -- "auto" | "suggested" | "manual" | "portal"
matched_at_ms       INTEGER (nullable)
matched_by          TEXT (nullable)       -- user ID for manual matches

-- Lean fields
description         TEXT NOT NULL
delivery_date_ms    INTEGER NOT NULL

-- Structured-only fields (all nullable)
project_title       TEXT
brief_kind          TEXT                  -- "shoot" | "edit" | "shoot_and_edit"
style_references    TEXT
key_messages        TEXT
target_audience     TEXT
deliverables_breakdown TEXT
location_details    TEXT
talent_notes        TEXT
budget_range        TEXT                  -- "under_1k" | "1k_3k" | "3k_5k" | "5k_10k" | "10k_plus"
additional_notes    TEXT
attachments_json    TEXT (JSON array of {filename, url, size_bytes})

-- Auto-created task
auto_task_id        TEXT FK → tasks.id (nullable)

-- Timestamps
created_at_ms       INTEGER NOT NULL
updated_at_ms       INTEGER NOT NULL
```

### §4.2 `brief_task_links` Table
One-to-many: a brief can link to multiple tasks beyond the auto-created one.
```
id          TEXT PK
brief_id    TEXT FK → briefs.id NOT NULL
task_id     TEXT FK → tasks.id NOT NULL
created_at_ms INTEGER NOT NULL
```
Unique constraint on (brief_id, task_id).

---

## §5 Auto-Task Creation

When a brief is submitted:
1. Create a task with:
   - `title`: "[Lean/Structured] Brief — {business_name}" (or project_title if structured)
   - `kind`: "client_deliverable"
   - `status`: "todo"
   - `due_at_ms`: the delivery date from the brief
   - `entity_type`: "company", `entity_id`: company_id (if matched)
   - `body`: summary of brief details
2. Store `auto_task_id` on the brief record.
3. If the brief is later matched to a company, update the task's `entity_id`.

---

## §6 Admin UI

### §6.1 Master Briefs Database
Toggle tab under **Clients** in the sidebar navigation (alongside the existing clients list). Shows all briefs in a filterable, sortable table:
- Columns: Reference, Business, Type, Status, Delivery Date, Match, Created
- Filters: status, brief type, match status (matched / suggested / unmatched)
- Sort: any column
- Click → brief detail view (slide-over or dedicated page)

### §6.2 Company Detail — Briefs Tab
New tab on the company detail page showing briefs linked to that company:
- Same table format as master database, filtered to the company
- "Create brief" button for admin-initiated briefs
- Link/unlink tasks from the brief detail

### §6.3 Brief Detail
Shows all brief fields, match info, linked tasks, and actions:
- Confirm/reject suggested match
- Reassign to different company
- Link additional tasks
- Change status

---

## §7 Reference Numbers
Sequential: `BRF-{YYYY}-{NNNN}` where NNNN is zero-padded, auto-incrementing per year. Stored in `briefs.reference_number`.

---

## §8 Success Criteria
- Public lean/structured forms submit and create a brief + task
- Portal pre-fills client info and auto-matches
- AI matching correctly identifies existing clients at ≥80% accuracy on name + email signals
- Master briefs database shows all briefs with working filters/sort
- Company detail briefs tab shows linked briefs
- Brief → task link works bidirectionally
