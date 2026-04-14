/**
 * SW-5c — critical-flight (stripe-admin) E2E smoke.
 *
 * Exercises the full arc the AUTONOMY_PROTOCOL §G12 names as E2E-mandatory:
 *   sign-in (pre-seeded cookie via globalSetup) →
 *   /lite/first-run redirects to /lite/setup/critical-flight/stripe-admin →
 *   paste test key → api-key-paste step verifies via live Stripe ping →
 *   POST synthetic signed webhook → webhook-probe detects the row →
 *   review-and-confirm → celebration → /lite/first-run capstone → cockpit.
 *
 * Skipped when `STRIPE_TEST_KEY` is unset. The scaffold stays green in CI
 * without a real key; opt in by exporting `STRIPE_TEST_KEY=sk_test_...`
 * before `npm run test:e2e`.
 *
 * All assertions are hermetic: the DB is the Playwright fixture file, the
 * webhook POST targets localhost, and the only external hop is Stripe
 * test-mode `balance.retrieve`.
 *
 * Owner: SW-5c.
 */
import { test, expect } from "@playwright/test";
import { eq } from "drizzle-orm";

import { E2E_USER, openTestDb } from "./fixtures/seed-db";
import { buildSignedWebhook } from "./fixtures/stripe-signature";
import { E2E_CONSTANTS } from "../../playwright.config";
import { external_call_log } from "@/lib/db/schema/external-call-log";
import { wizard_completions } from "@/lib/db/schema/wizard-completions";
import { integration_connections } from "@/lib/db/schema/integration-connections";

const STRIPE_TEST_KEY = process.env.STRIPE_TEST_KEY ?? "";

test.describe("critical-flight / stripe-admin", () => {
  test.skip(
    !STRIPE_TEST_KEY,
    "Set STRIPE_TEST_KEY (sk_test_...) to run the Stripe critical-flight E2E.",
  );

  test("full arc: sign-in → wizard → capstone → cockpit", async ({
    page,
    request,
  }) => {
    // Sanity: the pre-seeded cookie logs us in. /lite/first-run should
    // redirect into the stripe-admin wizard because critical_flight_complete
    // is false in the JWT.
    await page.goto("/lite/first-run");
    await page.waitForURL(/\/lite\/setup\/critical-flight\/stripe-admin\b/);

    // Step 1: api-key-paste. The step calls testStripeKeyAction, which
    // hits Stripe's test mode via balance.retrieve.
    const input = page.locator('[data-wizard-step="api-key-paste"] input');
    await input.fill(STRIPE_TEST_KEY);
    await page.getByRole("button", { name: "Test key" }).click();
    await expect(
      page.locator("[data-wizard-api-key-masked]"),
    ).toBeVisible({ timeout: 15_000 });
    await page.getByRole("button", { name: "Continue" }).click();

    // Step 2: webhook-probe. POST a signed synthetic event directly to
    // /api/stripe/webhook; the dev server inserts one external_call_log
    // row with job="stripe.webhook.receive"; the probe's polling loop
    // picks it up within wizards.webhook_probe_timeout_ms.
    await expect(
      page.locator('[data-wizard-step="webhook-probe"]'),
    ).toBeVisible();
    const { body, signature, eventId } = buildSignedWebhook();
    const webhookRes = await request.post(
      `${E2E_CONSTANTS.BASE_URL}/api/stripe/webhook`,
      {
        headers: {
          "stripe-signature": signature,
          "content-type": "application/json",
        },
        data: body,
      },
    );
    expect(webhookRes.status()).toBe(200);

    // The probe polls every ~2s; give it up to 10s before giving up.
    await expect(
      page.locator('[data-wizard-step="webhook-probe"] button', {
        hasText: "Continue",
      }),
    ).toBeVisible({ timeout: 15_000 });
    await page.getByRole("button", { name: "Continue" }).click();

    // Step 3: review-and-confirm.
    await expect(
      page.locator('[data-wizard-step="review-and-confirm"]'),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Looks right — finish" })
      .click();

    // Step 4: celebration. onComplete fires registerIntegration →
    // verifyCompletion → wizard_completions insert → unstable_update.
    const celebration = page.locator('[data-wizard-step="celebration"]');
    await expect(celebration).toBeVisible();
    await expect(
      page.locator("[data-wizard-observatory-summary]"),
    ).toBeVisible({ timeout: 30_000 });

    // DB assertions — hermetic, against the Playwright sqlite file.
    const { sqlite, db } = openTestDb();
    try {
      const externalRows = db
        .select()
        .from(external_call_log)
        .where(eq(external_call_log.job, "stripe.webhook.receive"))
        .all();
      expect(externalRows.length).toBeGreaterThanOrEqual(1);
      const matchedEvent = externalRows.find(
        (r) =>
          typeof r.units === "object" &&
          r.units !== null &&
          (r.units as { event_id?: string }).event_id === eventId,
      );
      expect(matchedEvent).toBeDefined();

      const completions = db
        .select()
        .from(wizard_completions)
        .where(eq(wizard_completions.wizard_key, "stripe-admin"))
        .all();
      expect(completions).toHaveLength(1);
      expect(completions[0].user_id).toBe(E2E_USER.id);

      const connections = db
        .select()
        .from(integration_connections)
        .where(eq(integration_connections.vendor_key, "stripe"))
        .all();
      expect(connections.length).toBeGreaterThanOrEqual(1);
      expect(connections[0].status).toBe("active");
    } finally {
      sqlite.close();
    }

    // "Done" — the wizard finished, the JWT gets refreshed via
    // unstable_update, so /lite/first-run now shows the capstone rather
    // than redirecting.
    await page.getByRole("button", { name: "Done" }).click();
    await page.waitForURL(/\/lite\/first-run/);
    await expect(
      page.getByRole("button", { name: /Head to cockpit/i }),
    ).toBeVisible();
  });
});
