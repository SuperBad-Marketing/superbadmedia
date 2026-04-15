/**
 * QB-POLISH-1 fix 3 — Brand DNA question selection regression.
 *
 * BDA-POLISH-1 fixed a leak where selecting option A on question 1
 * would pre-highlight option A on question 2 after server redirect
 * (the same QuestionCardClient instance was reconciled with a new
 * `question` prop while `selected` state carried forward). Fix:
 * `useEffect(..., [question.id])` reset in `question-card-client.tsx`.
 *
 * This spec walks three consecutive single-select questions and
 * asserts no `data-selected="true"` attribute carries over between
 * them.
 *
 * Closes: bdapolish1_question_selection_regression_e2e.
 */
import { test, expect } from "@playwright/test";
import { encode } from "@auth/core/jwt";

import { E2E_USER } from "./fixtures/seed-db";
import { E2E_CONSTANTS } from "../../playwright.config";

async function brandDnaStorageState() {
  const exp = Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60;
  const token = await encode({
    token: {
      sub: E2E_USER.id,
      id: E2E_USER.id,
      email: E2E_USER.email,
      name: E2E_USER.name,
      role: E2E_USER.role,
      // Gate bypass: `brand_dna_complete` lets the proxy pass /lite/*;
      // the page itself reads `brand_dna_profiles` and falls through
      // to the alignment gate when no profile exists. `critical_flight_complete`
      // bypasses the first-run wizard redirect.
      brand_dna_complete: true,
      critical_flight_complete: true,
      iat: Math.floor(Date.now() / 1000),
      exp,
    } as Record<string, unknown>,
    secret: E2E_CONSTANTS.NEXTAUTH_SECRET,
    salt: "authjs.session-token",
  });
  return {
    cookies: [
      {
        name: "authjs.session-token",
        value: token,
        domain: "127.0.0.1",
        path: "/",
        httpOnly: true,
        secure: false,
        sameSite: "Lax" as const,
        expires: exp,
      },
    ],
    origins: [],
  };
}

test.describe("brand-dna / question selection does not leak between questions", () => {
  test("selecting option A on Q1 does not pre-highlight Q2 or Q3", async ({
    browser,
  }) => {
    const context = await browser.newContext({
      storageState: await brandDnaStorageState(),
    });
    const page = await context.newPage();

    try {
      // Alignment gate — pick track A (founder).
      await page.goto("/lite/brand-dna");
      await expect(
        page.getByText("Does your business represent your personality?"),
      ).toBeVisible({ timeout: 10_000 });
      await page
        .locator('button.bda-opt:has-text("Completely")')
        .first()
        .click();

      // Land on section 1 / Q1. Wait for the question eyebrow.
      await page.waitForURL(/\/lite\/brand-dna\/section\/1/);
      await expect(page.locator("text=/Q1 of/i")).toBeVisible();

      // Q1: four options; click option A, wait for Q2.
      const q1Options = page.locator("button.bda-opt");
      await expect(q1Options).toHaveCount(4);
      await q1Options.nth(0).click();

      await expect(page.locator("text=/Q2 of/i")).toBeVisible();

      // Q2: no option should carry a selected state over from Q1.
      const q2Options = page.locator("button.bda-opt");
      await expect(q2Options).toHaveCount(4);
      await expect(
        page.locator('button.bda-opt[data-selected="true"]'),
      ).toHaveCount(0);

      // Click Q2 option A, land on Q3, assert no leak.
      await q2Options.nth(0).click();
      await expect(page.locator("text=/Q3 of/i")).toBeVisible();
      await expect(
        page.locator('button.bda-opt[data-selected="true"]'),
      ).toHaveCount(0);
    } finally {
      await context.close();
    }
  });
});
