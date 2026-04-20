import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import {
  candidates,
  type CandidateRow,
  type CandidateInsert,
  type CandidateStage,
  type HiringCandidateSource,
  type CandidateEngagementType,
} from "@/lib/db/schema/candidates";
import {
  role_briefs,
  type RoleBriefRow,
  type RoleBriefInsert,
  type RoleBriefStatus,
  type RoleBriefEngagementType,
} from "@/lib/db/schema/role-briefs";
import {
  trial_tasks,
  type TrialTaskRow,
  type TrialTaskInsert,
  type TrialTaskDisposition,
} from "@/lib/db/schema/trial-tasks";
import {
  candidate_archives,
  type CandidateArchiveRow,
  type CandidateArchiveInsert,
  type DispositionDirection,
} from "@/lib/db/schema/candidate-archives";
import { eq, and, inArray, lte, gte, isNull, isNotNull } from "drizzle-orm";

// ---------------------------------------------------------------------------
// Role Briefs — Create
// ---------------------------------------------------------------------------

export interface CreateRoleBriefInput {
  role_name: string;
  engagement_type?: RoleBriefEngagementType;
  rate_min_aud?: number | null;
  rate_max_aud?: number | null;
  rate_unit?: string | null;
  target_hours_per_week?: number | null;
  location_pref_city?: string | null;
  remote_ok?: boolean;
  open_count?: number;
}

export async function createRoleBrief(
  input: CreateRoleBriefInput,
): Promise<RoleBriefRow> {
  const now = Date.now();
  const row: RoleBriefInsert = {
    id: randomUUID(),
    role_name: input.role_name,
    engagement_type: input.engagement_type ?? "contractor",
    status: "draft",
    rate_min_aud: input.rate_min_aud ?? null,
    rate_max_aud: input.rate_max_aud ?? null,
    rate_unit: (input.rate_unit as RoleBriefInsert["rate_unit"]) ?? null,
    target_hours_per_week: input.target_hours_per_week ?? null,
    location_pref_city: input.location_pref_city ?? null,
    remote_ok: input.remote_ok ?? true,
    open_count: input.open_count ?? 1,
    created_at_ms: now,
    updated_at_ms: now,
  };
  const [inserted] = await db.insert(role_briefs).values(row).returning();
  return inserted;
}

// ---------------------------------------------------------------------------
// Role Briefs — Read
// ---------------------------------------------------------------------------

export async function getRoleBriefById(
  id: string,
): Promise<RoleBriefRow | undefined> {
  return db.query.role_briefs.findFirst({ where: eq(role_briefs.id, id) });
}

export interface ListRoleBriefsFilter {
  status?: RoleBriefStatus[];
  engagement_type?: RoleBriefEngagementType;
}

export async function listRoleBriefs(
  filter?: ListRoleBriefsFilter,
): Promise<RoleBriefRow[]> {
  const conditions = [];
  if (filter?.status?.length) {
    conditions.push(inArray(role_briefs.status, filter.status));
  }
  if (filter?.engagement_type) {
    conditions.push(eq(role_briefs.engagement_type, filter.engagement_type));
  }
  return db
    .select()
    .from(role_briefs)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .all();
}

// ---------------------------------------------------------------------------
// Role Briefs — Update
// ---------------------------------------------------------------------------

export async function updateRoleBrief(
  id: string,
  updates: Partial<
    Omit<RoleBriefInsert, "id" | "created_at_ms" | "updated_at_ms">
  >,
): Promise<RoleBriefRow> {
  const [updated] = await db
    .update(role_briefs)
    .set({ ...updates, updated_at_ms: Date.now() })
    .where(eq(role_briefs.id, id))
    .returning();
  if (!updated) {
    throw new Error(`updateRoleBrief: role_brief '${id}' not found`);
  }
  return updated;
}

// ---------------------------------------------------------------------------
// Candidates — Create
// ---------------------------------------------------------------------------

export interface CreateCandidateInput {
  role_brief_id?: string | null;
  stage: CandidateStage;
  source: HiringCandidateSource;
  discovery_source?: string | null;
  engagement_type?: CandidateEngagementType;
  name: string;
  email?: string | null;
  location_city?: string | null;
  portfolio_urls_json?: unknown;
  rate_expectation_aud?: number | null;
  rate_expectation_unit?: string | null;
  availability_hours_per_week?: number | null;
  available_from_ms?: number | null;
}

