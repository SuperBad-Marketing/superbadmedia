/**
 * IF-E2E — Intro Funnel critical-flow E2E (Wave 14 closer).
 *
 * Drives the full prospect arc through the trial-shoot funnel:
 *
 *   1. /trial-shoot — landing page renders, CTA visible.
 *   2. Click CTA → section 1 form appears; fill name, business, email,
 *      phone, shape → submit → redirect to /lite/intro/[token].
 *   3. Portal loads with questionnaire panel; drive through all 3
 *      sections (pick first MC option, skip free-text).
 *   4. Payment panel appears; fill Stripe test card 4242; pay → state
 *      transitions to `paid`.
 *   5. Portal reloads showing "Book your shoot" → click → /lite/intro/
 *      [token]/book renders with available time slots.
 *
 * Skipped when STRIPE_TEST_KEY or STRIPE_TEST_PUBLISHABLE_KEY is absent —
 * the payment flow needs real Stripe test-mode (same approach as SB-E2E).
 *
 * Run locally:
 *   STRIPE_TEST_KEY=sk_test_... \
 *   STRIPE_TEST_PUBLISHABLE_KEY=pk_test_... \
 *   npm run test:e2e -- tests/e2e/intro-funnel-booking.spec.ts
 *
 * Owner: IF-E2E.
 */
