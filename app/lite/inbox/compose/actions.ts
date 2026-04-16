"use server";

/**
 * Compose-new server actions (UI-6). Backs spec §4.4 "Compose-new"
 * action row: Draft / Send / Save to drafts / Discard.
 *
 *   - `draftComposeIntent(input)` → Opus intent-to-draft generator
 *     (`generateComposeDraft`). Synchronous — Andy is waiting.
 *   - `sendCompose(input)`        → inline-synchronous send via
 *     `sendComposeMessage` + `sendViaGraph`. On success: outbound row
 *     written, thread cached-draft invalidated, `inbox_message_sent`
 *     logged, any `compose_drafts` row drained.
 *   - `saveComposeDraft(input)`   → persist WIP body to `compose_drafts`
 *     (Option B; no autosave — explicit Save button only per brief).
 *   - `discardComposeDraft(id)`   → delete the WIP row.
 *
 * Auth: all actions require `admin` role (Andy-only). Walk-in recipients
 * (email matches no contact) still send; the outbound row exists on a
 * contactless thread until a future router pass back-fills the contact.
 *
 * Zod validates every input at the boundary; failures surface as
 * `{ ok: false, error }` so the UI can render a toast rather than
 * crash.
 */

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth/session";
import {
  generateComposeDraft,
  type ComposeDraftResult,
} from "@/lib/graph/compose-draft";
import {
  resolveRecipientContact,
  sendComposeMessage,
  saveComposeDraftRow,
} from "@/lib/graph/compose-send";
import {
  generateRefinedDraft,
  MAX_REFINE_INSTRUCTION_CHARS,
  MAX_REFINE_TURNS,
  type RefineDraftResult,
} from "@/lib/graph/refine-draft";
import type { DraftReplyLowConfidenceFlag } from "@/lib/graph/draft-reply";
import { createGraphClient, getActiveGraphState } from "@/lib/graph/client";
import { db } from "@/lib/db";
import { compose_drafts } from "@/lib/db/schema/compose-drafts";
import { threads } from "@/lib/db/schema/messages";
import { enqueueTask } from "@/lib/scheduled-tasks/enqueue";
import { and, eq } from "drizzle-orm";
import { logActivity } from "@/lib/activity-log";

// ── Shared auth helper ───────────────────────────────────────────────

type ActorContext = { userId: string; actorTag: string };

async function requireAdminActor(): Promise<ActorContext | null> {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") return null;
  return {
    userId: session.user.id,
    actorTag: `user:${session.user.id}`,
  };
}

// ── draftComposeIntent ───────────────────────────────────────────────

const DraftComposeIntentInput = z.object({
  intent: z.string().min(1).max(500),
  contactId: z.string().nullable().optional(),
  threadId: z.string().nullable().optional(),
  sendingAddress: z.string().min(1),
});

export type DraftComposeIntentResult =
  | { ok: true; draft: ComposeDraftResult }
  | { ok: false; error: string };

export async function draftComposeIntent(
  input: z.infer<typeof DraftComposeIntentInput>,
): Promise<DraftComposeIntentResult> {
  const actor = await requireAdminActor();
  if (!actor) return { ok: false, error: "Not authorised." };

  const parsed = DraftComposeIntentInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const draft = await generateComposeDraft({
    intent: parsed.data.intent,
    contactId: parsed.data.contactId ?? null,
    threadId: parsed.data.threadId ?? null,
    sendingAddress: parsed.data.sendingAddress,
  });

  return { ok: true, draft };
}

// ── sendCompose ──────────────────────────────────────────────────────

const MAX_ATTACHMENT_BYTES = 3 * 1024 * 1024;

const ComposeAttachmentSchema = z.object({
  name: z.string().min(1).max(512),
  contentType: z.string().min(1).max(255),
  contentBase64: z.string().min(1),
  sizeBytes: z.number().int().nonnegative().max(MAX_ATTACHMENT_BYTES),
});

const SendComposeInputSchema = z.object({
  threadId: z.string().nullable().optional(),
  /**
   * Recipient contact. Optional — if omitted, we'll attempt to resolve
   * from the first `to` address. Null → walk-in (unknown recipient).
   */
  contactId: z.string().nullable().optional(),
  companyId: z.string().nullable().optional(),
  to: z.array(z.string().email()).min(1),
  cc: z.array(z.string().email()).optional(),
  bcc: z.array(z.string().email()).optional(),
  subject: z.string().nullable().optional(),
  bodyText: z.string().min(1),
  sendingAddress: z.string().min(1),
  composeDraftId: z.string().nullable().optional(),
  attachments: z.array(ComposeAttachmentSchema).max(10).optional(),
});

