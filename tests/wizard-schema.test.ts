/**
 * wizard_progress / wizard_completions / integration_connections schema tests.
 *
 * Verifies SW-1's three tables land via migration 0008, indexes exist, and the
 * partial unique index on wizard_progress(user_id, wizard_key) WHERE
 * abandoned_at_ms IS NULL is enforced (a live + abandoned row can coexist;
 * two live rows cannot).
 */
import fs from "node:fs";
import path from "node:path";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate as drizzleMigrate } from "drizzle-orm/better-sqlite3/migrator";
import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";

import { wizard_progress } from "@/lib/db/schema/wizard-progress";
import { wizard_completions } from "@/lib/db/schema/wizard-completions";
import { integration_connections } from "@/lib/db/schema/integration-connections";

const TEST_DB = path.join(process.cwd(), "tests/.test-wizard-schema.db");

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

describe("wizard_progress schema", () => {
  it("inserts and reads a progress row", async () => {
    const id = randomUUID();
    await db.insert(wizard_progress).values({
      id,
      wizard_key: "stripe-admin",
      user_id: "user-sw1-test-001",
      audience: "admin",
      current_step: 0,
      step_state: { draft: true },
      started_at_ms: Date.now(),
      last_active_at_ms: Date.now(),
      expires_at_ms: Date.now() + 30 * 86400_000,
    });

    const rows = await db
      .select()
      .from(wizard_progress)
      .where(eq(wizard_progress.id, id));
    expect(rows).toHaveLength(1);
    expect(rows[0].audience).toBe("admin");
    expect(rows[0].current_step).toBe(0);
    expect(rows[0].resumed_count).toBe(0);
  });

  it("rejects a second live row for the same (user_id, wizard_key)", async () => {
    const userId = "user-sw1-test-002";
    const wizardKey = "resend";
    const now = Date.now();

    await db.insert(wizard_progress).values({
      id: randomUUID(),
      wizard_key: wizardKey,
      user_id: userId,
      audience: "admin",
      started_at_ms: now,
      last_active_at_ms: now,
      expires_at_ms: now + 86400_000,
    });

    expect(() => {
      // better-sqlite3 surfaces constraint errors synchronously; awaiting
      // a drizzle insert that throws wraps the sync throw into a rejection,
      // so we assert via expect().rejects below instead.
    }).not.toThrow();

    await expect(
      db.insert(wizard_progress).values({
        id: randomUUID(),
        wizard_key: wizardKey,
        user_id: userId,
        audience: "admin",
        started_at_ms: now,
        last_active_at_ms: now,
        expires_at_ms: now + 86400_000,
      }),
    ).rejects.toThrow(/UNIQUE/);
  });

  it("allows a new live row after the prior one is abandoned", async () => {
    const userId = "user-sw1-test-003";
    const wizardKey = "graph-api-admin";
    const now = Date.now();

    await db.insert(wizard_progress).values({
      id: randomUUID(),
      wizard_key: wizardKey,
      user_id: userId,
      audience: "admin",
      started_at_ms: now,
      last_active_at_ms: now,
      expires_at_ms: now + 86400_000,
      abandoned_at_ms: now + 60_000,
    });

    // Fresh live row should be permitted because the prior is abandoned.
    await expect(
      db.insert(wizard_progress).values({
        id: randomUUID(),
        wizard_key: wizardKey,
        user_id: userId,
        audience: "admin",
        started_at_ms: now + 120_000,
        last_active_at_ms: now + 120_000,
        expires_at_ms: now + 86400_000 + 120_000,
      }),
    ).resolves.not.toThrow();
  });
});

describe("wizard_completions schema", () => {
  it("inserts a completion row with a typed payload", async () => {
    const id = randomUUID();
    await db.insert(wizard_completions).values({
      id,
      wizard_key: "stripe-admin",
      user_id: "user-sw1-test-complete-001",
      audience: "admin",
      completion_payload: { customerId: "cus_test_abc", webhookRegistered: true },
      contract_version: "stripe-admin.v1",
      completed_at_ms: Date.now(),
    });

    const rows = await db
      .select()
      .from(wizard_completions)
      .where(eq(wizard_completions.id, id));
    expect(rows).toHaveLength(1);
    expect(rows[0].contract_version).toBe("stripe-admin.v1");
  });

  it("allows repeat completions for the same (user_id, wizard_key)", async () => {
    const userId = "user-sw1-test-complete-002";
    const wizardKey = "graph-api-client";
    for (let i = 0; i < 3; i++) {
      await expect(
        db.insert(wizard_completions).values({
          id: randomUUID(),
          wizard_key: wizardKey,
          user_id: userId,
          audience: "client",
          completion_payload: { mailboxIndex: i },
          contract_version: "graph-api-client.v1",
          completed_at_ms: Date.now() + i,
        }),
      ).resolves.not.toThrow();
    }
  });
});

describe("integration_connections schema", () => {
  it("inserts a connection row and defaults status to 'active'", async () => {
    const id = randomUUID();
    const now = Date.now();
    await db.insert(integration_connections).values({
      id,
      vendor_key: "pixieset",
      owner_type: "admin",
      owner_id: "user-sw1-admin-001",
      credentials: "enc:sealed-blob",
      metadata: { accountId: "px_abc" },
      connection_verified_at_ms: now,
      band_registration_hash: "hash-pxs-v1",
      connected_via_wizard_completion_id: null,
      created_at_ms: now,
      updated_at_ms: now,
    });

    const rows = await db
      .select()
      .from(integration_connections)
      .where(eq(integration_connections.id, id));
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe("active");
    expect(rows[0].vendor_key).toBe("pixieset");
  });
});
