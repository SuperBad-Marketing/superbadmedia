"use server";

import { z } from "zod";
import { eq, and, isNull, isNotNull, inArray, lt, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { auth } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { threads, messages } from "@/lib/db/schema/messages";
import { logActivity } from "@/lib/activity-log";
import { getActiveGraphState, createGraphClient } from "@/lib/graph";
import { logExternalCall } from "@/lib/observatory";

type ActorContext = { userId: string; actorTag: string };

async function requireAdminActor(): Promise<ActorContext | null> {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") return null;
  return {
    userId: session.user.id,
    actorTag: `user:${session.user.id}`,
  };
}

async function getGraphClient() {
  const state = await getActiveGraphState();
  if (!state) return null;
  try {
    return await createGraphClient(state.integration_connection_id);
  } catch {
    return null;
  }
}

async function trashGraphMessage(
  client: { fetch: (path: string, init?: RequestInit) => Promise<Response> },
  graphMessageId: string,
): Promise<boolean> {
  const res = await client.fetch(`/me/messages/${graphMessageId}/move`, {
    method: "POST",
    body: JSON.stringify({ destinationId: "deleteditems" }),
  });
  logExternalCall({
    job: "graph-mail-trash",
    actorType: "internal",
    units: { messages_trashed: 1 },
    estimatedCostAud: 0,
  }).catch(() => {});
  return res.ok;
}

const DeleteThreadInput = z.object({
  threadId: z.string().min(1),
});

export type DeleteThreadResult = { ok: true } | { ok: false; error: string };

export async function deleteThreadAction(
  input: z.infer<typeof DeleteThreadInput>,
): Promise<DeleteThreadResult> {
  const actor = await requireAdminActor();
  if (!actor) return { ok: false, error: "Not authorised." };

  const parsed = DeleteThreadInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const thread = await db
    .select({
      id: threads.id,
      contact_id: threads.contact_id,
      company_id: threads.company_id,
      subject: threads.subject,
    })
    .from(threads)
    .where(eq(threads.id, parsed.data.threadId))
    .get();

  if (!thread) return { ok: false, error: "Thread not found." };

  const threadMessages = await db
    .select({
      id: messages.id,
      graph_message_id: messages.graph_message_id,
    })
    .from(messages)
    .where(
      and(
        eq(messages.thread_id, thread.id),
        isNull(messages.deleted_at_ms),
      ),
    );

  const graphClient = await getGraphClient();
  const nowMs = Date.now();

  for (const msg of threadMessages) {
    if (msg.graph_message_id && graphClient) {
      await trashGraphMessage(graphClient, msg.graph_message_id);
    }
    await db
      .update(messages)
      .set({ deleted_at_ms: nowMs })
      .where(eq(messages.id, msg.id));
  }

  await logActivity({
    companyId: thread.company_id,
    contactId: thread.contact_id,
    kind: "inbox_thread_deleted",
    body: `Thread deleted: ${thread.subject ?? "(no subject)"}`,
    meta: {
      thread_id: thread.id,
      messages_deleted: threadMessages.length,
      graph_trashed: !!graphClient,
    },
    createdBy: actor.actorTag,
  });

  revalidatePath("/lite/inbox");
  return { ok: true };
}

export type CleanupCandidate = {
  threadId: string;
  subject: string | null;
  senderLabel: string;
  priorityClass: "noise" | "spam";
  messageCount: number;
  lastMessageAtMs: number;
};

export async function getCleanupCandidatesAction(): Promise<{
  ok: true;
  candidates: CleanupCandidate[];
} | { ok: false; error: string }> {
  const actor = await requireAdminActor();
  if (!actor) return { ok: false, error: "Not authorised." };

  const junkThreads = await db
    .select({
      id: threads.id,
      subject: threads.subject,
      priority_class: threads.priority_class,
      keep_pinned: threads.keep_pinned,
      last_message_at_ms: threads.last_message_at_ms,
      contact_id: threads.contact_id,
    })
    .from(threads)
    .where(
      and(
        inArray(threads.priority_class, ["noise", "spam"]),
        eq(threads.keep_pinned, false),
      ),
    );

  const candidates: CleanupCandidate[] = [];

  for (const t of junkThreads) {
    const msgRows = await db
      .select({ id: messages.id, from_address: messages.from_address })
      .from(messages)
      .where(
        and(
          eq(messages.thread_id, t.id),
          isNull(messages.deleted_at_ms),
        ),
      );

    if (msgRows.length === 0) continue;

    candidates.push({
      threadId: t.id,
      subject: t.subject,
      senderLabel: msgRows[0].from_address ?? "Unknown",
      priorityClass: t.priority_class as "noise" | "spam",
      messageCount: msgRows.length,
      lastMessageAtMs: t.last_message_at_ms,
    });
  }

  candidates.sort((a, b) => b.lastMessageAtMs - a.lastMessageAtMs);

  return { ok: true, candidates };
}

const CleanupInboxInput = z.object({
  threadIds: z.array(z.string().min(1)).min(1),
});

export type CleanupInboxResult = {
  ok: true;
  deletedThreads: number;
  deletedMessages: number;
} | { ok: false; error: string };

export async function cleanupInboxAction(
  input: z.infer<typeof CleanupInboxInput>,
): Promise<CleanupInboxResult> {
  const actor = await requireAdminActor();
  if (!actor) return { ok: false, error: "Not authorised." };

  const parsed = CleanupInboxInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const graphClient = await getGraphClient();
  const nowMs = Date.now();
  let totalMessages = 0;

  for (const threadId of parsed.data.threadIds) {
    const threadMessages = await db
      .select({
        id: messages.id,
        graph_message_id: messages.graph_message_id,
      })
      .from(messages)
      .where(
        and(
          eq(messages.thread_id, threadId),
          isNull(messages.deleted_at_ms),
        ),
      );

    for (const msg of threadMessages) {
      if (msg.graph_message_id && graphClient) {
        await trashGraphMessage(graphClient, msg.graph_message_id);
      }
      await db
        .update(messages)
        .set({ deleted_at_ms: nowMs })
        .where(eq(messages.id, msg.id));
    }

    totalMessages += threadMessages.length;
  }

  await logActivity({
    companyId: null,
    contactId: null,
    kind: "inbox_noise_cleanup",
    body: `Inbox cleanup: ${parsed.data.threadIds.length} threads, ${totalMessages} messages trashed.`,
    meta: {
      thread_ids: parsed.data.threadIds,
      messages_deleted: totalMessages,
      graph_trashed: !!graphClient,
    },
    createdBy: actor.actorTag,
  });

  revalidatePath("/lite/inbox");
  return { ok: true, deletedThreads: parsed.data.threadIds.length, deletedMessages: totalMessages };
}

// ── Age-based cleanup ─────────────────────────────────────────────────

export type AgeCandidate = {
  threadId: string;
  subject: string | null;
  senderLabel: string;
  priorityClass: "signal" | "noise" | "spam";
  messageCount: number;
  lastMessageAtMs: number;
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const GetAgeCandidatesInput = z.object({
  olderThanDays: z.number().int().min(1).max(365),
});

export async function getAgeCandidatesAction(
  input: z.infer<typeof GetAgeCandidatesInput>,
): Promise<
  { ok: true; candidates: AgeCandidate[] } | { ok: false; error: string }
> {
  const actor = await requireAdminActor();
  if (!actor) return { ok: false, error: "Not authorised." };

  const parsed = GetAgeCandidatesInput.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };

  const cutoffMs = Date.now() - parsed.data.olderThanDays * MS_PER_DAY;

  const oldThreads = await db
    .select({
      id: threads.id,
      subject: threads.subject,
      priority_class: threads.priority_class,
      keep_pinned: threads.keep_pinned,
      last_message_at_ms: threads.last_message_at_ms,
    })
    .from(threads)
    .where(
      and(
        lt(threads.last_message_at_ms, cutoffMs),
        eq(threads.keep_pinned, false),
      ),
    );

  const candidates: AgeCandidate[] = [];

  for (const t of oldThreads) {
    const msgRows = await db
      .select({ id: messages.id, from_address: messages.from_address })
      .from(messages)
      .where(
        and(eq(messages.thread_id, t.id), isNull(messages.deleted_at_ms)),
      );

    if (msgRows.length === 0) continue;

    candidates.push({
      threadId: t.id,
      subject: t.subject,
      senderLabel: msgRows[0].from_address ?? "Unknown",
      priorityClass: t.priority_class as "signal" | "noise" | "spam",
      messageCount: msgRows.length,
      lastMessageAtMs: t.last_message_at_ms,
    });
  }

  candidates.sort((a, b) => a.lastMessageAtMs - b.lastMessageAtMs);

  return { ok: true, candidates };
}

export async function cleanupOldThreadsAction(
  input: z.infer<typeof CleanupInboxInput>,
): Promise<CleanupInboxResult> {
  const actor = await requireAdminActor();
  if (!actor) return { ok: false, error: "Not authorised." };

  const parsed = CleanupInboxInput.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };

  const graphClient = await getGraphClient();
  const nowMs = Date.now();
  let totalMessages = 0;

  for (const threadId of parsed.data.threadIds) {
    const threadMessages = await db
      .select({ id: messages.id, graph_message_id: messages.graph_message_id })
      .from(messages)
      .where(
        and(eq(messages.thread_id, threadId), isNull(messages.deleted_at_ms)),
      );

    for (const msg of threadMessages) {
      if (msg.graph_message_id && graphClient) {
        await trashGraphMessage(graphClient, msg.graph_message_id);
      }
      await db
        .update(messages)
        .set({ deleted_at_ms: nowMs })
        .where(eq(messages.id, msg.id));
    }

    totalMessages += threadMessages.length;
  }

  await logActivity({
    companyId: null,
    contactId: null,
    kind: "inbox_age_cleanup",
    body: `Age cleanup: ${parsed.data.threadIds.length} old threads, ${totalMessages} messages trashed.`,
    meta: {
      thread_ids: parsed.data.threadIds,
      messages_deleted: totalMessages,
      graph_trashed: !!graphClient,
    },
    createdBy: actor.actorTag,
  });

  revalidatePath("/lite/inbox");
  return { ok: true, deletedThreads: parsed.data.threadIds.length, deletedMessages: totalMessages };
}

