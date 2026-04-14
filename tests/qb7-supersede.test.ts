import fs from "node:fs";
import path from "node:path";
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate as drizzleMigrate } from "drizzle-orm/better-sqlite3/migrator";
import { eq } from "drizzle-orm";

import * as schema from "@/lib/db/schema";

const TEST_DB = path.join(process.cwd(), "tests/.test-qb7-supersede.db");
let sqlite: Database.Database;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let testDb: any;

vi.mock("@/lib/db", () => ({
  get db() {
    return testDb;
  },
}));

// Stub settings so allocateQuoteNumber is happy — sequences table is
// seeded by the real migrations.
const { forkDraftFromSent, finaliseSupersedeOnSend } = await import(
  "@/lib/quote-builder/supersede"
);
const { quotes } = await import("@/lib/db/schema/quotes");
const { companies } = await import("@/lib/db/schema/companies");
const { deals } = await import("@/lib/db/schema/deals");
const { activity_log } = await import("@/lib/db/schema/activity-log");
const { scheduled_tasks } = await import("@/lib/db/schema/scheduled-tasks");
const { user } = await import("@/lib/db/schema/user");

const NOW = 1_700_000_000_000;

function seedQuote(
  id: string,
  status: "draft" | "sent" | "viewed" | "accepted" = "sent",
  overrides: Record<string, unknown> = {},
) {
  testDb
    .insert(quotes)
    .values({
      id,
      deal_id: "deal-1",
      company_id: "co-1",
      token: `tok-${id}`,
      quote_number: `SB-2026-${id}`,
      status,
      structure: "retainer",
      content_json: {
        sections: {
          whatYouToldUs: { prose: "Client context snippet." },
          whatWellDo: {
            line_items: [
              {
                id: "li-1",
                kind: "retainer",
                snapshot: {
                  catalogue_item_id: "cat-1",
                  name: "Retainer base",
                  category: "retainer",
                  unit: "month",
                  base_price_cents_inc_gst: 200000,
                  tier_rank: 1,
                },
                qty: 1,
                unit_price_cents_inc_gst: 200000,
              },
            ],
            prose: "",
          },
          terms: { template_id: null, overrides_prose: "" },
        },
        term_length_months: 6,
      },
      catalogue_snapshot_json: null,
      total_cents_inc_gst: 200000,
      retainer_monthly_cents_inc_gst: 200000,
      one_off_cents_inc_gst: null,
      term_length_months: 6,
      buyout_percentage: 50,
      created_at_ms: NOW,
      sent_at_ms: status === "draft" ? null : NOW,
      ...overrides,
    })
    .run();
}

function seedPendingTask(
  id: string,
  task_type: "quote_reminder_3d" | "quote_expire",
  quoteId: string,
) {
  testDb
    .insert(scheduled_tasks)
    .values({
      id,
      task_type,
      run_at_ms: NOW + 86400_000,
      payload: { quote_id: quoteId },
      status: "pending",
      attempts: 0,
      idempotency_key: `${task_type}:${quoteId}`,
      created_at_ms: NOW,
    })
    .run();
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
  testDb
    .insert(user)
    .values({
      id: "u-1",
      email: "admin@test.test",
      role: "admin",
      created_at_ms: NOW,
      updated_at_ms: NOW,
    })
    .run();
  testDb
    .insert(companies)
    .values({
      id: "co-1",
      name: "Acme",
      name_normalised: "acme",
      first_seen_at_ms: NOW,
      created_at_ms: NOW,
      updated_at_ms: NOW,
    })
    .run();
  testDb
    .insert(deals)
    .values({
      id: "deal-1",
      company_id: "co-1",
      title: "Acme",
      stage: "quoted",
      last_stage_change_at_ms: NOW,
      created_at_ms: NOW,
      updated_at_ms: NOW,
    })
    .run();
});

afterAll(() => {
  sqlite.close();
  for (const ext of ["", "-wal", "-shm"]) {
    const p = `${TEST_DB}${ext}`;
    if (fs.existsSync(p)) fs.unlinkSync(p);
  }
});

beforeEach(() => {
  testDb.delete(activity_log).run();
  testDb.delete(scheduled_tasks).run();
  testDb.delete(quotes).run();
});

