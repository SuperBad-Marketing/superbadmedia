"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { outreachDrafts } from "@/lib/db/schema/outreach-drafts";
import { dncEmails } from "@/lib/db/schema/dnc";
import { dncDomains } from "@/lib/db/schema/dnc";
import { eq } from "drizzle-orm";
import { logActivity } from "@/lib/activity-log";
import { randomUUID } from "node:crypto";

type ActionResult = { ok: true } | { ok: false; error: string };

const LEAD_GEN_PATH = "/lite/admin/lead-gen";

async function adminActorTag(): Promise<string | null> {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") return null;
  return `user:${session.user.id ?? "admin"}`;
}

export async function approveDraftAction(
  draftId: string,
): Promise<ActionResult> {
  const by = await adminActorTag();
  if (!by) return { ok: false, error: "Not authorised." };

  const [draft] = await db
    .select()
    .from(outreachDrafts)
    .where(eq(outreachDrafts.id, draftId))
    .limit(1);

  if (!draft) return { ok: false, error: "Draft not found." };
  if (draft.status !== "pending_approval") {
    return { ok: false, error: "Draft is not pending approval." };
  }

  await db
    .update(outreachDrafts)
    .set({
      status: "approved_queued",
      approved_at: new Date(),
      approved_by: by.replace("user:", ""),
      approval_kind: "manual",
    })
    .where(eq(outreachDrafts.id, draftId));

  await logActivity({
    kind: "outreach_draft_approved",
    body: `Approved draft ${draftId}`,
    createdBy: by,
    meta: { draft_id: draftId, approval_kind: "manual" },
  });

  revalidatePath(LEAD_GEN_PATH);
  return { ok: true };
}

export async function rejectDraftAction(
  draftId: string,
): Promise<ActionResult> {
  const by = await adminActorTag();
  if (!by) return { ok: false, error: "Not authorised." };

  const [draft] = await db
    .select()
    .from(outreachDrafts)
    .where(eq(outreachDrafts.id, draftId))
    .limit(1);

  if (!draft) return { ok: false, error: "Draft not found." };
  if (
    draft.status !== "pending_approval" &&
    draft.status !== "approved_queued"
  ) {
    return { ok: false, error: "Draft cannot be rejected in its current state." };
  }

  await db
    .update(outreachDrafts)
    .set({ status: "rejected" })
    .where(eq(outreachDrafts.id, draftId));

  await logActivity({
    kind: "outreach_draft_rejected",
    body: `Rejected draft ${draftId}`,
    createdBy: by,
    meta: { draft_id: draftId },
  });

  revalidatePath(LEAD_GEN_PATH);
  return { ok: true };
}

export async function addDncEmailAction(
  email: string,
  reason?: string,
): Promise<ActionResult> {
  const by = await adminActorTag();
  if (!by) return { ok: false, error: "Not authorised." };

  const normalised = email.toLowerCase().trim();
  if (!normalised || !normalised.includes("@")) {
    return { ok: false, error: "Invalid email." };
  }

  try {
    await db.insert(dncEmails).values({
      id: randomUUID(),
      email: normalised,
      reason: reason || null,
      source: "manual",
      added_by: by.replace("user:", ""),
    });
  } catch {
    return { ok: false, error: "Email already on DNC list." };
  }

  await logActivity({
    kind: "dnc_email_added",
    body: `Added ${normalised} to DNC email list`,
    createdBy: by,
    meta: { email: normalised, reason },
  });

  revalidatePath(LEAD_GEN_PATH);
  return { ok: true };
}

export async function removeDncEmailAction(
  id: string,
): Promise<ActionResult> {
  const by = await adminActorTag();
  if (!by) return { ok: false, error: "Not authorised." };

  const [row] = await db
    .select()
    .from(dncEmails)
    .where(eq(dncEmails.id, id))
    .limit(1);

  if (!row) return { ok: false, error: "Entry not found." };

  await db.delete(dncEmails).where(eq(dncEmails.id, id));

  await logActivity({
    kind: "dnc_email_removed",
    body: `Removed ${row.email} from DNC email list`,
    createdBy: by,
    meta: { email: row.email },
  });

  revalidatePath(LEAD_GEN_PATH);
  return { ok: true };
}

export async function addDncDomainAction(
  domain: string,
  reason?: string,
): Promise<ActionResult> {
  const by = await adminActorTag();
  if (!by) return { ok: false, error: "Not authorised." };

  const normalised = domain.toLowerCase().trim().replace(/^@/, "");
  if (!normalised || normalised.includes("@")) {
    return { ok: false, error: "Invalid domain." };
  }

  try {
    await db.insert(dncDomains).values({
      id: randomUUID(),
      domain: normalised,
      reason: reason || null,
      added_by: by.replace("user:", ""),
    });
  } catch {
    return { ok: false, error: "Domain already on DNC list." };
  }

  await logActivity({
    kind: "dnc_domain_added",
    body: `Added ${normalised} to DNC domain list`,
    createdBy: by,
    meta: { domain: normalised, reason },
  });

  revalidatePath(LEAD_GEN_PATH);
  return { ok: true };
}

export async function removeDncDomainAction(
  id: string,
): Promise<ActionResult> {
  const by = await adminActorTag();
  if (!by) return { ok: false, error: "Not authorised." };

  const [row] = await db
    .select()
    .from(dncDomains)
    .where(eq(dncDomains.id, id))
    .limit(1);

  if (!row) return { ok: false, error: "Entry not found." };

  await db.delete(dncDomains).where(eq(dncDomains.id, id));

  await logActivity({
    kind: "dnc_domain_removed",
    body: `Removed ${row.domain} from DNC domain list`,
    createdBy: by,
    meta: { domain: row.domain },
  });

  revalidatePath(LEAD_GEN_PATH);
  return { ok: true };
}
