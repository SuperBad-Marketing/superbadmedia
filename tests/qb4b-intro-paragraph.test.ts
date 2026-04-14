import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate as drizzleMigrate } from "drizzle-orm/better-sqlite3/migrator";
import { eq, inArray } from "drizzle-orm";

import * as schema from "@/lib/db/schema";

const TEST_DB = path.join(process.cwd(), "tests/.test-qb4b-intro.db");
let sqlite: Database.Database;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let testDb: any;

vi.mock("@/lib/db", () => ({
  get db() {
    return testDb;
  },
}));

const { composeIntroParagraph, checkIntroRedraftThrottle } = await import(
  "@/lib/quote-builder/compose-intro-paragraph"
);
const { enqueueTask } = await import("@/lib/scheduled-tasks/enqueue");
const { killSwitches } = await import("@/lib/kill-switches");
const { companies } = await import("@/lib/db/schema/companies");
const { contacts } = await import("@/lib/db/schema/contacts");
const { deals } = await import("@/lib/db/schema/deals");
const { quotes } = await import("@/lib/db/schema/quotes");
const { activity_log } = await import("@/lib/db/schema/activity-log");
const { scheduled_tasks } = await import("@/lib/db/schema/scheduled-tasks");

async function seedDraftQuote(): Promise<{ quoteId: string; dealId: string; companyId: string }> {
  const now = Date.now();
  const companyId = `co_${randomUUID()}`;
  const dealId = `deal_${randomUUID()}`;
  const quoteId = `q_${randomUUID()}`;
  await testDb.insert(companies).values({
    id: companyId,
    name: "Acme Pty Ltd",
    name_normalised: "acme pty ltd",
    billing_mode: "stripe",
    do_not_contact: false,
    trial_shoot_status: "not_booked",
    gst_applicable: true,
    first_seen_at_ms: now,
    created_at_ms: now,
    updated_at_ms: now,
  });
  await testDb.insert(deals).values({
    id: dealId,
    company_id: companyId,
    title: "Acme deal",
    stage: "quoted",
    billing_cadence: "monthly",
    last_stage_change_at_ms: now,
    created_at_ms: now,
    updated_at_ms: now,
  });
  await testDb.insert(quotes).values({
    id: quoteId,
    deal_id: dealId,
    company_id: companyId,
    token: `tok_${randomUUID()}`,
    quote_number: `SB-TEST-${now}-${randomUUID().slice(0, 6)}`,
    status: "draft",
    structure: "project",
    total_cents_inc_gst: 0,
    created_at_ms: now,
  });
  return { quoteId, dealId, companyId };
}

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

beforeEach(async () => {
  await testDb.delete(scheduled_tasks);
  await testDb.delete(activity_log);
  await testDb.delete(quotes);
  await testDb.delete(deals);
  await testDb.delete(contacts);
  await testDb.delete(companies);
});

describe("composeIntroParagraph — empty + kill-switch paths", () => {
  it("returns empty paragraph + low confidence when no sources", async () => {
    const { quoteId } = await seedDraftQuote();
    const result = await composeIntroParagraph({ quote_id: quoteId });
    expect(result.paragraph_text).toBe("");
    expect(result.confidence).toBe("low");
    expect(result.fallbackUsed).toBe(true);
    expect(result.flags.empty).toBe("true");
  });

  it("skips LLM when llm_calls_enabled=false even with sources present", async () => {
    const { quoteId, dealId, companyId } = await seedDraftQuote();
    await testDb.insert(activity_log).values({
      id: randomUUID(),
      company_id: companyId,
      deal_id: dealId,
      kind: "note",
      body: "They want to double down on EOFY push.",
      created_at_ms: Date.now(),
    });
    const restore = killSwitches.llm_calls_enabled;
    (killSwitches as { llm_calls_enabled: boolean }).llm_calls_enabled = false;
    try {
      const result = await composeIntroParagraph({ quote_id: quoteId });
      expect(result.fallbackUsed).toBe(true);
      expect(result.flags.kill_switch).toBe("true");
      expect(result.paragraph_text).toBe("");
    } finally {
      (killSwitches as { llm_calls_enabled: boolean }).llm_calls_enabled = restore;
    }
  });
});

describe("checkIntroRedraftThrottle", () => {
  it("allows under the cap and blocks at the cap", async () => {
    const { quoteId, dealId, companyId } = await seedDraftQuote();
    const now = Date.now();
    for (let i = 0; i < 5; i++) {
      await testDb.insert(activity_log).values({
        id: randomUUID(),
        company_id: companyId,
        deal_id: dealId,
        kind: "note",
        body: `redraft ${i}`,
        meta: { kind: "quote_intro_redrafted", quote_id: quoteId },
        created_at_ms: now - i * 1000,
      });
    }
    const blocked = await checkIntroRedraftThrottle(quoteId, now);
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);

    const later = now + 61 * 60 * 1000;
    const freed = await checkIntroRedraftThrottle(quoteId, later);
    expect(freed.allowed).toBe(true);
    expect(freed.remaining).toBe(5);
  });

  it("other quotes' redrafts do not count against this quote", async () => {
    const a = await seedDraftQuote();
    const otherQuoteId = `q_${randomUUID()}`;
    await testDb.insert(quotes).values({
      id: otherQuoteId,
      deal_id: a.dealId,
      company_id: a.companyId,
      token: `tok_${randomUUID()}`,
      quote_number: `SB-TEST-OTHER-${Date.now()}-${randomUUID().slice(0, 6)}`,
      status: "draft",
      structure: "project",
      total_cents_inc_gst: 0,
      created_at_ms: Date.now(),
      });
    for (let i = 0; i < 5; i++) {
      await testDb.insert(activity_log).values({
        id: randomUUID(),
        company_id: a.companyId,
        deal_id: a.dealId,
        kind: "note",
        body: `redraft-other ${i}`,
        meta: { kind: "quote_intro_redrafted", quote_id: otherQuoteId },
        created_at_ms: Date.now(),
      });
    }
    const result = await checkIntroRedraftThrottle(a.quoteId);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(5);
  });
});

describe("quote_reminder_3d idempotency key shape", () => {
  it("enqueue + mark-skipped share the `quote_reminder_3d:{id}` key", async () => {
    const { quoteId } = await seedDraftQuote();
    await enqueueTask({
      task_type: "quote_reminder_3d",
      runAt: Date.now() + 3 * 24 * 60 * 60 * 1000,
      payload: { quote_id: quoteId },
      idempotencyKey: `quote_reminder_3d:${quoteId}`,
    });
    const pending = await testDb
      .select()
      .from(scheduled_tasks)
      .where(eq(scheduled_tasks.idempotency_key, `quote_reminder_3d:${quoteId}`));
    expect(pending).toHaveLength(1);
    expect(pending[0].status).toBe("pending");

    await enqueueTask({
      task_type: "quote_reminder_3d",
      runAt: Date.now() + 3 * 24 * 60 * 60 * 1000,
      payload: { quote_id: quoteId },
      idempotencyKey: `quote_reminder_3d:${quoteId}`,
    });
    const all = await testDb
      .select()
      .from(scheduled_tasks)
      .where(inArray(scheduled_tasks.task_type, ["quote_reminder_3d"]));
    expect(all).toHaveLength(1);
  });
});