export async function createCandidate(
  input: CreateCandidateInput,
): Promise<CandidateRow> {
  const now = Date.now();
  const row: CandidateInsert = {
    id: randomUUID(),
    role_brief_id: input.role_brief_id ?? null,
    stage: input.stage,
    source: input.source,
    discovery_source: input.discovery_source ?? null,
    engagement_type: input.engagement_type ?? "contractor",
    name: input.name,
    email: input.email ?? null,
    location_city: input.location_city ?? null,
    portfolio_urls_json: input.portfolio_urls_json ?? null,
    rate_expectation_aud: input.rate_expectation_aud ?? null,
    rate_expectation_unit:
      (input.rate_expectation_unit as CandidateInsert["rate_expectation_unit"]) ??
      null,
    availability_hours_per_week: input.availability_hours_per_week ?? null,
    available_from_ms: input.available_from_ms ?? null,
    first_seen_at_ms: now,
    created_at_ms: now,
    updated_at_ms: now,
  };
  const [inserted] = await db.insert(candidates).values(row).returning();
  return inserted;
}

// ---------------------------------------------------------------------------
// Candidates — Read
// ---------------------------------------------------------------------------

export async function getCandidateById(
  id: string,
): Promise<CandidateRow | undefined> {
  return db.query.candidates.findFirst({ where: eq(candidates.id, id) });
}

export interface ListCandidatesFilter {
  stage?: CandidateStage[];
  source?: HiringCandidateSource[];
  role_brief_id?: string;
  engagement_type?: CandidateEngagementType;
  bench_status?: string;
}

export async function listCandidates(
  filter?: ListCandidatesFilter,
): Promise<CandidateRow[]> {
  const conditions = [];
  if (filter?.stage?.length) {
    conditions.push(inArray(candidates.stage, filter.stage));
  }
  if (filter?.source?.length) {
    conditions.push(inArray(candidates.source, filter.source));
  }
  if (filter?.role_brief_id) {
    conditions.push(eq(candidates.role_brief_id, filter.role_brief_id));
  }
  if (filter?.engagement_type) {
    conditions.push(eq(candidates.engagement_type, filter.engagement_type));
  }
  if (filter?.bench_status) {
    conditions.push(
      eq(
        candidates.bench_status,
        filter.bench_status as "active" | "paused",
      ),
    );
  }
  return db
    .select()
    .from(candidates)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .all();
}

export async function listCandidatesByRoleBrief(
  roleBriefId: string,
): Promise<CandidateRow[]> {
  return db
    .select()
    .from(candidates)
    .where(eq(candidates.role_brief_id, roleBriefId))
    .all();
}

// ---------------------------------------------------------------------------
// Candidates — Update
// ---------------------------------------------------------------------------

export async function updateCandidate(
  id: string,
  updates: Partial<
    Omit<CandidateInsert, "id" | "created_at_ms" | "updated_at_ms" | "first_seen_at_ms">
  >,
): Promise<CandidateRow> {
  const [updated] = await db
    .update(candidates)
    .set({ ...updates, updated_at_ms: Date.now() })
    .where(eq(candidates.id, id))
    .returning();
  if (!updated) {
    throw new Error(`updateCandidate: candidate '${id}' not found`);
  }
  return updated;
}

// ---------------------------------------------------------------------------
// Candidates — Bench queries
// ---------------------------------------------------------------------------

export async function getAvailableBenchMembers(
  role: string,
  hoursNeeded: number,
  options?: { excludeIds?: string[] },
): Promise<CandidateRow[]> {
  const nowMs = Date.now();
  const all = await db
    .select()
    .from(candidates)
    .where(
      and(
        eq(candidates.stage, "bench"),
        eq(candidates.bench_status, "active"),
      ),
    )
    .all();

  return all.filter((c) => {
    if (options?.excludeIds?.includes(c.id)) return false;
    if (c.paused_until_ms && c.paused_until_ms > nowMs) return false;
    if (!c.weekly_capacity_hours || c.weekly_capacity_hours < hoursNeeded)
      return false;
    if (!c.role_brief_id) return false;
    return true;
  });
}

export interface OpenBenchCount {
  active: number;
  paused: number;
  total: number;
}

export async function openBenchCount(
  roleBriefId: string,
): Promise<OpenBenchCount> {
  const benchMembers = await db
    .select()
    .from(candidates)
    .where(
      and(
        eq(candidates.stage, "bench"),
        eq(candidates.role_brief_id, roleBriefId),
      ),
    )
    .all();

  const active = benchMembers.filter(
    (c) => c.bench_status === "active",
  ).length;
  const paused = benchMembers.filter(
    (c) => c.bench_status === "paused",
  ).length;
  return { active, paused, total: active + paused };
}

// ---------------------------------------------------------------------------
// Trial Tasks — Create
// ---------------------------------------------------------------------------

export interface CreateTrialTaskInput {
  candidate_id: string;
  role_brief_id: string;
  internal_content_ref?: string | null;
  task_description: string;
  budget_cap_aud: number;
  rate_per_unit_aud: number;
  rate_unit: string;
  due_at_ms: number;
}

