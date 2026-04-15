/**
 * BI-E2E — Branded Invoicing critical flow.
 *
 * Drives the path §G12 mandates:
 *   seeded draft invoice
 *     → admin drawer "Send now" (Server Action) → status: sent
 *     → public `/lite/invoices/[token]` renders Payment Element
 *     → signed `payment_intent.succeeded` hits `/api/stripe/webhook`
 *       (metadata.product_type="invoice", metadata.invoice_id=<id>)
 *     → status: paid, paid_via=stripe, paid_at_ms stamped
 *       + activity_log kind=invoice_paid_online exists
 *     → re-delivery is idempotent (no duplicate log, paid_at unchanged)
 *     → public page flips to the "Payment received" confirmation view.
 *
 * Runs with `llm_calls_enabled=false` (webServer default) so the
 * deterministic email composer is the path under test. LLM-drafted
 * emails have unit coverage in `tests/bi2b-ii-compose-emails.test.ts`.
 *
 * The PI route (`/api/invoices/[token]/payment-intent`) is exercised
 * under `BI_E2E_STRIPE=1` only — it requires a live Stripe test key
 * and is covered hermetically by
 * `tests/stripe/dispatch-payment-intent-invoice.test.ts`.
 *
 * Owner: BI-E2E (Wave 7 closer).
 */
import { test, expect, type APIRequestContext } from "@playwright/test";
import { and, eq } from "drizzle-orm";
import { encode } from "@auth/core/jwt";

import { E2E_USER, openTestDb } from "./fixtures/seed-db";
import { buildSignedWebhook } from "./fixtures/stripe-signature";
import { seedBiE2e, BI_E2E } from "../../scripts/seed-bi-e2e";
import { E2E_CONSTANTS } from "../../playwright.config";
import { invoices } from "@/lib/db/schema/invoices";
import { activity_log } from "@/lib/db/schema/activity-log";
import { killSwitches } from "@/lib/kill-switches";

let seeded: Awaited<ReturnType<typeof seedBiE2e>>;

// BI-E2E drives `/lite/admin/invoices`, which sits behind the
// critical-flight gate. The shared `seed-db` storageState sets
// `critical_flight_complete: false` so the sibling `critical-flight-*`
// specs can assert the gate redirect; we mint a parallel cookie with
// the flag flipped on for this spec only.
async function adminStorageState(): Promise<{
  cookies: Array<{
    name: string;
    value: string;
    domain: string;
    path: string;
    httpOnly: boolean;
    secure: boolean;
    sameSite: "Lax";
    expires: number;
  }>;
  origins: never[];
}> {
  const exp = Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60;
  const token = await encode({
    token: {
      sub: E2E_USER.id,
      id: E2E_USER.id,
      email: E2E_USER.email,
      name: E2E_USER.name,
      role: E2E_USER.role,
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
        sameSite: "Lax",
        expires: exp,
      },
    ],
    origins: [],
  };
}

test.describe.configure({ mode: "serial" });

