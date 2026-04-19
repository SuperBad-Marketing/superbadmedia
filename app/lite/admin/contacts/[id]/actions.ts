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
