/**
 * Builds the Opus prompt for the `inbox-draft-reply` generator
 * (spec §7.4, Q14/Q15). Composes the two perpetual contexts —
 * Brand DNA (who Andy is) + Client Context Engine (where this client
 * is at) — around a trimmed thread history and a short set of
 * Andy-edit few-shot examples.
 *
 * Two-perpetual-contexts discipline (memory
 * `project_two_perpetual_contexts`): Brand DNA lives in the *system*
 * section so it never gets ventriloquised as user intent; Client
 * Context Engine lives in the *user* section's "where this client is
 * at" block.
 *
 * CCE-1 stub (spec §7.4 + brief §B): Client Context Engine lands in
 * Wave 16. Until then `loadClientContextOrStub` dynamically imports
 * the future module; on ImportError it falls back to a minimal shape
 * composed from the contact's `relationship_type` plus its last 10
 * activity-log rows.
 *
 * Few-shot stub: `lib/ai/few-shot.ts` isn't populated until Wave 11.
 * Until then this loader returns `[]` so the prompt degrades
 * gracefully (discipline #63 — missing context is better than fake
 * context).
 */
import { asc, desc, eq, and } from "drizzle-orm";
import { db } from "@/lib/db";
import { threads, messages } from "@/lib/db/schema/messages";
import { contacts } from "@/lib/db/schema/contacts";
import { brand_dna_profiles } from "@/lib/db/schema/brand-dna-profiles";
import { activity_log } from "@/lib/db/schema/activity-log";

const MAX_THREAD_MESSAGES = 20;
const MAX_FEW_SHOTS = 10;
const MAX_BODY_CHARS = 2000;
const MAX_CCE_ACTIVITY_ROWS = 10;

// ── Prompt-context shapes ────────────────────────────────────────────

export interface BrandDnaContext {
  prose_portrait: string | null;
  first_impression: string | null;
}

export interface ClientContextSnapshot {
  relationship_type: string | null;
  display_name: string | null;
  recent_activity: Array<{ kind: string; body: string; created_at_ms: number }>;
  // Wave 16 will fill these with real CCE output. Typed here so the
  // stub path and the real path match shape, avoiding a later rename.
  summary: string | null;
  open_action_items: string[];
  source: "cce" | "stub";
}

export interface ThreadMessageSnapshot {
  direction: "inbound" | "outbound";
  from_address: string;
  subject: string | null;
  body_text: string;
  sent_at_ms: number | null;
}

export interface FewShotExample {
  inbound_body: string;
  andy_reply_body: string;
}

export interface DraftReplyPromptContext {
  thread_subject: string | null;
  thread_history: ThreadMessageSnapshot[];
  latest_inbound: ThreadMessageSnapshot;
  brand_dna: BrandDnaContext;
  client_context: ClientContextSnapshot;
  few_shots: FewShotExample[];
}

// ── Context loader ───────────────────────────────────────────────────

export async function loadDraftReplyPromptContext(
  threadId: string,
): Promise<DraftReplyPromptContext | null> {
  const threadRow = await db
    .select({
      id: threads.id,
      subject: threads.subject,
      contact_id: threads.contact_id,
    })
    .from(threads)
    .where(eq(threads.id, threadId))
    .get();
  if (!threadRow) return null;

  const threadMessages = await db
    .select({
      direction: messages.direction,
      from_address: messages.from_address,
      subject: messages.subject,
      body_text: messages.body_text,
      sent_at_ms: messages.sent_at_ms,
      received_at_ms: messages.received_at_ms,
      created_at_ms: messages.created_at_ms,
    })
    .from(messages)
    .where(eq(messages.thread_id, threadId))
    .orderBy(asc(messages.created_at_ms))
    .limit(MAX_THREAD_MESSAGES);

  if (threadMessages.length === 0) return null;

  const history: ThreadMessageSnapshot[] = threadMessages.map((m) => ({
    direction: m.direction,
    from_address: m.from_address,
    subject: m.subject,
    body_text: (m.body_text ?? "").slice(0, MAX_BODY_CHARS),
    sent_at_ms: m.sent_at_ms ?? m.received_at_ms ?? m.created_at_ms,
  }));

  // Latest inbound = the last message with direction = inbound. If no
  // inbound is present the thread has nothing to draft a reply to.
  const latestInbound = [...history].reverse().find((m) => m.direction === "inbound");
  if (!latestInbound) return null;

  const [brandDna, clientContext, fewShots] = await Promise.all([
    loadBrandDna(),
    loadClientContextOrStub(threadRow.contact_id),
    loadFewShots(),
  ]);

  return {
    thread_subject: threadRow.subject,
    thread_history: history,
    latest_inbound: latestInbound,
    brand_dna: brandDna,
    client_context: clientContext,
    few_shots: fewShots,
  };
}

