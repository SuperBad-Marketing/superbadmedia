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

export type ParsedBraindump = {
  tasks: ParsedTask[];
  global_confidence: number;
};

export type SurfaceContext = {
  surfaceType?: string;
  entityType?: string;
  entityId?: string;
};

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

type LlmParsedBraindump = {
  tasks: LlmParsedTask[];
  global_confidence: number;
};

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

  let prompt = `You are a task parser for SuperBad Marketing, a Melbourne-based marketing agency run by Andy. Parse the following freeform braindump text into structured tasks.

TODAY: ${today} (${dayOfWeek})
TIMEZONE: Australia/Melbourne

${entityContext}
`;

  if (surfaceContext?.entityType && surfaceContext?.entityId) {
    prompt += `\nSURFACE CONTEXT: The user is currently viewing a ${surfaceContext.entityType} profile (id="${surfaceContext.entityId}"). Tasks mentioned without a specific entity reference likely relate to this ${surfaceContext.entityType}.\n`;
  }

  prompt += `
TASK KINDS (pick the most appropriate):
- "personal" — Andy's life admin, never visible to clients
- "admin" — SuperBad operational work not tied to a specific contact or deal
- "prospect_followup" — tied to a lead or prospect
- "client_deliverable" — work SuperBad owes a client (e.g. "4 instagram posts for Belle")
- "client_task" — task tied to a client that is NOT a deliverable (e.g. "call Jake about the invoice")

PRIORITIES: "high", "normal", "low"

INSTRUCTIONS:
1. Split the text into individual tasks. Each distinct action or item becomes one task.
2. Infer the kind from context. If it mentions a known contact or company, it's likely prospect_followup, client_deliverable, or client_task. Personal errands are "personal". General admin is "admin".
3. Parse relative dates: "tomorrow", "friday", "next week", "in 3 days", etc. relative to today. Output as ISO date (YYYY-MM-DD).
4. Match entity references against the CONTACTS and COMPANIES lists. Use fuzzy matching — "Belle" could match "Belle Bakery" or "Belle Robinson". Return the top candidates with confidence scores.
5. Detect countable phrasings ("4 instagram posts", "three blog drafts") and emit them as checklist items.
6. Assign confidence scores (0.0–1.0) for each parsed field. High confidence = unambiguous. Low confidence = guessed or inferred.
7. Keep task titles concise and action-oriented. Strip filler words but preserve intent.

OUTPUT FORMAT — respond with ONLY valid JSON, no markdown fencing:
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
  "global_confidence": 0.8
}

BRAINDUMP TEXT:
${rawText}`;

  return prompt;
}

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
    job: "task-manager-parse-braindump",
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
    throw new Error("Invalid braindump response: missing tasks array.");
  }

  const tasks = parsed.tasks.map((t, i) => mapLlmTask(t, i));

  await logActivity({
    kind: "braindump_parsed",
    body: `Braindump parsed — ${tasks.length} task${tasks.length === 1 ? "" : "s"} extracted`,
    meta: { task_count: tasks.length },
    createdBy: "system",
  });

  return {
    tasks,
    global_confidence: clamp01(parsed.global_confidence),
  };
}
