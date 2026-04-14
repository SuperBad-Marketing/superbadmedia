/**
 * SP-5: advanceTrialShootStatus() + advanceTrialShootStatusOnFeedback()
 * + updateTrialShootPlan() unit tests. Hermetic sqlite.
 */
import fs from "node:fs";
import path from "node:path";
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate as drizzleMigrate } from "drizzle-orm/better-sqlite3/migrator";
import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { companies, type TrialShootStatus } from "@/lib/db/schema/companies";
import { activity_log } from "@/lib/db/schema/activity-log";
import {
  advanceTrialShootStatus,
  advanceTrialShootStatusOnFeedback,
} from "@/lib/crm/advance-trial-shoot-status";
import { updateTrialShootPlan } from "@/lib/crm/update-trial-shoot-plan";

const TEST_DB = path.join(process.cwd(), "tests/.test-sp5-trial-shoot.db");
let sqlite: Database.Database;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let db: ReturnType<typeof drizzle<any>>;

beforeAll(() => {
  for (const ext of ["", "-wal", "-shm"]) {
    const p = `${TEST_DB}${ext}`;
    if (fs.existsSync(p)) fs.unlinkSync(p);
  }
  sqlite = new Database(TEST_DB);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  db = drizzle(sqlite);
  drizzleMigrate(db, {
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

beforeEach(() => {
  sqlite.exec(
    "DELETE FROM activity_log; DELETE FROM deals; DELETE FROM contacts; DELETE FROM companies;",
  );
});

const NOW = 1_800_000_000_000;

function seedCompany(status: TrialShootStatus = "none"): string {
  const id = randomUUID();
  db.insert(companies)
    .values({
      id,
      name: "Acme",
      name_normalised: "acme",
      billing_mode: "stripe",
      do_not_contact: false,
      trial_shoot_status: status,
      first_seen_at_ms: NOW,
      created_at_ms: NOW,
      updated_at_ms: NOW,
    })
    .run();
  return id;
}

describe("advanceTrialShootStatus", () => {
  it("advances forward and writes an activity row", () => {
    const id = seedCompany("none");
    const { advanced, company } = advanceTrialShootStatus(
      id,
      "booked",
      { by: "user:a", nowMs: NOW + 1000 },
      db,
    );
    expect(advanced).toBe(true);
    expect(company.trial_shoot_status).toBe("booked");
    expect(company.updated_at_ms).toBe(NOW + 1000);
    expect(company.trial_shoot_completed_at_ms).toBeNull();

    const rows = db
      .select()
      .from(activity_log)
      .where(eq(activity_log.company_id, id))
      .all();
    expect(rows).toHaveLength(1);
    expect(rows[0].kind).toBe("note");
    expect(rows[0].meta).toMatchObject({
      kind: "trial_shoot_status_change",
      from: "none",
      to: "booked",
      by: "user:a",
    });
    expect(rows[0].body).toBe("Trial shoot status: none → booked.");
  });

  it("allows skipping steps", () => {
    const id = seedCompany("none");
    const { company } = advanceTrialShootStatus(
      id,
      "in_progress",
      { by: null, nowMs: NOW },
      db,
    );
    expect(company.trial_shoot_status).toBe("in_progress");
  });

  it("stamps completed_at_ms on first completed transition and preserves it thereafter", () => {
    const id = seedCompany("in_progress");
    const first = advanceTrialShootStatus(
      id,
      "completed_awaiting_feedback",
      { by: null, nowMs: NOW + 5_000 },
      db,
    );
    expect(first.company.trial_shoot_completed_at_ms).toBe(NOW + 5_000);

    const second = advanceTrialShootStatus(
      id,
      "completed_feedback_provided",
      { by: null, nowMs: NOW + 10_000 },
      db,
    );
    // should NOT update completed_at on subsequent completed transition
    expect(second.company.trial_shoot_completed_at_ms).toBe(NOW + 5_000);
    expect(second.company.trial_shoot_status).toBe("completed_feedback_provided");
  });

  it("rejects identity transitions", () => {
    const id = seedCompany("planned");
    expect(() =>
      advanceTrialShootStatus(id, "planned", { by: null, nowMs: NOW }, db),
    ).toThrow(/illegal transition/);
    // no activity row written
    const rows = db.select().from(activity_log).all();
    expect(rows).toHaveLength(0);
  });

  it("rejects regression", () => {
    const id = seedCompany("in_progress");
    expect(() =>
      advanceTrialShootStatus(id, "booked", { by: null, nowMs: NOW }, db),
    ).toThrow(/illegal transition/);
  });

  it("throws on unknown company id", () => {
    expect(() =>
      advanceTrialShootStatus(
        "does-not-exist",
        "booked",
        { by: null, nowMs: NOW },
        db,
      ),
    ).toThrow(/not found/);
  });
});

describe("advanceTrialShootStatusOnFeedback", () => {
  it("advances when status is completed_awaiting_feedback", () => {
    const id = seedCompany("completed_awaiting_feedback");
    const { advanced, company } = advanceTrialShootStatusOnFeedback(
      id,
      { by: "system", nowMs: NOW },
      db,
    );
    expect(advanced).toBe(true);
    expect(company.trial_shoot_status).toBe("completed_feedback_provided");
  });

  it("is a silent no-op when status is not awaiting feedback", () => {
    for (const s of [
      "none",
      "booked",
      "planned",
      "in_progress",
      "completed_feedback_provided",
    ] as const) {
      const id = seedCompany(s);
      const { advanced, company } = advanceTrialShootStatusOnFeedback(
        id,
        { by: null, nowMs: NOW },
        db,
      );
      expect(advanced).toBe(false);
      expect(company.trial_shoot_status).toBe(s);
      const rows = db
        .select()
        .from(activity_log)
        .where(eq(activity_log.company_id, id))
        .all();
      expect(rows).toHaveLength(0);
    }
  });

  it("throws on unknown company id", () => {
    expect(() =>
      advanceTrialShootStatusOnFeedback(
        "nope",
        { by: null, nowMs: NOW },
        db,
      ),
    ).toThrow(/not found/);
  });
});

describe("updateTrialShootPlan", () => {
  it("writes plan + activity row", () => {
    const id = seedCompany("booked");
    const updated = updateTrialShootPlan(
      id,
      "Week 1: shoot the product wall. Week 2: capture team stills.",
      { by: "user:andy", nowMs: NOW + 2000 },
      db,
    );
    expect(updated.trial_shoot_plan).toContain("Week 1");
    expect(updated.updated_at_ms).toBe(NOW + 2000);

    const rows = db
      .select()
      .from(activity_log)
      .where(eq(activity_log.company_id, id))
      .all();
    expect(rows).toHaveLength(1);
    expect(rows[0].meta).toMatchObject({
      kind: "trial_shoot_plan_updated",
      by: "user:andy",
    });
  });

  it("trims whitespace and treats empty string as clearing", () => {
    const id = seedCompany("booked");
    updateTrialShootPlan(id, "first", { by: null, nowMs: NOW }, db);
    const cleared = updateTrialShootPlan(id, "   ", { by: null, nowMs: NOW + 1 }, db);
    expect(cleared.trial_shoot_plan).toBeNull();
    const rows = db
      .select()
      .from(activity_log)
      .where(eq(activity_log.company_id, id))
      .all();
    expect(rows).toHaveLength(2);
    expect(rows[1].body).toBe("Trial shoot plan cleared.");
  });

  it("throws on unknown company id", () => {
    expect(() =>
      updateTrialShootPlan("nope", "plan", { by: null, nowMs: NOW }, db),
    ).toThrow(/not found/);
  });
});
