import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate as drizzleMigrate } from "drizzle-orm/better-sqlite3/migrator";
import { eq } from "drizzle-orm";
import * as schema from "@/lib/db/schema";
import fs from "node:fs";
import path from "node:path";

import { validateCandidate } from "@/lib/hiring/validate-candidate";
import { transitionCandidateStage } from "@/lib/hiring/transition-candidate-stage";
import {
  HIRING_STAGES,
  ARCHIVE_REASONS_BY_STAGE,
  SKIP_TRIAL_REASONS,
} from "@/lib/hiring/stages";

const TEST_DB = "test-hp1.db";
const NOW = Date.now();

let sqlite: Database.Database;
let testDb: ReturnType<typeof drizzle<typeof schema>>;

beforeAll(() => {
  if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);
  sqlite = new Database(TEST_DB);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  testDb = drizzle(sqlite, { schema });
  drizzleMigrate(testDb, {
    migrationsFolder: path.join(process.cwd(), "lib/db/migrations"),
  });
});

afterAll(() => {
  sqlite.close();
  for (const ext of ["", "-wal", "-shm"]) {
    const p = `${TEST_DB}${ext}`;
    if (fs.existsSync(p)) fs.unlinkSync(p);
  }
});

function seedRoleBrief(id = "rb_1") {
  testDb
    .insert(schema.role_briefs)
    .values({
      id,
      role_name: "Video Editor",
      engagement_type: "contractor",
      status: "open",
      remote_ok: true,
      open_count: 1,
      created_at_ms: NOW,
      updated_at_ms: NOW,
    })
    .onConflictDoNothing()
    .run();
}

function seedCandidate(
  id: string,
  overrides?: Partial<schema.CandidateInsert>,
) {
  testDb
    .insert(schema.candidates)
    .values({
      id,
      role_brief_id: "rb_1",
      stage: "sourced",
      source: "sourced",
      engagement_type: "contractor",
      name: `Candidate ${id}`,
      email: `${id}@test.com`,
      first_seen_at_ms: NOW,
      created_at_ms: NOW,
      updated_at_ms: NOW,
      ...overrides,
    })
    .onConflictDoNothing()
    .run();
}

beforeEach(() => {
  testDb.delete(schema.candidate_archives).run();
  testDb.delete(schema.trial_tasks).run();
  testDb.delete(schema.candidates).run();
  testDb.delete(schema.role_briefs).run();
  testDb.delete(schema.activity_log).run();
  seedRoleBrief();
});

// ---------------------------------------------------------------------------
// Schema — table existence
// ---------------------------------------------------------------------------

describe("role_briefs table", () => {
  it("exists and accepts inserts", () => {
    const row = testDb
      .select()
      .from(schema.role_briefs)
      .where(eq(schema.role_briefs.id, "rb_1"))
      .get();
    expect(row).toBeDefined();
    expect(row!.role_name).toBe("Video Editor");
    expect(row!.status).toBe("open");
    expect(row!.engagement_type).toBe("contractor");
    expect(row!.remote_ok).toBe(true);
  });

  it("defaults status to draft", () => {
    testDb
      .insert(schema.role_briefs)
      .values({
        id: "rb_default",
        role_name: "Photographer",
        created_at_ms: NOW,
        updated_at_ms: NOW,
      })
      .run();
    const row = testDb
      .select()
      .from(schema.role_briefs)
      .where(eq(schema.role_briefs.id, "rb_default"))
      .get();
    expect(row!.status).toBe("draft");
    expect(row!.engagement_type).toBe("contractor");
  });
});

describe("candidates table", () => {
  it("exists and accepts inserts", () => {
    seedCandidate("c_1");
    const row = testDb
      .select()
      .from(schema.candidates)
      .where(eq(schema.candidates.id, "c_1"))
      .get();
    expect(row).toBeDefined();
    expect(row!.name).toBe("Candidate c_1");
    expect(row!.stage).toBe("sourced");
    expect(row!.source).toBe("sourced");
  });

  it("stores JSON portfolio_urls", () => {
    seedCandidate("c_json", {
      portfolio_urls_json: ["https://vimeo.com/test", "https://behance.net/test"],
    });
    const row = testDb
      .select()
      .from(schema.candidates)
      .where(eq(schema.candidates.id, "c_json"))
      .get();
    expect(row!.portfolio_urls_json).toEqual([
      "https://vimeo.com/test",
      "https://behance.net/test",
    ]);
  });

  it("enforces role_brief_id FK", () => {
    expect(() =>
      testDb
        .insert(schema.candidates)
        .values({
          id: "c_bad_fk",
          role_brief_id: "nonexistent",
          stage: "sourced",
          source: "sourced",
          name: "Bad FK",
          first_seen_at_ms: NOW,
          created_at_ms: NOW,
          updated_at_ms: NOW,
        })
        .run(),
    ).toThrow();
  });
});

