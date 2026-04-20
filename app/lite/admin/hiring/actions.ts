"use server";

import { revalidatePath } from "next/cache";

import { auth } from "@/lib/auth/session";
import { transitionCandidateStage } from "@/lib/hiring/transition-candidate-stage";
import {
  createCandidate,
  createCandidateArchive,
  getCandidateById,
  listRoleBriefs,
  updateCandidate,
} from "@/lib/hiring/queries";
import { ingestPortfolioUrl } from "@/lib/hiring/portfolio";
import { scoreCandidateAgainstBriefs } from "@/lib/hiring/score-candidate";
import { draftInviteEmail } from "@/lib/hiring/draft-invite";
import {
  processInviteDraft,
  sendInviteDraft,
} from "@/lib/hiring/send-invite";
import { logActivity } from "@/lib/activity-log";
import {
  CANDIDATE_STAGES,
  type CandidateStage,
} from "@/lib/db/schema/candidates";
import {
  SKIP_TRIAL_REASONS,
  type SkipTrialReason,
} from "@/lib/hiring/stages";
import type { ArchiveResult } from "@/components/lite/hiring-pipeline/archive-modal";

type ActionResult = { ok: true } | { ok: false; error: string };

export interface QuickAddResult {
  ok: true;
  candidateId: string;
  candidateName: string;
  roleName: string | null;
  score: number | null;
  scoreReasoning: string | null;
  inviteSubject: string;
  inviteBody: string;
  inviteConfidence: number;
  platform: string;
  inviteDraftId: string;
  inviteAutoSent: boolean;
  inviteHoldReason: string | null;
}

type QuickAddActionResult =
  | QuickAddResult
  | { ok: false; error: string };

async function adminActorTag(): Promise<string | null> {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") return null;
  return `user:${session.user.id ?? "admin"}`;
}

export async function transitionCandidateAction(
  candidateId: string,
  toStage: CandidateStage,
): Promise<ActionResult> {
  const by = await adminActorTag();
  if (!by) return { ok: false, error: "Not authorised." };
  if (!CANDIDATE_STAGES.includes(toStage)) {
    return { ok: false, error: "Unknown stage." };
  }
  try {
    transitionCandidateStage(candidateId, toStage, { by });
    revalidatePath("/lite/admin/hiring");
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Transition failed.",
    };
  }
}

export async function archiveCandidateAction(
  candidateId: string,
  fromStage: CandidateStage,
  archive: ArchiveResult,
): Promise<ActionResult> {
  const by = await adminActorTag();
  if (!by) return { ok: false, error: "Not authorised." };

  try {
    await createCandidateArchive({
      candidate_id: candidateId,
      stage_when_archived: fromStage,
      reason_code: archive.reason_code,
      reason_free_text: archive.reason_free_text,
      reflection_text: archive.reflection_text,
      disposition_direction: archive.disposition_direction,
    });

    transitionCandidateStage(candidateId, "archived", { by });
    revalidatePath("/lite/admin/hiring");
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Archive failed.",
    };
  }
}

export async function skipTrialAction(
  candidateId: string,
  reason: SkipTrialReason,
): Promise<ActionResult> {
  const by = await adminActorTag();
  if (!by) return { ok: false, error: "Not authorised." };

  if (!SKIP_TRIAL_REASONS.includes(reason)) {
    return { ok: false, error: "Unknown skip-trial reason." };
  }

  try {
    transitionCandidateStage(candidateId, "bench", {
      by,
      meta: { skip_trial_reason: reason },
    });
    revalidatePath("/lite/admin/hiring");
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Skip-trial failed.",
    };
  }
}

// ---------------------------------------------------------------------------
// Quick-Add (§5.3)
// ---------------------------------------------------------------------------

function extractNameFromUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const segments = parsed.pathname.split("/").filter(Boolean);
    if (segments.length > 0 && segments[0].length > 1) {
      return segments[0]
        .replace(/[-_]/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase());
    }
    const host = parsed.hostname.replace(/^www\./, "");
    return host.split(".")[0].replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  } catch {
    return "Unknown";
  }
}

function safeJsonArray(val: unknown): string[] {
  if (Array.isArray(val)) return val.filter((v) => typeof v === "string");
  return [];
}

