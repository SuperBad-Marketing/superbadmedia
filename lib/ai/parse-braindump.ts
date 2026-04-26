import { db } from "@/lib/db";
import { contacts } from "@/lib/db/schema/contacts";
import { companies } from "@/lib/db/schema/companies";
import { deals } from "@/lib/db/schema/deals";
import { eq, gt, sql } from "drizzle-orm";
import { invokeLlmText } from "@/lib/ai/invoke";
import { killSwitches } from "@/lib/kill-switches";
import { logActivity } from "@/lib/activity-log";
import type { TaskKind, TaskPriority, ChecklistItem } from "@/lib/tasks/types";
import { TASK_KINDS, TASK_PRIORITIES } from "@/lib/tasks/types";
import { CONTENT_TYPES, type ContentType } from "@/lib/db/schema/content-studio";
import { PILLAR_SLUGS, SCRIPT_FORMATS, type PillarSlug, type ScriptFormat } from "@/lib/db/schema/talking-head";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type EntityCandidate = {
  type: string;
  id: string;
  name: string;
};

export type ParsedTask = {
  id: string;
  title: string;
  kind: TaskKind;
  priority: TaskPriority;
  due_at_ms: number | null;
  entity_type: string | null;
  entity_id: string | null;
  entity_name: string | null;
  checklist: ChecklistItem[] | null;
  confidence: {
    title: number;
    kind: number;
    priority: number;
    due: number;
    entity: number;
  };
  alternatives?: {
    entity?: EntityCandidate[];
  };
};

export type ParsedContentIdea = {
  id: string;
  brief: string;
  content_type: ContentType;
  slide_count: number;
  confidence: number;
};

export type ParsedScriptIdea = {
  id: string;
  topic: string;
  pillar: PillarSlug;
  format: ScriptFormat;
  angle: string;
  confidence: number;
};

export type ParsedBraindump = {
  tasks: ParsedTask[];
  content_ideas: ParsedContentIdea[];
  script_ideas: ParsedScriptIdea[];
  global_confidence: number;
};

export type SurfaceContext = {
  surfaceType?: string;
  entityType?: string;
  entityId?: string;
};

// ---------------------------------------------------------------------------
// LLM response shapes (internal)
// ---------------------------------------------------------------------------

type LlmEntityCandidate = {
  entity_type: string;
  entity_id: string;
  entity_name: string;
  confidence: number;
};

type LlmParsedTask = {
  title: string;
  body?: string | null;
  kind: string;
  priority: string;
  due_at_iso?: string | null;
  entity_candidates?: LlmEntityCandidate[];
  checklist?: string[] | null;
  confidence: {
    title: number;
    kind: number;
    due_at: number;
    entity: number;
  };
};

type LlmContentIdea = {
  brief: string;
  content_type: string;
  slide_count: number;
  confidence: number;
};

type LlmScriptIdea = {
  topic: string;
  pillar: string;
  format: string;
  angle: string;
  confidence: number;
};

type LlmParsedBraindump = {
  tasks: LlmParsedTask[];
  content_ideas: LlmContentIdea[];
  script_ideas: LlmScriptIdea[];
  global_confidence: number;
};

// ---------------------------------------------------------------------------
// Entity context
// ---------------------------------------------------------------------------

