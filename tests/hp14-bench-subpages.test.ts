import fs from "node:fs";
import path from "node:path";
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate as drizzleMigrate } from "drizzle-orm/better-sqlite3/migrator";
import { eq, and } from "drizzle-orm";
import { randomUUID } from "node:crypto";

import * as schema from "@/lib/db/schema";

const TEST_DB = path.join(process.cwd(), "tests/.test-hp14.db");
let sqlite: Database.Database;
let testDb: ReturnType<typeof drizzle>;

beforeAll(() => {
  if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);
  sqlite = new Database(TEST_DB);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  testDb = drizzle(sqlite, { schema });

  const migDir = path.join(process.cwd(), "lib/db/migrations");
  drizzleMigrate(testDb, { migrationsFolder: migDir });

  const journalPath = path.join(migDir, "meta/_journal.json");
  const journal = JSON.parse(fs.readFileSync(journalPath, "utf8")) as {
    entries: { tag: string }[];
  };
  const applied = new Set(journal.entries.map((e) => e.tag));
  for (const file of fs.readdirSync(migDir).sort()) {
    if (!file.endsWith(".sql")) continue;
    const tag = file.replace(/\.sql$/, "");
    if (applied.has(tag)) continue;
    const sql = fs.readFileSync(path.join(migDir, file), "utf8");
    sqlite.exec(sql);
  }
});

afterAll(() => {
  sqlite.close();
  for (const ext of ["", "-wal", "-shm"]) {
    const p = `${TEST_DB}${ext}`;
    if (fs.existsSync(p)) fs.unlinkSync(p);
  }
});

function seedBrief() {
  const id = randomUUID();
  const now = Date.now();
  testDb
    .insert(schema.role_briefs)
    .values({
      id,
      role_name: "Test Role",
      status: "open",
      engagement_type: "contractor",
      created_at_ms: now,
      updated_at_ms: now,
    })
    .run();
  return id;
}

function seedCandidate(roleBriefId: string, overrides?: Record<string, unknown>) {
  const id = randomUUID();
  const now = Date.now();
  testDb
    .insert(schema.candidates)
    .values({
      id,
      role_brief_id: roleBriefId,
      stage: "bench",
      source: "applied",
      name: "Test Contractor",
      email: "test@example.com",
      engagement_type: "contractor",
      bench_status: "active",
      hourly_rate_aud: 50,
      weekly_capacity_hours: 20,
      abn: "12345678901",
      legal_name: "Test Pty Ltd",
      agreement_signed_at_ms: now,
      bank_details: "encrypted_blob",
      onboarding_completed_at_ms: now,
      first_seen_at_ms: now,
      created_at_ms: now,
      updated_at_ms: now,
      ...overrides,
    })
    .run();
  return id;
}

