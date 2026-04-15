/**
 * SB-E2E — SaaS signup golden-path E2E (Wave 8 closer).
 *
 * Single-flow critical-path spec covering the full subscriber arc:
 *
 *   1. /get-started/pricing — tier CTA renders.
 *   2. Click Medium tier CTA → /get-started/checkout loads with the right
 *      tier + commitment selector.
 *   3. Fill email + business name, keep monthly (default), continue.
 *   4. createSaasSubscriptionAction creates the live Stripe subscription +
 *      DB deal; returns clientSecret.
 *   5. Payment Element renders; fill 4242-4242-4242-4242; pay.
 *   6. stripe.confirmPayment resolves; browser redirects to
 *      /get-started/welcome with email in the URL.
 *   7. We synthesise the post-payment magic-link token directly in the
 *      hermetic DB (real Stripe can't POST a webhook back to localhost,
 *      and the webhook→token plumbing is unit-covered in the SB-6a
 *      primitive tests). Raw token → /api/auth/magic-link?token=… →
 *      Auth.js redeems, promotes prospect→client, redirects to
 *      /lite/onboarding.
 *   8. /lite/onboarding renders the active subscriber dashboard with the
 *      Brand DNA CTA (SB-6b contract).
 *   9. /lite/portal/subscription renders against the live deal + tier.
 *
 * Skipped automatically when `STRIPE_TEST_KEY` or
 * `STRIPE_TEST_PUBLISHABLE_KEY` is absent — the whole point of this spec
 * is exercising real Stripe test-mode, so a hermetic stand-in would
 * silently false-green.
 *
 * Run locally:
 *   STRIPE_TEST_KEY=sk_test_... \
 *   STRIPE_TEST_PUBLISHABLE_KEY=pk_test_... \
 *   npm run test:e2e -- tests/e2e/saas-signup.spec.ts
 *
 * Owner: SB-E2E.
 */
import { test, expect, type FrameLocator, type Page } from "@playwright/test";
import Stripe from "stripe";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { eq, desc } from "drizzle-orm";

import { openTestDb } from "./fixtures/seed-db";
import { seedSbE2e, SBE2E } from "../../scripts/seed-sbe2e";
import { user as userTable } from "@/lib/db/schema/user";
import { deals } from "@/lib/db/schema/deals";
import { activity_log } from "@/lib/db/schema/activity-log";
import { subscriber_magic_link_tokens } from "@/lib/db/schema/subscriber-magic-link-tokens";

const STRIPE_TEST_KEY = process.env.STRIPE_TEST_KEY ?? "";
const STRIPE_TEST_PUBLISHABLE_KEY =
  process.env.STRIPE_TEST_PUBLISHABLE_KEY ?? "";
const STRIPE_KEYS_SET = STRIPE_TEST_KEY !== "" && STRIPE_TEST_PUBLISHABLE_KEY !== "";

const SUBSCRIBER_EMAIL = `sbe2e-${randomUUID().slice(0, 8)}@example.com`;
const SUBSCRIBER_BUSINESS = `SB-E2E ${randomUUID().slice(0, 6)}`;

let LIVE_STRIPE_PRODUCT_ID = "";
let LIVE_STRIPE_PRICE_ID = "";