export async function createTrialTask(
  input: CreateTrialTaskInput,
): Promise<TrialTaskRow> {
  const now = Date.now();
  const row: TrialTaskInsert = {
    id: randomUUID(),
    candidate_id: input.candidate_id,
    role_brief_id: input.role_brief_id,
    internal_content_ref: input.internal_content_ref ?? null,
    task_description: input.task_description,
    budget_cap_aud: input.budget_cap_aud,
    rate_per_unit_aud: input.rate_per_unit_aud,
    rate_unit: input.rate_unit as TrialTaskInsert["rate_unit"],
    sent_at_ms: now,
    due_at_ms: input.due_at_ms,
    disposition: "pending",
    created_at_ms: now,
    updated_at_ms: now,
  };
  const [inserted] = await db.insert(trial_tasks).values(row).returning();
  return inserted;
}

// ---------------------------------------------------------------------------
// Trial Tasks — Read
// ---------------------------------------------------------------------------

export async function getTrialTaskById(
  id: string,
): Promise<TrialTaskRow | undefined> {
  return db.query.trial_tasks.findFirst({ where: eq(trial_tasks.id, id) });
}

export async function listTrialTasksByCandidate(
  candidateId: string,
): Promise<TrialTaskRow[]> {
  return db
    .select()
    .from(trial_tasks)
    .where(eq(trial_tasks.candidate_id, candidateId))
    .all();
}

export interface ListTrialTasksFilter {
  disposition?: TrialTaskDisposition[];
  role_brief_id?: string;
  overdue_at_ms?: number;
}

export async function listTrialTasks(
  filter?: ListTrialTasksFilter,
): Promise<TrialTaskRow[]> {
  const conditions = [];
  if (filter?.disposition?.length) {
    conditions.push(inArray(trial_tasks.disposition, filter.disposition));
  }
  if (filter?.role_brief_id) {
    conditions.push(eq(trial_tasks.role_brief_id, filter.role_brief_id));
  }
  if (filter?.overdue_at_ms) {
    conditions.push(lte(trial_tasks.due_at_ms, filter.overdue_at_ms));
    conditions.push(eq(trial_tasks.disposition, "pending"));
    conditions.push(isNull(trial_tasks.delivered_at_ms));
  }
  return db
    .select()
    .from(trial_tasks)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .all();
}

// ---------------------------------------------------------------------------
// Trial Tasks — Update
// ---------------------------------------------------------------------------

export async function updateTrialTask(
  id: string,
  updates: Partial<
    Omit<TrialTaskInsert, "id" | "created_at_ms" | "updated_at_ms">
  >,
): Promise<TrialTaskRow> {
  const [updated] = await db
    .update(trial_tasks)
    .set({ ...updates, updated_at_ms: Date.now() })
    .where(eq(trial_tasks.id, id))
    .returning();
  if (!updated) {
    throw new Error(`updateTrialTask: trial_task '${id}' not found`);
  }
  return updated;
}

// ---------------------------------------------------------------------------
// Candidate Archives — Create
// ---------------------------------------------------------------------------

export interface CreateCandidateArchiveInput {
  candidate_id: string;
  stage_when_archived: string;
  reason_code: string;
  reason_free_text?: string | null;
  reflection_text?: string | null;
  disposition_direction: DispositionDirection;
}

export async function createCandidateArchive(
  input: CreateCandidateArchiveInput,
): Promise<CandidateArchiveRow> {
  const now = Date.now();
  const row: CandidateArchiveInsert = {
    id: randomUUID(),
    candidate_id: input.candidate_id,
    archived_at_ms: now,
    stage_when_archived: input.stage_when_archived,
    reason_code: input.reason_code,
    reason_free_text: input.reason_free_text ?? null,
    reflection_text: input.reflection_text ?? null,
    disposition_direction: input.disposition_direction,
    created_at_ms: now,
  };
  const [inserted] = await db
    .insert(candidate_archives)
    .values(row)
    .returning();
  return inserted;
}

// ---------------------------------------------------------------------------
// Candidate Archives — Read
// ---------------------------------------------------------------------------

export async function getArchivesForCandidate(
  candidateId: string,
): Promise<CandidateArchiveRow[]> {
  return db
    .select()
    .from(candidate_archives)
    .where(eq(candidate_archives.candidate_id, candidateId))
    .all();
}

export async function markArchiveUnarchived(
  candidateId: string,
): Promise<void> {
  const nowMs = Date.now();
  const latest = await db
    .select()
    .from(candidate_archives)
    .where(
      and(
        eq(candidate_archives.candidate_id, candidateId),
        isNull(candidate_archives.un_archived_at_ms),
      ),
    )
    .all();
  for (const archive of latest) {
    await db
      .update(candidate_archives)
      .set({ un_archived_at_ms: nowMs })
      .where(eq(candidate_archives.id, archive.id))
      .run();
  }
}