// ── Read noise cleanup ────────────────────────────────────────────────

export type ReadNoiseCandidate = {
  threadId: string;
  subject: string | null;
  senderLabel: string;
  messageCount: number;
  lastMessageAtMs: number;
};

export async function getReadNoiseCandidatesAction(): Promise<
  { ok: true; candidates: ReadNoiseCandidate[] } | { ok: false; error: string }
> {
  const actor = await requireAdminActor();
  if (!actor) return { ok: false, error: "Not authorised." };

  const noiseThreads = await db
    .select({
      id: threads.id,
      subject: threads.subject,
      keep_pinned: threads.keep_pinned,
      last_message_at_ms: threads.last_message_at_ms,
      last_outbound_at_ms: threads.last_outbound_at_ms,
      last_inbound_at_ms: threads.last_inbound_at_ms,
    })
    .from(threads)
    .where(
      and(
        eq(threads.priority_class, "noise"),
        eq(threads.keep_pinned, false),
        isNotNull(threads.last_outbound_at_ms),
      ),
    );

  const candidates: ReadNoiseCandidate[] = [];

  for (const t of noiseThreads) {
    if (
      t.last_inbound_at_ms !== null &&
      t.last_outbound_at_ms !== null &&
      t.last_inbound_at_ms > t.last_outbound_at_ms
    )
      continue;

    const msgRows = await db
      .select({ id: messages.id, from_address: messages.from_address })
      .from(messages)
      .where(
        and(eq(messages.thread_id, t.id), isNull(messages.deleted_at_ms)),
      );

    if (msgRows.length === 0) continue;

    candidates.push({
      threadId: t.id,
      subject: t.subject,
      senderLabel: msgRows[0].from_address ?? "Unknown",
      messageCount: msgRows.length,
      lastMessageAtMs: t.last_message_at_ms,
    });
  }

  candidates.sort((a, b) => b.lastMessageAtMs - a.lastMessageAtMs);

  return { ok: true, candidates };
}