describe("HP-14: contractor_invoices table", () => {
  it("inserts and queries contractor invoices", () => {
    const briefId = seedBrief();
    const candId = seedCandidate(briefId);
    const now = Date.now();

    testDb
      .insert(schema.contractor_invoices)
      .values({
        id: randomUUID(),
        candidate_id: candId,
        amount_aud: 500,
        reference: "INV-001",
        notes: "Week 1 work",
        status: "submitted",
        submitted_at_ms: now,
        created_at_ms: now,
        updated_at_ms: now,
      })
      .run();

    const rows = testDb
      .select()
      .from(schema.contractor_invoices)
      .where(eq(schema.contractor_invoices.candidate_id, candId))
      .all();

    expect(rows).toHaveLength(1);
    expect(rows[0].amount_aud).toBe(500);
    expect(rows[0].reference).toBe("INV-001");
    expect(rows[0].status).toBe("submitted");
  });

  it("cascades on candidate delete", () => {
    const briefId = seedBrief();
    const candId = seedCandidate(briefId);
    const now = Date.now();

    testDb
      .insert(schema.contractor_invoices)
      .values({
        id: randomUUID(),
        candidate_id: candId,
        amount_aud: 100,
        reference: "DEL-TEST",
        status: "submitted",
        submitted_at_ms: now,
        created_at_ms: now,
        updated_at_ms: now,
      })
      .run();

    testDb
      .delete(schema.candidates)
      .where(eq(schema.candidates.id, candId))
      .run();

    const rows = testDb
      .select()
      .from(schema.contractor_invoices)
      .where(eq(schema.contractor_invoices.candidate_id, candId))
      .all();

    expect(rows).toHaveLength(0);
  });

  it("transitions through submitted → approved → paid", () => {
    const briefId = seedBrief();
    const candId = seedCandidate(briefId);
    const now = Date.now();
    const invoiceId = randomUUID();

    testDb
      .insert(schema.contractor_invoices)
      .values({
        id: invoiceId,
        candidate_id: candId,
        amount_aud: 750,
        reference: "INV-LIFECYCLE",
        status: "submitted",
        submitted_at_ms: now,
        created_at_ms: now,
        updated_at_ms: now,
      })
      .run();

    testDb
      .update(schema.contractor_invoices)
      .set({
        status: "approved",
        reviewed_at_ms: now + 1000,
        updated_at_ms: now + 1000,
      })
      .where(eq(schema.contractor_invoices.id, invoiceId))
      .run();

    const approved = testDb
      .select()
      .from(schema.contractor_invoices)
      .where(eq(schema.contractor_invoices.id, invoiceId))
      .get();
    expect(approved?.status).toBe("approved");

    testDb
      .update(schema.contractor_invoices)
      .set({ status: "paid", updated_at_ms: now + 2000 })
      .where(eq(schema.contractor_invoices.id, invoiceId))
      .run();

    const paid = testDb
      .select()
      .from(schema.contractor_invoices)
      .where(eq(schema.contractor_invoices.id, invoiceId))
      .get();
    expect(paid?.status).toBe("paid");
  });
});

describe("HP-14: candidate_edit_requests table", () => {
  it("inserts and queries edit requests", () => {
    const briefId = seedBrief();
    const candId = seedCandidate(briefId);
    const now = Date.now();

    testDb
      .insert(schema.candidate_edit_requests)
      .values({
        id: randomUUID(),
        candidate_id: candId,
        field_name: "hourly_rate_aud",
        old_value: "50",
        new_value: "65",
        status: "pending",
        created_at_ms: now,
      })
      .run();

    const rows = testDb
      .select()
      .from(schema.candidate_edit_requests)
      .where(
        and(
          eq(schema.candidate_edit_requests.candidate_id, candId),
          eq(schema.candidate_edit_requests.status, "pending"),
        ),
      )
      .all();

    expect(rows).toHaveLength(1);
    expect(rows[0].field_name).toBe("hourly_rate_aud");
    expect(rows[0].new_value).toBe("65");
  });

  it("cascades on candidate delete", () => {
    const briefId = seedBrief();
    const candId = seedCandidate(briefId);

    testDb
      .insert(schema.candidate_edit_requests)
      .values({
        id: randomUUID(),
        candidate_id: candId,
        field_name: "abn",
        old_value: "12345678901",
        new_value: "99988877766",
        status: "pending",
        created_at_ms: Date.now(),
      })
      .run();

    testDb
      .delete(schema.candidates)
      .where(eq(schema.candidates.id, candId))
      .run();

    const rows = testDb
      .select()
      .from(schema.candidate_edit_requests)
      .where(eq(schema.candidate_edit_requests.candidate_id, candId))
      .all();

    expect(rows).toHaveLength(0);
  });
});

