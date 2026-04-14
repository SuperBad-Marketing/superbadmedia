/**
 * SW-13 — admin non-critical (generic api-key, OpenAI profile) E2E smoke.
 *
 * First E2E through the generic api-key wizard. Vendor selected via
 * `?vendor=openai`; the api-key-paste step runs a live OpenAI
 * `/v1/models` ping; celebration writes `integration_connections`
 * keyed on `vendor_key="openai"` (not "api-key") + `wizard_completions`
 * keyed on `wizard_key="api-key"`.
 *
 *   sign-in (pre-seeded cookie via globalSetup) →
 *   /lite/setup/admin/api-key?vendor=openai →
 *   paste key → test key → continue → review → celebration → cockpit.
 *
 * Skipped unless `OPENAI_TEST_KEY` is set. Sibling specs for the other
 * three vendor profiles (anthropic / serpapi / remotion) can be added as
 * their TEST_KEY env vars get populated.
 *
 * Owner: SW-13.
 */
import { test, expect } from "@playwright/test";
import { eq } from "drizzle-orm";

import { E2E_USER, openTestDb } from "./fixtures/seed-db";
import { wizard_completions } from "@/lib/db/schema/wizard-completions";
import { integration_connections } from "@/lib/db/schema/integration-connections";

const OPENAI_TEST_KEY = process.env.OPENAI_TEST_KEY ?? "";

test.describe("admin / api-key (openai)", () => {
  test.skip(
    !OPENAI_TEST_KEY,
    "Set OPENAI_TEST_KEY to run the generic api-key OpenAI E2E.",
  );

  test("full arc: paste → test → review → celebration → cockpit", async ({
    page,
  }) => {
    await page.goto("/lite/setup/admin/api-key?vendor=openai");

    const paste = page.locator('[data-wizard-step="api-key-paste"]');
    await expect(paste).toBeVisible();
    await page.locator('input[type="password"]').fill(OPENAI_TEST_KEY);
    await page.getByRole("button", { name: "Test key" }).click();
    await expect(page.locator("[data-wizard-api-key-masked]")).toBeVisible({
      timeout: 15_000,
    });
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
        .where(eq(wizard_completions.wizard_key, "api-key"))
        .all();
      expect(completions).toHaveLength(1);
      expect(completions[0].user_id).toBe(E2E_USER.id);

      const connections = db
        .select()
        .from(integration_connections)
        .where(eq(integration_connections.vendor_key, "openai"))
        .all();
      expect(connections.length).toBeGreaterThanOrEqual(1);
      expect(connections[0].status).toBe("active");
    } finally {
      sqlite.close();
    }

    await page.getByRole("button", { name: "Done" }).click();
    await page.waitForURL((url) => !url.pathname.endsWith("/admin/api-key"));
  });
});