async function loadBrandDna(): Promise<BrandDnaContext> {
  const row = await db
    .select({
      prose_portrait: brand_dna_profiles.prose_portrait,
      first_impression: brand_dna_profiles.first_impression,
    })
    .from(brand_dna_profiles)
    .where(
      and(
        eq(brand_dna_profiles.is_superbad_self, true),
        eq(brand_dna_profiles.status, "complete"),
      ),
    )
    .orderBy(desc(brand_dna_profiles.completed_at_ms))
    .limit(1)
    .get();
  return {
    prose_portrait: row?.prose_portrait ?? null,
    first_impression: row?.first_impression ?? null,
  };
}

/**
 * Returns the CCE snapshot for the contact if Wave 16 is live, else
 * falls back to a minimal stub built from contact + activity_log.
 *
 * The dynamic import is wrapped so a missing module (pre-Wave-16)
 * never crashes draft generation. When Wave 16 lands and exports
 * `loadClientContextForDrafter`, this path becomes the live one and
 * the stub branch becomes dead code that can be deleted.
 */
export async function loadClientContextOrStub(
  contactId: string | null,
): Promise<ClientContextSnapshot> {
  if (!contactId) {
    return {
      relationship_type: null,
      display_name: null,
      recent_activity: [],
      summary: null,
      open_action_items: [],
      source: "stub",
    };
  }

  try {
    // Dynamic specifier (variable, not literal) so TypeScript doesn't try
    // to resolve the Wave 16 module at build time. When Wave 16 lands the
    // import resolves; until then the catch branch handles the miss.
    const cceModulePath = "@/lib/client-context/drafter-context";
    const mod = (await import(cceModulePath)) as {
      loadClientContextForDrafter?: (
        id: string,
      ) => Promise<ClientContextSnapshot>;
    };
    if (mod.loadClientContextForDrafter) {
      return await mod.loadClientContextForDrafter(contactId);
    }
  } catch {
    // Module not yet built (Wave 16) — fall through to stub.
  }

  return buildClientContextStub(contactId);
}

async function buildClientContextStub(
  contactId: string,
): Promise<ClientContextSnapshot> {
  const contact = await db
    .select({
      name: contacts.name,
      relationship_type: contacts.relationship_type,
    })
    .from(contacts)
    .where(eq(contacts.id, contactId))
    .get();

  const activity = await db
    .select({
      kind: activity_log.kind,
      body: activity_log.body,
      created_at_ms: activity_log.created_at_ms,
    })
    .from(activity_log)
    .where(eq(activity_log.contact_id, contactId))
    .orderBy(desc(activity_log.created_at_ms))
    .limit(MAX_CCE_ACTIVITY_ROWS);

  return {
    relationship_type: contact?.relationship_type ?? null,
    display_name: contact?.name ?? null,
    recent_activity: activity.map((a) => ({
      kind: a.kind,
      body: a.body,
      created_at_ms: a.created_at_ms,
    })),
    summary: null,
    open_action_items: [],
    source: "stub",
  };
}

/**
 * Wave 11 populates the few-shot store from Andy's edits. Until then
 * this returns empty so the prompt keeps working — fewer but still
 * correct examples beats fabricated ones (discipline #63).
 */
async function loadFewShots(): Promise<FewShotExample[]> {
  try {
    const fewShotModulePath = "@/lib/ai/few-shot";
    const mod = (await import(fewShotModulePath)) as {
      loadDraftReplyFewShots?: (limit: number) => Promise<FewShotExample[]>;
    };
    if (mod.loadDraftReplyFewShots) {
      return await mod.loadDraftReplyFewShots(MAX_FEW_SHOTS);
    }
  } catch {
    // Module not yet built (Wave 11) — no examples.
  }
  return [];
}

// ── Prompt builders ──────────────────────────────────────────────────

/**
 * Brand DNA lives in the system prompt so it frames Andy's voice
 * globally and never gets mis-read as the user's intent. Empty string
 * if no completed SuperBad-self profile exists yet — the generator
 * will still function, just with weaker voice grounding.
 */
