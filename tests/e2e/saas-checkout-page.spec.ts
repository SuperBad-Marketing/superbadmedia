/**
 * SB-5 — public `/get-started/checkout` critical-flow E2E.
 *
 * Seeds one active product + Full Suite in the hermetic DB, then
 * asserts page render, tier confirmation text, commitment toggle
 * (Monthly / Annual monthly-billed / Annual upfront), the "all in"
 * flourish on third card, and that a missing/invalid tier query
 * redirects to `/get-started/pricing`.
 *
 * Does NOT exercise live Stripe confirmPayment — the action's
 * Stripe-side behaviour is covered by the hermetic unit tests.
 *
 * Owner: SB-5.
 */
import { test, expect } from "@playwright/test";

import { openTestDb } from "./fixtures/seed-db";
import { seedSb5Checkout, SB5_CHECKOUT } from "../../scripts/seed-sb5-checkout";

test.describe("sb-5 / public checkout page", () => {
  test.beforeAll(async () => {
    const { sqlite, db } = openTestDb();
    try {
      await seedSb5Checkout(db);
    } finally {
      sqlite.close();
    }
  });

  test("renders product + tier name with commitment radios", async ({
    browser,
  }) => {
    const context = await browser.newContext({
      storageState: { cookies: [], origins: [] },
      viewport: { width: 1280, height: 900 },
    });
    const page = await context.newPage();
    try {
      await page.goto(
        `/get-started/checkout?tier=${SB5_CHECKOUT.mediumTierId}&product=${SB5_CHECKOUT.outreachSlug}`,
        { waitUntil: "domcontentloaded" },
      );
      await expect(page.getByTestId("checkout-header")).toBeVisible({
        timeout: 20_000,
      });
      await expect(page.getByTestId("checkout-product-name")).toHaveText(
        "Outreach",
      );
      await expect(page.getByTestId("checkout-tier-name")).toHaveText(
        "Standard",
      );

      const radios = page.getByTestId("checkout-commitment-radios");
      await expect(
        radios.getByTestId("commitment-card-monthly"),
      ).toBeVisible();
      await expect(
        radios.getByTestId("commitment-card-annual_monthly"),
      ).toBeVisible();
      await expect(
        radios.getByTestId("commitment-card-annual_upfront"),
      ).toBeVisible();

      // Default selection is monthly.
      await expect(
        radios.getByTestId("commitment-card-monthly"),
      ).toHaveAttribute("data-selected", "true");
    } finally {
      await context.close();
    }
  });

  test("selecting 'all in' surfaces the flourish + total recomputes", async ({
    browser,
  }) => {
    const context = await browser.newContext({
      storageState: { cookies: [], origins: [] },
      viewport: { width: 1280, height: 900 },
    });
    const page = await context.newPage();
    try {
      await page.goto(
        `/get-started/checkout?tier=${SB5_CHECKOUT.mediumTierId}&product=${SB5_CHECKOUT.outreachSlug}`,
        { waitUntil: "domcontentloaded" },
      );
      const upfrontCard = page.getByTestId("commitment-card-annual_upfront");
      await expect(upfrontCard).toBeVisible({ timeout: 20_000 });
      await upfrontCard.click();
      await expect(upfrontCard).toHaveAttribute("data-selected", "true");
      await expect(page.getByTestId("all-in-flourish")).toBeVisible();

      // Monthly starter setup fee 99 + $99 = $198. Annual upfront = $99 × 12 = $1,188.
      const total = page.getByTestId("checkout-total-line");
      await expect(total).toContainText("1,188");
    } finally {
      await context.close();
    }
  });

  test("missing query params redirect to /get-started/pricing", async ({
    browser,
  }) => {
    const context = await browser.newContext({
      storageState: { cookies: [], origins: [] },
      viewport: { width: 1280, height: 900 },
    });
    const page = await context.newPage();
    try {
      const response = await page.goto("/get-started/checkout", {
        waitUntil: "domcontentloaded",
      });
      // Next server redirect resolves into /get-started/pricing.
      await expect(page).toHaveURL(/\/get-started\/pricing/, {
        timeout: 20_000,
      });
      expect(response?.status()).toBeLessThan(500);
    } finally {
      await context.close();
    }
  });

  test("unknown tier id redirects to /get-started/pricing", async ({
    browser,
  }) => {
    const context = await browser.newContext({
      storageState: { cookies: [], origins: [] },
      viewport: { width: 1280, height: 900 },
    });
    const page = await context.newPage();
    try {
      await page.goto(
        `/get-started/checkout?tier=does-not-exist&product=${SB5_CHECKOUT.outreachSlug}`,
        { waitUntil: "domcontentloaded" },
      );
      await expect(page).toHaveURL(/\/get-started\/pricing/, {
        timeout: 20_000,
      });
    } finally {
      await context.close();
    }
  });
});
