/**
 * SP-7 — Stripe webhook dispatch critical-flow E2E smoke.
 *
 * POSTs a signed `checkout.session.completed` for a seeded `quoted` deal
 * straight at the dev-server's webhook route and asserts:
 *   1. Response 200 with `{ dispatch: "ok" }`.
 *   2. Deal landed in `won` with `won_outcome='retainer'` + `value_cents`
 *      populated + `value_estimated=false`.
 *   3. `webhook_events` has a row keyed on the event id with `result='ok'`.
 *   4. Replaying the same event is a no-op (`{ dispatch: "replay" }`).
 *
 * Hermetic: no live Stripe calls; the signature is generated locally from
 * the Playwright fixture `STRIPE_WEBHOOK_SECRET`.
 *
 * Skipped when `SP7_WEBHOOK_E2E` env var is unset — keeps CI green on
 * machines without Playwright + the dev server running. Opt in with:
 *   SP7_WEBHOOK_E2E=1 npm run test:e2e
 *
 * Owner: SP-7.
 */
import { test, expect } from "@playwright/test";
import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";

import { openTestDb } from "./fixtures/seed-db";
import { buildSignedWebhook } from "./fixtures/stripe-signature";
import { companies } from "@/lib/db/schema/companies";
import { deals } from "@/lib/db/schema/deals";
import { webhook_events } from "@/lib/db/schema/webhook-events";

const ENABLED = process.env.SP7_WEBHOOK_E2E === "1";

test.describe("SP-7 stripe webhook critical flow", () => {
  test.skip(
    !ENABLED,
    "Set SP7_WEBHOOK_E2E=1 to run the SP-7 webhook dispatch E2E.",
  );

  test("signed checkout.session.completed advances deal to Won", async ({
    request,
  }) => {
    const { db, sqlite } = openTestDb();
    try {
      const nowMs = Date.now();
      const companyId = randomUUID();
      await db.insert(companies).values({
        id: companyId,
        name: "SP-7 E2E",
        name_normalised: "sp-7-e2e",
        billing_mode: "stripe",
        do_not_contact: false,
        trial_shoot_status: "none",
        first_seen_at_ms: nowMs,
        created_at_ms: nowMs,
        updated_at_ms: nowMs,
      });
      const dealId = randomUUID();
      await db.insert(deals).values({
        id: dealId,
        company_id: companyId,
        title: "SP-7 E2E deal",
        stage: "quoted",
        value_estimated: true,
        pause_used_this_commitment: false,
        last_stage_change_at_ms: nowMs,
        created_at_ms: nowMs,
        updated_at_ms: nowMs,
      });

      const session = {
        id: `cs_e2e_${randomUUID()}`,
        object: "checkout.session",
        currency: "aud",
        amount_total: 250000,
        metadata: { deal_id: dealId, product_type: "retainer" },
      };
      const { body, signature, eventId } = buildSignedWebhook(
        "checkout.session.completed",
        session,
      );

      const res = await request.post("/api/stripe/webhook", {
        data: body,
        headers: {
          "content-type": "application/json",
          "stripe-signature": signature,
        },
      });
      expect(res.status()).toBe(200);
      const json = (await res.json()) as { dispatch?: string };
      expect(json.dispatch).toBe("ok");

      const deal = await db
        .select()
        .from(deals)
        .where(eq(deals.id, dealId))
        .limit(1);
      expect(deal[0]?.stage).toBe("won");
      expect(deal[0]?.won_outcome).toBe("retainer");
      expect(deal[0]?.value_cents).toBe(250000);
      expect(deal[0]?.value_estimated).toBe(false);

      const evRow = await db
        .select()
        .from(webhook_events)
        .where(eq(webhook_events.id, eventId))
        .limit(1);
      expect(evRow[0]?.result).toBe("ok");

      // Replay: same body + signature. Should short-circuit.
      const replay = await request.post("/api/stripe/webhook", {
        data: body,
        headers: {
          "content-type": "application/json",
          "stripe-signature": signature,
        },
      });
      expect(replay.status()).toBe(200);
      const replayJson = (await replay.json()) as { dispatch?: string };
      expect(replayJson.dispatch).toBe("replay");
    } finally {
      sqlite.close();
    }
  });
});
