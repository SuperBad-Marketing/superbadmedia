/**
 * SB-12: pure-function tests for `buildMonthlySetupFeeInvoiceItems`.
 * No DB, no Stripe — purely validates the cadence × fee-amount matrix
 * that encodes the spec §4.5 / Q7 invariants.
 */
import { describe, it, expect } from "vitest";
import { buildMonthlySetupFeeInvoiceItems } from "@/lib/billing/setup-fee";

describe("buildMonthlySetupFeeInvoiceItems", () => {
  it("monthly + positive fee → one-item array with exact shape", () => {
    const out = buildMonthlySetupFeeInvoiceItems({
      cadence: "monthly",
      stripeProductId: "prod_abc",
      setupFeeCentsIncGst: 9900,
    });
    expect(out).toEqual({
      add_invoice_items: [
        {
          price_data: {
            currency: "aud",
            product: "prod_abc",
            unit_amount: 9900,
          },
          quantity: 1,
        },
      ],
    });
  });

  it("monthly + zero fee → undefined (no zero-amount invoice line)", () => {
    expect(
      buildMonthlySetupFeeInvoiceItems({
        cadence: "monthly",
        stripeProductId: "prod_abc",
        setupFeeCentsIncGst: 0,
      }),
    ).toBeUndefined();
  });

  it("monthly + negative fee (defensive) → undefined", () => {
    expect(
      buildMonthlySetupFeeInvoiceItems({
        cadence: "monthly",
        stripeProductId: "prod_abc",
        setupFeeCentsIncGst: -1,
      }),
    ).toBeUndefined();
  });

  it("annual_monthly → undefined even with positive fee", () => {
    expect(
      buildMonthlySetupFeeInvoiceItems({
        cadence: "annual_monthly",
        stripeProductId: "prod_abc",
        setupFeeCentsIncGst: 9900,
      }),
    ).toBeUndefined();
  });

  it("annual_upfront → undefined even with positive fee", () => {
    expect(
      buildMonthlySetupFeeInvoiceItems({
        cadence: "annual_upfront",
        stripeProductId: "prod_abc",
        setupFeeCentsIncGst: 9900,
      }),
    ).toBeUndefined();
  });
});