describe("HP-14: trial_tasks deliverable submission", () => {
  it("marks task as shipped with delivery URL", () => {
    const briefId = seedBrief();
    const candId = seedCandidate(briefId);
    const now = Date.now();
    const taskId = randomUUID();

    testDb
      .insert(schema.trial_tasks)
      .values({
        id: taskId,
        candidate_id: candId,
        role_brief_id: briefId,
        task_description: "Edit product photography",
        budget_cap_aud: 200,
        rate_per_unit_aud: 50,
        rate_unit: "per_hour",
        sent_at_ms: now,
        due_at_ms: now + 7 * 24 * 60 * 60 * 1000,
        disposition: "pending",
        created_at_ms: now,
        updated_at_ms: now,
      })
      .run();

    testDb
      .update(schema.trial_tasks)
      .set({
        delivery_url_or_asset: "https://dropbox.com/deliverable",
        delivered_at_ms: now,
        disposition: "shipped",
        updated_at_ms: now,
      })
      .where(eq(schema.trial_tasks.id, taskId))
      .run();

    const updated = testDb
      .select()
      .from(schema.trial_tasks)
      .where(eq(schema.trial_tasks.id, taskId))
      .get();

    expect(updated?.disposition).toBe("shipped");
    expect(updated?.delivery_url_or_asset).toBe(
      "https://dropbox.com/deliverable",
    );
    expect(updated?.delivered_at_ms).toBe(now);
  });
});

describe("HP-14: availability updates", () => {
  it("toggles pause status", () => {
    const briefId = seedBrief();
    const candId = seedCandidate(briefId);
    const pauseUntil = Date.now() + 14 * 24 * 60 * 60 * 1000;

    testDb
      .update(schema.candidates)
      .set({
        bench_status: "paused",
        paused_until_ms: pauseUntil,
        updated_at_ms: Date.now(),
      })
      .where(eq(schema.candidates.id, candId))
      .run();

    const paused = testDb
      .select()
      .from(schema.candidates)
      .where(eq(schema.candidates.id, candId))
      .get();

    expect(paused?.bench_status).toBe("paused");
    expect(paused?.paused_until_ms).toBe(pauseUntil);

    testDb
      .update(schema.candidates)
      .set({
        bench_status: "active",
        paused_until_ms: null,
        updated_at_ms: Date.now(),
      })
      .where(eq(schema.candidates.id, candId))
      .run();

    const resumed = testDb
      .select()
      .from(schema.candidates)
      .where(eq(schema.candidates.id, candId))
      .get();

    expect(resumed?.bench_status).toBe("active");
    expect(resumed?.paused_until_ms).toBeNull();
  });

  it("updates weekly capacity", () => {
    const briefId = seedBrief();
    const candId = seedCandidate(briefId);

    testDb
      .update(schema.candidates)
      .set({
        weekly_capacity_hours: 35,
        updated_at_ms: Date.now(),
      })
      .where(eq(schema.candidates.id, candId))
      .run();

    const updated = testDb
      .select()
      .from(schema.candidates)
      .where(eq(schema.candidates.id, candId))
      .get();

    expect(updated?.weekly_capacity_hours).toBe(35);
  });
});

describe("HP-14: portfolio URL updates", () => {
  it("updates portfolio_urls_json and clears signal cache", () => {
    const briefId = seedBrief();
    const candId = seedCandidate(briefId, {
      portfolio_urls_json: ["https://old-portfolio.com"],
      portfolio_signal_fetched_at_ms: Date.now(),
    });

    const newUrls = ["https://vimeo.com/new", "https://behance.net/new"];

    testDb
      .update(schema.candidates)
      .set({
        portfolio_urls_json: newUrls,
        portfolio_signal_fetched_at_ms: null,
        updated_at_ms: Date.now(),
      })
      .where(eq(schema.candidates.id, candId))
      .run();

    const updated = testDb
      .select()
      .from(schema.candidates)
      .where(eq(schema.candidates.id, candId))
      .get();

    expect(updated?.portfolio_urls_json).toEqual(newUrls);
    expect(updated?.portfolio_signal_fetched_at_ms).toBeNull();
  });
});
