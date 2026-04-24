import { redirect } from "next/navigation";
import { desc, eq, and, asc, max } from "drizzle-orm";
import type { Metadata } from "next";

import { auth } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { candidates } from "@/lib/db/schema/candidates";
import { role_briefs } from "@/lib/db/schema/role-briefs";
import { trial_tasks } from "@/lib/db/schema/trial-tasks";
import { activity_log } from "@/lib/db/schema/activity-log";
import settingsRegistry from "@/lib/settings";

import { HiringBoard } from "@/components/lite/hiring-pipeline/hiring-board";
import { DiscoveryRunButton } from "@/components/lite/hiring-pipeline/discovery-run-button";
import type { HiringCardCandidate } from "@/components/lite/hiring-pipeline/candidate-card";

export const metadata: Metadata = {
  title: "SuperBad — Hiring Pipeline",
  robots: { index: false, follow: false },
};

interface StaleThresholds {
  sourced_days: number;
  invited_days: number;
  applied_days: number;
  screened_days: number;
  trial_grace_days: number;
}

async function loadThresholds(): Promise<StaleThresholds> {
  const get = settingsRegistry.get;
  const [sourced, invited, applied, screened, trialGrace] = await Promise.all([
    get("hiring.staleness.sourced_days"),
    get("hiring.staleness.invited_days"),
    get("hiring.staleness.applied_days"),
    get("hiring.staleness.screened_days"),
    get("hiring.trial.delivery_grace_days"),
  ]);
  return {
    sourced_days: sourced,
    invited_days: invited,
    applied_days: applied,
    screened_days: screened,
    trial_grace_days: trialGrace,
  };
}

function isStale(
  candidate: typeof candidates.$inferSelect,
  trialTask: typeof trial_tasks.$inferSelect | null,
  lastActivityMs: number | null,
  thresholds: StaleThresholds,
  nowMs: number,
): boolean {
  const refMs = lastActivityMs ?? candidate.updated_at_ms;
  const dayMs = 24 * 60 * 60 * 1000;
  const ageDays = (nowMs - refMs) / dayMs;

  switch (candidate.stage) {
    case "sourced":
      return ageDays > thresholds.sourced_days;
    case "invited":
      return ageDays > thresholds.invited_days;
    case "applied":
      return ageDays > thresholds.applied_days;
    case "screened":
      return ageDays > thresholds.screened_days;
    case "trial":
      if (trialTask?.due_at_ms) {
        return nowMs > trialTask.due_at_ms + thresholds.trial_grace_days * dayMs;
      }
      return false;
    default:
      return false;
  }
}

