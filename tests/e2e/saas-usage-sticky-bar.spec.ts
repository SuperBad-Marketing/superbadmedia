/**
 * SB-7 — `/lite/onboarding` sticky usage bar + at-cap takeover.
 *
 * Seeds two active SaaS subscribers on the same tier/dimension (limit
 * 10) — one at 8/10 (warn) and one at 10/10 (at_cap) — and asserts the
 * correct status variant + voice copy renders for each.
 *
 * Owner: SB-7. Consumer of scripts/seed-sb7-e2e.ts.
 */
import { test, expect } from "@playwright/test";

import { openTestDb } from "./fixtures/seed-db";
import { seedSb7E2e, SB7_E2E } from "../../scripts/seed-sb7-e2e";

let WARN_TOKEN = "";
let AT_CAP_TOKEN = "";

test.describe("sb-7 / saas usage sticky bar + at-cap", () => {
  test.beforeAll(async () => {
    const { sqlite, db } = openTestDb();
    try {
      const tokens = await seedSb7E2e(db);
      WARN_TOKEN = tokens.warn;
      AT_CAP_TOKEN = tokens.atCap;
    } finally {
      sqlite.close();
    }
  });

  test("warn subscriber sees active variant + sticky usage pill", async ({
    browser,
  }) => {
    const context = await browser.newContext({
      storageState: { cookies: [], origins: [] },
      viewport: { width: 1280, height: 900 },
    });
    const page = await context.newPage();
    try {
      await page.goto(`/api/auth/magic-link?token=${WARN_TOKEN}`, {
        waitUntil: "domcontentloaded",
      });
      await expect(page).toHaveURL(/\/lite\/onboarding$/, { timeout: 20_000 });

      const root = page.getByTestId("subscriber-onboarding");
      await expect(root).toHaveAttribute("data-variant", "active");

      const bar = page.getByTestId("usage-sticky-bar");
      await expect(bar).toBeVisible();

      const pill = page.getByTestId(`usage-pill-${SB7_E2E.dimensionKey}`);
      await expect(pill).toHaveAttribute("data-status", "warn");
      await expect(pill).toContainText(`${SB7_E2E.warn.usage} / ${SB7_E2E.limit}`);

      const voice = page.getByTestId(`usage-voice-${SB7_E2E.dimensionKey}`);
      await expect(voice).toContainText(
        "Making sure the juice is worth the squeeze.",
      );

      // Brand DNA CTA still present on active variant.
      await expect(page.getByTestId("brand-dna-cta")).toBeVisible();
      // At-cap takeover should NOT render.
      await expect(page.getByTestId("at-cap-hero")).toHaveCount(0);
    } finally {
      await context.close();
    }
  });

  test("at_cap subscriber sees takeover + upgrade CTA", async ({ browser }) => {
    const context = await browser.newContext({
      storageState: { cookies: [], origins: [] },
      viewport: { width: 1280, height: 900 },
    });
    const page = await context.newPage();
    try {
      await page.goto(`/api/auth/magic-link?token=${AT_CAP_TOKEN}`, {
        waitUntil: "domcontentloaded",
      });
      await expect(page).toHaveURL(/\/lite\/onboarding$/, { timeout: 20_000 });

      const root = page.getByTestId("subscriber-onboarding");
      await expect(root).toHaveAttribute("data-variant", "at_cap");

      const hero = page.getByTestId("at-cap-hero");
      await expect(hero).toBeVisible();

      const upgrade = page.getByTestId("upgrade-cta");
      await expect(upgrade).toBeVisible();
      await expect(upgrade).toContainText(SB7_E2E.tier2Name);

      await expect(page.getByTestId("wait-for-reset")).toBeVisible();

      // Brand DNA CTA is suppressed during at_cap takeover.
      await expect(page.getByTestId("brand-dna-cta")).toHaveCount(0);
      // Sticky bar is suppressed during at_cap takeover.
      await expect(page.getByTestId("usage-sticky-bar")).toHaveCount(0);
    } finally {
      await context.close();
    }
  });
});