async function fetchEntityContext(): Promise<string> {
  const ninetyDaysAgo = Date.now() - 90 * 24 * 60 * 60 * 1000;

  const [recentContacts, activeClientContacts, recentCompanies, activeCompanies] =
    await Promise.all([
      db
        .select({ id: contacts.id, name: contacts.name, company_id: contacts.company_id })
        .from(contacts)
        .where(gt(contacts.updated_at_ms, ninetyDaysAgo))
        .limit(200),
      db
        .select({ id: contacts.id, name: contacts.name, company_id: contacts.company_id })
        .from(contacts)
        .where(eq(contacts.relationship_type, "client"))
        .limit(200),
      db
        .select({ id: companies.id, name: companies.name })
        .from(companies)
        .where(gt(companies.updated_at_ms, ninetyDaysAgo))
        .limit(200),
      db
        .select({ id: companies.id, name: companies.name })
        .from(companies)
        .where(
          sql`${companies.id} IN (SELECT ${deals.company_id} FROM ${deals} WHERE ${deals.stage} IN ('won', 'trial_shoot', 'quoted', 'negotiating', 'conversation'))`,
        )
        .limit(200),
    ]);

  const contactMap = new Map<string, { id: string; name: string; company_id: string | null }>();
  for (const c of [...recentContacts, ...activeClientContacts]) {
    contactMap.set(c.id, c);
  }
  const companyMap = new Map<string, { id: string; name: string }>();
  for (const c of [...recentCompanies, ...activeCompanies]) {
    companyMap.set(c.id, c);
  }

  const lines: string[] = [];

  if (companyMap.size > 0) {
    lines.push("COMPANIES:");
    for (const c of companyMap.values()) {
      lines.push(`- id="${c.id}" name="${c.name}"`);
    }
  }

  if (contactMap.size > 0) {
    lines.push("CONTACTS:");
    for (const c of contactMap.values()) {
      const companyName = c.company_id ? companyMap.get(c.company_id)?.name : null;
      lines.push(
        `- id="${c.id}" name="${c.name}"${companyName ? ` company="${companyName}"` : ""}`,
      );
    }
  }

  return lines.length > 0 ? lines.join("\n") : "No entities in the system yet.";
}

// ---------------------------------------------------------------------------
// Prompt
// ---------------------------------------------------------------------------

