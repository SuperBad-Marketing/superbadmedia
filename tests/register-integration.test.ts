/**
 * SW-3 — registerIntegration tests.
 *
 * Hermetic sqlite db + in-memory CREDENTIAL_VAULT_KEY. Asserts row write,
 * ciphertext round-trip, deterministic band_registration_hash, and
 * kill-switch short-circuit.
 */
import fs from "node:fs";
import path from "node:path";
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate as drizzleMigrate } from "drizzle-orm/better-sqlite3/migrator";
import { integration_connections } from "@/lib/db/schema/integration-connections";
import { killSwitches, resetKillSwitchesToDefaults } from "@/lib/kill-switches";
import { stripeManifest } from "@/lib/integrations/vendors/stripe";

process.env.CREDENTIAL_VAULT_KEY = "a".repeat(64);

const { registerIntegration } = await import(
  "@/lib/integrations/registerIntegration"
);
const { vault } = await import("@/lib/crypto/vault");

const TEST_DB = path.join(process.cwd(), "tests/.test-register-integration.db");

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
  resetKillSwitchesToDefaults();
});

beforeEach(() => {
  sqlite.exec("DELETE FROM integration_connections");
  killSwitches.setup_wizards_enabled = true;
});

describe("registerIntegration", () => {
  it("inserts an integration_connections row with encrypted credentials", async () => {
    const result = await registerIntegration(
      {
        wizardCompletionId: "wc-1",
        manifest: stripeManifest,
        credentials: { plaintext: "sk_test_abc123" },
        metadata: { account_id: "acct_123" },
        ownerType: "admin",
        ownerId: "user-andy",
      },
      db,
    );

    expect(result.connectionId).toBeTruthy();
    expect(result.bandsRegistered).toEqual([
      "stripe.customer.create",
      "stripe.invoice.create",
      "stripe.webhook.receive",
    ]);

    const rows = await db.select().from(integration_connections);
    expect(rows).toHaveLength(1);
    const row = rows[0];
    expect(row.vendor_key).toBe("stripe-admin");
    expect(row.owner_type).toBe("admin");
    expect(row.owner_id).toBe("user-andy");
    expect(row.status).toBe("active");
    expect(row.connected_via_wizard_completion_id).toBe("wc-1");
    // Ciphertext round-trip.
    expect(
      vault.decrypt(row.credentials, "stripe-admin.credentials"),
    ).toBe("sk_test_abc123");
  });

  it("stamps a deterministic band_registration_hash for identical manifests", async () => {
    await registerIntegration(
      {
        wizardCompletionId: "wc-a",
        manifest: stripeManifest,
        credentials: { plaintext: "k1" },
        metadata: {},
        ownerType: "admin",
        ownerId: "u1",
      },
      db,
    );
    await registerIntegration(
      {
        wizardCompletionId: "wc-b",
        manifest: stripeManifest,
        credentials: { plaintext: "k2" },
        metadata: {},
        ownerType: "admin",
        ownerId: "u2",
      },
      db,
    );
    const rows = await db.select().from(integration_connections);
    expect(rows).toHaveLength(2);
    expect(rows[0].band_registration_hash).toBe(rows[1].band_registration_hash);
  });

  it("kill-switch off → throws and writes no row", async () => {
    killSwitches.setup_wizards_enabled = false;
    await expect(
      registerIntegration(
        {
          wizardCompletionId: "wc-x",
          manifest: stripeManifest,
          credentials: { plaintext: "k" },
          metadata: {},
          ownerType: "admin",
          ownerId: "u",
        },
        db,
      ),
    ).rejects.toThrow(/setup_wizards_enabled/);
    const rows = await db.select().from(integration_connections);
    expect(rows).toHaveLength(0);
  });
});