function relativeLabel(tsMs: number | null, nowMs: number): string | null {
  if (tsMs == null) return null;
  const diff = nowMs - tsMs;
  const dayMs = 24 * 60 * 60 * 1000;
  if (diff < dayMs) return "today";
  const days = Math.floor(diff / dayMs);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

function detectPlatforms(urlsJson: unknown): string[] {
  if (!Array.isArray(urlsJson)) return [];
  const platforms: string[] = [];
  const matchers: [string, RegExp][] = [
    ["vimeo", /vimeo\.com/i],
    ["behance", /behance\.net/i],
    ["dribbble", /dribbble\.com/i],
    ["arena", /are\.na/i],
    ["youtube", /youtube\.com|youtu\.be/i],
    ["instagram", /instagram\.com/i],
    ["linkedin", /linkedin\.com/i],
    ["tiktok", /tiktok\.com/i],
  ];
  for (const url of urlsJson) {
    if (typeof url !== "string") continue;
    let matched = false;
    for (const [name, re] of matchers) {
      if (re.test(url) && !platforms.includes(name)) {
        platforms.push(name);
        matched = true;
      }
    }
    if (!matched && !platforms.includes("personal")) {
      platforms.push("personal");
    }
  }
  return platforms;
}

function formatRate(aud: number | null, unit: string | null): string | null {
  if (aud == null) return null;
  const label = unit === "per_hour" ? "/hr" : unit === "per_day" ? "/day" : "";
  return `$${aud}${label}`;
}

function complianceCheck(candidate: typeof candidates.$inferSelect): {
  ok: boolean;
  missing: string[];
} {
  const missing: string[] = [];
  if (!candidate.abn) missing.push("ABN");
  if (!candidate.agreement_signed_at_ms) missing.push("Agreement");
  if (!candidate.bank_details) missing.push("Bank details");
  if (!candidate.hourly_rate_aud) missing.push("Hourly rate");
  return { ok: missing.length === 0, missing };
}

export default async function HiringPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    redirect("/api/auth/signin");
  }

  const nowMs = Date.now();
  const thresholds = await loadThresholds();

  const allCandidates = await db
    .select()
    .from(candidates)
    .orderBy(asc(candidates.stage), desc(candidates.updated_at_ms))
    .all();

  const allRoleBriefs = await db.select().from(role_briefs).all();
  const roleBriefMap = new Map(allRoleBriefs.map((rb) => [rb.id, rb]));

  const allTrialTasks = await db
    .select()
    .from(trial_tasks)
    .all();
  const latestTrialByCandidate = new Map<string, typeof trial_tasks.$inferSelect>();
  for (const tt of allTrialTasks) {
    const existing = latestTrialByCandidate.get(tt.candidate_id);
    if (!existing || tt.created_at_ms > existing.created_at_ms) {
      latestTrialByCandidate.set(tt.candidate_id, tt);
    }
  }

  const lastActivityRows = await db
    .select({
      candidate_id: activity_log.meta,
      last_at: max(activity_log.created_at_ms),
    })
    .from(activity_log)
    .groupBy(activity_log.meta);

  const lastActivityByCandidate = new Map<string, number>();
  for (const r of lastActivityRows) {
    if (r.candidate_id && typeof r.candidate_id === "object") {
      const meta = r.candidate_id as Record<string, unknown>;
      const cid = meta.candidate_id;
      if (typeof cid === "string" && r.last_at != null) {
        const existing = lastActivityByCandidate.get(cid);
        if (!existing || r.last_at > existing) {
          lastActivityByCandidate.set(cid, r.last_at);
        }
      }
    }
  }

  const cards: HiringCardCandidate[] = allCandidates.map((c) => {
    const rb = c.role_brief_id ? roleBriefMap.get(c.role_brief_id) : null;
    const trialTask = latestTrialByCandidate.get(c.id) ?? null;
    const lastAct = lastActivityByCandidate.get(c.id) ?? null;
    const compliance = complianceCheck(c);

    return {
      id: c.id,
      stage: c.stage,
      stage_before_archive: c.stage_before_archive,
      name: c.name,
      role_brief_id: c.role_brief_id,
      role_name: rb?.role_name ?? null,
      source: c.source,
      location_city: c.location_city,
      rate_display: formatRate(
        c.rate_expectation_aud,
        c.rate_expectation_unit,
      ),
      brief_match_score: c.brief_match_score,
      portfolio_platforms: detectPlatforms(c.portfolio_urls_json),
      is_stale: isStale(c, trialTask, lastAct, thresholds, nowMs),
      last_activity_label: relativeLabel(lastAct, nowMs),
      followup_question: c.application_followup_question,
      followup_reply: c.application_followup_reply,
      compliance_ok: compliance.ok,
      compliance_missing: compliance.missing,
      trial_summary: trialTask?.task_description
        ? trialTask.task_description.slice(0, 80)
        : null,
      trial_due_label: trialTask?.due_at_ms
        ? relativeLabel(trialTask.due_at_ms, nowMs)
        : null,
      trial_disposition: trialTask?.disposition ?? null,
    };
  });

  const roleBriefFilter = allRoleBriefs
    .filter((rb) => rb.status === "open" || rb.status === "paused")
    .map((rb) => ({ id: rb.id, name: rb.role_name }));

  const staleCount = cards.filter((c) => c.is_stale).length;

  return (
    <div>
      <header className="px-4 pt-6 pb-5">
        <div
          className="font-[family-name:var(--font-label)] text-[10px] uppercase leading-none text-[color:var(--color-neutral-500)]"
          style={{ letterSpacing: "2px" }}
        >
          Admin · Hiring
        </div>
        <div className="mt-3 flex items-start justify-between gap-4">
          <h1
            className="font-[family-name:var(--font-display)] text-[40px] leading-none text-[color:var(--color-brand-cream)]"
            style={{ letterSpacing: "-0.4px" }}
          >
            Hiring Pipeline
          </h1>
          <DiscoveryRunButton />
        </div>
        <p className="mt-3 max-w-[640px] font-[family-name:var(--font-body)] text-[16px] leading-[1.55] text-[color:var(--color-neutral-300)]">
          Every candidate, every stage, every stall.{" "}
          <em className="font-[family-name:var(--font-narrative)] text-[color:var(--color-brand-pink)]">
            {staleCount > 0
              ? "a few of them are waiting on you."
              : "scouting kicks in weekly."}
          </em>
        </p>
        <div className="mt-4 flex items-center gap-4 font-[family-name:var(--font-body)] text-[12px] text-[color:var(--color-neutral-500)]">
          <span
            className="font-[family-name:var(--font-label)] uppercase text-[color:var(--color-neutral-300)]"
            style={{ letterSpacing: "1.5px" }}
          >
            {cards.length}
          </span>
          <span>candidate{cards.length === 1 ? "" : "s"}</span>
          <span aria-hidden className="text-[color:var(--color-neutral-700)]">
            ·
          </span>
          <span>7 stages</span>
          {staleCount > 0 ? (
            <>
              <span
                aria-hidden
                className="text-[color:var(--color-neutral-700)]"
              >
                ·
              </span>
              <span
                className="font-[family-name:var(--font-label)] uppercase text-[color:var(--color-neutral-500)]"
                style={{ letterSpacing: "1.5px" }}
              >
                {staleCount} stale
              </span>
            </>
          ) : null}
        </div>
      </header>
      <HiringBoard candidates={cards} roleBriefFilter={roleBriefFilter} />
    </div>
  );
}