function getMelbourneDate(): string {
  return new Date().toLocaleDateString("en-AU", {
    timeZone: "Australia/Melbourne",
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function getMelbourneDayOfWeek(): string {
  return new Date().toLocaleDateString("en-AU", {
    timeZone: "Australia/Melbourne",
    weekday: "long",
  });
}

function buildPrompt(
  rawText: string,
  entityContext: string,
  surfaceContext?: SurfaceContext | null,
): string {
  const today = getMelbourneDate();
  const dayOfWeek = getMelbourneDayOfWeek();

  let prompt = `You are a morning braindump parser for SuperBad Marketing, a Melbourne-based marketing agency run by Andy. Parse freeform text into THREE categories: actionable tasks, Instagram content ideas, and talking-head video script ideas.

TODAY: ${today} (${dayOfWeek})
TIMEZONE: Australia/Melbourne

${entityContext}
`;

  if (surfaceContext?.entityType && surfaceContext?.entityId) {
    prompt += `\nSURFACE CONTEXT: The user is currently viewing a ${surfaceContext.entityType} profile (id="${surfaceContext.entityId}"). Tasks mentioned without a specific entity reference likely relate to this ${surfaceContext.entityType}.\n`;
  }

  prompt += `
CLASSIFICATION RULES:
- A TASK is something Andy needs to DO: call someone, invoice, follow up, book, fix, send, etc.
- A CONTENT IDEA is an idea for an Instagram post (image/graphic/carousel): opinions, observations, tips, portfolio showcase, behind-the-scenes moments, announcements, anti-motivation typography posts.
- A SCRIPT IDEA is an idea for a talking-head video: rants, takes, industry truths, advice, breakdowns — anything that sounds like Andy sitting in a chair talking to camera.

When in doubt between content and script: if the idea is visual or short-form, it's content. If it's a monologue, rant, or has a narrative arc, it's a script.

── TASKS ──

TASK KINDS:
- "personal" — Andy's life admin, never visible to clients
- "admin" — SuperBad operational work not tied to a specific contact or deal
- "prospect_followup" — tied to a lead or prospect
- "client_deliverable" — work SuperBad owes a client
- "client_task" — task tied to a client that is NOT a deliverable

PRIORITIES: "high", "normal", "low"

TASK INSTRUCTIONS:
1. Each distinct action becomes one task.
2. Infer kind from context. Known contacts/companies → prospect_followup, client_deliverable, or client_task. Personal errands → "personal". General ops → "admin".
3. Parse relative dates ("tomorrow", "friday", "next week") relative to today as ISO (YYYY-MM-DD).
4. Match entity references against CONTACTS and COMPANIES. Fuzzy match. Return top candidates with confidence.
5. Countable phrasings ("4 posts", "three drafts") → checklist items.
6. Confidence 0.0–1.0 per field.

── CONTENT IDEAS (Instagram) ──

CONTENT TYPES (pick best fit):
- "anti_motivation" — dry, typography-forward posts that reframe grind as proof of progress
- "tips" — practical marketing advice or observations
- "portfolio" — showcasing work, behind-the-camera perspective
- "behind_the_scenes" — process, setup, studio, day-in-the-life
- "announcement" — business news, launches, offers
- "testimonial" — client results or social proof

CONTENT INSTRUCTIONS:
1. Extract the core idea as a creative brief (1-2 sentences).
2. Pick the best content_type.
3. Suggest slide_count: 1 for single posts, 3-10 for carousels (multi-point ideas suit carousels).
4. Confidence 0.0–1.0 for the overall classification.

── SCRIPT IDEAS (talking-head video) ──

PILLARS (pick best fit):
- "agency_wont_say" — industry honesty, what agencies hide, retainer truths
- "shooting_small_business" — observations from shoots, patterns from behind the camera
- "marketing_doesnt_work" — widely recommended tactics that are mostly useless
- "uncomfortable_truth" — broader business realities, real costs, hard truths
- "if_i_were_brand" — unsolicited strategy breakdowns for real businesses
- "overheard_in_marketing" — deadpan observations about industry absurdity

FORMATS: "short" (30-90 sec), "mid" (2-5 min)

SCRIPT INSTRUCTIONS:
1. Extract the topic (what the video is about).
2. Write an angle (the specific take or hook — one sentence).
3. Pick the best pillar.
4. Pick format: simple takes → short, developed arguments → mid.
5. Confidence 0.0–1.0 for the overall classification.

── OUTPUT ──

Respond with ONLY valid JSON, no markdown fencing:
{
  "tasks": [
    {
      "title": "concise action-oriented title",
      "body": "optional longer description or null",
      "kind": "admin",
      "priority": "normal",
      "due_at_iso": "2026-04-25 or null",
      "entity_candidates": [
        { "entity_type": "contact or company", "entity_id": "actual id from the list", "entity_name": "name", "confidence": 0.9 }
      ],
      "checklist": ["item 1", "item 2"] or null,
      "confidence": { "title": 0.9, "kind": 0.8, "due_at": 0.7, "entity": 0.6 }
    }
  ],
  "content_ideas": [
    {
      "brief": "1-2 sentence creative brief for the post",
      "content_type": "anti_motivation",
      "slide_count": 1,
      "confidence": 0.85
    }
  ],
  "script_ideas": [
    {
      "topic": "what the video is about",
      "pillar": "agency_wont_say",
      "format": "short",
      "angle": "the specific take or hook",
      "confidence": 0.8
    }
  ],
  "global_confidence": 0.8
}

If there are no items for a category, return an empty array. Every fragment of the braindump should be classified into exactly one category — don't drop anything.

BRAINDUMP TEXT:
${rawText}`;

  return prompt;
}

// ---------------------------------------------------------------------------
// Mappers
// ---------------------------------------------------------------------------

function clamp01(n: unknown): number {
  const v = typeof n === "number" ? n : 0;
  return Math.max(0, Math.min(1, v));
}

function parseIsoToMs(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const d = new Date(iso + "T00:00:00+10:00");
  return Number.isNaN(d.getTime()) ? null : d.getTime();
}

function mapLlmTask(task: LlmParsedTask, index: number): ParsedTask {
  const validKind = TASK_KINDS.includes(task.kind as TaskKind)
    ? (task.kind as TaskKind)
    : "admin";
  const validPriority = TASK_PRIORITIES.includes(task.priority as TaskPriority)
    ? (task.priority as TaskPriority)
    : "normal";

  const candidates = task.entity_candidates ?? [];
  const topCandidate = candidates.length > 0
    ? candidates.reduce((best, c) => (c.confidence > best.confidence ? c : best), candidates[0])
    : null;

  const checklist: ChecklistItem[] | null = task.checklist?.length
    ? task.checklist.map((text, i) => ({
        id: `cl-${index}-${i}-${Date.now()}`,
        text,
        checked: false,
        checked_at: null,
      }))
    : null;

  const allCandidates: EntityCandidate[] = candidates.map((c) => ({
    type: c.entity_type,
    id: c.entity_id,
    name: c.entity_name,
  }));

  return {
    id: `parsed-${index}-${Date.now()}`,
    title: task.title || `Task ${index + 1}`,
    kind: validKind,
    priority: validPriority,
    due_at_ms: parseIsoToMs(task.due_at_iso),
    entity_type: topCandidate?.entity_type ?? null,
    entity_id: topCandidate?.entity_id ?? null,
    entity_name: topCandidate?.entity_name ?? null,
    checklist,
    confidence: {
      title: clamp01(task.confidence?.title),
      kind: clamp01(task.confidence?.kind),
      priority: clamp01(task.confidence?.kind ?? 0.5),
      due: clamp01(task.confidence?.due_at),
      entity: clamp01(task.confidence?.entity),
    },
    alternatives:
      allCandidates.length > 1 ? { entity: allCandidates } : undefined,
  };
}

function mapLlmContentIdea(idea: LlmContentIdea, index: number): ParsedContentIdea {
  const validType = (CONTENT_TYPES as readonly string[]).includes(idea.content_type)
    ? (idea.content_type as ContentType)
    : "tips";
  const slideCount = typeof idea.slide_count === "number" && idea.slide_count >= 1
    ? Math.min(idea.slide_count, 10)
    : 1;

  return {
    id: `content-${index}-${Date.now()}`,
    brief: idea.brief || "Untitled content idea",
    content_type: validType,
    slide_count: slideCount,
    confidence: clamp01(idea.confidence),
  };
}

function mapLlmScriptIdea(idea: LlmScriptIdea, index: number): ParsedScriptIdea {
  const validPillar = (PILLAR_SLUGS as readonly string[]).includes(idea.pillar)
    ? (idea.pillar as PillarSlug)
    : "overheard_in_marketing";
  const validFormat = (SCRIPT_FORMATS as readonly string[]).includes(idea.format)
    ? (idea.format as ScriptFormat)
    : "short";

  return {
    id: `script-${index}-${Date.now()}`,
    topic: idea.topic || "Untitled script idea",
    pillar: validPillar,
    format: validFormat,
    angle: idea.angle || "",
    confidence: clamp01(idea.confidence),
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

export async function parseBraindump(
  rawText: string,
  surfaceContext?: SurfaceContext | null,
): Promise<ParsedBraindump> {
  if (!killSwitches.llm_calls_enabled) {
    throw new Error("LLM calls are disabled (kill switch).");
  }

  const entityContext = await fetchEntityContext();
  const prompt = buildPrompt(rawText, entityContext, surfaceContext);

  const responseText = await invokeLlmText({
    job: "braindump-parse",
    prompt,
    maxTokens: 4096,
  });

  let parsed: LlmParsedBraindump;
  try {
    const cleaned = responseText.replace(/^```json?\s*/, "").replace(/\s*```$/, "");
    parsed = JSON.parse(cleaned) as LlmParsedBraindump;
  } catch {
    throw new Error("Failed to parse braindump response from Claude.");
  }

  if (!Array.isArray(parsed.tasks)) {
    parsed.tasks = [];
  }
  if (!Array.isArray(parsed.content_ideas)) {
    parsed.content_ideas = [];
  }
  if (!Array.isArray(parsed.script_ideas)) {
    parsed.script_ideas = [];
  }

  const tasks = parsed.tasks.map((t, i) => mapLlmTask(t, i));
  const content_ideas = parsed.content_ideas.map((c, i) => mapLlmContentIdea(c, i));
  const script_ideas = parsed.script_ideas.map((s, i) => mapLlmScriptIdea(s, i));

  const totalItems = tasks.length + content_ideas.length + script_ideas.length;

  await logActivity({
    kind: "braindump_parsed",
    body: `Braindump parsed — ${tasks.length} task${tasks.length === 1 ? "" : "s"}, ${content_ideas.length} content idea${content_ideas.length === 1 ? "" : "s"}, ${script_ideas.length} script${script_ideas.length === 1 ? "" : "s"}`,
    meta: { task_count: tasks.length, content_count: content_ideas.length, script_count: script_ideas.length, total: totalItems },
    createdBy: "system",
  });

  return {
    tasks,
    content_ideas,
    script_ideas,
    global_confidence: clamp01(parsed.global_confidence),
  };
}
