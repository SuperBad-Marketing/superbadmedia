"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth/session";
import { db } from "@/lib/db";
import settings from "@/lib/settings";
import { outreachDrafts } from "@/lib/db/schema/outreach-drafts";
import { leadCandidates } from "@/lib/db/schema/lead-candidates";
import { dncEmails } from "@/lib/db/schema/dnc";
import { dncDomains } from "@/lib/db/schema/dnc";
import { eq } from "drizzle-orm";
import { logActivity } from "@/lib/activity-log";
import { transitionAutonomyState } from "@/lib/lead-gen/autonomy";
import { classifyEdit } from "@/lib/lead-gen/classify-edit";
import { killSwitches } from "@/lib/kill-switches";
import { invokeLlmText } from "@/lib/ai/invoke";
import { getSuperbadBrandProfile } from "@/lib/quote-builder/superbad-brand-profile";
import { checkBrandVoiceDrift } from "@/lib/ai/drift-check";
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

  const hasNudges =
    draft.nudge_thread_json != null &&
    Array.isArray(draft.nudge_thread_json) &&
    (draft.nudge_thread_json as unknown[]).length > 0;
  const presetKind = draft.approval_kind;
  const approvalKind = presetKind === "minor_edit_manual" || presetKind === "edited_manual"
    ? presetKind
    : hasNudges
      ? ("nudged_manual" as const)
      : ("manual" as const);

  await db
    .update(outreachDrafts)
    .set({
      status: "approved_queued",
      approved_at: new Date(),
      approved_by: by.replace("user:", ""),
      approval_kind: approvalKind,
    })
    .where(eq(outreachDrafts.id, draftId));

  await logActivity({
    kind: "outreach_draft_approved",
    body: `Approved draft ${draftId}`,
    createdBy: by,
    meta: { draft_id: draftId, approval_kind: approvalKind },
  });

  if (draft.candidate_id) {
    const [candidate] = await db
      .select({ track: leadCandidates.qualified_track })
      .from(leadCandidates)
      .where(eq(leadCandidates.id, draft.candidate_id))
      .limit(1);

    if (candidate?.track === "saas" || candidate?.track === "retainer") {
      const isClean = approvalKind === "manual" || approvalKind === "minor_edit_manual";
      await transitionAutonomyState(
        candidate.track,
        isClean ? { type: "clean_approval" } : { type: "non_clean_approval" },
      );
    }
  }

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

  if (draft.candidate_id) {
    const [candidate] = await db
      .select({ track: leadCandidates.qualified_track })
      .from(leadCandidates)
      .where(eq(leadCandidates.id, draft.candidate_id))
      .limit(1);

    if (candidate?.track === "saas" || candidate?.track === "retainer") {
      await transitionAutonomyState(candidate.track, { type: "rejection" });
    }
  }

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

// ── Candidate management ────────────────────────────────────────────

export async function skipCandidateAction(
  candidateId: string,
  reason: string,
): Promise<ActionResult> {
  const by = await adminActorTag();
  if (!by) return { ok: false, error: "Not authorised." };

  const [candidate] = await db
    .select()
    .from(leadCandidates)
    .where(eq(leadCandidates.id, candidateId))
    .limit(1);

  if (!candidate) return { ok: false, error: "Candidate not found." };
  if (candidate.skipped_at) return { ok: false, error: "Already skipped." };

  await db
    .update(leadCandidates)
    .set({ skipped_at: new Date(), skipped_reason: reason || "Manual skip" })
    .where(eq(leadCandidates.id, candidateId));

  await logActivity({
    kind: "lead_candidate_skipped",
    body: `Skipped candidate ${candidate.company_name}`,
    createdBy: by,
    meta: { candidate_id: candidateId, reason },
  });

  revalidatePath(LEAD_GEN_PATH);
  return { ok: true };
}

export async function unskipCandidateAction(
  candidateId: string,
): Promise<ActionResult> {
  const by = await adminActorTag();
  if (!by) return { ok: false, error: "Not authorised." };

  await db
    .update(leadCandidates)
    .set({ skipped_at: null, skipped_reason: null })
    .where(eq(leadCandidates.id, candidateId));

  revalidatePath(LEAD_GEN_PATH);
  return { ok: true };
}

