import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Export periods ──────────────────────────────────────────────────────

describe("export-periods", () => {
  it("returns 2 BAS quarter presets from getBasPresets", async () => {
    const { getBasPresets } = await import("@/lib/finance/export-periods");
    const presets = getBasPresets(new Date("2026-05-15"));
    expect(presets).toHaveLength(2);
    expect(presets[0].label).toContain("BAS");
    expect(presets[0].start).toBeDefined();
    expect(presets[0].end).toBeDefined();
    expect(presets[1].label).toContain("BAS");
  });

  it("returns 2 FY presets from getFyPresets", async () => {
    const { getFyPresets } = await import("@/lib/finance/export-periods");
    const presets = getFyPresets(new Date("2026-05-15"));
    expect(presets).toHaveLength(2);
    expect(presets[0].label).toContain("FY");
    expect(presets[1].label).toContain("FY");
  });

  it("getAllPresets returns 4 presets (2 BAS + 2 FY)", async () => {
    const { getAllPresets } = await import("@/lib/finance/export-periods");
    const presets = getAllPresets(new Date("2026-05-15"));
    expect(presets).toHaveLength(4);
  });

  it("customPeriod creates a labeled period", async () => {
    const { customPeriod } = await import("@/lib/finance/export-periods");
    const p = customPeriod("2026-01-01", "2026-03-31");
    expect(p.start).toBe("2026-01-01");
    expect(p.end).toBe("2026-03-31");
    expect(p.label).toContain("Custom");
  });

  it("BAS quarter for Jan date returns Q3 (Jan–Mar)", async () => {
    const { getBasPresets } = await import("@/lib/finance/export-periods");
    const presets = getBasPresets(new Date("2026-01-15"));
    // Current quarter is Q3, so the last two completed quarters should be Q2 and Q1
    expect(presets[0].label).toContain("Oct–Dec");
    expect(presets[1].label).toContain("Jul–Sep");
  });

  it("Australian FY start in August yields current FY starting July", async () => {
    const { getFyPresets } = await import("@/lib/finance/export-periods");
    const presets = getFyPresets(new Date("2026-08-15"));
    expect(presets[0].label).toContain("2026–2027");
    expect(presets[0].start).toBe("2026-07-01");
    expect(presets[0].end).toBe("2027-06-30");
  });
});

// ── PDF templates ──────────────────────────────────────────────────────

describe("pdf-templates", () => {
  it("builds BAS PDF HTML with correct period info", async () => {
    const { buildBasPdfHtml } = await import("@/lib/finance/pdf-templates");
    const html = buildBasPdfHtml({
      period: { start: "2026-01-01", end: "2026-03-31", label: "BAS Q3 2026 (Jan–Mar)" },
      gst_collected_inc: 1200,
      gst_collected_ex: 1200,
      gst_paid_on_expenses: 400,
      net_gst_payable: 800,
      total_revenue_inc: 13200,
      total_revenue_ex: 12000,
      total_expenses_inc: 4400,
      total_expenses_ex: 4000,
    });
    expect(html).toContain("BAS Summary");
    expect(html).toContain("BAS Q3 2026");
    expect(html).toContain("$800.00"); // net GST payable
    expect(html).toContain("SuperBad Media");
  });

  it("builds P&L PDF HTML with expense breakdown", async () => {
    const { buildPandLPdfHtml } = await import("@/lib/finance/pdf-templates");
    const html = buildPandLPdfHtml({
      period: { start: "2026-01-01", end: "2026-03-31", label: "Q1 2026" },
      revenue_inc_gst: 10000,
      revenue_ex_gst: 9090.91,
      expenses_inc_gst: 3000,
      expenses_ex_gst: 2727.27,
      net_profit_inc_gst: 7000,
      net_profit_ex_gst: 6363.64,
      expense_breakdown: [
        { category: "software_subscriptions", label: "Software subscriptions", total_inc_gst: 2000, total_ex_gst: 1818.18 },
        { category: "api_costs", label: "API costs", total_inc_gst: 1000, total_ex_gst: 909.09 },
      ],
    });
    expect(html).toContain("Profit &amp; Loss");
    expect(html).toContain("Software subscriptions");
    expect(html).toContain("API costs");
  });

  it("exportFilename produces a slugified name", async () => {
    const { exportFilename } = await import("@/lib/finance/pdf-templates");
    const name = exportFilename("BAS Q3 2026 (Jan–Mar)");
    expect(name).toMatch(/^superbad-finance-bas-q3-2026-jan-mar-\d{4}-\d{2}-\d{2}$/);
  });
});

// ── Finance health banners ─────────────────────────────────────────────

describe("getFinanceHealthBanners", () => {
  it("module exports the function", async () => {
    const { getFinanceHealthBanners } = await import("@/lib/finance/cockpit");
    expect(typeof getFinanceHealthBanners).toBe("function");
  });
});

// ── Finance tax rates wizard ───────────────────────────────────────────

describe("finance-tax-rates wizard", () => {
  it("registers in the wizard registry", async () => {
    // Import the defs barrel to trigger registration
    await import("@/lib/wizards/defs/index");
    const { getWizard } = await import("@/lib/wizards/registry");
    const wiz = getWizard("finance-tax-rates");
    expect(wiz).toBeDefined();
    expect(wiz!.key).toBe("finance-tax-rates");
    expect(wiz!.audience).toBe("admin");
    expect(wiz!.steps).toHaveLength(3);
  });
});

// ── Finance export schema ──────────────────────────────────────────────

describe("finance-exports schema", () => {
  it("exports the table and types", async () => {
    const { finance_exports, FINANCE_EXPORT_STATUSES } = await import(
      "@/lib/db/schema/finance-exports"
    );
    expect(finance_exports).toBeDefined();
    expect(FINANCE_EXPORT_STATUSES).toContain("pending");
    expect(FINANCE_EXPORT_STATUSES).toContain("ready");
    expect(FINANCE_EXPORT_STATUSES).toContain("purged");
  });
});

// ── Compliance milestones schema ───────────────────────────────────────

describe("compliance-milestones schema", () => {
  it("exports kinds", async () => {
    const { COMPLIANCE_MILESTONE_KINDS } = await import(
      "@/lib/db/schema/compliance-milestones"
    );
    expect(COMPLIANCE_MILESTONE_KINDS).toContain("bas_filed");
    expect(COMPLIANCE_MILESTONE_KINDS).toContain("eofy_filed");
  });
});

// ── Handler registration ───────────────────────────────────────────────

describe("handler exports", () => {
  it("finance_export_retention_purge handler exports a HandlerMap", async () => {
    const { FINANCE_EXPORT_RETENTION_PURGE_HANDLERS } = await import(
      "@/lib/scheduled-tasks/handlers/finance-export-retention-purge"
    );
    expect(FINANCE_EXPORT_RETENTION_PURGE_HANDLERS).toHaveProperty("finance_export_retention_purge");
    expect(typeof FINANCE_EXPORT_RETENTION_PURGE_HANDLERS.finance_export_retention_purge).toBe("function");
  });
});

// ── Scheduled task type enum ───────────────────────────────────────────

describe("scheduled task types", () => {
  it("includes finance_export_generate and retention_purge", async () => {
    const { SCHEDULED_TASK_TYPES } = await import(
      "@/lib/db/schema/scheduled-tasks"
    );
    expect(SCHEDULED_TASK_TYPES).toContain("finance_export_generate");
    expect(SCHEDULED_TASK_TYPES).toContain("finance_export_retention_purge");
  });
});
