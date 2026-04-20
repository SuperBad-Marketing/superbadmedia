import { and, eq, gte, isNotNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { invite_drafts } from "@/lib/db/schema/invite-drafts";
import settingsRegistry from "@/lib/settings";
import type { CandidateEngagementType } from "@/lib/db/schema/candidates";

export interface InviteGateInput {
  candidateId: string;
  roleBriefId: string | null;
  confidence: number;
  engagementType: CandidateEngagementType;
}

export interface InviteGateResult {
  autoSend: boolean;
  holdReason: string | null;
}

export async function evaluateInviteSendGate(
  input: InviteGateInput,
): Promise<InviteGateResult> {
  const autoSendEnabled = await settingsRegistry.get(
    "hiring.invite.auto_send_enabled",
  );
  if (!autoSendEnabled) {
    return { autoSend: false, holdReason: "low_confidence" };
  }

  const threshold =
    input.engagementType === "employee"
      ? await settingsRegistry.get(
          "hiring.invite.ft_auto_send_confidence_threshold",
        )
      : await settingsRegistry.get(
          "hiring.invite.auto_send_confidence_threshold",
        );

  if (input.confidence < threshold) {
    return { autoSend: false, holdReason: "low_confidence" };
  }

  if (input.roleBriefId) {
    const dailyCap = await settingsRegistry.get(
      "hiring.invite.daily_send_cap_per_role",
    );
    const todayStartMs = startOfDayMs();
    const sentToday = await db
      .select()
      .from(invite_drafts)
      .where(
        and(
          eq(invite_drafts.role_brief_id, input.roleBriefId),
          eq(invite_drafts.status, "sent"),
          gte(invite_drafts.sent_at_ms, todayStartMs),
        ),
      )
      .all();

    if (sentToday.length >= dailyCap) {
      return { autoSend: false, holdReason: "daily_cap" };
    }
  }

  const throttleDays = await settingsRegistry.get(
    "hiring.invite.per_candidate_throttle_days",
  );
  const throttleWindowMs = Date.now() - throttleDays * 24 * 60 * 60 * 1000;
  const recentToCandidate = await db
    .select()
    .from(invite_drafts)
    .where(
      and(
        eq(invite_drafts.candidate_id, input.candidateId),
        eq(invite_drafts.status, "sent"),
        gte(invite_drafts.sent_at_ms, throttleWindowMs),
        input.roleBriefId
          ? eq(invite_drafts.role_brief_id, input.roleBriefId)
          : undefined,
      ),
    )
    .all();

  if (recentToCandidate.length > 0) {
    return { autoSend: false, holdReason: "candidate_throttle" };
  }

  const crossRoleCap = await settingsRegistry.get(
    "hiring.invite.cross_role_max_per_candidate_per_year",
  );
  const yearStartMs = startOfYearMs();
  const sentThisYear = await db
    .select()
    .from(invite_drafts)
    .where(
      and(
        eq(invite_drafts.candidate_id, input.candidateId),
        eq(invite_drafts.status, "sent"),
        gte(invite_drafts.sent_at_ms, yearStartMs),
      ),
    )
    .all();

  if (sentThisYear.length >= crossRoleCap) {
    return { autoSend: false, holdReason: "cross_role_cap" };
  }

  return { autoSend: true, holdReason: null };
}

function startOfDayMs(): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function startOfYearMs(): number {
  const d = new Date();
  d.setMonth(0, 1);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}