export async function updateCandidateTrackAction(
  candidateId: string,
  track: "saas" | "retainer",
): Promise<ActionResult> {
  const by = await adminActorTag();
  if (!by) return { ok: false, error: "Not authorised." };

  const [candidate] = await db
    .select()
    .from(leadCandidates)
    .where(eq(leadCandidates.id, candidateId))
    .limit(1);

  if (!candidate) return { ok: false, error: "Candidate not found." };

  await db
    .update(leadCandidates)
    .set({ qualified_track: track })
    .where(eq(leadCandidates.id, candidateId));

  await logActivity({
    kind: "candidate_track_changed",
    body: `Changed ${candidate.company_name} track to ${track}`,
    createdBy: by,
    meta: { candidate_id: candidateId, from: candidate.qualified_track, to: track },
  });

  revalidatePath(LEAD_GEN_PATH);
  return { ok: true };
}

export async function deleteCandidateAction(
  candidateId: string,
): Promise<ActionResult> {
  const by = await adminActorTag();
  if (!by) return { ok: false, error: "Not authorised." };

  const [candidate] = await db
    .select({ id: leadCandidates.id, company_name: leadCandidates.company_name })
    .from(leadCandidates)
    .where(eq(leadCandidates.id, candidateId))
    .limit(1);

  if (!candidate) return { ok: false, error: "Candidate not found." };

  await db.delete(leadCandidates).where(eq(leadCandidates.id, candidateId));

  await logActivity({
    kind: "lead_candidate_deleted",
    body: `Deleted candidate ${candidate.company_name}`,
    createdBy: by,
    meta: { candidate_id: candidateId },
  });

  revalidatePath(LEAD_GEN_PATH);
  return { ok: true };
}

export async function updateCandidateDetailsAction(
  candidateId: string,
  details: {
    contact_email?: string | null;
    contact_name?: string | null;
    contact_role?: string | null;
    contact_phone?: string | null;
    notes?: string | null;
  },
): Promise<ActionResult> {
  const by = await adminActorTag();
  if (!by) return { ok: false, error: "Not authorised." };

  const [candidate] = await db
    .select({ id: leadCandidates.id, company_name: leadCandidates.company_name })
    .from(leadCandidates)
    .where(eq(leadCandidates.id, candidateId))
    .limit(1);

  if (!candidate) return { ok: false, error: "Candidate not found." };

  await db
    .update(leadCandidates)
    .set({
      contact_email: details.contact_email ?? null,
      contact_name: details.contact_name ?? null,
      contact_role: details.contact_role ?? null,
      contact_phone: details.contact_phone ?? null,
      notes: details.notes ?? null,
    })
    .where(eq(leadCandidates.id, candidateId));

  await logActivity({
    kind: "lead_candidate_updated",
    body: `Updated details for ${candidate.company_name}`,
    createdBy: by,
    meta: { candidate_id: candidateId },
  });

  revalidatePath(LEAD_GEN_PATH);
  revalidatePath(`${LEAD_GEN_PATH}/candidates/${candidateId}`);
  return { ok: true };
}

export async function generateCandidateSummaryAction(
  candidateId: string,
): Promise<{ ok: true; summary: string } | { ok: false; error: string }> {
  const by = await adminActorTag();
  if (!by) return { ok: false, error: "Not authorised." };

  if (!killSwitches.llm_calls_enabled) {
    return { ok: false, error: "LLM calls are paused." };
  }

  const [candidate] = await db
    .select()
    .from(leadCandidates)
    .where(eq(leadCandidates.id, candidateId))
    .limit(1);

  if (!candidate) return { ok: false, error: "Candidate not found." };

  const profile = candidate.viability_profile_json as Record<string, unknown>;

  const prompt = `Summarise this lead generation candidate in 2-3 concise sentences for an agency owner reviewing prospects. Focus on what makes them interesting or not, their marketing maturity, and any red flags.

CANDIDATE:
- Company: ${candidate.company_name}
- Domain: ${candidate.domain || "unknown"}
- Track: ${candidate.qualified_track}
- SaaS Score: ${candidate.saas_score} / Retainer Score: ${candidate.retainer_score}
- Source: ${candidate.sourced_from.replace(/_/g, " ")}
- Contact: ${candidate.contact_name || "unknown"} (${candidate.contact_email || "no email"})

ENRICHMENT DATA:
${JSON.stringify(profile, null, 2)}

Write the summary in a direct, matter-of-fact tone. No fluff. Start with what they do, then their marketing posture.`;

  try {
    const summary = await invokeLlmText({
      job: "lead-gen-candidate-summary",
      system: "You are a concise marketing strategist. Write short, direct candidate summaries.",
      prompt,
      maxTokens: 300,
    });

    if (!summary) return { ok: false, error: "Empty response — try again." };

    await db
      .update(leadCandidates)
      .set({ ai_summary: summary })
      .where(eq(leadCandidates.id, candidateId));

    revalidatePath(`${LEAD_GEN_PATH}/candidates/${candidateId}`);
    return { ok: true, summary };
  } catch {
    return { ok: false, error: "Summary generation failed — try again." };
  }
}