test.describe("bi-e2e / invoice online-payment critical flow", () => {
  test.beforeAll(async () => {
    const { sqlite, db } = openTestDb();
    try {
      seeded = await seedBiE2e(db);
    } finally {
      sqlite.close();
    }
  });

  test("precondition — manual-cycle enqueue kill-switch is ON", () => {
    expect(killSwitches.invoicing_manual_cycle_enqueue_enabled).toBe(true);
  });

  test("admin drawer — Send now flips draft → sent", async ({ browser }) => {
    const context = await browser.newContext({
      storageState: await adminStorageState(),
    });
    const page = await context.newPage();
    try {
    await page.goto(`/lite/admin/invoices?invoice=${seeded.invoiceId}`);

    // Drawer renders the action matrix only once `loadInvoiceDetail`
    // resolves; the `Send now` button is the reliable signal.
    const sendBtn = page.getByRole("button", { name: "Send now" });
    await expect(sendBtn).toBeVisible({ timeout: 15_000 });
    await sendBtn.click();

    // Poll the row directly — the drawer's toast + router.refresh may
    // land after the Server Action resolves.
    await expect
      .poll(
        () => {
          const { sqlite, db } = openTestDb();
          try {
            const row = db
              .select()
              .from(invoices)
              .where(eq(invoices.id, seeded.invoiceId))
              .get();
            return row?.status;
          } finally {
            sqlite.close();
          }
        },
        { timeout: 15_000, intervals: [300, 500, 1_000] },
      )
      .toBe("sent");

    const { sqlite, db } = openTestDb();
    try {
      const sentLogs = await db
        .select()
        .from(activity_log)
        .where(
          and(
            eq(activity_log.deal_id, seeded.dealId),
            eq(activity_log.kind, "invoice_sent"),
          ),
        )
        .all();
      expect(sentLogs.length).toBeGreaterThanOrEqual(1);
    } finally {
      sqlite.close();
    }
    } finally {
      await context.close();
    }
  });

  test("public page — renders invoice + Payment Element", async ({
    browser,
  }) => {
    const context = await browser.newContext({
      storageState: { cookies: [], origins: [] },
    });
    const page = await context.newPage();
    try {
      await page.goto(`/lite/invoices/${seeded.invoiceToken}`, {
        waitUntil: "networkidle",
      });
      await expect(
        page.getByTestId("invoice-payment-element"),
      ).toBeVisible({ timeout: 15_000 });
      await expect(
        page.getByText(seeded.invoiceNumber).first(),
      ).toBeVisible();
    } finally {
      await context.close();
    }
  });

  test("webhook payment_intent.succeeded → invoice paid + idempotent replay", async ({
    request,
  }) => {
    const event = buildSignedWebhook("payment_intent.succeeded", {
      id: `pi_bi_e2e_${Date.now()}`,
      object: "payment_intent",
      amount: 275_000,
      currency: "aud",
      status: "succeeded",
      customer: "cus_bi_e2e",
      metadata: {
        product_type: "invoice",
        invoice_id: seeded.invoiceId,
        invoice_number: seeded.invoiceNumber,
        deal_id: seeded.dealId,
        company_id: seeded.companyId,
      },
    });

    const res = await postWebhook(request, event);
    expect(res.status).toBe(200);
    expect(res.json.dispatch).toBe("ok");

    const { sqlite, db } = openTestDb();
    try {
      const row = await db
        .select()
        .from(invoices)
        .where(eq(invoices.id, seeded.invoiceId))
        .get();
      expect(row?.status).toBe("paid");
      expect(row?.paid_via).toBe("stripe");
      expect(row?.paid_at_ms).not.toBeNull();
      const firstPaidAt = row?.paid_at_ms;

      const logs = await db
        .select()
        .from(activity_log)
        .where(eq(activity_log.kind, "invoice_paid_online"))
        .all();
      expect(logs.length).toBe(1);

      // Replay — same signed event body. Stripe webhook dispatcher
      // short-circuits on the webhook_events table.
      const replay = await postWebhook(request, event);
      expect(replay.status).toBe(200);
      expect(replay.json.dispatch).toBe("replay");

      const afterReplay = await db
        .select()
        .from(invoices)
        .where(eq(invoices.id, seeded.invoiceId))
        .get();
      expect(afterReplay?.paid_at_ms).toBe(firstPaidAt);

      const logsAfter = await db
        .select()
        .from(activity_log)
        .where(eq(activity_log.kind, "invoice_paid_online"))
        .all();
      expect(logsAfter.length).toBe(1);
    } finally {
      sqlite.close();
    }
  });

  test("public page — post-paid renders confirmation variant", async ({
    browser,
  }) => {
    const context = await browser.newContext({
      storageState: { cookies: [], origins: [] },
    });
    const page = await context.newPage();
    try {
      await page.goto(`/lite/invoices/${seeded.invoiceToken}`, {
        waitUntil: "networkidle",
      });
      await expect(
        page.getByTestId("invoice-paid-confirmation"),
      ).toBeVisible({ timeout: 15_000 });
    } finally {
      await context.close();
    }
  });
});

async function postWebhook(
  request: APIRequestContext,
  event: { body: string; signature: string; eventId: string },
): Promise<{ status: number; json: { dispatch?: string } }> {
  const res = await request.post("/api/stripe/webhook", {
    data: event.body,
    headers: {
      "content-type": "application/json",
      "stripe-signature": event.signature,
    },
  });
  const json = (await res.json()) as { dispatch?: string };
  return { status: res.status(), json };
}
