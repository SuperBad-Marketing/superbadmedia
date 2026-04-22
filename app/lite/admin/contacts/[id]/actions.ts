"use server";

import { auth } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { contacts } from "@/lib/db/schema/contacts";
import { eq } from "drizzle-orm";
import {
  createPrivateNote,
  toggleNoteVisibility,
} from "@/lib/private-notes";
import { revalidatePath } from "next/cache";
import { createOnboardingCredentials } from "@/lib/onboarding/create-credentials";

export async function addNote(formData: FormData) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    throw new Error("Unauthorized");
  }

  const contactId = formData.get("contactId") as string;
  const content = (formData.get("content") as string)?.trim();
  const visibleToAi = formData.get("visibleToAi") === "true";

  if (!contactId || !content) return;

  const contact = await db
    .select({ company_id: contacts.company_id })
    .from(contacts)
    .where(eq(contacts.id, contactId))
    .get();

  await createPrivateNote({
    contactId,
    companyId: contact?.company_id ?? null,
    content,
    visibleToAi,
    createdBy: session.user.id!,
  });

  revalidatePath(`/lite/admin/contacts/${contactId}`);
}

export async function toggleVisibility(formData: FormData) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    throw new Error("Unauthorized");
  }

  const noteId = formData.get("noteId") as string;
  const contactId = formData.get("contactId") as string;
  const currentlyPrivate = formData.get("currentlyPrivate") === "true";

  if (!noteId || !contactId) return;

  const contact = await db
    .select({ company_id: contacts.company_id })
    .from(contacts)
    .where(eq(contacts.id, contactId))
    .get();

  await toggleNoteVisibility({
    noteId,
    currentlyPrivate,
    contactId,
    companyId: contact?.company_id ?? null,
  });

  revalidatePath(`/lite/admin/contacts/${contactId}`);
}

export async function resendPortalLinkAction(
  contactId: string,
  companyId: string,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return { ok: false, reason: "Unauthorized" };
  }

  const result = await createOnboardingCredentials({ contactId, companyId });

  if (!result.ok) {
    const messages: Record<string, string> = {
      contact_not_found: "Contact not found.",
      email_missing: "No email on file for this contact.",
      already_verified: "Already verified — they can request a login link from the portal.",
    };
    return { ok: false, reason: messages[result.reason] ?? result.reason };
  }

  revalidatePath(`/lite/admin/contacts/${contactId}`);
  return { ok: true };
}