export async function generateDraftEmailAction(
  candidateId: string,
): Promise<{ ok: true; subject: string; body: string } | { ok: false; error: string }> {
  const by = await adminActorTag();
  if (!by) return { ok: false, error: "Not authorised." };

  if (!killSwitches.llm_calls_enabled) {
    return { ok: false, error: "LLM calls are paused." };
  }

  const [candidate] = await db
    .select()
    .from(leadCandidates)
    .where(eq(leadCandidates.id, candidateId))
    .limit(1);

  if (!candidate) return { ok: false, error: "Candidate not found." };

  if (!candidate.contact_email) {
    return { ok: false, error: "No contact email — add one first." };
  }

  const profile = candidate.viability_profile_json as Record<string, unknown>;
  const brandProfile = await getSuperbadBrandProfile();

  const systemPrompt = `You are drafting a cold outreach email on behalf of Andy Robinson, founder of SuperBad Marketing (Melbourne, Australia).

BRAND VOICE:
${brandProfile.voiceDescription}
Tone markers: ${brandProfile.toneMarkers.join(", ")}
${brandProfile.avoidWords?.length ? `Words to avoid: ${brandProfile.avoidWords.join(", ")}` : ""}

Respond in exactly this format:
SUBJECT: <subject line>
BODY:
<email body in markdown>`;

  const userPrompt = `Write a personalised cold outreach email for this prospect.

PROSPECT:
- Company: ${candidate.company_name}
- Domain: ${candidate.domain || "unknown"}
- Contact: ${candidate.contact_name || "the owner"}
- Role: ${candidate.contact_role || "unknown"}
- Track: ${candidate.qualified_track}

ENRICHMENT:
${JSON.stringify(profile, null, 2)}

${candidate.notes ? `NOTES:\n${candidate.notes}` : ""}

The email should feel personal, reference something specific about their business, and be genuinely useful. No hard sell. Keep it under 150 words.`;

  try {
    const result = await invokeLlmText({
      job: "lead-gen-outreach-draft",
      system: systemPrompt,
      prompt: userPrompt,
      maxTokens: 600,
    });

    const subjectMatch = result.match(/SUBJECT:\s*(.+)/i);
    const bodyMatch = result.match(/BODY:\s*([\s\S]+)/i);

    if (!subjectMatch || !bodyMatch) {
      return { ok: false, error: "Unexpected format — try again." };
    }

    return {
      ok: true,
      subject: subjectMatch[1].trim(),
      body: bodyMatch[1].trim(),
    };
  } catch {
    return { ok: false, error: "Draft generation failed — try again." };
  }
}

// ── Manual run ──────────────────────────────────────────────────────

export async function triggerManualRunAction(): Promise<
  | {
      ok: true;
      runId: string;
      candidatesCreated: number;
      foundCount: number;
      qualifiedCount: number;
      dncFilteredCount: number;
      cappedReason: string | null;
      sourceErrors: Record<string, string> | null;
    }
  | { ok: false; error: string }
> {
  const by = await adminActorTag();
  if (!by) return { ok: false, error: "Not authorised." };

  const { runDailySearch } = await import("@/lib/lead-gen/daily-search");
  const result = await runDailySearch({ trigger: "run_now" });

  if (result.error) return { ok: false, error: result.error };

  revalidatePath(LEAD_GEN_PATH);
  revalidatePath("/lite/admin/lead-gen/runs");
  return {
    ok: true,
    runId: result.runId,
    candidatesCreated: result.candidatesCreated,
    foundCount: result.foundCount,
    qualifiedCount: result.qualifiedCount,
    dncFilteredCount: result.dncFilteredCount,
    cappedReason: result.cappedReason,
    sourceErrors: result.perSourceErrors,
  };
}

