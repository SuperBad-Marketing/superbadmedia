/**
 * SP-4: snoozeDeal() unit tests. Hermetic sqlite.
 */
import fs from "node:fs";
import path from "node:path";
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate as drizzleMigrate } from "drizzle-orm/better-sqlite3/migrator";
import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { companies } from "@/lib/db/schema/companies";
import { deals } from "@/lib/db/schema/deals";
import { activity_log } from "@/lib/db/schema/activity-log";
import { snoozeDeal } from "@/lib/crm/snooze-deal";

const TEST_DB = path.join(process.cwd(), "tests/.test-sp4-snooze.db");
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
const LATER = NOW + 3 * 24 * 60 * 60 * 1000;

function seedDeal(): string {
  const companyId = randomUUID();
  db.insert(companies)
    .values({
      id: companyId,
      name: "Acme",
      name_normalised: "acme",
      billing_mode: "stripe",
      do_not_contact: false,
      trial_shoot_status: "none",
      first_seen_at_ms: NOW,
      created_at_ms: NOW,
      updated_at_ms: NOW,
    })
    .run();
  const dealId = randomUUID();
  db.insert(deals)
    .values({
      id: dealId,
      company_id: companyId,
      title: "Acme deal",
      stage: "contacted",
      value_estimated: true,
      pause_used_this_commitment: false,
      last_stage_change_at_ms: NOW,
      created_at_ms: NOW,
      updated_at_ms: NOW,
    })
    .run();
  return dealId;
}

describe("snoozeDeal", () => {
  it("writes snoozed_until_ms and a note activity row", () => {
    const dealId = seedDeal();
    const updated = snoozeDeal(
      dealId,
      LATER,
      { by: "user:abc", nowMs: NOW },
      db,
    );
    expect(updated.snoozed_until_ms).toBe(LATER);
    expect(updated.updated_at_ms).toBe(NOW);

    const rows = db
      .select()
      .from(activity_log)
      .where(eq(activity_log.deal_id, dealId))
      .all();
    expect(rows).toHaveLength(1);
    expect(rows[0].kind).toBe("note");
    expect(rows[0].body).toMatch(/^Snoozed until \d{4}-\d{2}-\d{2}\.$/);
    expect(rows[0].meta).toMatchObject({
      kind: "snooze",
      until_ms: LATER,
      by: "user:abc",
    });
    expect(rows[0].created_by).toBe("user:abc");
  });

  it("rejects untilMs in the past", () => {
    const dealId = seedDeal();
    expect(() =>
      snoozeDeal(dealId, NOW - 1000, { by: null, nowMs: NOW }, db),
    ).toThrow(/strictly in the future/);
  });

  it("rejects untilMs equal to now", () => {
    const dealId = seedDeal();
    expect(() =>
      snoozeDeal(dealId, NOW, { by: null, nowMs: NOW }, db),
    ).toThrow(/strictly in the future/);
  });

  it("throws on unknown deal id without writing anything", () => {
    expect(() =>
      snoozeDeal("does-not-exist", LATER, { by: null, nowMs: NOW }, db),
    ).toThrow(/not found/);
    const rows = db.select().from(activity_log).all();
    expect(rows).toHaveLength(0);
  });

  it("overwrites a prior snooze value", () => {
    const dealId = seedDeal();
    snoozeDeal(dealId, LATER, { by: null, nowMs: NOW }, db);
    const longer = LATER + 7 * 24 * 60 * 60 * 1000;
    const updated = snoozeDeal(
      dealId,
      longer,
      { by: null, nowMs: NOW + 1000 },
      db,
    );
    expect(updated.snoozed_until_ms).toBe(longer);
    const rows = db
      .select()
      .from(activity_log)
      .where(eq(activity_log.deal_id, dealId))
      .all();
    expect(rows).toHaveLength(2);
  });
});
