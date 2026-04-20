import { randomUUID } from "node:crypto";
import { eq, and, asc, desc, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  action_items,
  type ActionItemRow,
  type ActionItemOwner,
  type ActionItemStatus,
} from "@/lib/db/schema/action-items";
import { logActivity } from "@/lib/activity-log";

export interface ActionItemFilters {
  owner?: ActionItemOwner;
  status?: ActionItemStatus;
}

export async function getActionItems(
  contactId: string,
  filters?: ActionItemFilters,
): Promise<ActionItemRow[]> {
  const conditions = [eq(action_items.contact_id, contactId)];

  if (filters?.owner) {
    conditions.push(eq(action_items.owner, filters.owner));
  }
  if (filters?.status) {
    conditions.push(eq(action_items.status, filters.status));
  }

  return db
    .select()
    .from(action_items)
    .where(and(...conditions))
    .orderBy(asc(action_items.due_date_ms), desc(action_items.created_at_ms));
}

export async function createActionItem(input: {
  contactId: string;
  companyId?: string | null;
  description: string;
  owner: ActionItemOwner;
  dueDateMs?: number | null;
  source: "claude_extract" | "manual";
  sourceMessageId?: string | null;
}): Promise<ActionItemRow> {
  const nowMs = Date.now();
  const row = {
    id: randomUUID(),
    contact_id: input.contactId,
    description: input.description,
    owner: input.owner,
    due_date_ms: input.dueDateMs ?? null,
    source: input.source,
    source_message_id: input.sourceMessageId ?? null,
    status: "open" as const,
    created_at_ms: nowMs,
    completed_at_ms: null,
  };

  const [inserted] = await db.insert(action_items).values(row).returning();

  const kind =
    input.source === "manual"
      ? "action_item_manual_created"
      : "action_item_extracted";

  await logActivity({
    contactId: input.contactId,
    companyId: input.companyId,
    kind,
    body: input.description,
    meta: { owner: input.owner, source: input.source },
  });

  return inserted;
}

export async function completeActionItem(
  itemId: string,
  companyId?: string | null,
): Promise<void> {
  const nowMs = Date.now();
  const item = await db
    .select()
    .from(action_items)
    .where(eq(action_items.id, itemId))
    .get();

  if (!item || item.status !== "open") return;

  await db
    .update(action_items)
    .set({ status: "done", completed_at_ms: nowMs })
    .where(eq(action_items.id, itemId));

  await logActivity({
    contactId: item.contact_id,
    companyId,
    kind: "action_item_completed",
    body: item.description,
    meta: { owner: item.owner },
  });
}

export async function dismissActionItem(
  itemId: string,
  companyId?: string | null,
): Promise<void> {
  const item = await db
    .select()
    .from(action_items)
    .where(eq(action_items.id, itemId))
    .get();

  if (!item || item.status !== "open") return;

  await db
    .update(action_items)
    .set({ status: "dismissed" })
    .where(eq(action_items.id, itemId));

  await logActivity({
    contactId: item.contact_id,
    companyId,
    kind: "action_item_dismissed",
    body: item.description,
    meta: { owner: item.owner },
  });
}

export async function editActionItem(
  itemId: string,
  updates: { description?: string; dueDateMs?: number | null },
  companyId?: string | null,
): Promise<void> {
  const item = await db
    .select()
    .from(action_items)
    .where(eq(action_items.id, itemId))
    .get();

  if (!item) return;

  const set: Record<string, unknown> = {};
  if (updates.description !== undefined) set.description = updates.description;
  if (updates.dueDateMs !== undefined) set.due_date_ms = updates.dueDateMs;

  if (Object.keys(set).length === 0) return;

  await db.update(action_items).set(set).where(eq(action_items.id, itemId));

  await logActivity({
    contactId: item.contact_id,
    companyId,
    kind: "action_item_edited",
    body: updates.description ?? item.description,
    meta: { owner: item.owner, changes: Object.keys(set) },
  });
}