// ── Inline edit ─────────────────────────────────────────────────────

export async function updateDraftAction(
  draftId: string,
  subject: string,
  bodyMarkdown: string,
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
    return { ok: false, error: "Only pending drafts can be edited." };
  }

  const classification = await classifyEdit(
    { subject: draft.subject, body_markdown: draft.body_markdown },
    { subject, body_markdown: bodyMarkdown },
  );

  if (classification === "clean") return { ok: true };

  const approvalKind =
    classification === "minor" ? "minor_edit_manual" as const : "edited_manual" as const;

  await db
    .update(outreachDrafts)
    .set({ subject, body_markdown: bodyMarkdown, approval_kind: approvalKind })
    .where(eq(outreachDrafts.id, draftId));

  await logActivity({
    kind: "outreach_draft_edited",
    body: `Edited draft ${draftId} (${classification})`,
    createdBy: by,
    meta: { draft_id: draftId, edit_classification: classification },
  });

  revalidatePath(LEAD_GEN_PATH);
  return { ok: true };
}

// ── Nudge rewrite (LLM call) ───────────────────────────────────────

const NUDGE_MAX_INSTRUCTION = 500;
const NUDGE_MAX_OUTPUT_TOKENS = 1024;

type NudgeResult =
  | { ok: true; body: string }
  | { ok: false; error: string };

export async function nudgeRewriteAction(
  draftId: string,
  instruction: string,
  currentBody: string,
): Promise<NudgeResult> {
  const by = await adminActorTag();
  if (!by) return { ok: false, error: "Not authorised." };

  if (!killSwitches.llm_calls_enabled) {
    return { ok: false, error: "LLM calls are paused." };
  }

  const trimmed = instruction.trim().slice(0, NUDGE_MAX_INSTRUCTION);
  if (!trimmed) return { ok: false, error: "Instruction is empty." };

  const brandProfile = await getSuperbadBrandProfile();

  const systemPrompt = `You are rewriting a cold outreach email on behalf of Andy Robinson, founder of SuperBad Marketing (Melbourne, Australia).

BRAND VOICE:
${brandProfile.voiceDescription}
Tone markers: ${brandProfile.toneMarkers.join(", ")}
${brandProfile.avoidWords?.length ? `Words to avoid: ${brandProfile.avoidWords.join(", ")}` : ""}

Respond with ONLY the rewritten email body in markdown. No JSON wrapper, no explanation, no subject line — just the email body text.`;

  const userPrompt = `CURRENT DRAFT:
${currentBody}

ANDY'S INSTRUCTION:
${trimmed}

Rewrite the draft to satisfy the instruction. Keep everything the instruction doesn't touch. Changes should be surgical unless a total rewrite is asked for.`;

  try {
    const rewritten = await invokeLlmText({
      job: "lead-gen-nudge-rewrite",
      system: systemPrompt,
      prompt: userPrompt,
      maxTokens: NUDGE_MAX_OUTPUT_TOKENS,
    });

    const body = rewritten.trim();
    if (!body) return { ok: false, error: "Model returned empty body." };

    return { ok: true, body };
  } catch {
    return { ok: false, error: "Rewrite failed — try again." };
  }
}

// ── Apply nudge (persist rewritten body) ────────────────────────────

export async function applyNudgeAction(
  draftId: string,
  newBody: string,
  nudgeThread: Array<{ role: string; content: string }>,
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
    return { ok: false, error: "Only pending drafts can be nudged." };
  }

  await db
    .update(outreachDrafts)
    .set({
      body_markdown: newBody,
      nudge_thread_json: nudgeThread,
    })
    .where(eq(outreachDrafts.id, draftId));

  await logActivity({
    kind: "outreach_draft_nudged",
    body: `Nudge-rewrote draft ${draftId}`,
    createdBy: by,
    meta: { draft_id: draftId, nudge_turns: nudgeThread.length },
  });

  revalidatePath(LEAD_GEN_PATH);
  return { ok: true };
}

// ── Settings ──────────────────────────────────────────────────────────