test.describe("sb-e2e / SaaS signup golden path", () => {
  test.skip(
    !STRIPE_KEYS_SET,
    "Set STRIPE_TEST_KEY and STRIPE_TEST_PUBLISHABLE_KEY to run the SB-E2E signup golden path.",
  );

  // Stripe iframe handshake + subscription create can be slow on first run.
  test.setTimeout(180_000);

  test.beforeAll(async () => {
    // 1. Create a real Stripe test-mode product + monthly recurring price.
    //    Each run creates a fresh pair — Stripe test mode has no soft
    //    limits, and the spec is rare.
    const stripe = new Stripe(STRIPE_TEST_KEY);
    const product = await stripe.products.create({
      name: `SB-E2E ${new Date().toISOString()}`,
    });
    const price = await stripe.prices.create({
      product: product.id,
      unit_amount: SBE2E.monthlyPriceCents,
      currency: "aud",
      recurring: { interval: "month" },
    });
    LIVE_STRIPE_PRODUCT_ID = product.id;
    LIVE_STRIPE_PRICE_ID = price.id;

    // 2. Seed the SBE2E product/tier row with those live IDs so that
    //    createSaasSubscriptionAction's Stripe call resolves.
    const { sqlite, db } = openTestDb();
    try {
      await seedSbE2e(db, {
        stripeProductId: LIVE_STRIPE_PRODUCT_ID,
        stripeMonthlyPriceId: LIVE_STRIPE_PRICE_ID,
      });
    } finally {
      sqlite.close();
    }
  });

  test("full golden-path flow: pricing → checkout → pay → magic-link → onboarding → portal", async ({
    browser,
  }) => {
    const context = await browser.newContext({
      storageState: { cookies: [], origins: [] },
      viewport: { width: 1280, height: 900 },
    });
    const page = await context.newPage();
    try {
      // ── Stage 1: pricing ──────────────────────────────────────────
      await page.goto("/get-started/pricing", {
        waitUntil: "domcontentloaded",
      });
      const tierCta = page
        .getByTestId("pricing-grid-desktop")
        .locator(`[data-product-slug="${SBE2E.productSlug}"]`)
        .locator('[data-testid="tier-card-rank-2"] a[data-testid^="cta-"]');
      await expect(tierCta).toBeVisible({ timeout: 20_000 });
      await tierCta.click();

      // ── Stage 2: checkout page loaded ─────────────────────────────
      await expect(page).toHaveURL(/\/get-started\/checkout/, {
        timeout: 20_000,
      });
      await expect(page.getByTestId("checkout-header")).toBeVisible({
        timeout: 20_000,
      });
      await expect(page.getByTestId("checkout-tier-name")).toHaveText(
        SBE2E.tierName,
      );

      // ── Stage 3: fill identity + keep monthly (default) + continue ─
      await page
        .getByTestId("checkout-email-input")
        .fill(SUBSCRIBER_EMAIL);
      await page
        .getByTestId("checkout-business-name-input")
        .fill(SUBSCRIBER_BUSINESS);

      // Monthly is default-selected; no click needed. Sanity-check it.
      await expect(
        page.getByTestId("commitment-card-monthly"),
      ).toHaveAttribute("data-selected", "true");

      await page.getByTestId("checkout-continue-button").click();

      // Action creates Stripe sub + DB deal; payment phase renders with
      // the Payment Element iframe.
      await expect(page.getByTestId("checkout-payment-phase")).toBeVisible({
        timeout: 60_000,
      });

      // ── Stage 4: fill Stripe Payment Element (live iframe) ────────
      const stripeFrame = await waitForStripePaymentFrame(page);

      // Card number / expiry / CVC labels are consistent across Stripe
      // Payment Element locales; AU postcode field appears for AUD.
      await stripeFrame
        .getByLabel(/card number/i)
        .fill("4242 4242 4242 4242");
      await stripeFrame
        .getByLabel(/expiration|expiry|MM \/ YY/i)
        .fill("12 / 34");
      await stripeFrame.getByLabel(/CVC|security code/i).fill("123");
      // Postcode field is optional — only present for AU. Best-effort fill.
      const postcode = stripeFrame.getByLabel(/postal code|postcode|ZIP/i);
      if (await postcode.count()) {
        await postcode.fill("3000");
      }

      await page.getByTestId("checkout-pay-button").click();

      // ── Stage 5: redirect to /get-started/welcome ─────────────────
      await expect(page).toHaveURL(/\/get-started\/welcome/, {
        timeout: 90_000,
      });
      await expect(page.getByTestId("welcome-page")).toBeVisible();

      // ── Stage 6: assert server-side state landed ───────────────────
      const userId = await waitForUser(SUBSCRIBER_EMAIL);
      expect(userId).not.toBeNull();

      const { sqlite, db } = openTestDb();
      try {
        // The action links the deal via primary_contact_id = contactId,
        // not userId — look up by the newly-created subscription state.
        const dealByOutcome = await db
          .select()
          .from(deals)
          .where(eq(deals.won_outcome, "saas"))
          .orderBy(desc(deals.created_at_ms))
          .limit(1)
          .get();
        expect(dealByOutcome).toBeTruthy();
        expect(dealByOutcome!.stage).toBe("won");
        expect(dealByOutcome!.subscription_state).toBe("active");
        expect(dealByOutcome!.stripe_subscription_id).toBeTruthy();

        const activity = await db
          .select()
          .from(activity_log)
          .where(eq(activity_log.deal_id, dealByOutcome!.id))
          .all();
        expect(
          activity.some((a) => a.kind === "saas_subscription_created"),
        ).toBe(true);
      } finally {
        sqlite.close();
      }

      // ── Stage 7: mint magic-link token directly (bypass webhook) ──
      const rawToken = await mintMagicLinkToken(userId!);

      // ── Stage 8: redeem magic-link → /lite/onboarding ─────────────
      await page.goto(`/api/auth/magic-link?token=${rawToken}`, {
        waitUntil: "domcontentloaded",
      });
      await expect(page).toHaveURL(/\/lite\/onboarding$/, {
        timeout: 30_000,
      });

      const onboardingRoot = page.getByTestId("subscriber-onboarding");
      await expect(onboardingRoot).toHaveAttribute("data-variant", "active");

      const brandDnaCta = page.getByTestId("brand-dna-cta");
      await expect(brandDnaCta).toBeVisible();
      await expect(brandDnaCta).toHaveAttribute("href", "/lite/brand-dna");

      // ── Stage 9: /lite/portal/subscription renders ────────────────
      await page.goto("/lite/portal/subscription", {
        waitUntil: "domcontentloaded",
      });
      // Server Component dispatcher renders one of the branch panels.
      // We don't pin which — just that it mounted, not the kill-switch
      // fallback or an auth bounce.
      await expect(page).toHaveURL(/\/lite\/portal\/subscription$/, {
        timeout: 20_000,
      });
      await expect(page.locator("body")).not.toContainText(
        /sign in|log in|not authorised|403/i,
      );
    } finally {
      await context.close();
    }
  });
});