describe("QB-7 — forkDraftFromSent", () => {
  it("creates a new draft with supersedes_quote_id set", async () => {
    seedQuote("q-src", "sent");
    const result = await forkDraftFromSent({
      source_quote_id: "q-src",
      user_id: "u-1",
    });
    expect(result.ok).toBe(true);
    expect(result.quote).toBeTruthy();
    expect(result.quote!.status).toBe("draft");
    expect(result.quote!.supersedes_quote_id).toBe("q-src");
    // Fresh token — never reuses source's token.
    expect(result.quote!.token).not.toBe("tok-q-src");
    // Source row untouched.
    const src = testDb
      .select()
      .from(quotes)
      .where(eq(quotes.id, "q-src"))
      .get();
    expect(src.status).toBe("sent");
  });

  it("forks from a viewed source too", async () => {
    seedQuote("q-src", "viewed");
    const result = await forkDraftFromSent({
      source_quote_id: "q-src",
      user_id: "u-1",
    });
    expect(result.ok).toBe(true);
  });

  it("is idempotent — second call returns the existing open fork", async () => {
    seedQuote("q-src", "sent");
    const a = await forkDraftFromSent({
      source_quote_id: "q-src",
      user_id: "u-1",
    });
    const b = await forkDraftFromSent({
      source_quote_id: "q-src",
      user_id: "u-1",
    });
    expect(a.quote!.id).toBe(b.quote!.id);
  });

  it("refuses to fork from a terminal source", async () => {
    seedQuote("q-src", "accepted");
    const result = await forkDraftFromSent({
      source_quote_id: "q-src",
      user_id: "u-1",
    });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/source_not_live/);
  });
});

describe("QB-7 — finaliseSupersedeOnSend", () => {
  it("atomically transitions old→superseded + new→sent", async () => {
    seedQuote("q-old", "sent");
    const fork = await forkDraftFromSent({
      source_quote_id: "q-old",
      user_id: "u-1",
    });
    const newId = fork.quote!.id;

    const result = await finaliseSupersedeOnSend({
      new_quote_id: newId,
      thread_message_id: "msg-new",
    });
    expect(result.ok).toBe(true);

    const oldRow = testDb
      .select()
      .from(quotes)
      .where(eq(quotes.id, "q-old"))
      .get();
    const newRow = testDb.select().from(quotes).where(eq(quotes.id, newId)).get();
    expect(oldRow.status).toBe("superseded");
    expect(oldRow.superseded_at_ms).toBeTypeOf("number");
    expect(oldRow.superseded_by_quote_id).toBe(newId);
    expect(newRow.status).toBe("sent");
    expect(newRow.sent_at_ms).toBeTypeOf("number");
    expect(newRow.thread_message_id).toBe("msg-new");
  });

  it("flips pending scheduled_tasks on the old row to skipped", async () => {
    seedQuote("q-old", "sent");
    seedPendingTask("t-old-1", "quote_reminder_3d", "q-old");
    seedPendingTask("t-old-2", "quote_expire", "q-old");
    const fork = await forkDraftFromSent({
      source_quote_id: "q-old",
      user_id: "u-1",
    });
    await finaliseSupersedeOnSend({ new_quote_id: fork.quote!.id });

    const t1 = testDb
      .select()
      .from(scheduled_tasks)
      .where(eq(scheduled_tasks.id, "t-old-1"))
      .get();
    const t2 = testDb
      .select()
      .from(scheduled_tasks)
      .where(eq(scheduled_tasks.id, "t-old-2"))
      .get();
    expect(t1.status).toBe("skipped");
    expect(t2.status).toBe("skipped");
  });

  it("logs quote_superseded with old + new ids", async () => {
    seedQuote("q-old", "sent");
    const fork = await forkDraftFromSent({
      source_quote_id: "q-old",
      user_id: "u-1",
    });
    await finaliseSupersedeOnSend({ new_quote_id: fork.quote!.id });

    const logs = testDb.select().from(activity_log).all();
    const log = logs.find(
      (l: { kind: string }) => l.kind === "quote_superseded",
    );
    expect(log).toBeTruthy();
    expect(log.meta.old_quote_id).toBe("q-old");
    expect(log.meta.new_quote_id).toBe(fork.quote!.id);
  });

  it("refuses when the old row has gone terminal before send", async () => {
    seedQuote("q-old", "sent");
    const fork = await forkDraftFromSent({
      source_quote_id: "q-old",
      user_id: "u-1",
    });
    // Mid-edit, client accepted the old one.
    testDb
      .update(quotes)
      .set({ status: "accepted", accepted_at_ms: NOW })
      .where(eq(quotes.id, "q-old"))
      .run();

    const result = await finaliseSupersedeOnSend({
      new_quote_id: fork.quote!.id,
    });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/old_terminal/);
    // New draft must NOT have been transitioned.
    const newRow = testDb
      .select()
      .from(quotes)
      .where(eq(quotes.id, fork.quote!.id))
      .get();
    expect(newRow.status).toBe("draft");
  });

  it("refuses when new row has no supersedes_quote_id", async () => {
    seedQuote("q-naked", "draft");
    const result = await finaliseSupersedeOnSend({ new_quote_id: "q-naked" });
    expect(result.ok).toBe(false);
    expect(result.error).toBe("new_has_no_source");
  });
});