describe("trial_tasks table", () => {
  it("exists and accepts inserts", () => {
    seedCandidate("c_trial");
    testDb
      .insert(schema.trial_tasks)
      .values({
        id: "tt_1",
        candidate_id: "c_trial",
        role_brief_id: "rb_1",
        task_description: "Edit a 30s social reel",
        budget_cap_aud: 320,
        rate_per_unit_aud: 80,
        rate_unit: "per_hour",
        sent_at_ms: NOW,
        due_at_ms: NOW + 7 * 86400000,
        created_at_ms: NOW,
        updated_at_ms: NOW,
      })
      .run();
    const row = testDb
      .select()
      .from(schema.trial_tasks)
      .where(eq(schema.trial_tasks.id, "tt_1"))
      .get();
    expect(row).toBeDefined();
    expect(row!.disposition).toBe("pending");
    expect(row!.budget_cap_aud).toBe(320);
  });

  it("cascades on candidate delete", () => {
    seedCandidate("c_cascade");
    testDb
      .insert(schema.trial_tasks)
      .values({
        id: "tt_cascade",
        candidate_id: "c_cascade",
        role_brief_id: "rb_1",
        task_description: "Cascade test",
        budget_cap_aud: 100,
        rate_per_unit_aud: 50,
        rate_unit: "per_hour",
        sent_at_ms: NOW,
        due_at_ms: NOW + 7 * 86400000,
        created_at_ms: NOW,
        updated_at_ms: NOW,
      })
      .run();
    testDb
      .delete(schema.candidates)
      .where(eq(schema.candidates.id, "c_cascade"))
      .run();
    const row = testDb
      .select()
      .from(schema.trial_tasks)
      .where(eq(schema.trial_tasks.id, "tt_cascade"))
      .get();
    expect(row).toBeUndefined();
  });
});

describe("candidate_archives table", () => {
  it("exists and accepts inserts", () => {
    seedCandidate("c_archive");
    testDb
      .insert(schema.candidate_archives)
      .values({
        id: "ca_1",
        candidate_id: "c_archive",
        archived_at_ms: NOW,
        stage_when_archived: "sourced",
        reason_code: "not_my_taste",
        disposition_direction: "we_archived",
        created_at_ms: NOW,
      })
      .run();
    const row = testDb
      .select()
      .from(schema.candidate_archives)
      .where(eq(schema.candidate_archives.id, "ca_1"))
      .get();
    expect(row).toBeDefined();
    expect(row!.reason_code).toBe("not_my_taste");
    expect(row!.disposition_direction).toBe("we_archived");
  });
});

// ---------------------------------------------------------------------------
// Stage registry
// ---------------------------------------------------------------------------

describe("HIRING_STAGES", () => {
  it("has 7 stages in correct order", () => {
    expect(HIRING_STAGES).toHaveLength(7);
    expect(HIRING_STAGES[0].key).toBe("sourced");
    expect(HIRING_STAGES[6].key).toBe("archived");
    for (let i = 1; i < HIRING_STAGES.length; i++) {
      expect(HIRING_STAGES[i].order).toBeGreaterThan(
        HIRING_STAGES[i - 1].order,
      );
    }
  });

  it("none are full_time_only in v1", () => {
    for (const s of HIRING_STAGES) {
      expect(s.full_time_only).toBe(false);
    }
  });
});

