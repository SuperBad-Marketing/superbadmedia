/**
 * SW-12 — admin non-critical (twilio) E2E smoke.
 *
 * First form-step E2E in the admin tree — no OAuth, no `?testToken=`
 * injection. The test pastes a real SID + Auth Token into the form step
 * and the celebration orchestrator runs a live Twilio account ping.
 *
 *   sign-in (pre-seeded cookie via globalSetup) →
 *   /lite/setup/admin/twilio →
 *   form step (paste SID + token) → review → celebration → cockpit.
 *
 * Skipped unless both `TWILIO_TEST_SID` and `TWILIO_TEST_TOKEN` are set.
 *
 * Owner: SW-12.
 */
import { test, expect } from "@playwright/test";
import { eq } from "drizzle-orm";

import { E2E_USER, openTestDb } from "./fixtures/seed-db";
import { wizard_completions } from "@/lib/db/schema/wizard-completions";
import { integration_connections } from "@/lib/db/schema/integration-connections";

const TWILIO_TEST_SID = process.env.TWILIO_TEST_SID ?? "";
const TWILIO_TEST_TOKEN = process.env.TWILIO_TEST_TOKEN ?? "";

test.describe("admin / twilio", () => {
  test.skip(
    !TWILIO_TEST_SID || !TWILIO_TEST_TOKEN,
    "Set TWILIO_TEST_SID + TWILIO_TEST_TOKEN to run the twilio admin E2E.",
  );

  test("full arc: form → review → celebration → cockpit", async ({ page }) => {
    await page.goto("/lite/setup/admin/twilio");

    const form = page.locator('[data-wizard-step="form"]');
    await expect(form).toBeVisible();
    await page.locator("#field-accountSid").fill(TWILIO_TEST_SID);
    await page.locator("#field-authToken").fill(TWILIO_TEST_TOKEN);
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
        .where(eq(wizard_completions.wizard_key, "twilio"))
        .all();
      expect(completions).toHaveLength(1);
      expect(completions[0].user_id).toBe(E2E_USER.id);

      const connections = db
        .select()
        .from(integration_connections)
        .where(eq(integration_connections.vendor_key, "twilio"))
        .all();
      expect(connections.length).toBeGreaterThanOrEqual(1);
      expect(connections[0].status).toBe("active");
    } finally {
      sqlite.close();
    }

    await page.getByRole("button", { name: "Done" }).click();
    await page.waitForURL(
      (url) => !url.pathname.endsWith("/admin/twilio"),
    );
  });
});
