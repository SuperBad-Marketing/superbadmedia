"use server";

import { randomUUID } from "node:crypto";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { rundownSessions } from "@/lib/db/schema/rundown-sessions";
import { brand_dna_profiles } from "@/lib/db/schema/brand-dna-profiles";
import { leadCandidates } from "@/lib/db/schema/lead-candidates";
import { contacts } from "@/lib/db/schema/contacts";
import { logActivity } from "@/lib/activity-log";
import { verifyTurnstile } from "@/lib/audit/turnstile";

function normaliseEmail(email: string): string {
  return email.trim().toLowerCase();
}

function normaliseInstagram(handle: string): string {
  return handle.replace(/^@/, "").replace(/^https?:\/\/(www\.)?instagram\.com\//, "").replace(/\/+$/, "").trim();
}

function normaliseDomain(url: string): string {
  try {
    const u = new URL(url.startsWith("http") ? url : `https://${url}`);
    return u.hostname.replace(/^www\./, "");
  } catch {
    return url.trim().toLowerCase();
  }
}

const entrySchema = z.object({
  name: z.string().trim().min(1).max(200),
  email: z.string().email().max(200),
  businessName: z.string().trim().min(1).max(200),
  website: z.string().trim().max(500).optional(),
  instagramHandle: z.string().trim().max(100).optional(),
  turnstileToken: z.string().default(""),
  utmSource: z.string().max(200).optional(),
  utmMedium: z.string().max(200).optional(),
  utmCampaign: z.string().max(200).optional(),
  referrer: z.string().max(500).optional(),
});

export type RundownEntryInput = z.infer<typeof entrySchema>;

export type RundownEntryResult =
  | { ok: true; sessionToken: string; resuming?: false }
  | { ok: true; sessionToken: string; resuming: true }
  | { ok: false; reason: "error"; message: string }
  | {
      ok: false;
      reason: "existing_client";
      existingProfileComplete: boolean;
      contactName: string;
    }
  | { ok: false; reason: "existing_rundown"; sessionToken: string };

export async function submitRundownEntry(
  raw: RundownEntryInput,
): Promise<RundownEntryResult> {
  const parsed = entrySchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, reason: "error", message: "Invalid form data." };
  }
  const input = parsed.data;

  const turnstile = await verifyTurnstile(input.turnstileToken);
  if (!turnstile.success) {
    return { ok: false, reason: "error", message: "Verification failed. Please try again." };
  }

  const emailNorm = normaliseEmail(input.email);
  const now = Date.now();

  // ── Check for existing client ──
  const existingContact = await db.query.contacts.findFirst({
    where: eq(contacts.email_normalised, emailNorm),
  });

  if (existingContact && (existingContact.relationship_type === "client" || existingContact.relationship_type === "past_client")) {
    const existingProfile = await db.query.brand_dna_profiles.findFirst({
      where: and(
        eq(brand_dna_profiles.contact_id, existingContact.id),
        eq(brand_dna_profiles.is_current, true),
      ),
    });
    return {
      ok: false,
      reason: "existing_client",
      existingProfileComplete: existingProfile?.status === "complete",
      contactName: existingContact.name,
    };
  }

  // ── Check for existing in-progress Rundown ──
  const existingSession = await db.query.rundownSessions.findFirst({
    where: and(
      eq(rundownSessions.email_normalised, emailNorm),
      eq(rundownSessions.status, "entry_submitted"),
    ),
  });
  // Also check for any non-complete session
  const activeSession = existingSession ?? await db.query.rundownSessions.findFirst({
    where: eq(rundownSessions.email_normalised, emailNorm),
  });

  if (activeSession && activeSession.status !== "complete") {
    return {
      ok: false,
      reason: "existing_rundown",
      sessionToken: activeSession.session_token,
    };
  }

  // ── Check for completed Rundown (retake blocked on public side) ──
  const completedSession = await db.query.rundownSessions.findFirst({
    where: and(
      eq(rundownSessions.email_normalised, emailNorm),
      eq(rundownSessions.status, "complete"),
    ),
  });
  if (completedSession) {
    return {
      ok: false,
      reason: "existing_rundown",
      sessionToken: completedSession.session_token,
    };
  }

  // ── Create candidate record ──
  const candidateId = randomUUID();
  const domain = input.website ? normaliseDomain(input.website) : null;
  const igHandle = input.instagramHandle ? normaliseInstagram(input.instagramHandle) : null;

  await db.insert(leadCandidates).values({
    id: candidateId,
    company_name: input.businessName,
    domain,
    contact_email: input.email,
    contact_name: input.name,
    email_confidence: "verified",
    instagram_handle: igHandle,
    viability_profile_json: {},
    saas_score: 0,
    retainer_score: 0,
    qualified_track: "retainer",
    lead_run_id: `rundown_${now}`,
    sourced_from: "brand_dna_rundown",
    created_at: new Date(now),
  });

  // ── Create brand DNA profile ──
  const profileId = randomUUID();
  await db.insert(brand_dna_profiles).values({
    id: profileId,
    subject_type: "client",
    subject_id: candidateId,
    subject_display_name: input.name,
    candidate_id: candidateId,
    status: "pending",
    is_current: true,
    is_superbad_self: false,
    current_section: 1,
    version: 1,
    created_at_ms: now,
    updated_at_ms: now,
  });

  // ── Create rundown session ──
  const sessionToken = randomUUID().replace(/-/g, "").slice(0, 20);
  const resumeToken = randomUUID().replace(/-/g, "").slice(0, 20);
  const sessionId = randomUUID();

  await db.insert(rundownSessions).values({
    id: sessionId,
    session_token: sessionToken,
    resume_token: resumeToken,
    name: input.name,
    email: input.email,
    email_normalised: emailNorm,
    business_name: input.businessName,
    website: input.website ?? null,
    instagram_handle: igHandle,
    candidate_id: candidateId,
    profile_id: profileId,
    status: "entry_submitted",
    source_type: "public",
    entry_submitted_at_ms: now,
    utm_source: input.utmSource ?? null,
    utm_medium: input.utmMedium ?? null,
    utm_campaign: input.utmCampaign ?? null,
    referrer: input.referrer ?? null,
    created_at_ms: now,
    updated_at_ms: now,
  });

  await logActivity({
    kind: "rundown_entry_submitted",
    body: `Rundown entry submitted by ${input.name} (${input.email})`,
    meta: { candidateId, sessionId, profileId, source: "public" },
  });

  // ── Kick off enrichment in background (fire and forget) ──
  if (domain || igHandle) {
    triggerEnrichment(candidateId, input.businessName, domain, igHandle).catch(() => {});
  }

  // ── Send resume email (fire and forget) ──
  sendResumeEmail(input.email, input.name, sessionToken, resumeToken).catch(() => {});

  return { ok: true, sessionToken };
}

