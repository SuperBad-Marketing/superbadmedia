/**
 * SW-3 — verifyCompletion tests.
 *
 * Uses a hermetic sqlite db. Mocks @/lib/settings so `wizards.verify_timeout_ms`
 * is supplied without needing the full seed pipeline.
 */
import fs from "node:fs";
import path from "node:path";
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate as drizzleMigrate } from "drizzle-orm/better-sqlite3/migrator";
import { randomUUID } from "node:crypto";
import { integration_connections } from "@/lib/db/schema/integration-connections";
import { activity_log } from "@/lib/db/schema/activity-log";
import type { WizardDefinition } from "@/lib/wizards/types";
import { stripeManifest } from "@/lib/integrations/vendors/stripe";

vi.mock("@/lib/settings", () => ({
  default: {
    get: vi.fn(async (key: string) => {
      if (key === "wizards.verify_timeout_ms") return 200;
      throw new Error(`Unexpected settings key: ${key}`);
    }),
  },
}));

const { verifyCompletion } = await import("@/lib/wizards/verify-completion");

const TEST_DB = path.join(process.cwd(), "tests/.test-verify-completion.db");

let sqlite: Database.Database;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let db: ReturnType<typeof drizzle<any>>;

beforeAll(() => {
  if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);
  sqlite = new Database(TEST_DB);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  db = drizzle(sqlite);
  drizzleMigrate(db, {
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
  sqlite.exec("DELETE FROM integration_connections");
  sqlite.exec("DELETE FROM activity_log");
});

type StripePayload = {
  apiKey: string;
  webhookId: string;
};

function makeDef(
  overrides: Partial<WizardDefinition<StripePayload>["completionContract"]> = {},
  withManifest = true,
): WizardDefinition<StripePayload> {
  return {
    key: "stripe-admin",
    audience: "admin",
    renderMode: "slideover",
    steps: [],
    completionContract: {
      required: ["apiKey", "webhookId"],
      verify: async () => ({ ok: true }),
      artefacts: {},
      ...overrides,
    },
    vendorManifest: withManifest ? stripeManifest : undefined,
    voiceTreatment: {
      introCopy: "",
      outroCopy: "",
      tabTitlePool: {
        setup: [],
        connecting: [],
        confirming: [],
        connected: [],
        stuck: [],
      },
    },
  };
}

describe("verifyCompletion", () => {
  it("happy path: required keys present + verify() ok + no artefacts", async () => {
    const def = makeDef();
    const res = await verifyCompletion(
      def,
      { apiKey: "sk_1", webhookId: "wh_1" },
      undefined,
      db,
    );
    expect(res).toEqual({ ok: true });
  });

  it("fails when a required key is missing", async () => {
    const def = makeDef();
    const res = await verifyCompletion(
      def,
      { apiKey: "sk_1" } as StripePayload,
      undefined,
      db,
    );
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toMatch(/webhookId/);
  });

  it("times out if verify() hangs past wizards.verify_timeout_ms", async () => {
    const def = makeDef({
      verify: () =>
        new Promise(() => {
          /* never resolves */
        }),
    });
    const res = await verifyCompletion(
      def,
      { apiKey: "x", webhookId: "y" },
      undefined,
      db,
    );
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toMatch(/timed out/);
  });

  it("artefact integrationConnections: passes when row exists for vendor+owner", async () => {
    const def = makeDef({
      artefacts: { integrationConnections: true },
    });
    const now = Date.now();
    await db.insert(integration_connections).values({
      id: randomUUID(),
      vendor_key: "stripe-admin",
      owner_type: "admin",
      owner_id: "user-andy",
      credentials: "x",
      metadata: {},
      connection_verified_at_ms: now,
      band_registration_hash: "h",
      status: "active",
      created_at_ms: now,
      updated_at_ms: now,
    });
    const res = await verifyCompletion(
      def,
      { apiKey: "x", webhookId: "y" },
      { ownerType: "admin", ownerId: "user-andy" },
      db,
    );
    expect(res).toEqual({ ok: true });
  });

  it("artefact integrationConnections: fails when row is missing", async () => {
    const def = makeDef({
      artefacts: { integrationConnections: true },
    });
    const res = await verifyCompletion(
      def,
      { apiKey: "x", webhookId: "y" },
      { ownerType: "admin", ownerId: "nobody" },
      db,
    );
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toMatch(/integration_connections/);
  });

  it("artefact activityLog: passes when a recent row of that kind exists", async () => {
    const def = makeDef({
      artefacts: { activityLog: "wizard_completed" },
    });
    sqlite
      .prepare(
        "INSERT INTO activity_log (id, kind, body, created_at_ms) VALUES (?, ?, ?, ?)",
      )
      .run(randomUUID(), "wizard_completed", "hi", Date.now());
    const res = await verifyCompletion(
      def,
      { apiKey: "x", webhookId: "y" },
      undefined,
      db,
    );
    expect(res).toEqual({ ok: true });
    // silence unused import warning
    void activity_log;
  });

  it("artefact activityLog: fails when no matching row exists", async () => {
    const def = makeDef({
      artefacts: { activityLog: "wizard_completed" },
    });
    const res = await verifyCompletion(
      def,
      { apiKey: "x", webhookId: "y" },
      undefined,
      db,
    );
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toMatch(/activity_log/);
  });
});