// ── Empty trash ───────────────────────────────────────────────────────

export type EmptyTrashResult =
  | { ok: true; hardDeleted: number }
  | { ok: false; error: string };

export async function emptyTrashAction(): Promise<EmptyTrashResult> {
  const actor = await requireAdminActor();
  if (!actor) return { ok: false, error: "Not authorised." };

  const trashed = await db
    .select({ id: messages.id })
    .from(messages)
    .where(isNotNull(messages.deleted_at_ms));

  if (trashed.length === 0) return { ok: true, hardDeleted: 0 };

  const ids = trashed.map((r) => r.id);
  await db.delete(messages).where(inArray(messages.id, ids));

  await logActivity({
    companyId: null,
    contactId: null,
    kind: "inbox_trash_emptied",
    body: `Trash emptied: ${trashed.length} messages permanently deleted.`,
    meta: { hard_deleted: trashed.length },
    createdBy: actor.actorTag,
  });

  revalidatePath("/lite/inbox");
  return { ok: true, hardDeleted: trashed.length };
}

export async function getTrashCountAction(): Promise<
  { ok: true; count: number } | { ok: false; error: string }
> {
  const actor = await requireAdminActor();
  if (!actor) return { ok: false, error: "Not authorised." };

  const rows = await db
    .select({ count: sql<number>`count(*)` })
    .from(messages)
    .where(isNotNull(messages.deleted_at_ms));

  return { ok: true, count: rows[0]?.count ?? 0 };
}
