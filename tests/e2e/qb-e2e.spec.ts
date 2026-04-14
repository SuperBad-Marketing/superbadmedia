/**
 * QB-E2E — Quote Builder critical-flow E2E.
 *
 * Scope: the public `deal → quote → accept → pay` flow. Manual-billed
 * branch (no Stripe Payment Element), `project` structure (no
 * subscription). Seed puts the quote in `sent` status directly; the
 * admin Send path is covered by unit tests (QB-3 send modal +
 * compose-send-email harness). This spec is the only end-to-end drive
 * of `/lite/quotes/[token]` view-tracking + accept.
 *
 * Runs in a fresh (unauthenticated) browser context so the public token
 * URL is exercised the way a real client would hit it.
 *
 * Owner: QB-E2E. Consumers: Wave 7+ build sessions referencing the
 * accept contract.
 */
import { test, expect } from "@playwright/test";
import { and, eq } from "drizzle-orm";

import { openTestDb } from "./fixtures/seed-db";
import { seedQbE2e, QB_E2E } from "../../scripts/seed-qb-e2e";
import { quotes } from "@/lib/db/schema/quotes";
import { deals } from "@/lib/db/schema/deals";
import { activity_log } from "@/lib/db/schema/activity-log";
import { scheduled_tasks } from "@/lib/db/schema/scheduled-tasks";
import { killSwitches } from "@/lib/kill-switches";

test.describe("qb-e2e / public quote accept (manual-billed, project)", () => {
  test.beforeAll(async () => {
    const { sqlite, db } = openTestDb();
    try {
      await seedQbE2e(db);
    } finally {
      sqlite.close();
    }
  });

  test("blocker precondition — manual-invoice enqueue kill-switch is OFF", () => {
    // Hard guard: if BI-1 flips this default ON before BI-E2E lands, the
    // §3 bullet "zero manual_invoice_generate row" below would start to
    // legitimately fail. Fail loudly here rather than further down.
    expect(killSwitches.invoicing_manual_cycle_enqueue_enabled).toBe(false);
  });

  test("client loads quote → view-tracking flips sent → viewed", async ({
    browser,
  }) => {
    const context = await browser.newContext({
      storageState: { cookies: [], origins: [] },
    });
    const page = await context.newPage();
    try {
      await page.goto(`/lite/quotes/${QB_E2E.quoteToken}`, {
        waitUntil: "networkidle",
      });
      // Wait for the accept block to be visible — it only renders when
      // the public experience has fully hydrated.
      await expect(
        page.getByTestId("quote-accept-button"),
      ).toBeVisible({ timeout: 15_000 });

      const { sqlite, db } = openTestDb();
      try {
        const quote = await db
          .select()
          .from(quotes)
          .where(eq(quotes.id, QB_E2E.quoteId))
          .get();
        expect(quote?.status).toBe("viewed");
        expect(quote?.viewed_at_ms).not.toBeNull();

        const viewedRows = await db
          .select()
          .from(activity_log)
          .where(
            and(
              eq(activity_log.deal_id, QB_E2E.dealId),
              eq(activity_log.kind, "quote_viewed"),
            ),
          )
          .all();
        expect(viewedRows.length).toBeGreaterThanOrEqual(1);
      } finally {
        sqlite.close();
      }
    } finally {
      await context.close();
    }
  });

  test("tick ToS + privacy → Accept → side effects land", async ({
    browser,
  }) => {
    const context = await browser.newContext({
      storageState: { cookies: [], origins: [] },
    });
    const page = await context.newPage();
    try {
      await page.goto(`/lite/quotes/${QB_E2E.quoteToken}`);

      const acceptBtn = page.getByTestId("quote-accept-button");
      await expect(acceptBtn).toBeVisible({ timeout: 15_000 });

      // Tick the single ToS/privacy checkbox. The accept block renders
      // one <input type="checkbox"> inside a <label>.
      const agreement = page.getByRole("checkbox");
      await agreement.check();
      await expect(acceptBtn).toBeEnabled();

      await acceptBtn.click();

      // Confirmation screen means the Server Action resolved, manual
      // branch fired its side effects, and the UI morphed through.
      await expect(
        page.getByTestId("quote-confirmation-screen"),
      ).toBeVisible({ timeout: 15_000 });

      const { sqlite, db } = openTestDb();
      try {
        // Quote flipped to accepted.
        const quote = await db
          .select()
          .from(quotes)
          .where(eq(quotes.id, QB_E2E.quoteId))
          .get();
        expect(quote?.status).toBe("accepted");
        expect(quote?.accepted_at_ms).not.toBeNull();
        expect(quote?.accepted_content_hash).not.toBeNull();
        expect(quote?.accepted_tos_version_id).toBe(QB_E2E.tosVersionId);
        expect(quote?.accepted_privacy_version_id).toBe(
          QB_E2E.privacyVersionId,
        );

        // Deal finalised as won with project outcome; project → no
        // subscription state.
        const deal = await db
          .select()
          .from(deals)
          .where(eq(deals.id, QB_E2E.dealId))
          .get();
        expect(deal?.stage).toBe("won");
        expect(deal?.won_outcome).toBe("project");
        expect(deal?.subscription_state).toBeNull();

        // quote_accepted activity_log row exists.
        const acceptedRows = await db
          .select()
          .from(activity_log)
          .where(
            and(
              eq(activity_log.deal_id, QB_E2E.dealId),
              eq(activity_log.kind, "quote_accepted"),
            ),
          )
          .all();
        expect(acceptedRows.length).toBeGreaterThanOrEqual(1);

        // Manual-invoice enqueue MUST be gated off (kill-switch=false).
        // No scheduled_tasks row of that type should exist.
        const manualInvoiceRows = await db
          .select()
          .from(scheduled_tasks)
          .where(
            eq(scheduled_tasks.task_type, "manual_invoice_generate"),
          )
          .all();
        expect(manualInvoiceRows).toHaveLength(0);

        // NOTE: the brief (and spec §5.1) expect a `quote_settled`
        // activity_log row on accept. Current code emits that row only
        // from `payment_intent.succeeded` (Stripe-billed path). For the
        // manual path this is a spec-vs-code gap; tracked as
        // `qbe2e_manual_quote_settled_missing` in PATCHES_OWED.md.
      } finally {
        sqlite.close();
      }
    } finally {
      await context.close();
    }
  });
});