async function triggerEnrichment(
  candidateId: string,
  businessName: string,
  domain: string | null,
  instagramHandle: string | null,
): Promise<void> {
  try {
    const { enrichCandidate } = await import("@/lib/lead-gen/enrich");
    const result = await enrichCandidate({
      company_name: businessName,
      domain,
      source: "google_maps",
      partial_profile: instagramHandle
        ? { social_profiles: { instagram_url: `https://instagram.com/${instagramHandle}`, facebook_url: null, linkedin_url: null, tiktok_url: null, twitter_url: null, youtube_url: null } }
        : {},
    });

    await db
      .update(leadCandidates)
      .set({
        viability_profile_json: result.profile,
      })
      .where(eq(leadCandidates.id, candidateId));
  } catch {
    // Enrichment failure is non-blocking
  }
}

async function sendResumeEmail(
  email: string,
  name: string,
  sessionToken: string,
  _resumeToken: string,
): Promise<void> {
  try {
    const { sendEmail } = await import("@/lib/channels/email/send");
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://superbadmedia.com.au";
    const resumeUrl = `${baseUrl}/rundown/s/${sessionToken}`;

    await sendEmail({
      to: email,
      subject: "your brand dna is ready to start",
      body: `
        <p>Hey ${name.split(" ")[0]},</p>
        <p>Your Brand DNA assessment is ready. Pick up where you left off any time:</p>
        <p><a href="${resumeUrl}" style="color: #B22848;">${resumeUrl}</a></p>
        <p>It's an intensive one. Worth it.</p>
        <p>Andy</p>
      `,
      classification: "rundown_resume",
      purpose: "rundown_resume_link",
    });
  } catch {
    // Email failure is non-blocking
  }
}

/** For existing client who confirms they want to retake via Rundown. */
export async function confirmClientRetakeAction(input: {
  email: string;
  turnstileToken: string;
}): Promise<RundownEntryResult> {
  const turnstile = await verifyTurnstile(input.turnstileToken);
  if (!turnstile.success) {
    return { ok: false, reason: "error", message: "Verification failed." };
  }

  const emailNorm = normaliseEmail(input.email);
  const contact = await db.query.contacts.findFirst({
    where: eq(contacts.email_normalised, emailNorm),
  });
  if (!contact) {
    return { ok: false, reason: "error", message: "Contact not found." };
  }

  // Archive existing current profile
  const existingProfile = await db.query.brand_dna_profiles.findFirst({
    where: and(
      eq(brand_dna_profiles.contact_id, contact.id),
      eq(brand_dna_profiles.is_current, true),
    ),
  });
  if (existingProfile) {
    await db
      .update(brand_dna_profiles)
      .set({ is_current: false, updated_at_ms: Date.now() })
      .where(eq(brand_dna_profiles.id, existingProfile.id));
  }

  // Proceed with normal entry flow (minus turnstile re-check)
  // The caller should resubmit the full entry form after confirmation
  return { ok: true, sessionToken: "" };
}
