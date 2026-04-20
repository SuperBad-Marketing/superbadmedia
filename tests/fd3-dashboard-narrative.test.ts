import { describe, it, expect } from "vitest";
import {
  buildNarrativePrompt,
  type NarrativeInput,
  type NarrativeOutput,
} from "@/lib/finance/narrative-prompt";

const SAMPLE_METRICS = {
  revenue_mtd_cents: 1240000,
  expenses_mtd_cents: 410000,
  net_cents: 830000,
  mrr_cents: 1110000,
  outstanding_invoices_cents: 320000,
  gst_owed_cents: 124000,
  income_tax_provisioned_cents: 300000,
  yours_to_spend_cents: 140000,
  stripe_balance_cents: 620000,
};

const SAMPLE_PROJECTION = {
  contracted_curve: Array.from({ length: 90 }, (_, i) => ({
    date: `2026-05-${String((i % 28) + 1).padStart(2, "0")}`,
    cents: 3700,
  })),
  pipeline_weighted_curve: Array.from({ length: 90 }, (_, i) => ({
    date: `2026-05-${String((i % 28) + 1).padStart(2, "0")}`,
    cents: 1200,
  })),
  decay_adjusted_curve: Array.from({ length: 90 }, (_, i) => ({
    date: `2026-05-${String((i % 28) + 1).padStart(2, "0")}`,
    cents: 900,
  })),
};

describe("buildNarrativePrompt", () => {
  it("produces a non-empty prompt with current metrics", () => {
    const input: NarrativeInput = {
      snapshot_today: {
        metrics: SAMPLE_METRICS,
        projection: SAMPLE_PROJECTION,
      },
      snapshot_compare: null,
      range_label: "This Month",
      callouts: [],
    };

    const prompt = buildNarrativePrompt(input);
    expect(prompt).toContain("Revenue MTD:");
    expect(prompt).toContain("$12.4k");
    expect(prompt).toContain("This Month");
    expect(prompt).toContain("number_references");
  });

  it("includes month-over-month when compare snapshot provided", () => {
    const input: NarrativeInput = {
      snapshot_today: {
        metrics: SAMPLE_METRICS,
        projection: SAMPLE_PROJECTION,
      },
      snapshot_compare: {
        metrics: {
          ...SAMPLE_METRICS,
          revenue_mtd_cents: 1000000,
        },
        projection: SAMPLE_PROJECTION,
      },
      range_label: "This Month",
      callouts: [],
    };

    const prompt = buildNarrativePrompt(input);
    expect(prompt).toContain("+24%");
  });

  it("includes callout notes when callouts provided", () => {
    const input: NarrativeInput = {
      snapshot_today: {
        metrics: { ...SAMPLE_METRICS, yours_to_spend_cents: -5000 },
        projection: SAMPLE_PROJECTION,
      },
      snapshot_compare: null,
      range_label: "This Month",
      callouts: ["tax_tight"],
    };

    const prompt = buildNarrativePrompt(input);
    expect(prompt).toContain("tax_tight");
    expect(prompt).toContain("buffer is thin");
  });

  it("includes projection_cliff callout", () => {
    const input: NarrativeInput = {
      snapshot_today: {
        metrics: SAMPLE_METRICS,
        projection: SAMPLE_PROJECTION,
      },
      snapshot_compare: null,
      range_label: "This Month",
      callouts: ["projection_cliff"],
    };

    const prompt = buildNarrativePrompt(input);
    expect(prompt).toContain("sharp revenue drop");
  });
});

describe("NarrativeOutput validation shape", () => {
  it("validates correct output shape", () => {
    const output: NarrativeOutput = {
      paragraph_text:
        "Revenue tracking at $12.4k this month. Expenses sitting at $4.1k.",
      number_references: [
        { token: "$12.4k", value_aud: 12400, link_path: "/lite/finance/mrr" },
        {
          token: "$4.1k",
          value_aud: 4100,
          link_path: "/lite/finance/expenses",
        },
      ],
      callout_used: null,
    };

    expect(output.paragraph_text.length).toBeGreaterThan(0);
    expect(output.number_references).toHaveLength(2);
    for (const ref of output.number_references) {
      expect(typeof ref.token).toBe("string");
      expect(typeof ref.value_aud).toBe("number");
      expect(ref.link_path).toMatch(/^\/lite\/finance/);
    }
  });

  it("accepts output with callout_used", () => {
    const output: NarrativeOutput = {
      paragraph_text: "Short month. Yours to spend is tight.",
      number_references: [],
      callout_used: "tax_tight",
    };

    expect(output.callout_used).toBe("tax_tight");
  });
});