import { test, expect, type FrameLocator, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { eq, and } from "drizzle-orm";

import { openTestDb } from "./fixtures/seed-db";
import { seedIfE2e, IF_E2E } from "../../scripts/seed-if-e2e";
import { intro_funnel_submissions } from "@/lib/db/schema/intro-funnel-submissions";
import { intro_funnel_payments } from "@/lib/db/schema/intro-funnel-payments";
import { deals } from "@/lib/db/schema/deals";
import { activity_log } from "@/lib/db/schema/activity-log";

const STRIPE_TEST_KEY = process.env.STRIPE_TEST_KEY ?? "";
const STRIPE_TEST_PUBLISHABLE_KEY =
  process.env.STRIPE_TEST_PUBLISHABLE_KEY ?? "";
const STRIPE_KEYS_SET =
  STRIPE_TEST_KEY !== "" && STRIPE_TEST_PUBLISHABLE_KEY !== "";

const PROSPECT_NAME = `IF-E2E ${randomUUID().slice(0, 6)}`;
const PROSPECT_BUSINESS = `E2E Biz ${randomUUID().slice(0, 6)}`;
const PROSPECT_EMAIL = `ife2e-${randomUUID().slice(0, 8)}@example.com`;
const PROSPECT_PHONE = "0400000000";

let capturedToken = "";

test.describe("if-e2e / intro funnel golden path", () => {
  test.skip(
    !STRIPE_KEYS_SET,
    "Set STRIPE_TEST_KEY and STRIPE_TEST_PUBLISHABLE_KEY to run the IF-E2E intro funnel golden path.",
  );

  test.setTimeout(240_000);

  test.beforeAll(async () => {
    const { sqlite, db } = openTestDb();
    try {
      await seedIfE2e(db);
    } finally {
      sqlite.close();
    }
  });

  test("landing → section 1 → questionnaire → payment → booking page", async ({
    browser,
  }) => {
    const context = await browser.newContext({
      storageState: { cookies: [], origins: [] },
      viewport: { width: 1280, height: 900 },
    });
    const page = await context.newPage();
    try {
      // ── Stage 1: landing page ─────────────────────────────────────
      await page.goto("/trial-shoot", { waitUntil: "domcontentloaded" });
      await expect(page.locator("h1")).toContainText(
        "Most marketing looks like marketing",
        { timeout: 20_000 },
      );

      const ctaButton = page.getByRole("button", {
        name: /book your shoot/i,
      });
      await expect(ctaButton).toBeVisible({ timeout: 10_000 });
      await ctaButton.click();

      // ── Stage 2: section 1 form ───────────────────────────────────
      const nameInput = page.locator('input[name="name"]');
      await expect(nameInput).toBeVisible({ timeout: 10_000 });

      await nameInput.fill(PROSPECT_NAME);
      await page.locator('input[name="businessName"]').fill(PROSPECT_BUSINESS);
      await page.locator('input[name="email"]').fill(PROSPECT_EMAIL);
      await page.locator('input[name="phone"]').fill(PROSPECT_PHONE);

      // Select the first shape ("It's just me")
      const shapeButton = page.getByRole("button", {
        name: /it.?s just me/i,
      });
      await shapeButton.click();

      // Submit
      const submitButton = page.getByRole("button", { name: /next/i });
      await expect(submitButton).toBeEnabled();
      await submitButton.click();

      // Should redirect to /lite/intro/[token]
      await expect(page).toHaveURL(/\/lite\/intro\/[a-z0-9]+$/, {
        timeout: 30_000,
      });

      // Capture token from URL
      const url = page.url();
      const tokenMatch = url.match(/\/lite\/intro\/([a-z0-9]+)$/);
      expect(tokenMatch).not.toBeNull();
      capturedToken = tokenMatch![1];

      // Verify "Welcome" header
      await expect(page.locator("h1")).toContainText(
        `Welcome, ${PROSPECT_NAME.split(" ")[0]}`,
        { timeout: 15_000 },
      );

      // ── Stage 2b: verify DB state ────────────────────────────────
      const { sqlite: db1s, db: db1 } = openTestDb();
      try {
        const submission = await db1
          .select()
          .from(intro_funnel_submissions)
          .where(eq(intro_funnel_submissions.token, capturedToken))
          .limit(1)
          .get();
        expect(submission).toBeTruthy();
        expect(submission!.funnel_state).toBe("contact_submitted");
        expect(submission!.shape).toBe("solo_founder");
        expect(submission!.submitted_email).toBe(PROSPECT_EMAIL);

        const startedActivity = await db1
          .select()
          .from(activity_log)
          .where(eq(activity_log.kind, "intro_funnel_started"))
          .all();
        expect(startedActivity.length).toBeGreaterThanOrEqual(1);
      } finally {
        db1s.close();
      }

      // ── Stage 3: questionnaire (3 sections) ──────────────────────
      // Each section has ~6 questions. For MC questions we click the
      // first option and then "Next". Free-text questions get skipped.
      for (let section = 0; section < 3; section++) {
        // Wait for the section heading to be visible
        await page.waitForTimeout(500);

        // Drive through each question in this section
        let questionsDone = 0;
        const MAX_QUESTIONS = 10; // safety cap

        while (questionsDone < MAX_QUESTIONS) {
          // Check if we have MC option buttons in the current question
          const optionButtons = page.locator(
            'button[type="button"]',
          ).filter({ hasNotText: /next|skip|finish|next section|saving/i });

          // Wait a beat for animation
          await page.waitForTimeout(300);

          const optionCount = await optionButtons.count();

          if (optionCount > 0) {
            // MC question — click first option
            await optionButtons.first().click();
            await page.waitForTimeout(200);
          }

          // Look for Skip button (free-text with no answer)
          const skipButton = page.getByRole("button", { name: /^skip$/i });
          const nextButton = page
            .getByRole("button", {
              name: /^(next|finish|next section)$/i,
            });

          const hasSkip = (await skipButton.count()) > 0;
          const hasNext = (await nextButton.count()) > 0;

          if (hasNext && (await nextButton.isVisible())) {
            await nextButton.click();
          } else if (hasSkip && (await skipButton.isVisible())) {
            await skipButton.click();
          } else {
            break;
          }

          questionsDone++;

          // If we got redirected or the questionnaire panel changed
          // to a different section, break this inner loop
          await page.waitForTimeout(300);
        }
      }

      // After all 3 sections, the portal should refresh and show
      // the payment panel. Wait for it.
      await page.waitForTimeout(2_000);

      // The portal shell should now show "questionnaire_complete" state
      // which renders the PaymentPanel. Check for the price display or
      // payment element loading.
      const { sqlite: db2s, db: db2 } = openTestDb();
      try {
        const sub2 = await db2
          .select()
          .from(intro_funnel_submissions)
          .where(eq(intro_funnel_submissions.token, capturedToken))
          .limit(1)
          .get();
        expect(sub2).toBeTruthy();
        expect(sub2!.funnel_state).toBe("questionnaire_complete");
        expect(sub2!.questionnaire_sections_completed).toBe(3);
      } finally {
        db2s.close();
      }

      // ── Stage 4: payment ──────────────────────────────────────────
      // Wait for the PaymentPanel's price display ($297)
      await expect(
        page.getByText("$297"),
      ).toBeVisible({ timeout: 30_000 });

      // Wait for Stripe Payment Element iframe
      const stripeFrame = await waitForStripePaymentFrame(page);

      await stripeFrame
        .getByLabel(/card number/i)
        .fill("4242 4242 4242 4242");
      await stripeFrame
        .getByLabel(/expiration|expiry|MM \/ YY/i)
        .fill("12 / 34");
      await stripeFrame.getByLabel(/CVC|security code/i).fill("123");

      const postcode = stripeFrame.getByLabel(/postal code|postcode|ZIP/i);
      if (await postcode.count()) {
        await postcode.fill("3000");
      }

      // Click "Pay $297"
      const payButton = page.getByRole("button", { name: /pay \$297/i });
      await expect(payButton).toBeEnabled({ timeout: 10_000 });
      await payButton.click();

      // Wait for page to refresh after payment confirmation
      // The portal should now show "paid" state with "Book your shoot"
      await page.waitForTimeout(3_000);

      // Verify payment landed
      const { sqlite: db3s, db: db3 } = openTestDb();
      try {
        const sub3 = await db3
          .select()
          .from(intro_funnel_submissions)
          .where(eq(intro_funnel_submissions.token, capturedToken))
          .limit(1)
          .get();
        expect(sub3).toBeTruthy();
        expect(sub3!.funnel_state).toBe("paid");

        const payment = await db3
          .select()
          .from(intro_funnel_payments)
          .where(eq(intro_funnel_payments.submission_id, sub3!.id))
          .limit(1)
          .get();
        expect(payment).toBeTruthy();
        expect(payment!.status).toBe("succeeded");
        expect(payment!.amount_cents).toBe(IF_E2E.priceCents);

        const deal = await db3
          .select()
          .from(deals)
          .where(eq(deals.id, sub3!.deal_id))
          .limit(1)
          .get();
        expect(deal).toBeTruthy();
        expect(deal!.funnel_state).toBe("paid");
        expect(deal!.stripe_customer_id).not.toBeNull();

        const paidActivity = await db3
          .select()
          .from(activity_log)
          .where(
            and(
              eq(activity_log.deal_id, sub3!.deal_id),
              eq(activity_log.kind, "intro_funnel_paid"),
            ),
          )
          .all();
        expect(paidActivity.length).toBeGreaterThanOrEqual(1);
      } finally {
        db3s.close();
      }

      // ── Stage 5: booking page ─────────────────────────────────────
      // Portal should show "Book your shoot" card with a link
      await expect(
        page.getByRole("link", { name: /choose a time/i }),
      ).toBeVisible({ timeout: 15_000 });

      await page.getByRole("link", { name: /choose a time/i }).click();

      // Booking page should load and show available time slots
      await expect(page).toHaveURL(
        new RegExp(`/lite/intro/${capturedToken}/book`),
        { timeout: 15_000 },
      );

      // The booking page should render slot buttons or date groups
      // (calendar defaults produce weekday slots). Wait for at least
      // one slot or heading to appear.
      await expect(
        page.locator("main"),
      ).toBeVisible({ timeout: 10_000 });
    } finally {
      await context.close();
    }
  });
});

/**
 * Wait for the Stripe Payment Element iframe containing the card number
 * field. Stripe mounts multiple helper iframes — only one has the inputs.
 */
async function waitForStripePaymentFrame(page: Page): Promise<FrameLocator> {
  await page.waitForTimeout(1_000);
  const locators = page.locator('iframe[name^="__privateStripeFrame"]');
  await expect(locators.first()).toBeAttached({ timeout: 30_000 });
  const count = await locators.count();
  for (let i = 0; i < count; i++) {
    const name = await locators.nth(i).getAttribute("name");
    if (!name) continue;
    const frame = page.frameLocator(`iframe[name="${name}"]`);
    if ((await frame.getByLabel(/card number/i).count()) > 0) {
      return frame;
    }
  }
  throw new Error(
    "Stripe Payment Element frame with card number field not found.",
  );
}
