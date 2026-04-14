/**
 * SP-6: finaliseDealAsWon() / finaliseDealAsLost() unit tests.
 * Hermetic in-process SQLite.
 */
import fs from "node:fs";
import path from "node:path";
import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
} from "vitest";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate as drizzleMigrate } from "drizzle-orm/better-sqlite3/migrator";
import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { companies } from "@/lib/db/schema/companies";
import {
  deals,
  type DealStage,
  type DealInsert,
} from "@/lib/db/schema/deals";
import { activity_log } from "@/lib/db/schema/activity-log";
import {
  finaliseDealAsWon,
  finaliseDealAsLost,
} from "@/lib/crm/finalise-deal";

const TEST_DB = path.join(process.cwd(), "tests/.test-sp6-finalise.db");
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

function seedDeal(
  stage: DealStage,
  extras: Partial<DealInsert> = {},
): { dealId: string; companyId: string } {
  const nowMs = 1_700_000_000_000;
  const companyId = randomUUID();
  db.insert(companies)
    .values({
      id: companyId,
      name: "Acme",
      name_normalised: "acme",
      billing_mode: "stripe",
      do_not_contact: false,
      trial_shoot_status: "none",
      first_seen_at_ms: nowMs,
      created_at_ms: nowMs,
      updated_at_ms: nowMs,
    })
    .run();
  const dealId = randomUUID();
  db.insert(deals)
    .values({
      id: dealId,
      company_id: companyId,
      title: "Acme deal",
      stage,
      value_estimated: true,
      pause_used_this_commitment: false,
      last_stage_change_at_ms: nowMs,
      created_at_ms: nowMs,
      updated_at_ms: nowMs,
      ...extras,
    })
    .run();
  return { dealId, companyId };
}

describe("finaliseDealAsWon", () => {
  it("sets won_outcome and transitions to 'won' atomically", () => {
    const { dealId } = seedDeal("quoted");
    const nowMs = 1_800_000_000_000;
    const updated = finaliseDealAsWon(
      dealId,
      { won_outcome: "retainer" },
      { by: "user:admin", nowMs },
      db,
    );
    expect(updated.stage).toBe("won");
    expect(updated.won_outcome).toBe("retainer");
    expect(updated.last_stage_change_at_ms).toBe(nowMs);

    const logRows = db
      .select()
      .from(activity_log)
      .where(eq(activity_log.deal_id, dealId))
      .all();
    expect(logRows).toHaveLength(1);
    expect(logRows[0].kind).toBe("stage_change");
    const meta = logRows[0].meta as Record<string, unknown>;
    expect(meta.from_stage).toBe("quoted");
    expect(meta.to_stage).toBe("won");
    expect(meta.won_outcome).toBe("retainer");
  });

  it("clears stale loss fields when moving to Won", () => {
    const { dealId } = seedDeal("negotiating", {
      loss_reason: "price",
      loss_notes: "too high",
    });
    finaliseDealAsWon(
      dealId,
      { won_outcome: "saas" },
      { by: "user:admin" },
      db,
    );
    const row = db.select().from(deals).where(eq(deals.id, dealId)).get();
    expect(row?.loss_reason).toBeNull();
    expect(row?.loss_notes).toBeNull();
    expect(row?.won_outcome).toBe("saas");
  });

  it("rejects when the stage transition is illegal", () => {
    const { dealId } = seedDeal("lost");
    expect(() =>
      finaliseDealAsWon(
        dealId,
        { won_outcome: "project" },
        { by: "user:admin" },
        db,
      ),
    ).toThrow(/illegal transition/);
  });

  it("accepts all three won_outcome values", () => {
    for (const outcome of ["retainer", "saas", "project"] as const) {
      const { dealId } = seedDeal("quoted");
      const updated = finaliseDealAsWon(
        dealId,
        { won_outcome: outcome },
        { by: "user:admin" },
        db,
      );
      expect(updated.won_outcome).toBe(outcome);
    }
  });
});

describe("finaliseDealAsLost", () => {
  it("sets loss_reason + notes and transitions to 'lost'", () => {
    const { dealId } = seedDeal("negotiating");
    const nowMs = 1_800_000_000_000;
    const updated = finaliseDealAsLost(
      dealId,
      { loss_reason: "price", loss_notes: "15% over budget" },
      { by: "user:admin", nowMs },
      db,
    );
    expect(updated.stage).toBe("lost");
    expect(updated.loss_reason).toBe("price");
    expect(updated.loss_notes).toBe("15% over budget");

    const logRows = db
      .select()
      .from(activity_log)
      .where(eq(activity_log.deal_id, dealId))
      .all();
    expect(logRows).toHaveLength(1);
    const meta = logRows[0].meta as Record<string, unknown>;
    expect(meta.loss_reason).toBe("price");
    expect(meta.loss_notes).toBe("15% over budget");
  });

  it("accepts null notes for non-'other' reasons", () => {
    const { dealId } = seedDeal("conversation");
    const updated = finaliseDealAsLost(
      dealId,
      { loss_reason: "ghosted", loss_notes: null },
      { by: "user:admin" },
      db,
    );
    expect(updated.loss_reason).toBe("ghosted");
    expect(updated.loss_notes).toBeNull();
  });

  it("rejects 'other' without notes (pre-transaction guard)", () => {
    const { dealId } = seedDeal("conversation");
    expect(() =>
      finaliseDealAsLost(
        dealId,
        { loss_reason: "other", loss_notes: null },
        { by: "user:admin" },
        db,
      ),
    ).toThrow(/loss_notes required/);
    expect(() =>
      finaliseDealAsLost(
        dealId,
        { loss_reason: "other", loss_notes: "   " },
        { by: "user:admin" },
        db,
      ),
    ).toThrow(/loss_notes required/);

    // Deal must be untouched — no partial writes.
    const row = db.select().from(deals).where(eq(deals.id, dealId)).get();
    expect(row?.stage).toBe("conversation");
    expect(row?.loss_reason).toBeNull();
  });

  it("rejects when the stage transition is illegal (won is terminal)", () => {
    const { dealId } = seedDeal("won", { won_outcome: "retainer" });
    expect(() =>
      finaliseDealAsLost(
        dealId,
        { loss_reason: "timing", loss_notes: null },
        { by: "user:admin" },
        db,
      ),
    ).toThrow(/illegal transition/);
  });

  it("does not leave the deal in a half-written state if transition fails", () => {
    // Seed in 'won' — illegal to move to 'lost'. The UPDATE inside the
    // transaction should roll back along with the transition failure.
    const { dealId } = seedDeal("won", { won_outcome: "retainer" });
    expect(() =>
      finaliseDealAsLost(
        dealId,
        { loss_reason: "price", loss_notes: "test" },
        { by: "user:admin" },
        db,
      ),
    ).toThrow();
    const row = db.select().from(deals).where(eq(deals.id, dealId)).get();
    expect(row?.stage).toBe("won");
    expect(row?.loss_reason).toBeNull();
    expect(row?.loss_notes).toBeNull();
  });
});
