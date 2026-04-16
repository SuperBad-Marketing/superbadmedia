"use server";

/**
 * Thread-level server actions used by the mobile swipe gestures
 * (spec §4.5): swipe-right keeps, swipe-left archives. Desktop can also
 * consume these — the `KeepToggle` in `thread-detail.tsx` wires through
 * `setThreadKeepAction` so a pin survives reload.
 *
 *   - `setThreadKeepAction(input)`  → flip `threads.keep_pinned`. Logs
 *     `inbox_keep_pinned` on each state change.
 *   - `archiveThreadAction(input)`  → promote to noise via
 *     `threads.priority_class = 'noise'`. Logs `inbox_noise_promoted`.
 *     Reversible: the Noise tab still surfaces the thread, and a
 *     classification correction can route it back to signal.
 *
 * Auth: admin role required (matches `ticket/actions.ts`).
 * Kill switches: no gate — both are local state writes.
 */

import { z } from "zod";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { auth } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { threads } from "@/lib/db/schema/messages";
import { logActivity } from "@/lib/activity-log";

type ActorContext = { userId: string; actorTag: string };

async function requireAdminActor(): Promise<ActorContext | null> {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") return null;
  return {
    userId: session.user.id,
    actorTag: `user:${session.user.id}`,
  };
}

// ── setThreadKeep ────────────────────────────────────────────────────

const SetThreadKeepInput = z.object({
  threadId: z.string().min(1),
  pinned: z.boolean(),
});

export type SetThreadKeepResult =
  | { ok: true; pinned: boolean }
  | { ok: false; error: string };

export async function setThreadKeepAction(
  input: z.infer<typeof SetThreadKeepInput>,
): Promise<SetThreadKeepResult> {
  const actor = await requireAdminActor();
  if (!actor) return { ok: false, error: "Not authorised." };

  const parsed = SetThreadKeepInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const existing = await db
    .select({
      contact_id: threads.contact_id,
      company_id: threads.company_id,
      keep_pinned: threads.keep_pinned,
    })
    .from(threads)
    .where(eq(threads.id, parsed.data.threadId))
    .get();

  if (!existing) return { ok: false, error: "Thread not found." };
  if (existing.keep_pinned === parsed.data.pinned) {
    return { ok: true, pinned: parsed.data.pinned };
  }

  const nowMs = Date.now();
  await db
    .update(threads)
    .set({
      keep_pinned: parsed.data.pinned,
      updated_at_ms: nowMs,
    })
    .where(eq(threads.id, parsed.data.threadId));

  await logActivity({
    companyId: existing.company_id,
    contactId: existing.contact_id,
    kind: "inbox_keep_pinned",
    body: parsed.data.pinned ? "Thread pinned." : "Thread unpinned.",
    meta: {
      thread_id: parsed.data.threadId,
      pinned: parsed.data.pinned,
    },
    createdBy: actor.actorTag,
  });

  revalidatePath("/lite/inbox");
  return { ok: true, pinned: parsed.data.pinned };
}

// ── archiveThread (promote to noise) ────────────────────────────────

const ArchiveThreadInput = z.object({
  threadId: z.string().min(1),
});

export type ArchiveThreadResult = { ok: true } | { ok: false; error: string };

export async function archiveThreadAction(
  input: z.infer<typeof ArchiveThreadInput>,
): Promise<ArchiveThreadResult> {
  const actor = await requireAdminActor();
  if (!actor) return { ok: false, error: "Not authorised." };

  const parsed = ArchiveThreadInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const existing = await db
    .select({
      contact_id: threads.contact_id,
      company_id: threads.company_id,
      priority_class: threads.priority_class,
    })
    .from(threads)
    .where(eq(threads.id, parsed.data.threadId))
    .get();

  if (!existing) return { ok: false, error: "Thread not found." };
  if (existing.priority_class === "noise") return { ok: true };

  const nowMs = Date.now();
  await db
    .update(threads)
    .set({
      priority_class: "noise",
      updated_at_ms: nowMs,
    })
    .where(eq(threads.id, parsed.data.threadId));

  await logActivity({
    companyId: existing.company_id,
    contactId: existing.contact_id,
    kind: "inbox_noise_promoted",
    body: "Thread archived (promoted to noise).",
    meta: {
      thread_id: parsed.data.threadId,
      previous_class: existing.priority_class,
      trigger: "mobile_swipe_archive",
    },
    createdBy: actor.actorTag,
  });

  revalidatePath("/lite/inbox");
  return { ok: true };
}