export async function getLeadGenSettingsAction(): Promise<{
  category: string;
  standingBrief: string;
  locationCentre: string;
  locationLat: number;
  locationLng: number;
  locationRadiusKm: number;
  locationMode: "local" | "global";
  locationCountry: string;
  locationCountryCode: string;
  dailyMaxPerDay: number;
  runTime: string;
  autoSendDelayMinutes: number;
  dedupWindowDays: number;
  trackPriority: string;
  targetRevenue: string;
  targetTeamSize: string;
  targetIndustry: string;
}> {
  const [
    category,
    standingBrief,
    locationCentre,
    locationLat,
    locationLng,
    locationRadiusKm,
    locationMode,
    locationCountry,
    locationCountryCode,
    dailyMaxPerDay,
    runTime,
    autoSendDelayMinutes,
    dedupWindowDays,
    trackPriority,
    targetRevenue,
    targetTeamSize,
    targetIndustry,
  ] = await Promise.all([
    settings.get("lead_generation.category"),
    settings.get("lead_generation.standing_brief"),
    settings.get("lead_generation.location_centre"),
    settings.get("lead_generation.location_lat"),
    settings.get("lead_generation.location_lng"),
    settings.get("lead_generation.location_radius_km"),
    settings.get("lead_generation.location_mode"),
    settings.get("lead_generation.location_country"),
    settings.get("lead_generation.location_country_code"),
    settings.get("lead_generation.daily_max_per_day"),
    settings.get("lead_generation.run_time"),
    settings.get("lead_generation.auto_send_delay_minutes"),
    settings.get("lead_generation.dedup_window_days"),
    settings.get("lead_generation.track_priority"),
    settings.get("lead_generation.target_revenue"),
    settings.get("lead_generation.target_team_size"),
    settings.get("lead_generation.target_industry"),
  ]);
  return {
    category,
    standingBrief,
    locationCentre,
    locationLat,
    locationLng,
    locationRadiusKm,
    locationMode,
    locationCountry,
    locationCountryCode,
    dailyMaxPerDay,
    runTime,
    autoSendDelayMinutes,
    dedupWindowDays,
    trackPriority,
    targetRevenue,
    targetTeamSize,
    targetIndustry,
  };
}

export type LeadGenSettings = Awaited<ReturnType<typeof getLeadGenSettingsAction>>;

export async function updateLeadGenSettingsAction(input: {
  category: string;
  standingBrief: string;
  locationCentre: string;
  locationLat: number;
  locationLng: number;
  locationRadiusKm: number;
  locationMode: string;
  locationCountry: string;
  locationCountryCode: string;
  dailyMaxPerDay: number;
  runTime: string;
  autoSendDelayMinutes: number;
  dedupWindowDays: number;
  trackPriority: string;
  targetRevenue: string;
  targetTeamSize: string;
  targetIndustry: string;
}): Promise<ActionResult> {
  const by = await adminActorTag();
  if (!by) return { ok: false, error: "Not authorised." };

  await Promise.all([
    settings.set("lead_generation.category", input.category),
    settings.set("lead_generation.standing_brief", input.standingBrief),
    settings.set("lead_generation.location_centre", input.locationCentre),
    settings.set("lead_generation.location_lat", String(input.locationLat)),
    settings.set("lead_generation.location_lng", String(input.locationLng)),
    settings.set("lead_generation.location_radius_km", String(input.locationRadiusKm)),
    settings.set("lead_generation.location_mode", input.locationMode as "local" | "global"),
    settings.set("lead_generation.location_country", input.locationCountry),
    settings.set("lead_generation.location_country_code", input.locationCountryCode),
    settings.set("lead_generation.daily_max_per_day", String(input.dailyMaxPerDay)),
    settings.set("lead_generation.run_time", input.runTime),
    settings.set("lead_generation.auto_send_delay_minutes", String(input.autoSendDelayMinutes)),
    settings.set("lead_generation.dedup_window_days", String(input.dedupWindowDays)),
    settings.set("lead_generation.track_priority", input.trackPriority),
    settings.set("lead_generation.target_revenue", input.targetRevenue),
    settings.set("lead_generation.target_team_size", input.targetTeamSize),
    settings.set("lead_generation.target_industry", input.targetIndustry),
  ]);

  revalidatePath("/lite/admin/lead-gen/settings");
  return { ok: true };
}

// ── Place geocoding ────────────────────────────────────────────────────

