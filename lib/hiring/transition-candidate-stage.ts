import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { db as defaultDb } from "@/lib/db";
import {
  candidates,
  type CandidateRow,
  type CandidateStage,
} from "@/lib/db/schema/candidates";
import { activity_log, type ActivityLogKind } from "@/lib/db/schema/activity-log";
import { validateCandidate } from "./validate-candidate";

export interface TransitionCandidateStageOpts {
  by: string | null;
  meta?: Record<string, unknown>;
  nowMs?: number;
}

type Db = BetterSQLite3Database<Record<string, unknown>> | typeof defaultDb;

const STAGE_TO_ACTIVITY_KIND: Record<CandidateStage, ActivityLogKind> = {
  sourced: "candidate_sourced",
  invited: "candidate_invited",
  applied: "candidate_applied",
  screened: "candidate_screened",
  trial: "candidate_trial_sent",
  bench: "candidate_benched",
  archived: "candidate_archived",
};

function resolveActivityKind(
  fromStage: CandidateStage,
  toStage: CandidateStage,
): ActivityLogKind {
  if (fromStage === "archived") return "candidate_unarchived";
  return STAGE_TO_ACTIVITY_KIND[toStage];
}

export function transitionCandidateStage(
  candidateId: string,
  toStage: CandidateStage,
  opts: TransitionCandidateStageOpts,
  dbArg: Db = defaultDb,
): CandidateRow {
  const nowMs = opts.nowMs ?? Date.now();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const database = dbArg as any;

  return database.transaction((tx: Db) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const txDb = tx as any;

    const existing: CandidateRow | undefined = txDb
      .select()
      .from(candidates)
      .where(eq(candidates.id, candidateId))
      .get();
    if (!existing) {
      throw new Error(
        `transitionCandidateStage: candidate '${candidateId}' not found`,
      );
    }

    const fromStage = existing.stage;
    if (fromStage === toStage) {
      throw new Error(
        `transitionCandidateStage: candidate '${candidateId}' already in stage '${toStage}'`,
      );
    }

    const updates: Record<string, unknown> = {
      stage: toStage,
      updated_at_ms: nowMs,
    };

    if (toStage === "archived") {
      updates.stage_before_archive = fromStage;
      updates.archived_at_ms = nowMs;
    }

    if (fromStage === "archived" && toStage !== "archived") {
      updates.archived_at_ms = null;
    }

    if (toStage === "bench" && !existing.bench_status) {
      updates.bench_status = "active";
    }

    if (fromStage === "bench" && toStage !== "bench") {
      updates.bench_status = null;
      updates.paused_until_ms = null;
    }

    const simulated: CandidateRow = {
      ...existing,
      ...updates,
    } as CandidateRow;
    const validation = validateCandidate(simulated);
    if (!validation.ok) {
      throw new Error(
        `transitionCandidateStage: cannot move candidate '${candidateId}' to '${toStage}': ${validation.errors.join("; ")}`,
      );
    }

    txDb
      .update(candidates)
      .set(updates)
      .where(eq(candidates.id, candidateId))
      .run();

    const extraMeta = { ...(opts.meta ?? {}) };
    delete extraMeta.from_stage;
    delete extraMeta.to_stage;
    delete extraMeta.by;

    txDb
      .insert(activity_log)
      .values({
        id: randomUUID(),
        kind: resolveActivityKind(fromStage, toStage),
        body: `Candidate stage '${fromStage}' → '${toStage}'.`,
        meta: {
          from_stage: fromStage,
          to_stage: toStage,
          by: opts.by,
          candidate_id: candidateId,
          ...extraMeta,
        },
        created_at_ms: nowMs,
        created_by: opts.by,
      })
      .run();

    return txDb
      .select()
      .from(candidates)
      .where(eq(candidates.id, candidateId))
      .get() as CandidateRow;
  });
}