export type SendComposeActionResult =
  | {
      ok: true;
      threadId: string;
      messageId: string;
      graphMessageId: string | null;
      subject: string;
      subjectSource: "user" | "generated" | "heuristic" | "kill_switch_heuristic";
    }
  | { ok: false; error: string };

export async function sendCompose(
  input: z.infer<typeof SendComposeInputSchema>,
): Promise<SendComposeActionResult> {
  const actor = await requireAdminActor();
  if (!actor) return { ok: false, error: "Not authorised." };

  const parsed = SendComposeInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  // Fill in contact/company if not supplied — first `to` wins, same
  // convention as the router's resolution pass.
  let contactId = parsed.data.contactId ?? null;
  let companyId = parsed.data.companyId ?? null;
  if (contactId === null) {
    const resolved = await resolveRecipientContact(parsed.data.to[0]!);
    if (resolved) {
      contactId = resolved.contactId;
      companyId = resolved.companyId;
    }
  }

  try {
    const state = await getActiveGraphState();
    if (!state) {
      return { ok: false, error: "Graph mailbox not connected." };
    }
    const client = await createGraphClient(state.integration_connection_id);
    const result = await sendComposeMessage(client, {
      threadId: parsed.data.threadId ?? null,
      contactId,
      companyId,
      sendingAddress: parsed.data.sendingAddress,
      to: parsed.data.to,
      cc: parsed.data.cc,
      bcc: parsed.data.bcc,
      subject: parsed.data.subject ?? null,
      bodyText: parsed.data.bodyText,
      createdBy: actor.actorTag,
      composeDraftId: parsed.data.composeDraftId ?? null,
      attachments: parsed.data.attachments,
    });
    if ((parsed.data.attachments?.length ?? 0) > 0) {
      await logActivity({
        companyId,
        contactId,
        kind: "inbox_attachment_uploaded",
        body: `${parsed.data.attachments!.length} attachment(s) sent with reply.`,
        meta: {
          thread_id: result.threadId,
          message_id: result.messageId,
          attachment_count: parsed.data.attachments!.length,
          total_bytes: parsed.data.attachments!.reduce(
            (acc, a) => acc + a.sizeBytes,
            0,
          ),
        },
        createdBy: actor.actorTag,
      });
    }
    revalidatePath("/lite/inbox");
    return { ok: true, ...result };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Send failed.",
    };
  }
}

// ── saveComposeDraft ─────────────────────────────────────────────────

const SaveComposeDraftInputSchema = z.object({
  id: z.string().nullable().optional(),
  threadId: z.string().nullable().optional(),
  contactId: z.string().nullable().optional(),
  companyId: z.string().nullable().optional(),
  sendingAddress: z.string().min(1),
  to: z.array(z.string().email()).nullable().optional(),
  cc: z.array(z.string().email()).nullable().optional(),
  bcc: z.array(z.string().email()).nullable().optional(),
  subject: z.string().nullable().optional(),
  bodyText: z.string(),
});

export type SaveComposeDraftActionResult =
  | { ok: true; id: string; created: boolean }
  | { ok: false; error: string };

export async function saveComposeDraft(
  input: z.infer<typeof SaveComposeDraftInputSchema>,
): Promise<SaveComposeDraftActionResult> {
  const actor = await requireAdminActor();
  if (!actor) return { ok: false, error: "Not authorised." };

  const parsed = SaveComposeDraftInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  try {
    const { id, created } = await saveComposeDraftRow({
      id: parsed.data.id ?? null,
      authorUserId: actor.userId,
      threadId: parsed.data.threadId ?? null,
      contactId: parsed.data.contactId ?? null,
      companyId: parsed.data.companyId ?? null,
      sendingAddress: parsed.data.sendingAddress,
      to: parsed.data.to ?? null,
      cc: parsed.data.cc ?? null,
      bcc: parsed.data.bcc ?? null,
      subject: parsed.data.subject ?? null,
      bodyText: parsed.data.bodyText,
    });
    return { ok: true, id, created };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Save failed.",
    };
  }
}

// ── refineDraft (UI-7) ───────────────────────────────────────────────

const RefineTurnSchema = z.object({
  instruction: z.string().min(1).max(MAX_REFINE_INSTRUCTION_CHARS),
  result_body: z.string(),
});

const RefineDraftInputSchema = z.object({
  priorDraft: z.string(),
  instruction: z.string().min(1).max(MAX_REFINE_INSTRUCTION_CHARS),
  priorTurns: z.array(RefineTurnSchema).max(MAX_REFINE_TURNS * 4).optional(),
  contactId: z.string().nullable().optional(),
  threadId: z.string().nullable().optional(),
  sendingAddress: z.string().min(1),
});

export type RefineDraftActionResult =
  | { ok: true; draft: RefineDraftResult }
  | { ok: false; error: string };

