/**
 * SW-6 — critical-flight (resend) E2E smoke.
 *
 * Exercises the Resend critical-flight arc — one step shorter than the
 * stripe-admin arc (no webhook-probe leg):
 *   sign-in (pre-seeded cookie via globalSetup) →
 *   navigate directly to /lite/setup/critical-flight/resend →
 *   paste test key → api-key-paste step verifies via live Resend ping →
 *   review-and-confirm → celebration → /lite/first-run → cockpit CTA.
 *
 * We navigate directly to the Resend wizard route (rather than bouncing
 * through /lite/first-run) because the seeded session has
 * `critical_flight_complete=false` and the ordering in
 * `wizards.critical_flight_wizards` puts stripe-admin first — first-run
 * would redirect to the stripe wizard, not this one. A direct hop is the
 * right way to exercise this spec in isolation.
 *
 * Skipped when `RESEND_TEST_KEY` is unset. The scaffold stays green in CI
 * without a real key; opt in by exporting `RESEND_TEST_KEY=re_...`
 * before `npm run test:e2e`.
 *
 * Owner: SW-6.
 */
import { test, expect } from "@playwright/test";
import { eq } from "drizzle-orm";

import { E2E_USER, openTestDb } from "./fixtures/seed-db";
import { wizard_completions } from "@/lib/db/schema/wizard-completions";
import { integration_connections } from "@/lib/db/schema/integration-connections";

const RESEND_TEST_KEY = process.env.RESEND_TEST_KEY ?? "";

test.describe("critical-flight / resend", () => {
  test.skip(
    !RESEND_TEST_KEY,
    "Set RESEND_TEST_KEY (re_...) to run the Resend critical-flight E2E.",
  );

  test("full arc: paste → review → celebration → cockpit", async ({
    page,
  }) => {
    await page.goto("/lite/setup/critical-flight/resend");

    // Step 1: api-key-paste. Step calls testResendKeyAction which hits
    // Resend's apiKeys.list() as the cheapest authenticated ping.
    const input = page.locator('[data-wizard-step="api-key-paste"] input');
    await input.fill(RESEND_TEST_KEY);
    await page.getByRole("button", { name: "Test key" }).click();
    await expect(
      page.locator("[data-wizard-api-key-masked]"),
    ).toBeVisible({ timeout: 15_000 });
    await page.getByRole("button", { name: "Continue" }).click();

    // Step 2: review-and-confirm (no webhook leg).
    await expect(
      page.locator('[data-wizard-step="review-and-confirm"]'),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Looks right — finish" })
      .click();

    // Step 3: celebration. onComplete fires registerIntegration →
    // verifyCompletion → wizard_completions insert → unstable_update.
    const celebration = page.locator('[data-wizard-step="celebration"]');
    await expect(celebration).toBeVisible();
    await expect(
      page.locator("[data-wizard-observatory-summary]"),
    ).toBeVisible({ timeout: 30_000 });

    // DB assertions — hermetic, against the Playwright sqlite file.
    const { sqlite, db } = openTestDb();
    try {
      const completions = db
        .select()
        .from(wizard_completions)
        .where(eq(wizard_completions.wizard_key, "resend"))
        .all();
      expect(completions).toHaveLength(1);
      expect(completions[0].user_id).toBe(E2E_USER.id);

      const connections = db
        .select()
        .from(integration_connections)
        .where(eq(integration_connections.vendor_key, "resend"))
        .all();
      expect(connections.length).toBeGreaterThanOrEqual(1);
      expect(connections[0].status).toBe("active");
    } finally {
      sqlite.close();
    }

    // "Done" — the wizard finished; resend is now one of multiple
    // completions. /lite/first-run may still redirect onwards to the
    // next uncompleted critical wizard (graph-api-admin), so we only
    // assert that the navigation fires and we leave the celebration.
    await page.getByRole("button", { name: "Done" }).click();
    await page.waitForURL(
      (url) => !url.pathname.endsWith("/critical-flight/resend"),
    );
  });
});
