/**
 * stripe-webhook-route.test.ts
 *
 * Tests for `app/api/stripe/webhook/route.ts`.
 *
 *   - missing signature / missing secret → 400
 *   - bad signature → 400 (no external_call_log row written)
 *   - valid event → 200 + one external_call_log row with
 *     job="stripe.webhook.receive", actor_type="internal",
 *     estimated_cost_aud=0, units={event_type,event_id}
 *
 * Uses a hermetic sqlite db mocked in for `@/lib/db`, and mocks
 * `@/lib/stripe/client` to control `webhooks.constructEvent`.
 *
 * Owner: SW-5b.
 */

import fs from "node:fs";
import path from "node:path";
import {
  describe,
  it,
  expect,
  vi,
  beforeAll,
  afterAll,
  beforeEach,
} from "vitest";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate as drizzleMigrate } from "drizzle-orm/better-sqlite3/migrator";
import { eq } from "drizzle-orm";

import { external_call_log } from "@/lib/db/schema/external-call-log";

const TEST_DB = path.join(process.cwd(), "tests/.test-stripe-webhook.db");

let sqlite: Database.Database;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let testDb: ReturnType<typeof drizzle<any>>;

vi.mock("@/lib/db", () => ({
  get db() {
    return testDb;
  },
}));

const constructEventMock = vi.fn();

vi.mock("stripe", () => {
  class StripeStub {
    webhooks = { constructEvent: constructEventMock };
  }
  return { __esModule: true, default: StripeStub };
});

const { POST } = await import("@/app/api/stripe/webhook/route");

beforeAll(() => {
  if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);
  sqlite = new Database(TEST_DB);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  testDb = drizzle(sqlite);
  drizzleMigrate(testDb, {
    migrationsFolder: path.join(process.cwd(), "lib/db/migrations"),
  });
});

afterAll(() => {
  sqlite.close();
  for (const ext of ["", "-wal", "-shm"]) {
    const p = `${TEST_DB}${ext}`;
    if (fs.existsSync(p)) fs.unlinkSync(p);
  }
});

beforeEach(() => {
  constructEventMock.mockReset();
  process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";
  sqlite.exec("DELETE FROM external_call_log");
});

describe("/api/stripe/webhook POST", () => {
  it("returns 400 when stripe-signature header is missing", async () => {
    const req = new Request("http://localhost/api/stripe/webhook", {
      method: "POST",
      body: "{}",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    expect(constructEventMock).not.toHaveBeenCalled();
  });

  it("returns 400 when STRIPE_WEBHOOK_SECRET is unset", async () => {
    delete process.env.STRIPE_WEBHOOK_SECRET;
    const req = new Request("http://localhost/api/stripe/webhook", {
      method: "POST",
      headers: { "stripe-signature": "sig" },
      body: "{}",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 on bad signature and writes no log row", async () => {
    constructEventMock.mockImplementation(() => {
      throw new Error("bad signature");
    });
    const req = new Request("http://localhost/api/stripe/webhook", {
      method: "POST",
      headers: { "stripe-signature": "sig_bad" },
      body: "{}",
    });
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await POST(req);
    errorSpy.mockRestore();
    expect(res.status).toBe(400);

    const rows = await testDb
      .select()
      .from(external_call_log)
      .where(eq(external_call_log.job, "stripe.webhook.receive"));
    expect(rows).toHaveLength(0);
  });

  it("returns 200 on valid event and writes one external_call_log row", async () => {
    constructEventMock.mockReturnValue({
      id: "evt_test_1",
      type: "customer.created",
    } as never);

    const req = new Request("http://localhost/api/stripe/webhook", {
      method: "POST",
      headers: { "stripe-signature": "sig_ok" },
      body: JSON.stringify({ id: "evt_test_1", type: "customer.created" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = (await res.json()) as { received: boolean };
    expect(json.received).toBe(true);

    const rows = await testDb
      .select()
      .from(external_call_log)
      .where(eq(external_call_log.job, "stripe.webhook.receive"));
    expect(rows).toHaveLength(1);
    expect(rows[0].actor_type).toBe("internal");
    expect(rows[0].estimated_cost_aud).toBe(0);
    expect(rows[0].units).toEqual({
      event_type: "customer.created",
      event_id: "evt_test_1",
    });
  });

  it("still returns 200 if external_call_log insert fails (never throws)", async () => {
    constructEventMock.mockReturnValue({
      id: "evt_test_2",
      type: "invoice.paid",
    } as never);
    // Break the table to force an insert failure without disturbing schema state.
    sqlite.exec("DROP TABLE external_call_log");

    const req = new Request("http://localhost/api/stripe/webhook", {
      method: "POST",
      headers: { "stripe-signature": "sig_ok" },
      body: "{}",
    });
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await POST(req);
    errorSpy.mockRestore();
    expect(res.status).toBe(200);
  });
});