describe("ARCHIVE_REASONS_BY_STAGE", () => {
  it("has reasons for sourced through bench", () => {
    expect(ARCHIVE_REASONS_BY_STAGE.sourced).toBeDefined();
    expect(ARCHIVE_REASONS_BY_STAGE.bench).toBeDefined();
    expect(ARCHIVE_REASONS_BY_STAGE.archived).toBeUndefined();
  });

  it("every stage includes 'other'", () => {
    for (const [, reasons] of Object.entries(ARCHIVE_REASONS_BY_STAGE)) {
      expect(reasons).toContain("other");
    }
  });
});

describe("SKIP_TRIAL_REASONS", () => {
  it("has 3 reasons", () => {
    expect(SKIP_TRIAL_REASONS).toHaveLength(3);
    expect(SKIP_TRIAL_REASONS).toContain("prior_relationship");
    expect(SKIP_TRIAL_REASONS).toContain("strong_referral");
    expect(SKIP_TRIAL_REASONS).toContain("immediate_need");
  });
});

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

describe("validateCandidate", () => {
  it("passes for non-bench stage", () => {
    const result = validateCandidate({
      stage: "sourced",
      bench_status: null,
      paused_until_ms: null,
      abn: null,
      agreement_signed_at_ms: null,
      bank_details: null,
      hourly_rate_aud: null,
      weekly_capacity_hours: null,
    });
    expect(result.ok).toBe(true);
  });

  it("fails bench without compliance fields", () => {
    const result = validateCandidate({
      stage: "bench",
      bench_status: "active",
      paused_until_ms: null,
      abn: null,
      agreement_signed_at_ms: null,
      bank_details: null,
      hourly_rate_aud: null,
      weekly_capacity_hours: null,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.length).toBeGreaterThanOrEqual(4);
    }
  });

  it("passes bench with all compliance fields", () => {
    const result = validateCandidate({
      stage: "bench",
      bench_status: "active",
      paused_until_ms: null,
      abn: "12345678901",
      agreement_signed_at_ms: NOW,
      bank_details: '{"bsb":"000000","account":"12345678"}',
      hourly_rate_aud: 100,
      weekly_capacity_hours: 20,
    });
    expect(result.ok).toBe(true);
  });

  it("fails if paused_until_ms set without paused bench_status", () => {
    const result = validateCandidate({
      stage: "bench",
      bench_status: "active",
      paused_until_ms: NOW + 86400000,
      abn: "12345678901",
      agreement_signed_at_ms: NOW,
      bank_details: '{"bsb":"000000","account":"12345678"}',
      hourly_rate_aud: 100,
      weekly_capacity_hours: 20,
    });
    expect(result.ok).toBe(false);
  });

  it("fails if bench_status set on non-bench stage", () => {
    const result = validateCandidate({
      stage: "sourced",
      bench_status: "active",
      paused_until_ms: null,
      abn: null,
      agreement_signed_at_ms: null,
      bank_details: null,
      hourly_rate_aud: null,
      weekly_capacity_hours: null,
    });
    expect(result.ok).toBe(false);
  });

  it("fails bench with zero weekly_capacity_hours", () => {
    const result = validateCandidate({
      stage: "bench",
      bench_status: "active",
      paused_until_ms: null,
      abn: "12345678901",
      agreement_signed_at_ms: NOW,
      bank_details: '{"bsb":"000000","account":"12345678"}',
      hourly_rate_aud: 100,
      weekly_capacity_hours: 0,
    });
    expect(result.ok).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Stage transitions
// ---------------------------------------------------------------------------

describe("transitionCandidateStage", () => {
  it("moves candidate between stages", () => {
    seedCandidate("c_trans");
    const result = transitionCandidateStage(
      "c_trans",
      "invited",
      { by: "admin", nowMs: NOW },
      testDb,
    );
    expect(result.stage).toBe("invited");
  });

  it("throws on identity transition", () => {
    seedCandidate("c_identity");
    expect(() =>
      transitionCandidateStage(
        "c_identity",
        "sourced",
        { by: "admin", nowMs: NOW },
        testDb,
      ),
    ).toThrow("already in stage");
  });

  it("throws on missing candidate", () => {
    expect(() =>
      transitionCandidateStage(
        "nonexistent",
        "invited",
        { by: "admin", nowMs: NOW },
        testDb,
      ),
    ).toThrow("not found");
  });

  it("sets stage_before_archive + archived_at on archive", () => {
    seedCandidate("c_arch", { stage: "applied" });
    const result = transitionCandidateStage(
      "c_arch",
      "archived",
      { by: "admin", nowMs: NOW },
      testDb,
    );
    expect(result.stage).toBe("archived");
    expect(result.stage_before_archive).toBe("applied");
    expect(result.archived_at_ms).toBe(NOW);
  });

  it("clears archived_at on un-archive", () => {
    seedCandidate("c_unarch", {
      stage: "archived",
      stage_before_archive: "screened",
      archived_at_ms: NOW - 86400000,
    });
    const result = transitionCandidateStage(
      "c_unarch",
      "screened",
      { by: "admin", nowMs: NOW },
      testDb,
    );
    expect(result.stage).toBe("screened");
    expect(result.archived_at_ms).toBeNull();
  });

  it("sets bench_status to active on bench entry", () => {
    seedCandidate("c_bench_entry", {
      stage: "screened",
      abn: "12345678901",
      agreement_signed_at_ms: NOW,
      bank_details: '{"bsb":"000000","account":"12345678"}',
      hourly_rate_aud: 100,
      weekly_capacity_hours: 20,
    });
    const result = transitionCandidateStage(
      "c_bench_entry",
      "bench",
      { by: "admin", nowMs: NOW },
      testDb,
    );
    expect(result.bench_status).toBe("active");
  });

  it("clears bench fields on bench exit", () => {
    seedCandidate("c_bench_exit", {
      stage: "bench",
      bench_status: "active",
      paused_until_ms: null,
      abn: "12345678901",
      agreement_signed_at_ms: NOW,
      bank_details: '{"bsb":"000000","account":"12345678"}',
      hourly_rate_aud: 100,
      weekly_capacity_hours: 20,
    });
    const result = transitionCandidateStage(
      "c_bench_exit",
      "archived",
      { by: "admin", nowMs: NOW },
      testDb,
    );
    expect(result.bench_status).toBeNull();
    expect(result.paused_until_ms).toBeNull();
  });

  it("blocks bench entry without compliance", () => {
    seedCandidate("c_no_compliance", { stage: "screened" });
    expect(() =>
      transitionCandidateStage(
        "c_no_compliance",
        "bench",
        { by: "admin", nowMs: NOW },
        testDb,
      ),
    ).toThrow("abn is required");
  });

  it("writes activity_log on transition", () => {
    seedCandidate("c_log");
    transitionCandidateStage(
      "c_log",
      "invited",
      { by: "admin", nowMs: NOW },
      testDb,
    );
    const logs = testDb
      .select()
      .from(schema.activity_log)
      .where(eq(schema.activity_log.kind, "candidate_invited"))
      .all();
    expect(logs.length).toBeGreaterThanOrEqual(1);
    const log = logs[0];
    expect((log.meta as Record<string, unknown>).from_stage).toBe("sourced");
    expect((log.meta as Record<string, unknown>).to_stage).toBe("invited");
  });

  it("logs candidate_unarchived when leaving archived", () => {
    seedCandidate("c_unarch_log", {
      stage: "archived",
      stage_before_archive: "applied",
      archived_at_ms: NOW - 86400000,
    });
    transitionCandidateStage(
      "c_unarch_log",
      "applied",
      { by: "admin", nowMs: NOW },
      testDb,
    );
    const logs = testDb
      .select()
      .from(schema.activity_log)
      .where(eq(schema.activity_log.kind, "candidate_unarchived"))
      .all();
    expect(logs.length).toBeGreaterThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// Activity log kind coverage
// ---------------------------------------------------------------------------

describe("activity_log kinds", () => {
  it("includes all 17 hiring pipeline kinds", () => {
    const hiringKinds = [
      "candidate_sourced",
      "candidate_invited",
      "candidate_applied",
      "candidate_followup_received",
      "candidate_screened",
      "candidate_trial_sent",
      "candidate_trial_delivered",
      "candidate_trial_reviewed",
      "candidate_benched",
      "candidate_paused",
      "candidate_resumed",
      "candidate_archived",
      "candidate_unarchived",
      "role_brief_opened",
      "role_brief_regenerated",
      "role_brief_closed",
      "trial_skipped",
    ];
    for (const kind of hiringKinds) {
      expect(schema.ACTIVITY_LOG_KINDS).toContain(kind);
    }
  });
});
