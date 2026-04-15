/**
 * SB-6b — `/lite/onboarding` status-variant dashboard E2E.
 *
 * Seeds two SaaS subscribers (active + past_due) in the hermetic DB, then
 * redeems each magic-link token in a fresh browser context and asserts
 * the correct variant renders with its primary action.
 *
 * Does NOT exercise live Stripe billingPortal.create — the POST route is
 * integration-tested separately; the test clicks the button and asserts
 * the form targets the right endpoint.
 *
 * Owner: SB-6b.
 */
import { test, expect } from "@playwright/test";

import { openTestDb } from "./fixtures/seed-db";
import { seedSb6bE2e, SB6B_E2E } from "../../scripts/seed-sb6b-e2e";

let ACTIVE_TOKEN = "";
let PAST_DUE_TOKEN = "";

test.describe("sb-6b / saas onboarding-gate dashboard", () => {
  test.beforeAll(async () => {
    const { sqlite, db } = openTestDb();
    try {
      const tokens = await seedSb6bE2e(db);
      ACTIVE_TOKEN = tokens.active;
      PAST_DUE_TOKEN = tokens.pastDue;
    } finally {
      sqlite.close();
    }
  });

  test("active subscriber lands on Brand DNA CTA dashboard", async ({
    browser,
  }) => {
    const context = await browser.newContext({
      storageState: { cookies: [], origins: [] },
      viewport: { width: 1280, height: 900 },
    });
    const page = await context.newPage();
    try {
      await page.goto(`/api/auth/magic-link?token=${ACTIVE_TOKEN}`, {
        waitUntil: "domcontentloaded",
      });
      await expect(page).toHaveURL(/\/lite\/onboarding$/, { timeout: 20_000 });

      const root = page.getByTestId("subscriber-onboarding");
      await expect(root).toHaveAttribute("data-variant", "active");

      const summary = page.getByTestId("subscription-summary");
      await expect(summary).toContainText(SB6B_E2E.productName);
      await expect(summary).toContainText(SB6B_E2E.tierName);

      const cta = page.getByTestId("brand-dna-cta");
      await expect(cta).toBeVisible();
      await expect(cta).toHaveAttribute("href", "/lite/brand-dna");
    } finally {
      await context.close();
    }
  });

  test("past_due subscriber lands on billing-portal hero", async ({
    browser,
  }) => {
    const context = await browser.newContext({
      storageState: { cookies: [], origins: [] },
      viewport: { width: 1280, height: 900 },
    });
    const page = await context.newPage();
    try {
      await page.goto(`/api/auth/magic-link?token=${PAST_DUE_TOKEN}`, {
        waitUntil: "domcontentloaded",
      });
      await expect(page).toHaveURL(/\/lite\/onboarding$/, { timeout: 20_000 });

      const root = page.getByTestId("subscriber-onboarding");
      await expect(root).toHaveAttribute("data-variant", "past_due");

      const hero = page.getByTestId("billing-portal-hero");
      await expect(hero).toBeVisible();

      const button = page.getByTestId("billing-portal-button");
      await expect(button).toBeVisible();

      // The submit button is inside a form targetting the billing-portal
      // route — assert that without firing the POST (no live Stripe).
      const formAction = await button.evaluate((btn) =>
        (btn.closest("form") as HTMLFormElement | null)?.getAttribute("action"),
      );
      expect(formAction).toBe("/api/stripe/billing-portal");

      // Brand DNA CTA should NOT render on the past_due variant.
      await expect(page.getByTestId("brand-dna-cta")).toHaveCount(0);
    } finally {
      await context.close();
    }
  });
});