export async function quickAddCandidateAction(
  rawUrl: string,
): Promise<QuickAddActionResult> {
  const by = await adminActorTag();
  if (!by) return { ok: false, error: "Not authorised." };

  const url = rawUrl.trim();
  if (!url) return { ok: false, error: "URL is required." };

  try {
    new URL(url.startsWith("http") ? url : `https://${url}`);
  } catch {
    return { ok: false, error: "That doesn't look like a valid URL." };
  }

  const normalised = url.startsWith("http") ? url : `https://${url}`;

  try {
    const signal = await ingestPortfolioUrl(normalised);
    let fallbackName = extractNameFromUrl(normalised);

    const openBriefs = await listRoleBriefs({ status: ["open"] });

    let bestBriefId: string | null = null;
    let bestScore: number | null = null;
    let bestReasoning: string | null = null;
    let bestRoleName: string | null = null;

    if (openBriefs.length > 0) {
      const scores = await scoreCandidateAgainstBriefs(signal, openBriefs);
      if (scores.length > 0 && scores[0].score > 0) {
        bestBriefId = scores[0].role_brief_id;
        bestScore = scores[0].score;
        bestReasoning = scores[0].reasoning;
        bestRoleName = scores[0].role_name;
        if (scores[0].name_guess) {
          fallbackName = scores[0].name_guess;
        }
      }
    }

    const candidate = await createCandidate({
      role_brief_id: bestBriefId,
      stage: "sourced",
      source: "sourced",
      discovery_source: `quick-add:${signal.platform}`,
      name: fallbackName,
      portfolio_urls_json: [normalised],
    });

    await updateCandidate(candidate.id, {
      portfolio_signal_json: signal as unknown as Record<string, unknown>,
      portfolio_signal_fetched_at_ms: signal.fetched_at,
      brief_match_score: bestScore,
    });

    await logActivity({
      kind: "candidate_sourced",
      body: `Quick-added ${fallbackName} from ${signal.platform}`,
      meta: {
        candidate_id: candidate.id,
        url: normalised,
        platform: signal.platform,
        role_brief_id: bestBriefId,
        score: bestScore,
      },
      createdBy: by,
    });

    const matchedBrief = bestBriefId
      ? openBriefs.find((b) => b.id === bestBriefId)
      : null;

    const draft = await draftInviteEmail({
      candidateName: fallbackName,
      signal,
      roleName: bestRoleName ?? "general freelance work",
      styleSummary: matchedBrief?.style_summary ?? null,
      extractedTags: matchedBrief
        ? safeJsonArray(matchedBrief.extracted_tags_json)
        : [],
    });

    const freshCandidate = await getCandidateById(candidate.id);
    const inviteResult = await processInviteDraft({
      candidate: freshCandidate ?? candidate,
      draft,
      roleBriefId: bestBriefId,
      by,
    });

    revalidatePath("/lite/admin/hiring");

    return {
      ok: true,
      candidateId: candidate.id,
      candidateName: fallbackName,
      roleName: bestRoleName,
      score: bestScore,
      scoreReasoning: bestReasoning,
      inviteSubject: draft.subject,
      inviteBody: draft.body,
      inviteConfidence: draft.confidence,
      platform: signal.platform,
      inviteDraftId: inviteResult.draftId,
      inviteAutoSent: inviteResult.autoSent,
      inviteHoldReason: inviteResult.holdReason,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Quick-add failed.",
    };
  }
}

export async function confirmQuickAddInviteAction(
  candidateId: string,
  draftId?: string,
): Promise<ActionResult> {
  const by = await adminActorTag();
  if (!by) return { ok: false, error: "Not authorised." };

  try {
    if (draftId) {
      const result = await sendInviteDraft(draftId, by);
      if (!result.sent) {
        return { ok: false, error: result.reason ?? "Send failed." };
      }
    } else {
      transitionCandidateStage(candidateId, "invited", { by });
    }
    revalidatePath("/lite/admin/hiring");
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Couldn't send invite.",
    };
  }
}

export async function sendInviteDraftAction(
  draftId: string,
): Promise<ActionResult> {
  const by = await adminActorTag();
  if (!by) return { ok: false, error: "Not authorised." };

  try {
    const result = await sendInviteDraft(draftId, by);
    if (!result.sent) {
      return { ok: false, error: result.reason ?? "Send failed." };
    }
    revalidatePath("/lite/admin/hiring");
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Send failed.",
    };
  }
}

