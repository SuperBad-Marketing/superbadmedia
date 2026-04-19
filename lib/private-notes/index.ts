import { randomUUID } from "node:crypto";
import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { private_notes, type PrivateNoteRow } from "@/lib/db/schema/private-notes";
import { activity_log, type ActivityLogRow } from "@/lib/db/schema/activity-log";
import { logActivity } from "@/lib/activity-log";

export async function createPrivateNote(input: {
  contactId: string;
  companyId?: string | null;
  content: string;
  visibleToAi: boolean;
  createdBy: string;
}): Promise<{ type: "private"; row: PrivateNoteRow } | { type: "activity"; row: ActivityLogRow }> {
  const nowMs = Date.now();

  if (input.visibleToAi) {
    const row = await logActivity({
      contactId: input.contactId,
      companyId: input.companyId,
      kind: "note",
      body: input.content,
      createdBy: input.createdBy,
      createdAtMs: nowMs,
    });
    return { type: "activity", row };
  }

  const row = {
    id: randomUUID(),
    contact_id: input.contactId,
    content: input.content,
    created_by: input.createdBy,
    created_at_ms: nowMs,
    updated_at_ms: nowMs,
  };
  const [inserted] = await db.insert(private_notes).values(row).returning();
  return { type: "private", row: inserted };
}

export async function getPrivateNotesForContact(
  contactId: string,
): Promise<PrivateNoteRow[]> {
  return db
    .select()
    .from(private_notes)
    .where(eq(private_notes.contact_id, contactId))
    .orderBy(desc(private_notes.created_at_ms));
}

export async function toggleNoteVisibility(input: {
  noteId: string;
  currentlyPrivate: boolean;
  contactId: string;
  companyId?: string | null;
}): Promise<void> {
  if (input.currentlyPrivate) {
    const note = await db
      .select()
      .from(private_notes)
      .where(eq(private_notes.id, input.noteId))
      .get();
    if (!note) return;

    await db.delete(private_notes).where(eq(private_notes.id, input.noteId));
    await logActivity({
      contactId: input.contactId,
      companyId: input.companyId,
      kind: "note",
      body: note.content,
      createdBy: note.created_by,
      createdAtMs: note.created_at_ms,
    });
  } else {
    const entry = await db
      .select()
      .from(activity_log)
      .where(eq(activity_log.id, input.noteId))
      .get();
    if (!entry || entry.kind !== "note") return;

    await db.delete(activity_log).where(eq(activity_log.id, input.noteId));
    const nowMs = Date.now();
    await db.insert(private_notes).values({
      id: randomUUID(),
      contact_id: input.contactId,
      content: entry.body,
      created_by: entry.created_by,
      created_at_ms: entry.created_at_ms,
      updated_at_ms: nowMs,
    });
  }
}
