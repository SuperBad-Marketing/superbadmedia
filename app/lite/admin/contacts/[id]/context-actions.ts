"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { contacts } from "@/lib/db/schema/contacts";
import { eq } from "drizzle-orm";
import {
  generateDraft as generateDraftFn,
  regenerateDraft as regenerateDraftFn,
  reformatDraft as reformatDraftFn,
  clearDraft,
  completeActionItem,
  dismissActionItem,
  editActionItem,
  createActionItem,
} from "@/lib/context-engine";
import { logActivity } from "@/lib/activity-log";
import { sendEmail } from "@/lib/channels/email/send";
import type { ActionItemOwner } from "@/lib/db/schema/action-items";

type ActionResult<T = Record<string, unknown>> =
  | ({ ok: true } & T)
  | { ok: false; error: string };

async function requireAdmin() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return null;
  }
  return session;
}

async function getContact(contactId: string) {
  return db
    .select({ company_id: contacts.company_id, email: contacts.email, name: contacts.name })
    .from(contacts)
    .where(eq(contacts.id, contactId))
    .get();
}

export async function generateDraftAction(
  contactId: string,
): Promise<ActionResult<{ content: string; channel: string; nudgeHistory: string[] }>> {
  if (!(await requireAdmin())) return { ok: false, error: "Not authorised." };

  try {
    const result = await generateDraftFn(contactId);
    revalidatePath(`/lite/admin/contacts/${contactId}`);
    return {
      ok: true,
      content: result.content,
      channel: result.channel,
      nudgeHistory: result.nudgeHistory,
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Draft generation failed." };
  }
}

export async function regenerateDraftAction(
  contactId: string,
  nudge: string,
  previousDraft: string,
  nudgeHistory: string[],
): Promise<ActionResult<{ content: string; channel: string; nudgeHistory: string[] }>> {
  if (!(await requireAdmin())) return { ok: false, error: "Not authorised." };

  if (!nudge.trim()) return { ok: false, error: "Nudge cannot be empty." };

  try {
    const result = await regenerateDraftFn(contactId, nudge.trim(), previousDraft, nudgeHistory);
    revalidatePath(`/lite/admin/contacts/${contactId}`);
    return {
      ok: true,
      content: result.content,
      channel: result.channel,
      nudgeHistory: result.nudgeHistory,
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Nudge failed." };
  }
}

export async function reformatDraftAction(
  contactId: string,
  draftText: string,
  targetChannel: string,
): Promise<ActionResult<{ content: string; channel: string }>> {
  if (!(await requireAdmin())) return { ok: false, error: "Not authorised." };

  try {
    const result = await reformatDraftFn(contactId, draftText, targetChannel);
    revalidatePath(`/lite/admin/contacts/${contactId}`);
    return { ok: true, content: result.content, channel: result.channel };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Reformat failed." };
  }
}

export async function discardDraftAction(
  contactId: string,
): Promise<ActionResult> {
  if (!(await requireAdmin())) return { ok: false, error: "Not authorised." };

  try {
    const contact = await getContact(contactId);
    await clearDraft(contactId);
    await logActivity({
      contactId,
      companyId: contact?.company_id ?? null,
      kind: "draft_discarded",
      body: "Draft discarded",
    });
    revalidatePath(`/lite/admin/contacts/${contactId}`);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Discard failed." };
  }
}

export async function sendDraftAction(
  contactId: string,
  draftContent: string,
  channel: string,
): Promise<ActionResult> {
  if (!(await requireAdmin())) return { ok: false, error: "Not authorised." };

  const contact = await getContact(contactId);
  if (!contact?.email) return { ok: false, error: "Contact has no email address." };

  try {
    const emailResult = await sendEmail({
      to: contact.email,
      subject: `Re: ${contact.name}`,
      body: draftContent.replace(/\n/g, "<br>"),
      classification: "transactional",
      purpose: "context_engine_draft_send",
    });

    if (!emailResult.sent) {
      return { ok: false, error: emailResult.reason ?? "Email send failed." };
    }

    await clearDraft(contactId);

    await logActivity({
      contactId,
      companyId: contact.company_id,
      kind: "draft_sent",
      body: `Draft sent via ${channel}`,
      meta: { messageId: emailResult.messageId },
    });

    revalidatePath(`/lite/admin/contacts/${contactId}`);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Send failed." };
  }
}

export async function completeActionItemAction(
  itemId: string,
  contactId: string,
): Promise<ActionResult> {
  if (!(await requireAdmin())) return { ok: false, error: "Not authorised." };

  try {
    const contact = await getContact(contactId);
    await completeActionItem(itemId, contact?.company_id ?? null);
    revalidatePath(`/lite/admin/contacts/${contactId}`);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Failed." };
  }
}

export async function dismissActionItemAction(
  itemId: string,
  contactId: string,
): Promise<ActionResult> {
  if (!(await requireAdmin())) return { ok: false, error: "Not authorised." };

  try {
    const contact = await getContact(contactId);
    await dismissActionItem(itemId, contact?.company_id ?? null);
    revalidatePath(`/lite/admin/contacts/${contactId}`);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Failed." };
  }
}

export async function editActionItemAction(
  itemId: string,
  contactId: string,
  description: string,
  dueDateMs: number | null,
): Promise<ActionResult> {
  if (!(await requireAdmin())) return { ok: false, error: "Not authorised." };

  if (!description.trim()) return { ok: false, error: "Description cannot be empty." };

  try {
    const contact = await getContact(contactId);
    await editActionItem(itemId, { description: description.trim(), dueDateMs }, contact?.company_id ?? null);
    revalidatePath(`/lite/admin/contacts/${contactId}`);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Failed." };
  }
}

export async function addActionItemAction(
  contactId: string,
  description: string,
  owner: ActionItemOwner,
  dueDateMs: number | null,
): Promise<ActionResult> {
  if (!(await requireAdmin())) return { ok: false, error: "Not authorised." };

  if (!description.trim()) return { ok: false, error: "Description cannot be empty." };

  try {
    const contact = await getContact(contactId);
    await createActionItem({
      contactId,
      companyId: contact?.company_id ?? null,
      description: description.trim(),
      owner,
      dueDateMs,
      source: "manual",
    });
    revalidatePath(`/lite/admin/contacts/${contactId}`);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Failed." };
  }
}
