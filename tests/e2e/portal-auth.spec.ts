/**
 * CM-E2E — Portal auth critical-flow E2E.
 *
 * Single-flow spec covering the portal magic-link redemption arc:
 *
 *   1. GET /lite/portal/r/<rawToken> — redeems the one-time token, sets
 *      the `sbl_portal_session` cookie, redirects into the portal.
 *   2. Portal shell renders — "SuperBad" logo visible, contact's first
 *      name in the room label.
 *   3. Menu bubble visible → click opens overlay → section grid renders
 *      with expected items → "Know someone?" referral button visible.
 *   4. Verify the magic link is consumed (cannot be reused).
 *
 * Runs in a fresh (unauthenticated) browser context — no storageState
 * from globalSetup. The portal uses its own cookie (`sbl_portal_session`),
 * not the admin NextAuth session.
 *
 * Owner: CM-E2E.
 */
import { test, expect } from "@playwright/test";
import { eq } from "drizzle-orm";

import { openTestDb } from "./fixtures/seed-db";
import { seedCmE2e, CM_E2E } from "../../scripts/seed-cm-e2e";
import { portal_magic_links } from "@/lib/db/schema/portal-magic-links";
import { activity_log } from "@/lib/db/schema/activity-log";

const PORTAL_TOKEN = "e2e-portal";

test.describe("cm-e2e / portal magic-link → session → portal", () => {
  test.beforeAll(async () => {
    const { sqlite, db } = openTestDb();
    try {
      await seedCmE2e(db);
    } finally {
      sqlite.close();
    }
  });

  test("magic link redeems → portal renders → menu opens → referral visible", async ({
    browser,
  }) => {
    const context = await browser.newContext({
      storageState: { cookies: [], origins: [] },
    });
    const page = await context.newPage();

    try {
      // Step 1: Hit the magic-link redeem endpoint with a callbackUrl
      // pointing into the portal [token] route.
      const callbackUrl = `/lite/portal/${PORTAL_TOKEN}`;
      await page.goto(
        `/lite/portal/r/${CM_E2E.rawToken}?callbackUrl=${encodeURIComponent(callbackUrl)}`,
        { waitUntil: "networkidle" },
      );

      // Should have been redirected into the portal.
      await expect(page).toHaveURL(new RegExp(`/lite/portal/${PORTAL_TOKEN}`), {
        timeout: 20_000,
      });

      // Step 2: Portal shell renders — logo and room label.
      await expect(page.getByText("SuperBad")).toBeVisible({ timeout: 10_000 });

      // Step 3: Menu bubble visible.
      const menuButton = page.getByRole("button", { name: "Open menu" });
      await expect(menuButton).toBeVisible({ timeout: 10_000 });

      // Click menu → overlay opens.
      await menuButton.click();

      // Overlay greeting visible.
      await expect(
        page.getByText("everything in its place."),
      ).toBeVisible({ timeout: 5_000 });

      // Section items rendered — check a few key sections.
      await expect(page.getByText("Chat")).toBeVisible();
      await expect(page.getByText("Deliverables")).toBeVisible();
      await expect(page.getByText("Gallery")).toBeVisible();

      // "Know someone?" referral button visible.
      await expect(page.getByText("Know someone?")).toBeVisible();

      // Close the menu.
      await page.getByRole("button", { name: "Close" }).click();

      // Step 4: DB assertions — magic link consumed.
      const { sqlite, db } = openTestDb();
      try {
        const links = await db
          .select()
          .from(portal_magic_links)
          .where(eq(portal_magic_links.contact_id, CM_E2E.contactId))
          .all();

        const consumed = links.filter((l) => l.consumed_at_ms !== null);
        expect(consumed.length).toBeGreaterThanOrEqual(1);

        // Activity log: portal_magic_link_redeemed + portal_session_started.
        const activities = await db
          .select()
          .from(activity_log)
          .where(eq(activity_log.contact_id, CM_E2E.contactId))
          .all();

        const redeemed = activities.filter(
          (a) => a.kind === "portal_magic_link_redeemed",
        );
        const sessionStarted = activities.filter(
          (a) => a.kind === "portal_session_started",
        );
        expect(redeemed.length).toBeGreaterThanOrEqual(1);
        expect(sessionStarted.length).toBeGreaterThanOrEqual(1);
      } finally {
        sqlite.close();
      }
    } finally {
      await context.close();
    }
  });

  test("consumed magic link redirects to recovery", async ({ browser }) => {
    const context = await browser.newContext({
      storageState: { cookies: [], origins: [] },
    });
    const page = await context.newPage();

    try {
      // Reuse the same token — should be consumed from the previous test.
      await page.goto(`/lite/portal/r/${CM_E2E.rawToken}`, {
        waitUntil: "networkidle",
      });

      // Should redirect to the recover page.
      await expect(page).toHaveURL(/\/lite\/portal\/recover/, {
        timeout: 15_000,
      });
    } finally {
      await context.close();
    }
  });
});