export async function geocodePlaceAction(place: string): Promise<
  | { ok: true; lat: number; lng: number; countryCode: string; displayName: string }
  | { ok: false; error: string }
> {
  const by = await adminActorTag();
  if (!by) return { ok: false, error: "Not authorised." };

  const trimmed = place.trim();
  if (!trimmed) return { ok: false, error: "Enter a place name." };

  try {
    const params = new URLSearchParams({
      q: trimmed,
      format: "json",
      limit: "1",
      addressdetails: "1",
    });

    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?${params}`,
      { headers: { "User-Agent": "SuperBadLite/1.0 (andy@superbadmedia.com.au)" } },
    );

    if (!response.ok) {
      return { ok: false, error: "Geocoding service unavailable — try again." };
    }

    const results = await response.json() as Array<{
      lat: string;
      lon: string;
      display_name: string;
      address?: { country_code?: string };
    }>;

    if (results.length === 0) {
      return { ok: false, error: `Couldn't find "${trimmed}" — try a more specific place name.` };
    }

    const top = results[0];
    return {
      ok: true,
      lat: parseFloat(top.lat),
      lng: parseFloat(top.lon),
      countryCode: (top.address?.country_code ?? "au").toUpperCase(),
      displayName: top.display_name,
    };
  } catch {
    return { ok: false, error: "Geocoding failed — try again." };
  }
}

// ── Discovery suggestions ──────────────────────────────────────────────

export type DiscoverySuggestion = {
  track: "retainer" | "saas";
  category: string;
  rationale: string;
  standingBrief: string;
};

export async function getDiscoverySuggestionsAction(): Promise<
  | { ok: true; suggestions: DiscoverySuggestion[] }
  | { ok: false; error: string }
> {
  const by = await adminActorTag();
  if (!by) return { ok: false, error: "Not authorised." };

  if (!killSwitches.llm_calls_enabled) {
    return { ok: false, error: "LLM calls are paused." };
  }

  const prompt = `You are a marketing strategist helping SuperBad Marketing (Melbourne, Australia) find new prospects.

SuperBad offers two tracks:

RETAINER TRACK (full-service creative agency):
- Target: established businesses with >$500k annual revenue
- Have existing brand presence but need better execution
- Can afford $2k–$8k/month for creative + performance marketing
- Typically local/regional businesses with real marketing budgets
- Verticals that benefit most: hospitality, health/wellness, professional services, retail, property

SAAS TRACK (self-serve marketing tools):
- Target: smaller teams, 1-20 people
- DIY marketing, price-sensitive, tech-comfortable
- $19–$99/month subscription
- Global reach, any English-speaking market
- Verticals: freelancers, small e-commerce, local services, creators, startups

Generate exactly 3 discovery suggestions — at least 1 retainer and 1 SaaS. For each:
- Pick a specific business category (what you'd search on Google Maps)
- Write a one-sentence rationale explaining WHY this category is a good fit for the track
- Write a 2-sentence standing brief for the AI outreach generator

Be specific and varied. Don't repeat categories from common defaults like "cafes" — find underserved niches.

Respond as JSON array only — no prose, no markdown fences:
[{"track":"retainer"|"saas","category":"...","rationale":"...","standing_brief":"..."}]`;

  try {
    const result = await invokeLlmText({
      job: "lead-gen-discovery-suggestions",
      system: "You are a concise marketing strategist. Respond only in the requested JSON format.",
      prompt,
      maxTokens: 800,
    });

    const cleaned = result
      .replace(/^```(?:json)?\s*/, "")
      .replace(/\s*```$/, "")
      .trim();

    const parsed = JSON.parse(cleaned) as Array<{
      track: string;
      category: string;
      rationale: string;
      standing_brief: string;
    }>;

    if (!Array.isArray(parsed) || parsed.length === 0) {
      return { ok: false, error: "Unexpected response — try again." };
    }

    const suggestions: DiscoverySuggestion[] = parsed
      .filter((s) => s.track === "retainer" || s.track === "saas")
      .map((s) => ({
        track: s.track as "retainer" | "saas",
        category: s.category,
        rationale: s.rationale,
        standingBrief: s.standing_brief,
      }));

    return { ok: true, suggestions };
  } catch {
    return { ok: false, error: "Suggestion failed — try again." };
  }
}
