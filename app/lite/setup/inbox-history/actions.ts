"use server";

/**
 * Server actions for the inbox history import wizard step.
 *
 * Surfaces: progress polling, import kickoff, contact routing review,
 * noise cleanup. All admin-role-gated.
 *
 * Owner: UI-12. Spec: unified-inbox.md §13 Steps 3–5.
 */
import { z } from "zod";
import { eq, and, lte, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { messages, threads } from "@/lib/db/schema/messages";
import { contacts } from "@/lib/db/schema/contacts";
import { graph_api_state } from "@/lib/db/schema/graph-api-state";
import { enqueueTask } from "@/lib/scheduled-tasks/enqueue";
import settings from "@/lib/settings";
import { logActivity } from "@/lib/activity-log";
import {
  getGraphStateForImport,
  getImportProgress,
  type ImportProgress,
} from "@/lib/graph/history-import";

// ---------------------------------------------------------------------------
// Auth guard
// ---------------------------------------------------------------------------
async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "admin") {
    throw new Error("Unauthorized");
  }
  return session.user;
}

// ---------------------------------------------------------------------------
// 1. Get import progress (polled by the wizard UI)
// ---------------------------------------------------------------------------
export async function getHistoryImportStatus(): Promise<
  | { ok: true; graphStateId: string; status: string; progress: ImportProgress | null }
  | { ok: false; error: string }
> {
  try {
    await requireAdmin();
    const state = await getGraphStateForImport();
    if (!state) {
      return { ok: false, error: "No Microsoft connection found. Complete the Graph API wizard first." };
    }

    const progress = await getImportProgress(state.id);
    return {
      ok: true,
      graphStateId: state.id,
      status: state.status,
      progress,
    };
  } catch {
    return { ok: false, error: "Failed to read import status." };
  }
}

// ---------------------------------------------------------------------------
// 2. Start the import (enqueues the first batch)
// ---------------------------------------------------------------------------
export async function startHistoryImport(): Promise<
  { ok: true } | { ok: false; error: string }
> {
  try {
    await requireAdmin();
    const state = await getGraphStateForImport();
    if (!state) {
      return { ok: false, error: "No Microsoft connection found." };
    }

    if (state.status === "complete") {
      return { ok: false, error: "Import already completed." };
    }

    if (state.status === "in_progress") {
      return { ok: false, error: "Import already in progress." };
    }

    const monthsBack = await settings.get("inbox.history_import_months");

    // Mark as in_progress
    await db
      .update(graph_api_state)
      .set({
        initial_import_status: "in_progress",
        updated_at_ms: Date.now(),
      })
      .where(eq(graph_api_state.id, state.id));

    // Enqueue the first batch
    await enqueueTask({
      task_type: "inbox_initial_import",
      runAt: Date.now(),
      payload: {
        graph_state_id: state.id,
        months_back: monthsBack,
      },
      idempotencyKey: `inbox_initial_import|${state.id}|start`,
    });

    await logActivity({
      kind: "inbox_history_import_started",
      body: `Started ${monthsBack}-month email history import`,
    });

    revalidatePath("/lite/setup/inbox-history");
    return { ok: true };
  } catch {
    return { ok: false, error: "Failed to start import." };
  }
}

// ---------------------------------------------------------------------------
// 3. Get auto-created contacts summary (for routing review)
// ---------------------------------------------------------------------------
export type ContactSummary = {
  id: string;
  name: string | null;
  email: string;
  relationshipType: string | null;
  messageCount: number;
};

export async function getImportedContactsSummary(): Promise<
  | { ok: true; contacts: ContactSummary[]; totals: Record<string, number> }
  | { ok: false; error: string }
> {
  try {
    await requireAdmin();

    // Find contacts linked to threads that have backfill-imported messages.
    // Group by contact to get per-contact message counts.
    const rows = await db
      .select({
        contactId: threads.contact_id,
        contactName: contacts.name,
        contactEmail: contacts.email,
        relationshipType: contacts.relationship_type,
        messageCount: sql<number>`count(distinct ${messages.id})`,
      })
      .from(messages)
      .innerJoin(threads, eq(messages.thread_id, threads.id))
      .innerJoin(contacts, eq(threads.contact_id, contacts.id))
      .where(eq(messages.import_source, "backfill_12mo"))
      .groupBy(threads.contact_id);

    const contactSummaries: ContactSummary[] = [];
    const totals: Record<string, number> = {};

    for (const row of rows) {
      if (!row.contactId) continue;
      const type = row.relationshipType ?? "unknown";
      totals[type] = (totals[type] ?? 0) + 1;

      contactSummaries.push({
        id: row.contactId,
        name: row.contactName,
        email: row.contactEmail ?? "",
        relationshipType: row.relationshipType,
        messageCount: row.messageCount,
      });
    }

    return { ok: true, contacts: contactSummaries, totals };
  } catch {
    return { ok: false, error: "Failed to load contacts." };
  }
}

// ---------------------------------------------------------------------------
// 4. Re-route a contact (change relationship type)
// ---------------------------------------------------------------------------
const RerouteSchema = z.object({
  contactId: z.string().min(1),
  newRelationshipType: z.enum([
    "lead",
    "client",
    "past_client",
    "non_client",
    "supplier",
    "personal",
  ]),
});

export async function rerouteContact(
  input: z.infer<typeof RerouteSchema>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await requireAdmin();
    const parsed = RerouteSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: "Invalid input." };
    }

    await db
      .update(contacts)
      .set({
        relationship_type: parsed.data.newRelationshipType,
        updated_at_ms: Date.now(),
      })
      .where(eq(contacts.id, parsed.data.contactId));

    await logActivity({
      kind: "inbox_contact_rerouted",
      body: `Re-routed contact to ${parsed.data.newRelationshipType}`,
      contactId: parsed.data.contactId,
    });

    revalidatePath("/lite/setup/inbox-history");
    return { ok: true };
  } catch {
    return { ok: false, error: "Failed to re-route contact." };
  }
}

// ---------------------------------------------------------------------------
// 5. Noise cleanup — soft-delete noise older than 30d
// ---------------------------------------------------------------------------
export async function cleanupOldNoise(): Promise<
  { ok: true; purged: number } | { ok: false; error: string }
> {
  try {
    await requireAdmin();

    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;

    const result = await db
      .update(messages)
      .set({
        deleted_at_ms: Date.now(),
        updated_at_ms: Date.now(),
      })
      .where(
        and(
          eq(messages.import_source, "backfill_12mo"),
          eq(messages.priority_class, "noise"),
          lte(messages.received_at_ms, thirtyDaysAgo),
          sql`${messages.deleted_at_ms} IS NULL`,
        ),
      )
      .returning({ id: messages.id });

    const purged = result.length;

    await logActivity({
      kind: "inbox_noise_cleanup",
      body: `Purged ${purged} noise messages older than 30 days from history import`,
    });

    revalidatePath("/lite/setup/inbox-history");
    return { ok: true, purged };
  } catch {
    return { ok: false, error: "Failed to clean up noise." };
  }
}