export function buildDraftReplySystemPrompt(brand: BrandDnaContext): string {
  const intro = `You are drafting a reply that will appear — unsent, for Andy Robinson to review and edit — as the pre-composed draft in his unified inbox. Andy runs SuperBad Marketing solo out of Melbourne. The draft must feel like Andy wrote it, not like a polite AI assistant wrote it.`;

  const voice = `VOICE (non-negotiable, from Andy's Brand DNA):
- Dry, observational, self-deprecating, slow burn.
- Short sentences. Leave room for the mutter.
- Never explain the joke.
- Plain, real language. No hype, no agency-speak.
- Banned words: "synergy", "leverage", "solutions", "circle back", "touch base", "reach out", "excited to", "thrilled to".
- Write how a dry, tired, competent founder writes. Not how a brand writes.`;

  const portrait = brand.prose_portrait
    ? `\nBRAND DNA — prose portrait (voice reference, not content to quote):\n${brand.prose_portrait.slice(0, 2000)}`
    : "";
  const impression = brand.first_impression
    ? `\nBRAND DNA — first impression:\n${brand.first_impression.slice(0, 500)}`
    : "";

  const output = `OUTPUT CONTRACT:
- Respond with a single JSON object ONLY — no prose, no markdown fences.
- Shape: { "draft_body": string, "low_confidence_flags": Array<{ "span": string, "reason": string }> }
- "draft_body" is the ready-to-send email body, plain text, no greetings beyond what Andy would actually write, no sign-off like "Best regards, Andy" (Andy's client handles sign-off).
- "low_confidence_flags" flags short verbatim spans from draft_body that you weren't sure about (e.g. a guessed price, an assumed meeting time, a made-up project name). Each "span" must be a substring that actually appears in draft_body. Leave the array empty when every claim in the draft is grounded in the supplied context.
- If the inbound truly doesn't warrant a reply (auto-reply, bounce, etc.), return { "draft_body": "", "low_confidence_flags": [] } — never fabricate.`;

  return [intro, voice, portrait, impression, output].filter(Boolean).join("\n\n");
}

export function buildDraftReplyUserPrompt(
  ctx: DraftReplyPromptContext,
): string {
  const clientBlock = formatClientContext(ctx.client_context);
  const historyBlock = formatThreadHistory(ctx.thread_history);
  const fewShotBlock = formatFewShots(ctx.few_shots);
  const inboundBlock = formatLatestInbound(ctx.latest_inbound);

  return `WHO THEY ARE / WHERE YOU ARE WITH THEM:
${clientBlock}

THREAD HISTORY (oldest → newest, for context — do not repeat what's already been said):
${historyBlock}
${fewShotBlock}
INCOMING MESSAGE TO REPLY TO:
${inboundBlock}

TASK: Draft Andy's reply to the incoming message. Use the thread history as context but don't rehash it. If information is missing, either ask one plain question in Andy's voice or leave the uncertain claim out entirely — never invent a fact. Flag any span of draft_body you weren't sure about in "low_confidence_flags".

Respond with the JSON object described in the system prompt. JSON only.`;
}

function formatClientContext(cc: ClientContextSnapshot): string {
  const lines: string[] = [];
  lines.push(`- Name: ${cc.display_name ?? "unknown"}`);
  lines.push(`- Relationship: ${cc.relationship_type ?? "unknown"}`);
  if (cc.summary) {
    lines.push(`- Summary: ${cc.summary}`);
  }
  if (cc.open_action_items.length > 0) {
    lines.push(`- Open action items:`);
    for (const item of cc.open_action_items) {
      lines.push(`    • ${item}`);
    }
  }
  if (cc.recent_activity.length > 0) {
    lines.push(`- Recent activity (newest first):`);
    for (const row of cc.recent_activity) {
      const date = new Date(row.created_at_ms).toISOString().slice(0, 10);
      lines.push(`    • [${date} · ${row.kind}] ${row.body.slice(0, 240)}`);
    }
  } else if (!cc.summary) {
    lines.push(
      `- (No prior activity on record. Treat as a fresh conversation.)`,
    );
  }
  if (cc.source === "stub") {
    lines.push(
      `- Note: Client Context Engine is not yet live — this block is a minimal fallback assembled from activity log only. Avoid claims that would require full context.`,
    );
  }
  return lines.join("\n");
}

function formatThreadHistory(history: ThreadMessageSnapshot[]): string {
  if (history.length <= 1) {
    return "(no prior messages on this thread — this is the first inbound)";
  }
  // Drop the latest inbound itself from history; it's rendered below.
  const older = history.slice(0, -1);
  return older
    .map((m) => {
      const date = m.sent_at_ms
        ? new Date(m.sent_at_ms).toISOString().slice(0, 16).replace("T", " ")
        : "unknown time";
      const sender = m.direction === "outbound" ? "Andy" : m.from_address;
      return `[${date} · ${sender}]\n${m.body_text.trim()}`;
    })
    .join("\n\n");
}

function formatFewShots(shots: FewShotExample[]): string {
  if (shots.length === 0) return "";
  const rendered = shots
    .map(
      (s, i) =>
        `Example ${i + 1}:\nInbound:\n${s.inbound_body.slice(0, MAX_BODY_CHARS)}\n\nAndy's reply:\n${s.andy_reply_body.slice(0, MAX_BODY_CHARS)}`,
    )
    .join("\n\n---\n\n");
  return `\nFEW-SHOT EXAMPLES (Andy's own prior replies — match this voice, not the wording):\n${rendered}\n`;
}

function formatLatestInbound(msg: ThreadMessageSnapshot): string {
  const date = msg.sent_at_ms
    ? new Date(msg.sent_at_ms).toISOString().slice(0, 16).replace("T", " ")
    : "just now";
  return `From: ${msg.from_address}
Sent: ${date}
Subject: ${msg.subject ?? "(no subject)"}

${msg.body_text.trim()}`;
}
