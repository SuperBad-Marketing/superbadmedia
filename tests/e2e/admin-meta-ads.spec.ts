/**
 * SW-10 — admin non-critical (meta-ads) E2E smoke.
 *
 * Exercises the Meta Ads oauth-consent arc without a real Meta app
 * registration. The oauth-consent step is bypassed via the wizard's
 * `?testToken=…` direct-injection path — gated server-side on
 * `NODE_ENV !== "production"`.
 *
 *   sign-in (pre-seeded cookie via globalSetup) →
 *   navigate directly to
 *     /lite/setup/admin/meta-ads?testToken=<META_ADS_TEST_TOKEN> →
 *   oauth-consent hydrates → review → celebration → cockpit.
 *
 * Skipped when `META_ADS_TEST_TOKEN` is unset. SW-10-b swaps the direct-
 * injection path for the real oauth redirect once Andy registers a Meta
 * app.
 *
 * Owner: SW-10.
 */
import { test, expect } from "@playwright/test";
import { eq } from "drizzle-orm";

import { E2E_USER, openTestDb } from "./fixtures/seed-db";
import { wizard_completions } from "@/lib/db/schema/wizard-completions";
import { integration_connections } from "@/lib/db/schema/integration-connections";

const META_ADS_TEST_TOKEN = process.env.META_ADS_TEST_TOKEN ?? "";

test.describe("admin / meta-ads", () => {
  test.skip(
    !META_ADS_TEST_TOKEN,
    "Set META_ADS_TEST_TOKEN to run the meta-ads admin E2E.",
  );

  test("full arc: oauth-consent (injected) → review → celebration → cockpit", async ({
    page,
  }) => {
    await page.goto(
      `/lite/setup/admin/meta-ads?testToken=${encodeURIComponent(META_ADS_TEST_TOKEN)}`,
    );

    const consent = page.locator('[data-wizard-step="oauth-consent"]');
    await expect(consent).toBeVisible();
    await page.getByRole("button", { name: "Continue" }).click();

    await expect(
      page.locator('[data-wizard-step="review-and-confirm"]'),
    ).toBeVisible();
    await page.getByRole("button", { name: "Looks right — finish" }).click();

    const celebration = page.locator('[data-wizard-step="celebration"]');
    await expect(celebration).toBeVisible();
    await expect(
      page.locator("[data-wizard-observatory-summary]"),
    ).toBeVisible({ timeout: 30_000 });

    const { sqlite, db } = openTestDb();
    try {
      const completions = db
        .select()
        .from(wizard_completions)
        .where(eq(wizard_completions.wizard_key, "meta-ads"))
        .all();
      expect(completions).toHaveLength(1);
      expect(completions[0].user_id).toBe(E2E_USER.id);

      const connections = db
        .select()
        .from(integration_connections)
        .where(eq(integration_connections.vendor_key, "meta-ads"))
        .all();
      expect(connections.length).toBeGreaterThanOrEqual(1);
      expect(connections[0].status).toBe("active");
    } finally {
      sqlite.close();
    }

    await page.getByRole("button", { name: "Done" }).click();
    await page.waitForURL(
      (url) => !url.pathname.endsWith("/admin/meta-ads"),
    );
  });
});
