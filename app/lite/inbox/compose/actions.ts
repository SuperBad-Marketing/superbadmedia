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
import { createGraphClient, getActiveGraphState } from "@/lib/graph/client";
import { db } from "@/lib/db";
import { compose_drafts } from "@/lib/db/schema/compose-drafts";
import { and, eq } from "drizzle-orm";

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
    });
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
