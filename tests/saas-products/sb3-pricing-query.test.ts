/**
 * SB-3 — `listActivePricingProducts` query + `buildPricingPageViewModel`
 * pure view-model builder.
 *
 * Brief G3 named `sb3-pricing-query.test.ts` (query) + `sb3-pricing-page.test.tsx`
 * (RTL). RTL dep would violate G7 (zero new packages), so the page
 * component's testable surface is split out as a pure function
 * (`buildPricingPageViewModel`) and exercised here alongside the query.
 * Silent reconcile per `feedback_technical_decisions_claude_calls`.
 *
 * Owner: SB-3.
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
  vi,
} from "vitest";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate as drizzleMigrate } from "drizzle-orm/better-sqlite3/migrator";
import { runSeeds } from "@/lib/db/migrate";

let testDb: ReturnType<typeof drizzle>;

vi.mock("@/lib/db", () => ({
  get db() {
    return testDb;
  },
}));

const TEST_DB = path.join(process.cwd(), "tests/.test-sb3-pricing-query.db");
let sqlite: Database.Database;

const NOW = 1_700_000_000_000;

beforeAll(() => {
  if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);
  sqlite = new Database(TEST_DB);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  testDb = drizzle(sqlite);
  const folder = path.join(process.cwd(), "lib/db/migrations");
  drizzleMigrate(testDb, { migrationsFolder: folder });
  runSeeds(sqlite, folder);
});

afterAll(() => {
  sqlite.close();
  for (const suffix of ["", "-wal", "-shm"]) {
    const p = `${TEST_DB}${suffix}`;
    if (fs.existsSync(p)) fs.unlinkSync(p);
  }
});

beforeEach(() => {
  sqlite.prepare("DELETE FROM saas_tier_limits").run();
  sqlite.prepare("DELETE FROM saas_tiers").run();
  sqlite.prepare("DELETE FROM saas_usage_dimensions").run();
  sqlite.prepare("DELETE FROM saas_products").run();
});

function seedProduct(
  id: string,
  slug: string,
  name: string,
  status: "draft" | "active" | "archived",
  order = 0,
  createdAt = NOW,
) {
  sqlite
    .prepare(
      `INSERT INTO saas_products (id, name, description, slug, status, demo_enabled, display_order, created_at_ms, updated_at_ms)
       VALUES (?, ?, NULL, ?, ?, 0, ?, ?, ?)`,
    )
    .run(id, name, slug, status, order, createdAt, createdAt);
}

function seedDimension(id: string, productId: string, key: string, order = 0) {
  sqlite
    .prepare(
      `INSERT INTO saas_usage_dimensions (id, product_id, dimension_key, display_name, display_order, created_at_ms)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(id, productId, key, `Display ${key}`, order, NOW);
}

function seedTier(
  id: string,
  productId: string,
  rank: number,
  monthlyCents: number,
  opts: {
    flags?: Record<string, boolean>;
    setupFeeCents?: number;
    stripeMonthly?: string | null;
  } = {},
) {
  sqlite
    .prepare(
      `INSERT INTO saas_tiers (id, product_id, name, tier_rank, monthly_price_cents_inc_gst, setup_fee_cents_inc_gst, feature_flags, stripe_monthly_price_id, stripe_annual_price_id, stripe_upfront_price_id, created_at_ms, updated_at_ms)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      id,
      productId,
      `Tier ${rank}`,
      rank,
      monthlyCents,
      opts.setupFeeCents ?? 0,
      JSON.stringify(opts.flags ?? { feature_alpha: true }),
      opts.stripeMonthly === undefined
        ? `price_m_${id}`
        : opts.stripeMonthly,
      `price_a_${id}`,
      `price_u_${id}`,
      NOW,
      NOW,
    );
}

function seedLimit(
  id: string,
  tierId: string,
  dimensionId: string,
  value: number | null,
) {
  sqlite
    .prepare(
      `INSERT INTO saas_tier_limits (id, tier_id, dimension_id, limit_value)
       VALUES (?, ?, ?, ?)`,
    )
    .run(id, tierId, dimensionId, value);
}

describe("SB-3 / listActivePricingProducts", () => {
  it("returns empty array when nothing is active", async () => {
    seedProduct("p_draft", "p-draft", "Drafty", "draft");
    seedProduct("p_archived", "p-archived", "Gone", "archived");

    const { listActivePricingProducts } = await import(
      "@/lib/saas-products/queries"
    );
    const rows = await listActivePricingProducts();
    expect(rows).toEqual([]);
  });

  it("returns only active products with full dimensions + tiers + limits", async () => {
    seedProduct("p_active", "outreach", "Outreach", "active", 0, NOW);
    seedProduct("p_draft", "p-draft", "Drafty", "draft", 0, NOW + 1);
    seedDimension("d_sends", "p_active", "sends", 0);
    seedDimension("d_seats", "p_active", "seats", 1);
    seedTier("t_s", "p_active", 1, 4900);
    seedTier("t_m", "p_active", 2, 9900);
    seedTier("t_l", "p_active", 3, 19900);
    seedLimit("l1", "t_s", "d_sends", 100);
    seedLimit("l2", "t_m", "d_sends", 500);
    seedLimit("l3", "t_l", "d_sends", null);
    seedLimit("l4", "t_s", "d_seats", 1);
    seedLimit("l5", "t_m", "d_seats", 3);
    // t_l × d_seats intentionally missing

    const { listActivePricingProducts } = await import(
      "@/lib/saas-products/queries"
    );
    const rows = await listActivePricingProducts();
    expect(rows).toHaveLength(1);
    const [p] = rows;
    expect(p.row.slug).toBe("outreach");
    expect(p.dimensions.map((d) => d.dimension_key)).toEqual([
      "sends",
      "seats",
    ]);
    expect(p.tiers.map((t) => t.row.tier_rank)).toEqual([1, 2, 3]);
    // Unlimited surfaces via limit_value === null.
    const large = p.tiers[2];
    expect(large.limitsByDimensionId.get("d_sends")?.limit_value).toBeNull();
    // Missing limit row surfaces as an absent Map entry.
    expect(large.limitsByDimensionId.has("d_seats")).toBe(false);
  });

  it("surfaces a Full Suite product alongside other actives, ordered by display_order + created_at", async () => {
    // Full Suite created later, but display_order is higher → keeps
    // admin-driven ordering.
    seedProduct("p_outreach", "outreach", "Outreach", "active", 0, NOW);
    seedProduct("p_ads", "ads", "Ads", "active", 1, NOW + 1);
    seedProduct("p_full", "full-suite", "Full Suite", "active", 2, NOW + 2);
    seedTier("t_out", "p_outreach", 3, 19900);
    seedTier("t_ads", "p_ads", 3, 14900);
    seedTier("t_full", "p_full", 3, 29900);

    const { listActivePricingProducts } = await import(
      "@/lib/saas-products/queries"
    );
    const rows = await listActivePricingProducts();
    expect(rows.map((r) => r.row.slug)).toEqual([
      "outreach",
      "ads",
      "full-suite",
    ]);
  });
});

describe("SB-3 / buildPricingPageViewModel", () => {
  it("marks isEmpty when input is empty", async () => {
    const { buildPricingPageViewModel } = await import(
      "@/lib/saas-products/pricing-page-view-model"
    );
    const vm = buildPricingPageViewModel([]);
    expect(vm.isEmpty).toBe(true);
    expect(vm.products).toEqual([]);
    expect(vm.fullSuite).toBeNull();
  });

  it("splits Full Suite out of the per-product grid + computes savings", async () => {
    seedProduct("p_outreach", "outreach", "Outreach", "active", 0, NOW);
    seedProduct("p_ads", "ads", "Ads", "active", 1, NOW + 1);
    seedProduct("p_full", "full-suite", "Full Suite", "active", 2, NOW + 2);
    seedTier("t_out", "p_outreach", 3, 19900);
    seedTier("t_ads", "p_ads", 3, 14900);
    seedTier("t_full", "p_full", 3, 29900);

    const { listActivePricingProducts } = await import(
      "@/lib/saas-products/queries"
    );
    const { buildPricingPageViewModel } = await import(
      "@/lib/saas-products/pricing-page-view-model"
    );
    const vm = buildPricingPageViewModel(await listActivePricingProducts());
    expect(vm.products.map((c) => c.slug)).toEqual(["outreach", "ads"]);
    expect(vm.fullSuite).not.toBeNull();
    expect(vm.fullSuite!.savings.kind).toBe("computed");
    if (vm.fullSuite!.savings.kind === "computed") {
      expect(vm.fullSuite!.savings.individualSumPerMonthCents).toBe(
        19900 + 14900,
      );
      expect(vm.fullSuite!.savings.monthlySavingsCents).toBe(
        19900 + 14900 - 29900,
      );
    }
  });

  it("falls back on savings line when only Full Suite is active", async () => {
    seedProduct("p_full", "full-suite", "Full Suite", "active", 0, NOW);
    seedTier("t_full", "p_full", 3, 29900);

    const { listActivePricingProducts } = await import(
      "@/lib/saas-products/queries"
    );
    const { buildPricingPageViewModel } = await import(
      "@/lib/saas-products/pricing-page-view-model"
    );
    const vm = buildPricingPageViewModel(await listActivePricingProducts());
    expect(vm.products).toEqual([]);
    expect(vm.fullSuite!.savings.kind).toBe("fallback");
  });

  it("falls back when Full Suite is priced at or above the individual sum (no negative savings)", async () => {
    seedProduct("p_outreach", "outreach", "Outreach", "active", 0, NOW);
    seedProduct("p_full", "full-suite", "Full Suite", "active", 1, NOW + 1);
    seedTier("t_out", "p_outreach", 3, 9900);
    seedTier("t_full", "p_full", 3, 12900);

    const { listActivePricingProducts } = await import(
      "@/lib/saas-products/queries"
    );
    const { buildPricingPageViewModel } = await import(
      "@/lib/saas-products/pricing-page-view-model"
    );
    const vm = buildPricingPageViewModel(await listActivePricingProducts());
    expect(vm.fullSuite!.savings.kind).toBe("fallback");
  });

  it("marks tier unavailable when stripe_monthly_price_id is missing", async () => {
    seedProduct("p_out", "outreach", "Outreach", "active");
    seedTier("t1", "p_out", 1, 4900, { stripeMonthly: null });
    seedTier("t2", "p_out", 2, 9900);

    const { listActivePricingProducts } = await import(
      "@/lib/saas-products/queries"
    );
    const { buildPricingPageViewModel } = await import(
      "@/lib/saas-products/pricing-page-view-model"
    );
    const vm = buildPricingPageViewModel(await listActivePricingProducts());
    const [col] = vm.products;
    expect(col.tiers[0].available).toBe(false);
    expect(col.tiers[1].available).toBe(true);
  });

  it("humanises feature-flag keys + formats prices + handles null limits", async () => {
    seedProduct("p_out", "outreach", "Outreach", "active");
    seedDimension("d_sends", "p_out", "sends", 0);
    seedTier("t1", "p_out", 3, 19950, {
      flags: { api_access: true, disabled_flag: false, ai_drafts: true },
    });
    seedLimit("l1", "t1", "d_sends", null);

    const { listActivePricingProducts } = await import(
      "@/lib/saas-products/queries"
    );
    const { buildPricingPageViewModel, formatCentsAud, humaniseFlagKey } =
      await import("@/lib/saas-products/pricing-page-view-model");
    const vm = buildPricingPageViewModel(await listActivePricingProducts());
    const tier = vm.products[0].tiers[0];
    // Enabled flags only, in insertion order.
    expect(tier.featureFlags).toEqual(["api_access", "ai_drafts"]);
    expect(humaniseFlagKey("api_access")).toBe("API access");
    expect(humaniseFlagKey("ai_drafts")).toBe("AI drafts");
    expect(humaniseFlagKey("simple_key")).toBe("Simple key");
    // GST-inclusive formatter preserves trailing .50 only when non-zero cents.
    expect(formatCentsAud(19950)).toBe("199.50");
    expect(formatCentsAud(19900)).toBe("199");
    // Null limit flows through as unlimited.
    expect(tier.limitEntries[0].limitValue).toBeNull();
    expect(tier.limitEntries[0].missing).toBe(false);
  });
});
