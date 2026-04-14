import fs from "node:fs";
import path from "node:path";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate as drizzleMigrate } from "drizzle-orm/better-sqlite3/migrator";
import { randomUUID } from "node:crypto";
import {
  ACTIVITY_LOG_KINDS,
  activity_log,
} from "@/lib/db/schema/activity-log";
import { companies } from "@/lib/db/schema/companies";

const TEST_DB = path.join(process.cwd(), "tests/.test-activity-log.db");

let sqlite: Database.Database;
let db: ReturnType<typeof drizzle>;

beforeAll(() => {
  if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);
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

describe("activity_log schema + kind enum", () => {
  it("consolidated kind enum has every spec block represented", () => {
    const set = new Set<string>(ACTIVITY_LOG_KINDS);
    expect(set.size).toBe(ACTIVITY_LOG_KINDS.length);
    // Representative probes from every contributing spec.
    for (const k of [
      "stage_change",
      "cost_anomaly_fired",
      "finance_bas_filed",
      "candidate_trial_reviewed",
      "active_strategy_created",
      "quote_accepted",
      "invoice_sent",
      "assessment_completed",
      "shoot_booked",
      "outreach_sent",
      "content_post_published",
      "draft_generated",
      "portal_chat_message_sent",
      "cockpit_brief_generated",
      "onboarding_completed",
      "saas_subscription_created",
      "wizard_completed",
      "inbox_thread_created",
      "six_week_plan_released",
      "company_shape_updated",
    ]) {
      expect(set.has(k)).toBe(true);
    }
  });

  it("lands at least 200 consolidated kinds", () => {
    expect(ACTIVITY_LOG_KINDS.length).toBeGreaterThanOrEqual(200);
  });

  it("insert + read via Drizzle ORM round-trips", async () => {
    const companyId = randomUUID();
    await db.insert(companies).values({
      id: companyId,
      name: "Test Co",
      name_normalised: "test co",
      billing_mode: "stripe",
      do_not_contact: false,
      trial_shoot_status: "none",
      first_seen_at_ms: Date.now(),
      created_at_ms: Date.now(),
      updated_at_ms: Date.now(),
    });
    const id = randomUUID();
    await db.insert(activity_log).values({
      id,
      company_id: companyId,
      kind: "note",
      body: "test note",
      meta: { source: "test" },
      created_at_ms: Date.now(),
    });
    const rows = await db.select().from(activity_log);
    expect(rows.length).toBe(1);
    expect(rows[0].id).toBe(id);
    expect(rows[0].kind).toBe("note");
    expect(rows[0].meta).toEqual({ source: "test" });
  });
});
