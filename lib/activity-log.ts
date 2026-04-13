import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import {
  activity_log,
  type ActivityLogKind,
  type ActivityLogRow,
} from "@/lib/db/schema/activity-log";

/**
 * Write a row to `activity_log`. Every state-changing mutation in a
 * feature surface should call this in the same transaction per
 * FOUNDATIONS §11.1.
 *
 * `companyId` is conceptually required (activity is scoped to a company
 * or org) but left optional here because several early events (e.g.
 * `intro_funnel_started` before a company is resolved) don't have one
 * yet. Callers should still pass a scope whenever one exists.
 */
export interface LogActivityInput {
  companyId?: string | null;
  contactId?: string | null;
  dealId?: string | null;
  kind: ActivityLogKind;
  body: string;
  meta?: Record<string, unknown> | null;
  createdBy?: string | null;
  createdAtMs?: number;
}

export async function logActivity(
  input: LogActivityInput,
): Promise<ActivityLogRow> {
  const row = {
    id: randomUUID(),
    company_id: input.companyId ?? null,
    contact_id: input.contactId ?? null,
    deal_id: input.dealId ?? null,
    kind: input.kind,
    body: input.body,
    meta: input.meta ?? null,
    created_at_ms: input.createdAtMs ?? Date.now(),
    created_by: input.createdBy ?? null,
  };
  const [inserted] = await db.insert(activity_log).values(row).returning();
  return inserted;
}
