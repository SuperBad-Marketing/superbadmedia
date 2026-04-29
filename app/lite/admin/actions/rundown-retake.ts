"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { eq, and } from "drizzle-orm";

import { auth } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { brand_dna_profiles } from "@/lib/db/schema/brand-dna-profiles";
import { leadCandidates } from "@/lib/db/schema/lead-candidates";
import { contacts } from "@/lib/db/schema/contacts";
import { rundownSessions } from "@/lib/db/schema/rundown-sessions";
import { logActivity } from "@/lib/activity-log";

type RetakeResult =
  | { ok: true; retakeUrl: string }
  | { ok: false; error: string };

/**
 * Admin-only: trigger a Brand DNA retake for a candidate or contact.
 * Archives the existing profile, creates a new Rundown session,
 * and emails the retake link.
 */
export async function triggerRundownRetake(
  entityType: "candidate" | "contact",
  entityId: string,
): Promise<RetakeResult> {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return { ok: false, error: "Not authorised." };
  }

  let email: string;
  let name: string;
  let businessName: string;
  let candidateId: string | null = null;
  let contactId: string | null = null;
  let domain: string | null = null;

  if (entityType === "candidate") {
    const [candidate] = await db
      .select()
      .from(leadCandidates)
      .where(eq(leadCandidates.id, entityId))
      .limit(1);

    if (!candidate) return { ok: false, error: "Candidate not found." };
    if (!candidate.contact_email) {
      return { ok: false, error: "Candidate has no email address." };
    }

    email = candidate.contact_email;
    name = candidate.contact_name ?? candidate.company_name;
    businessName = candidate.company_name;
    candidateId = candidate.id;
    domain = candidate.domain;
  } else {
    const [contact] = await db
      .select()
      .from(contacts)
      .where(eq(contacts.id, entityId))
      .limit(1);

    if (!contact) return { ok: false, error: "Contact not found." };
    if (!contact.email) {
      return { ok: false, error: "Contact has no email address." };
    }

    email = contact.email;
    name = contact.name;
    businessName = contact.name;
    contactId = contact.id;
  }

  // Archive any existing current profiles for this entity
  const profileConditions =
    entityType === "candidate"
      ? and(
          eq(brand_dna_profiles.candidate_id, entityId),
          eq(brand_dna_profiles.is_current, true),
        )
      : and(
          eq(brand_dna_profiles.contact_id, entityId),
          eq(brand_dna_profiles.is_current, true),
        );

  const existingProfiles = await db
    .select({ id: brand_dna_profiles.id })
    .from(brand_dna_profiles)
    .where(profileConditions);

  for (const p of existingProfiles) {
    await db
      .update(brand_dna_profiles)
      .set({ is_current: false, updated_at_ms: Date.now() })
      .where(eq(brand_dna_profiles.id, p.id));
  }

  // Create fresh profile
  const now = Date.now();
  const profileId = randomUUID();
  await db.insert(brand_dna_profiles).values({
    id: profileId,
    subject_type: "client",
    subject_id: entityId,
    subject_display_name: name,
    candidate_id: candidateId,
    contact_id: contactId,
    status: "pending",
    is_current: true,
    is_superbad_self: false,
    current_section: 1,
    version: 1,
    created_at_ms: now,
    updated_at_ms: now,
  });

  // Create Rundown session
  const sessionToken = randomUUID().replace(/-/g, "").slice(0, 20);
  const sessionId = randomUUID();
  await db.insert(rundownSessions).values({
    id: sessionId,
    session_token: sessionToken,
    name,
    email,
    email_normalised: email.trim().toLowerCase(),
    business_name: businessName,
    website: domain ?? null,
    candidate_id: candidateId,
    profile_id: profileId,
    status: "entry_submitted",
    source_type: "public",
    entry_submitted_at_ms: now,
    created_at_ms: now,
    updated_at_ms: now,
  });

  // Send retake email
  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://superbadmedia.com.au";
  const retakeUrl = `${baseUrl}/rundown/s/${sessionToken}`;

  try {
    const { sendEmail } = await import("@/lib/channels/email/send");
    const firstName = name.split(" ")[0];
    await sendEmail({
      to: email,
      subject: `fresh brand dna for you, ${firstName}`,
      body: `
        <p>Hey ${firstName},</p>
        <p>You've been invited to take the Brand DNA assessment again. Fresh start, fresh signals.</p>
        <p><a href="${retakeUrl}" style="color: #B22848;">Start your Brand DNA →</a></p>
        <p>It's an intensive one. Worth it.</p>
        <p>Andy</p>
      `,
      classification: "rundown_resume",
      purpose: "admin_triggered_retake",
    });
  } catch {
    // Email failure doesn't block the retake
  }

  await logActivity({
    kind: "rundown_entry_submitted",
    body: `Admin triggered retake for ${name} (${email})`,
    createdBy: `user:${session.user.id ?? "admin"}`,
    meta: { entityType, entityId, sessionToken },
  });

  revalidatePath("/lite/admin/lead-gen");
  revalidatePath("/lite/admin/pipeline");

  return { ok: true, retakeUrl };
}
