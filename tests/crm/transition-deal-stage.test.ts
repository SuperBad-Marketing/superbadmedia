/**
 * SP-2: transitionDealStage() unit tests.
 * Hermetic in-process SQLite; does not touch dev.db.
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
import { contacts } from "@/lib/db/schema/contacts";
import {
  deals,
  DEAL_STAGES,
  type DealStage,
  type DealInsert,
} from "@/lib/db/schema/deals";
import { activity_log } from "@/lib/db/schema/activity-log";
import {
  transitionDealStage,
  LEGAL_TRANSITIONS,
} from "@/lib/crm/transition-deal-stage";

const TEST_DB = path.join(process.cwd(), "tests/.test-sp2-transition.db");
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

describe("LEGAL_TRANSITIONS matrix", () => {
  it("covers every stage exactly once", () => {
    const keys = Object.keys(LEGAL_TRANSITIONS).sort();
    expect(keys).toEqual([...DEAL_STAGES].sort());
  });

  it("terminates 'won' (no forward edges)", () => {
    expect(LEGAL_TRANSITIONS.won).toEqual([]);
  });

  it("only allows 'lost → lead' out of lost (rekindle only)", () => {
    expect(LEGAL_TRANSITIONS.lost).toEqual(["lead"]);
  });

  it("allows 'quoted → conversation' (backward manual per §3.3)", () => {
    expect(LEGAL_TRANSITIONS.quoted).toContain("conversation");
  });

  it("never lists a stage as a legal transition from itself", () => {
    for (const stage of DEAL_STAGES) {
      expect(LEGAL_TRANSITIONS[stage]).not.toContain(stage);
    }
  });
});

describe("transitionDealStage — happy path", () => {
  it("applies a legal transition, updates timestamps, writes activity_log", () => {
    const { dealId } = seedDeal("lead");
    const nowMs = 1_800_000_000_000;
    const updated = transitionDealStage(
      dealId,
      "contacted",
      { by: "webhook:resend", meta: { event_id: "evt_123" }, nowMs },
      db,
    );
    expect(updated.stage).toBe("contacted");
    expect(updated.last_stage_change_at_ms).toBe(nowMs);
    expect(updated.updated_at_ms).toBe(nowMs);

    const rows = db
      .select()
      .from(activity_log)
      .where(eq(activity_log.deal_id, dealId))
      .all();
    expect(rows).toHaveLength(1);
    expect(rows[0].kind).toBe("stage_change");
    expect(rows[0].created_by).toBe("webhook:resend");
    const meta = rows[0].meta as Record<string, unknown>;
    expect(meta.from_stage).toBe("lead");
    expect(meta.to_stage).toBe("contacted");
    expect(meta.by).toBe("webhook:resend");
    expect(meta.event_id).toBe("evt_123");
  });

  it("resets next_action_overridden_at_ms on transition", () => {
    const { dealId } = seedDeal("lead", {
      next_action_overridden_at_ms: 123,
    });
    const result = transitionDealStage(
      dealId,
      "contacted",
      { by: null },
      db,
    );
    expect(result.next_action_overridden_at_ms).toBeNull();
  });

  it("accepts won when won_outcome is already set", () => {
    const { dealId } = seedDeal("quoted", { won_outcome: "retainer" });
    const result = transitionDealStage(dealId, "won", { by: "admin" }, db);
    expect(result.stage).toBe("won");
  });

  it("allows lost → lead rekindle", () => {
    const { dealId } = seedDeal("lost", { loss_reason: "ghosted" });
    const result = transitionDealStage(dealId, "lead", { by: "admin" }, db);
    expect(result.stage).toBe("lead");
  });
});

describe("transitionDealStage — rejections", () => {
  it("throws for unknown deal id", () => {
    expect(() =>
      transitionDealStage("does-not-exist", "contacted", { by: null }, db),
    ).toThrow(/not found/);
  });

  it("throws on identity transition (from === to)", () => {
    const { dealId } = seedDeal("lead");
    expect(() =>
      transitionDealStage(dealId, "lead", { by: null }, db),
    ).toThrow(/already in stage/);
  });

  it("throws on illegal transitions (won → anything)", () => {
    const { dealId } = seedDeal("quoted", { won_outcome: "retainer" });
    transitionDealStage(dealId, "won", { by: "admin" }, db);
    for (const toStage of DEAL_STAGES.filter((s) => s !== "won")) {
      expect(() =>
        transitionDealStage(dealId, toStage, { by: "admin" }, db),
      ).toThrow(/illegal transition/);
    }
  });

  it("throws on illegal forward jumps (lead → won)", () => {
    const { dealId } = seedDeal("lead");
    expect(() =>
      transitionDealStage(dealId, "won", { by: null }, db),
    ).toThrow(/illegal transition/);
  });

  it("rejects won when won_outcome is missing", () => {
    const { dealId } = seedDeal("quoted");
    expect(() =>
      transitionDealStage(dealId, "won", { by: "admin" }, db),
    ).toThrow(/won_outcome/);
  });

  it("rejects lost when loss_reason is missing", () => {
    const { dealId } = seedDeal("quoted");
    expect(() =>
      transitionDealStage(dealId, "lost", { by: "admin" }, db),
    ).toThrow(/loss_reason/);
  });

  it("does not write activity_log on rejection", () => {
    const { dealId } = seedDeal("lead");
    expect(() =>
      transitionDealStage(dealId, "won", { by: null }, db),
    ).toThrow();
    const rows = db
      .select()
      .from(activity_log)
      .where(eq(activity_log.deal_id, dealId))
      .all();
    expect(rows).toHaveLength(0);
  });
});

describe("LEGAL_TRANSITIONS — full edge coverage", () => {
  it("every legal edge round-trips through transitionDealStage", () => {
    for (const from of DEAL_STAGES) {
      for (const to of LEGAL_TRANSITIONS[from]) {
        const extras: Partial<DealInsert> = {};
        // Seed finalisation fields so the edge landing at won/lost passes
        // validateDeal (the point of this test is the legal-edge shape,
        // not the finalisation rule — which has its own test above).
        if (to === "won") extras.won_outcome = "retainer";
        if (to === "lost") extras.loss_reason = "price";
        // Seeding the deal directly in `from` stage requires the finalisation
        // fields if `from` is terminal too.
        if (from === "won") extras.won_outcome = "retainer";
        if (from === "lost") extras.loss_reason = "ghosted";
        const { dealId } = seedDeal(from, extras);
        const updated = transitionDealStage(dealId, to, { by: "test" }, db);
        expect(updated.stage).toBe(to);
        // Clean between iterations to keep FK-scoped data tidy.
        sqlite.exec(
          "DELETE FROM activity_log; DELETE FROM deals; DELETE FROM contacts; DELETE FROM companies;",
        );
      }
    }
  });

  it("every illegal edge throws", () => {
    for (const from of DEAL_STAGES) {
      const legal = new Set(LEGAL_TRANSITIONS[from]);
      for (const to of DEAL_STAGES) {
        if (to === from || legal.has(to)) continue;
        const extras: Partial<DealInsert> = {};
        if (from === "won") extras.won_outcome = "retainer";
        if (from === "lost") extras.loss_reason = "ghosted";
        const { dealId } = seedDeal(from, extras);
        expect(() =>
          transitionDealStage(dealId, to, { by: "test" }, db),
        ).toThrow(/illegal transition/);
        sqlite.exec(
          "DELETE FROM activity_log; DELETE FROM deals; DELETE FROM contacts; DELETE FROM companies;",
        );
      }
    }
  });
});