export async function refineDraft(
  input: z.infer<typeof RefineDraftInputSchema>,
): Promise<RefineDraftActionResult> {
  const actor = await requireAdminActor();
  if (!actor) return { ok: false, error: "Not authorised." };

  const parsed = RefineDraftInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const result = await generateRefinedDraft({
    priorDraft: parsed.data.priorDraft,
    instruction: parsed.data.instruction,
    priorTurns: parsed.data.priorTurns,
    contactId: parsed.data.contactId ?? null,
    threadId: parsed.data.threadId ?? null,
    sendingAddress: parsed.data.sendingAddress,
  });

  if (result.outcome === "generated") {
    await logActivity({
      companyId: null,
      contactId: parsed.data.contactId ?? null,
      kind: "inbox_draft_refined",
      body: `Refine turn applied (${(parsed.data.priorTurns?.length ?? 0) + 1} of session, ${result.low_confidence_flags.length} flags).`,
      meta: {
        thread_id: parsed.data.threadId ?? null,
        turn_count: (parsed.data.priorTurns?.length ?? 0) + 1,
        instruction_length: parsed.data.instruction.length,
        flag_count: result.low_confidence_flags.length,
      },
      createdBy: actor.actorTag,
    });
  }

  return { ok: true, draft: result };
}

// ── pollCachedDraft ──────────────────────────────────────────────────
//
// The reply composer polls this every `POLL_STALE_MS` (30s) so that a
// freshly-regenerated draft lands in the UI without a full page reload
// and so stale-flag flips from other tabs / the sync worker become
// visible. Returns only the three fields the composer actually reads;
// the rehydrate-vs-preserve-edit decision lives client-side (§16 #60).

export type PollCachedDraftResult =
  | {
      ok: true;
      body: string | null;
      stale: boolean;
      flags: DraftReplyLowConfidenceFlag[];
    }
  | { ok: false; error: string };

export async function pollCachedDraft(
  threadId: string,
): Promise<PollCachedDraftResult> {
  const actor = await requireAdminActor();
  if (!actor) return { ok: false, error: "Not authorised." };
  if (typeof threadId !== "string" || threadId.length === 0) {
    return { ok: false, error: "Invalid thread id." };
  }

  const row = await db
    .select({
      body: threads.cached_draft_body,
      stale: threads.cached_draft_stale,
      flags: threads.cached_draft_low_confidence_flags,
    })
    .from(threads)
    .where(eq(threads.id, threadId))
    .get();

  if (!row) return { ok: false, error: "Thread not found." };
  return {
    ok: true,
    body: row.body ?? null,
    stale: Boolean(row.stale),
    flags: (row.flags as DraftReplyLowConfidenceFlag[] | null) ?? [],
  };
}

// ── regenerateCachedDraft ────────────────────────────────────────────
//
// Wired to the stale-banner "Regenerate" button. Stale-flags the row so
// the UI can render a refreshing hint, then enqueues an
// `inbox_draft_generate` task. Idempotency key buckets manual triggers
// into a 60s window so frantic clicking doesn't pile up the queue.

export type RegenerateCachedDraftResult =
  | { ok: true; enqueued: boolean }
  | { ok: false; error: string };

const REGENERATE_DEBOUNCE_MS = 60_000;

export async function regenerateCachedDraft(
  threadId: string,
): Promise<RegenerateCachedDraftResult> {
  const actor = await requireAdminActor();
  if (!actor) return { ok: false, error: "Not authorised." };
  if (typeof threadId !== "string" || threadId.length === 0) {
    return { ok: false, error: "Invalid thread id." };
  }

  const nowMs = Date.now();
  await db
    .update(threads)
    .set({ cached_draft_stale: true, updated_at_ms: nowMs })
    .where(eq(threads.id, threadId));

  const bucket = Math.floor(nowMs / REGENERATE_DEBOUNCE_MS);
  const inserted = await enqueueTask({
    task_type: "inbox_draft_generate",
    runAt: nowMs,
    payload: { thread_id: threadId, trigger: "manual_regenerate" },
    idempotencyKey: `inbox-draft-generate:${threadId}:manual:${bucket}`,
  });
  return { ok: true, enqueued: inserted !== null };
}

// ── discardComposeDraft ──────────────────────────────────────────────

export type DiscardComposeDraftResult =
  | { ok: true }
  | { ok: false; error: string };

export async function discardComposeDraft(
  id: string,
): Promise<DiscardComposeDraftResult> {
  const actor = await requireAdminActor();
  if (!actor) return { ok: false, error: "Not authorised." };
  if (typeof id !== "string" || id.length === 0) {
    return { ok: false, error: "Invalid id." };
  }
  try {
    await db
      .delete(compose_drafts)
      .where(
        and(
          eq(compose_drafts.id, id),
          eq(compose_drafts.author_user_id, actor.userId),
        ),
      );
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Discard failed.",
    };
  }
}
