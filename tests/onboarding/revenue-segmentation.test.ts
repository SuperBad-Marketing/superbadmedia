/**
 * OS-2: Revenue Segmentation validation + schema tests.
 *
 * The server action itself requires `next/headers` (portal session cookie),
 * which is impractical to mock in unit tests. These tests verify the Zod
 * schema, the enum alignment with the companies schema, and the data-write
 * contract via direct DB manipulation.
 */
import fs from "node:fs";
import path from "node:path";
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate as drizzleMigrate } from "drizzle-orm/better-sqlite3/migrator";
import { eq } from "drizzle-orm";
import { companies, REVENUE_RANGES, TEAM_SIZES, BIGGEST_CONSTRAINTS, TWELVE_MONTH_GOALS, INDUSTRY_VERTICALS } from "@/lib/db/schema/companies";
import { z } from "zod";

const TEST_DB = path.join(process.cwd(), "tests/.test-os2-revseg.db");
let sqlite: Database.Database;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let testDb: ReturnType<typeof drizzle<any>>;

// Replicate the action's schema for standalone validation testing
const SubmitRevSegSchema = z.object({
  revenue_range: z.enum(REVENUE_RANGES),
  team_size: z.enum(TEAM_SIZES),
  biggest_constraint: z.enum(BIGGEST_CONSTRAINTS),
  twelve_month_goal: z.enum(TWELVE_MONTH_GOALS),
  industry_vertical: z.enum(INDUSTRY_VERTICALS),
  industry_vertical_other: z.string().max(200).optional().nullable(),
});

beforeAll(() => {
  for (const ext of ["", "-wal", "-shm"]) {
    const p = `${TEST_DB}${ext}`;
    if (fs.existsSync(p)) fs.unlinkSync(p);
  }
  sqlite = new Database(TEST_DB);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  testDb = drizzle(sqlite);
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

beforeEach(() => {
  sqlite.exec("DELETE FROM companies;");
});

describe("Revenue Segmentation schema validation", () => {
  it("accepts valid input with all fields", () => {
    const result = SubmitRevSegSchema.safeParse({
      revenue_range: "500k_1m",
      team_size: "6_15",
      biggest_constraint: "no_time_marketing",
      twelve_month_goal: "grow",
      industry_vertical: "professional_services",
    });
    expect(result.success).toBe(true);
  });

  it("accepts valid input with 'other' industry + free text", () => {
    const result = SubmitRevSegSchema.safeParse({
      revenue_range: "under_250k",
      team_size: "solo",
      biggest_constraint: "burned_before",
      twelve_month_goal: "figure_out",
      industry_vertical: "other",
      industry_vertical_other: "Bespoke ceramics",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid revenue_range", () => {
    const result = SubmitRevSegSchema.safeParse({
      revenue_range: "billion_plus",
      team_size: "solo",
      biggest_constraint: "burned_before",
      twelve_month_goal: "figure_out",
      industry_vertical: "retail",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing required field", () => {
    const result = SubmitRevSegSchema.safeParse({
      revenue_range: "under_250k",
      team_size: "solo",
      // missing biggest_constraint
      twelve_month_goal: "figure_out",
      industry_vertical: "retail",
    });
    expect(result.success).toBe(false);
  });

  it("rejects industry_vertical_other exceeding 200 chars", () => {
    const result = SubmitRevSegSchema.safeParse({
      revenue_range: "under_250k",
      team_size: "solo",
      biggest_constraint: "burned_before",
      twelve_month_goal: "figure_out",
      industry_vertical: "other",
      industry_vertical_other: "x".repeat(201),
    });
    expect(result.success).toBe(false);
  });
});

describe("Revenue Segmentation enum alignment", () => {
  it("REVENUE_RANGES has 5 values matching spec §3.2 Q1", () => {
    expect(REVENUE_RANGES).toHaveLength(5);
    expect(REVENUE_RANGES).toContain("under_250k");
    expect(REVENUE_RANGES).toContain("3m_plus");
  });

  it("TEAM_SIZES has 5 values matching spec §3.2 Q2", () => {
    expect(TEAM_SIZES).toHaveLength(5);
    expect(TEAM_SIZES).toContain("solo");
    expect(TEAM_SIZES).toContain("50_plus");
  });

  it("BIGGEST_CONSTRAINTS has 6 values matching spec §3.2 Q3", () => {
    expect(BIGGEST_CONSTRAINTS).toHaveLength(6);
  });

  it("TWELVE_MONTH_GOALS has 5 values matching spec §3.2 Q4", () => {
    expect(TWELVE_MONTH_GOALS).toHaveLength(5);
  });

  it("INDUSTRY_VERTICALS has 8 values matching spec §3.2 Q5", () => {
    expect(INDUSTRY_VERTICALS).toHaveLength(8);
    expect(INDUSTRY_VERTICALS).toContain("other");
  });
});

describe("Revenue Segmentation data write", () => {
  it("writes Rev Seg columns to an existing company row", () => {
    const now = Date.now();
    sqlite.exec(`
      INSERT INTO companies (id, name, name_normalised, billing_mode, do_not_contact, gst_applicable, payment_terms_days, first_seen_at_ms, created_at_ms, updated_at_ms)
      VALUES ('co-1', 'Test Co', 'test co', 'stripe', 0, 1, 14, ${now}, ${now}, ${now})
    `);

    testDb
      .update(companies)
      .set({
        revenue_range: "500k_1m",
        team_size: "6_15",
        biggest_constraint: "no_time_marketing",
        twelve_month_goal: "scale",
        industry_vertical: "professional_services",
        revenue_segmentation_completed_at_ms: now,
        updated_at_ms: now,
      })
      .where(eq(companies.id, "co-1"))
      .run();

    const row = testDb
      .select()
      .from(companies)
      .where(eq(companies.id, "co-1"))
      .get();

    expect(row?.revenue_range).toBe("500k_1m");
    expect(row?.team_size).toBe("6_15");
    expect(row?.biggest_constraint).toBe("no_time_marketing");
    expect(row?.twelve_month_goal).toBe("scale");
    expect(row?.industry_vertical).toBe("professional_services");
    expect(row?.industry_vertical_other).toBeNull();
    expect(row?.revenue_segmentation_completed_at_ms).toBe(now);
  });

  it("stores industry_vertical_other only when vertical is 'other'", () => {
    const now = Date.now();
    sqlite.exec(`
      INSERT INTO companies (id, name, name_normalised, billing_mode, do_not_contact, gst_applicable, payment_terms_days, first_seen_at_ms, created_at_ms, updated_at_ms)
      VALUES ('co-2', 'Other Co', 'other co', 'stripe', 0, 1, 14, ${now}, ${now}, ${now})
    `);

    testDb
      .update(companies)
      .set({
        revenue_range: "under_250k",
        team_size: "solo",
        biggest_constraint: "burned_before",
        twelve_month_goal: "figure_out",
        industry_vertical: "other",
        industry_vertical_other: "Bespoke ceramics",
        revenue_segmentation_completed_at_ms: now,
        updated_at_ms: now,
      })
      .where(eq(companies.id, "co-2"))
      .run();

    const row = testDb
      .select()
      .from(companies)
      .where(eq(companies.id, "co-2"))
      .get();

    expect(row?.industry_vertical).toBe("other");
    expect(row?.industry_vertical_other).toBe("Bespoke ceramics");
  });
});
