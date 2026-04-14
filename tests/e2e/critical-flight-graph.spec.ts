/**
 * SW-7 — critical-flight (graph-api-admin) E2E smoke.
 *
 * Exercises the Microsoft Graph critical-flight arc without a real Azure
 * app registration. The oauth-consent step is bypassed via the wizard's
 * `?testToken=…` direct-injection path — gated server-side on
 * `NODE_ENV !== "production"` so this is unreachable from production pages
 * by construction.
 *
 *   sign-in (pre-seeded cookie via globalSetup) →
 *   navigate directly to
 *     /lite/setup/critical-flight/graph-api-admin?testToken=<GRAPH_TEST_TOKEN> →
 *   oauth-consent state hydrates with the token →
 *   review-and-confirm → celebration → /lite/first-run.
 *
 * Skipped when `GRAPH_TEST_TOKEN` is unset. The scaffold stays green in CI
 * without a real token; opt in by exporting `GRAPH_TEST_TOKEN=<ey...>`
 * (a valid access token that can call `GET /v1.0/me`) before running
 * `npm run test:e2e`.
 *
 * SW-7-b swaps the direct-injection path for the real oauth redirect +
 * signed-cookie handoff once Andy registers an Azure app.
 *
 * Owner: SW-7.
 */
import { test, expect } from "@playwright/test";
import { eq } from "drizzle-orm";

import { E2E_USER, openTestDb } from "./fixtures/seed-db";
import { wizard_completions } from "@/lib/db/schema/wizard-completions";
import { integration_connections } from "@/lib/db/schema/integration-connections";

const GRAPH_TEST_TOKEN = process.env.GRAPH_TEST_TOKEN ?? "";

test.describe("critical-flight / graph-api-admin", () => {
  test.skip(
    !GRAPH_TEST_TOKEN,
    "Set GRAPH_TEST_TOKEN to run the graph-api-admin critical-flight E2E.",
  );

  test("full arc: oauth-consent (injected) → review → celebration → cockpit", async ({
    page,
  }) => {
    // Direct-token injection via query param — client seeds state.consent.token
    // from the URL on mount because NODE_ENV !== "production" in the E2E env.
    await page.goto(
      `/lite/setup/critical-flight/graph-api-admin?testToken=${encodeURIComponent(GRAPH_TEST_TOKEN)}`,
    );

    // Step 1: oauth-consent. With the test token injected into state, the
    // step shows its "Continue" button (not the vendor redirect link).
    const consent = page.locator('[data-wizard-step="oauth-consent"]');
    await expect(consent).toBeVisible();
    await page.getByRole("button", { name: "Continue" }).click();

    // Step 2: review-and-confirm.
    await expect(
      page.locator('[data-wizard-step="review-and-confirm"]'),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Looks right — finish" })
      .click();

    // Step 3: celebration. onComplete fires registerIntegration →
    // verifyCompletion (live GET /me ping) → wizard_completions insert →
    // unstable_update.
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
        .where(eq(wizard_completions.wizard_key, "graph-api-admin"))
        .all();
      expect(completions).toHaveLength(1);
      expect(completions[0].user_id).toBe(E2E_USER.id);

      const connections = db
        .select()
        .from(integration_connections)
        .where(eq(integration_connections.vendor_key, "graph-api"))
        .all();
      expect(connections.length).toBeGreaterThanOrEqual(1);
      expect(connections[0].status).toBe("active");
    } finally {
      sqlite.close();
    }

    // Done. graph-api-admin is the last critical-flight wizard — after this
    // completion, hasCompletedCriticalFlight() should be true and the
    // capstone fires at /lite/first-run.
    await page.getByRole("button", { name: "Done" }).click();
    await page.waitForURL(
      (url) => !url.pathname.endsWith("/critical-flight/graph-api-admin"),
    );
  });
});
