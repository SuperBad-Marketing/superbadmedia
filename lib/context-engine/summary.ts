import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  context_summaries,
  type ContextSummaryRow,
} from "@/lib/db/schema/context-summaries";

export interface ContextSummaryOutput {
  conversation_summary: string | null;
  summary_generated_at_ms: number | null;
}

export interface DraftOutput {
  content: string;
  channel: string;
  nudgeHistory: string[];
  generatedAtMs: number;
}

export async function getContextSummary(
  contactId: string,
): Promise<ContextSummaryOutput> {
  const row = await db
    .select()
    .from(context_summaries)
    .where(eq(context_summaries.contact_id, contactId))
    .get();

  return {
    conversation_summary: row?.conversation_summary ?? null,
    summary_generated_at_ms: row?.summary_generated_at_ms ?? null,
  };
}

export async function upsertContextSummary(
  contactId: string,
  conversationSummary: string,
): Promise<ContextSummaryRow> {
  const nowMs = Date.now();
  const existing = await db
    .select()
    .from(context_summaries)
    .where(eq(context_summaries.contact_id, contactId))
    .get();

  if (existing) {
    await db
      .update(context_summaries)
      .set({
        conversation_summary: conversationSummary,
        summary_generated_at_ms: nowMs,
        updated_at_ms: nowMs,
      })
      .where(eq(context_summaries.id, existing.id));
    return { ...existing, conversation_summary: conversationSummary, summary_generated_at_ms: nowMs, updated_at_ms: nowMs };
  }

  const row = {
    id: randomUUID(),
    contact_id: contactId,
    conversation_summary: conversationSummary,
    summary_generated_at_ms: nowMs,
    draft_content: null,
    draft_channel: null,
    draft_nudge_history: null,
    draft_generated_at_ms: null,
    created_at_ms: nowMs,
    updated_at_ms: nowMs,
  };
  const [inserted] = await db
    .insert(context_summaries)
    .values(row)
    .returning();
  return inserted;
}

export async function getDraft(
  contactId: string,
): Promise<DraftOutput | null> {
  const row = await db
    .select()
    .from(context_summaries)
    .where(eq(context_summaries.contact_id, contactId))
    .get();

  if (!row?.draft_content) return null;

  return {
    content: row.draft_content,
    channel: row.draft_channel ?? "email",
    nudgeHistory: (row.draft_nudge_history as string[] | null) ?? [],
    generatedAtMs: row.draft_generated_at_ms ?? row.updated_at_ms,
  };
}

export async function saveDraft(
  contactId: string,
  content: string,
  channel: string,
  nudgeHistory: string[],
): Promise<void> {
  const nowMs = Date.now();
  const existing = await db
    .select()
    .from(context_summaries)
    .where(eq(context_summaries.contact_id, contactId))
    .get();

  if (existing) {
    await db
      .update(context_summaries)
      .set({
        draft_content: content,
        draft_channel: channel,
        draft_nudge_history: nudgeHistory,
        draft_generated_at_ms: nowMs,
        updated_at_ms: nowMs,
      })
      .where(eq(context_summaries.id, existing.id));
  } else {
    await db.insert(context_summaries).values({
      id: randomUUID(),
      contact_id: contactId,
      conversation_summary: null,
      summary_generated_at_ms: null,
      draft_content: content,
      draft_channel: channel,
      draft_nudge_history: nudgeHistory,
      draft_generated_at_ms: nowMs,
      created_at_ms: nowMs,
      updated_at_ms: nowMs,
    });
  }
}

export async function clearDraft(contactId: string): Promise<void> {
  const nowMs = Date.now();
  await db
    .update(context_summaries)
    .set({
      draft_content: null,
      draft_channel: null,
      draft_nudge_history: null,
      draft_generated_at_ms: null,
      updated_at_ms: nowMs,
    })
    .where(eq(context_summaries.contact_id, contactId));
}

export async function ensureContextSummaryRow(
  contactId: string,
): Promise<ContextSummaryRow> {
  const existing = await db
    .select()
    .from(context_summaries)
    .where(eq(context_summaries.contact_id, contactId))
    .get();

  if (existing) return existing;

  const nowMs = Date.now();
  const row = {
    id: randomUUID(),
    contact_id: contactId,
    conversation_summary: null,
    summary_generated_at_ms: null,
    draft_content: null,
    draft_channel: null,
    draft_nudge_history: null,
    draft_generated_at_ms: null,
    created_at_ms: nowMs,
    updated_at_ms: nowMs,
  };
  const [inserted] = await db
    .insert(context_summaries)
    .values(row)
    .returning();
  return inserted;
}
