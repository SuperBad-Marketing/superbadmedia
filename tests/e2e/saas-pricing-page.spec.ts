/**
 * SB-3 — public `/get-started/pricing` critical-flow E2E.
 *
 * Seeds two active products + a Full Suite + one archived product in
 * the hermetic DB, then asserts:
 *   - Desktop grid renders one column per active product (archived hidden).
 *   - Each column shows three tier cards.
 *   - "Get started" CTAs route to the SB-5 stub checkout URL.
 *   - Full Suite section renders below the grid with a computed savings line.
 *   - Mobile viewport (< md) collapses into per-product cards with working expand.
 *
 * Runs unauthenticated (public route; proxy bypasses `/get-started/*`).
 *
 * Owner: SB-3.
 */
import { test, expect } from "@playwright/test";

import { openTestDb } from "./fixtures/seed-db";
import { seedSb3Pricing, SB3_PRICING } from "../../scripts/seed-sb3-pricing";

test.describe("sb-3 / public pricing page", () => {
  test.beforeAll(async () => {
    const { sqlite, db } = openTestDb();
    try {
      await seedSb3Pricing(db);
    } finally {
      sqlite.close();
    }
  });

  test("desktop grid shows only active products with three tiers each", async ({
    browser,
  }) => {
    const context = await browser.newContext({
      storageState: { cookies: [], origins: [] },
      viewport: { width: 1280, height: 900 },
    });
    const page = await context.newPage();
    try {
      await page.goto("/get-started/pricing", {
        waitUntil: "domcontentloaded",
      });

      // Page header copy from `lib/content/pricing-page.ts`.
      await expect(
        page.getByRole("heading", { name: "What things cost." }),
      ).toBeVisible({ timeout: 20_000 });

      const desktopGrid = page.getByTestId("pricing-grid-desktop");
      await expect(desktopGrid).toBeVisible();

      // Two active non-Full-Suite products rendered.
      await expect(
        desktopGrid.locator('[data-product-slug="outreach"]'),
      ).toBeVisible();
      await expect(
        desktopGrid.locator('[data-product-slug="ads"]'),
      ).toBeVisible();

      // Archived product MUST NOT render.
      await expect(
        page.locator('[data-product-slug="retired-thing"]'),
      ).toHaveCount(0);

      // Each visible product exposes three tier cards.
      const outreachCol = desktopGrid.locator(
        '[data-product-slug="outreach"]',
      );
      await expect(
        outreachCol.locator('[data-testid^="tier-card-rank-"]'),
      ).toHaveCount(3);
    } finally {
      await context.close();
    }
  });

  test("Get started buttons link to the SB-5 stub checkout", async ({
    browser,
  }) => {
    const context = await browser.newContext({
      storageState: { cookies: [], origins: [] },
      viewport: { width: 1280, height: 900 },
    });
    const page = await context.newPage();
    try {
      await page.goto("/get-started/pricing", { waitUntil: "domcontentloaded" });
      const outreachCol = page
        .getByTestId("pricing-grid-desktop")
        .locator('[data-product-slug="outreach"]');
      const mediumCta = outreachCol.locator(
        '[data-testid="tier-card-rank-2"] a[data-testid^="cta-"]',
      );
      await expect(mediumCta).toHaveText("Get started", { timeout: 20_000 });
      const href = await mediumCta.getAttribute("href");
      expect(href).toContain("/get-started/checkout");
      expect(href).toContain(`tier=${SB3_PRICING.outreachId}-t2`);
      expect(href).toContain("product=outreach");
    } finally {
      await context.close();
    }
  });

  test("Full Suite section renders with a computed savings line", async ({
    browser,
  }) => {
    const context = await browser.newContext({
      storageState: { cookies: [], origins: [] },
      viewport: { width: 1280, height: 900 },
    });
    const page = await context.newPage();
    try {
      await page.goto("/get-started/pricing", { waitUntil: "domcontentloaded" });
      const section = page.getByTestId("full-suite-section");
      await expect(section).toBeVisible({ timeout: 20_000 });
      await expect(
        section.getByRole("heading", { name: "Full Suite." }),
      ).toBeVisible();
      // individual sum = 199 + 149 = 348; full suite = 299; savings = 49.
      const savings = page.getByTestId("full-suite-savings");
      await expect(savings).toContainText("348");
      await expect(savings).toContainText("49");
    } finally {
      await context.close();
    }
  });

  test("mobile viewport collapses to per-product cards with expand/collapse", async ({
    browser,
  }) => {
    const context = await browser.newContext({
      storageState: { cookies: [], origins: [] },
      viewport: { width: 375, height: 812 },
    });
    const page = await context.newPage();
    try {
      await page.goto("/get-started/pricing", { waitUntil: "domcontentloaded" });

      await expect(page.getByTestId("pricing-grid-mobile")).toBeVisible({ timeout: 20_000 });
      // Desktop grid is display:none on mobile but still in the DOM —
      // check the toggle lives on the mobile stack.
      const toggle = page.getByTestId("product-toggle-outreach");
      await expect(toggle).toBeVisible();
      await expect(toggle).toHaveAttribute("aria-expanded", "false");

      await toggle.click();
      await expect(toggle).toHaveAttribute("aria-expanded", "true");

      // Tier cards for outreach are now visible.
      const tierCards = page
        .getByTestId("pricing-grid-mobile")
        .locator('[data-product-slug="outreach"]')
        .locator('[data-testid^="tier-card-rank-"]');
      await expect(tierCards).toHaveCount(3);

      // Collapse again.
      await toggle.click();
      await expect(toggle).toHaveAttribute("aria-expanded", "false");
    } finally {
      await context.close();
    }
  });
});