export async function expireInviteDraftAction(
  draftId: string,
): Promise<ActionResult> {
  const by = await adminActorTag();
  if (!by) return { ok: false, error: "Not authorised." };

  try {
    const { eq } = await import("drizzle-orm");
    const { db } = await import("@/lib/db");
    const { invite_drafts } = await import(
      "@/lib/db/schema/invite-drafts"
    );
    await db
      .update(invite_drafts)
      .set({ status: "expired", updated_at_ms: Date.now() })
      .where(eq(invite_drafts.id, draftId))
      .run();
    revalidatePath("/lite/admin/hiring");
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Expire failed.",
    };
  }
}

export interface DiscoveryRunActionResult {
  ok: true;
  briefsProcessed: number;
  candidatesFound: number;
  totalCost: number;
  costCapHit: boolean;
}

// ---------------------------------------------------------------------------
// Trial Task Authoring (§9.1)
// ---------------------------------------------------------------------------

export async function proposeTrialTaskAction(
  candidateId: string,
): Promise<
  | {
      ok: true;
      proposal: {
        contentItemId: string;
        contentItemKeyword: string;
        rationale: string;
        taskDescription: string;
        budgetCapHours: number;
        deliverableFormat: string;
      };
      candidateName: string;
      roleName: string;
      candidateRate: number | null;
      candidateRateUnit: string | null;
      budgetCapAud: number;
      deadlineDays: number;
    }
  | { ok: false; error: string }
> {
  const by = await adminActorTag();
  if (!by) return { ok: false, error: "Not authorised." };

  try {
    const { proposeTrialTask } = await import("@/lib/hiring/trial-task");
    const result = await proposeTrialTask(candidateId);
    if (!result.ok) return { ok: false, error: result.reason };
    return result;
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Trial task proposal failed.",
    };
  }
}

export async function confirmTrialTaskAction(
  candidateId: string,
  contentItemId: string,
  taskDescription: string,
  budgetCapAud: number,
  ratePerUnitAud: number,
  rateUnit: string,
  deadlineDays: number,
): Promise<{ ok: true; trialTaskId: string } | { ok: false; error: string }> {
  const by = await adminActorTag();
  if (!by) return { ok: false, error: "Not authorised." };

  try {
    const { confirmAndSendTrialTask } = await import(
      "@/lib/hiring/trial-task"
    );
    const result = await confirmAndSendTrialTask({
      candidateId,
      contentItemId,
      taskDescription,
      budgetCapAud,
      ratePerUnitAud,
      rateUnit,
      deadlineDays,
      by,
    });
    if (!result.ok) return { ok: false, error: result.reason };
    revalidatePath("/lite/admin/hiring");
    return { ok: true, trialTaskId: result.trialTask.id };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Trial task send failed.",
    };
  }
}

// ---------------------------------------------------------------------------
// Discovery (§5)
// ---------------------------------------------------------------------------

export async function runDiscoveryNowAction(
  roleBriefId?: string,
): Promise<DiscoveryRunActionResult | { ok: false; error: string }> {
  const by = await adminActorTag();
  if (!by) return { ok: false, error: "Not authorised." };

  try {
    const { runDiscoveryForBrief, runDiscoveryForAllOpenBriefs } = await import(
      "@/lib/hiring/discovery/agent"
    );

    if (roleBriefId) {
      const { getRoleBriefById } = await import("@/lib/hiring/queries");
      const brief = await getRoleBriefById(roleBriefId);
      if (!brief) return { ok: false, error: "Role Brief not found." };

      const result = await runDiscoveryForBrief(brief);
      revalidatePath("/lite/admin/hiring");
      return {
        ok: true,
        briefsProcessed: 1,
        candidatesFound: result.candidates.length,
        totalCost: result.total_cost_aud,
        costCapHit: result.cost_cap_hit,
      };
    }

    const results = await runDiscoveryForAllOpenBriefs();
    revalidatePath("/lite/admin/hiring");

    return {
      ok: true,
      briefsProcessed: results.length,
      candidatesFound: results.reduce(
        (sum, r) => sum + r.candidates.length,
        0,
      ),
      totalCost: results.reduce((sum, r) => sum + r.total_cost_aud, 0),
      costCapHit: results.some((r) => r.cost_cap_hit),
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Discovery run failed.",
    };
  }
}