/**
 * The Payment Element mounts inside at least one `__privateStripeFrame*`
 * iframe. We wait for one to appear and return a FrameLocator that
 * contains the `card number` field — Stripe renders multiple helper
 * iframes (controller, metrics); only the card frame has the inputs.
 */
async function waitForStripePaymentFrame(page: Page): Promise<FrameLocator> {
  // Give Stripe.js time to mount.
  await page.waitForTimeout(1_000);
  const locators = page.locator('iframe[name^="__privateStripeFrame"]');
  await expect(locators.first()).toBeAttached({ timeout: 30_000 });
  const count = await locators.count();
  for (let i = 0; i < count; i++) {
    const name = await locators.nth(i).getAttribute("name");
    if (!name) continue;
    const frame = page.frameLocator(`iframe[name="${name}"]`);
    // Probe: does this frame expose the card number field?
    if ((await frame.getByLabel(/card number/i).count()) > 0) {
      return frame;
    }
  }
  throw new Error(
    "Stripe Payment Element frame with card number field not found.",
  );
}

/**
 * Poll the hermetic DB for the user row the checkout action writes in the
 * same transaction as the Stripe subscription create. Returns the user id.
 */
async function waitForUser(email: string): Promise<string | null> {
  const emailNorm = email.trim().toLowerCase();
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    const { sqlite, db } = openTestDb();
    try {
      const row = await db
        .select({ id: userTable.id })
        .from(userTable)
        .where(eq(userTable.email, emailNorm))
        .limit(1)
        .get();
      if (row?.id) return row.id;
    } finally {
      sqlite.close();
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  return null;
}

/**
 * Mint a subscriber magic-link token row directly in the hermetic DB.
 * We bypass `issueSubscriberMagicLink` because its transitive
 * `settings.get()` call would bind to the TEST process's global DB
 * handle, not the webServer's — two separate better-sqlite3 handles on
 * the same file. Inserting the row directly is fine for the E2E: the
 * webServer reads the token_hash back via its own handle.
 */
async function mintMagicLinkToken(userId: string): Promise<string> {
  const rawToken = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(rawToken).digest("hex");
  const now = Date.now();
  const { sqlite, db } = openTestDb();
  try {
    await db.insert(subscriber_magic_link_tokens).values({
      id: randomUUID(),
      user_id: userId,
      token_hash: tokenHash,
      issued_for: "sbe2e_test_mint",
      expires_at_ms: now + 60 * 60 * 1000,
      consumed_at_ms: null,
      created_at_ms: now,
    });
  } finally {
    sqlite.close();
  }
  return rawToken;
}
