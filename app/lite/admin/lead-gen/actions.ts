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

// ── Manual run ──────────────────────────────────────────────────────

export async function triggerManualRunAction(): Promise<
  | { ok: true; runId: string; candidatesCreated: number }
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
  locationRadiusKm: number;
  dailyMaxPerDay: number;
  runTime: string;
  autoSendDelayMinutes: number;
  dedupWindowDays: number;
}> {
  const [
    category,
    standingBrief,
    locationCentre,
    locationRadiusKm,
    dailyMaxPerDay,
    runTime,
    autoSendDelayMinutes,
    dedupWindowDays,
  ] = await Promise.all([
    settings.get("lead_generation.category"),
    settings.get("lead_generation.standing_brief"),
    settings.get("lead_generation.location_centre"),
    settings.get("lead_generation.location_radius_km"),
    settings.get("lead_generation.daily_max_per_day"),
    settings.get("lead_generation.run_time"),
    settings.get("lead_generation.auto_send_delay_minutes"),
    settings.get("lead_generation.dedup_window_days"),
  ]);
  return {
    category,
    standingBrief,
    locationCentre,
    locationRadiusKm,
    dailyMaxPerDay,
    runTime,
    autoSendDelayMinutes,
    dedupWindowDays,
  };
}

export type LeadGenSettings = Awaited<ReturnType<typeof getLeadGenSettingsAction>>;

export async function updateLeadGenSettingsAction(input: {
  category: string;
  standingBrief: string;
  locationCentre: string;
  locationRadiusKm: number;
  dailyMaxPerDay: number;
  runTime: string;
  autoSendDelayMinutes: number;
  dedupWindowDays: number;
}): Promise<ActionResult> {
  const by = await adminActorTag();
  if (!by) return { ok: false, error: "Not authorised." };

  await Promise.all([
    settings.set("lead_generation.category", input.category),
    settings.set("lead_generation.standing_brief", input.standingBrief),
    settings.set("lead_generation.location_centre", input.locationCentre),
    settings.set("lead_generation.location_radius_km", String(input.locationRadiusKm)),
    settings.set("lead_generation.daily_max_per_day", String(input.dailyMaxPerDay)),
    settings.set("lead_generation.run_time", input.runTime),
    settings.set("lead_generation.auto_send_delay_minutes", String(input.autoSendDelayMinutes)),
    settings.set("lead_generation.dedup_window_days", String(input.dedupWindowDays)),
  ]);

  revalidatePath("/lite/admin/lead-gen/settings");
  return { ok: true };
}
