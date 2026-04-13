/**
 * canSendTo suppression gate tests — A7.
 *
 * Uses an in-memory SQLite DB (via dbOverride) so tests never touch the
 * production database. Runs all three migration files to ensure the
 * email_suppressions table exists.
 */
import fs from "node:fs";
import path from "node:path";
import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate as drizzleMigrate } from "drizzle-orm/better-sqlite3/migrator";
import { canSendTo } from "@/lib/channels/email/can-send-to";
import { email_suppressions } from "@/lib/db/schema/email-suppressions";

const TEST_DB = path.join(process.cwd(), "tests/.test-can-send-to.db");

let sqlite: Database.Database;
let db: ReturnType<typeof drizzle>;

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

beforeEach(() => {
  sqlite.exec("DELETE FROM email_suppressions");
});

afterAll(() => {
  sqlite.close();
  for (const ext of ["", "-wal", "-shm"]) {
    const p = `${TEST_DB}${ext}`;
    if (fs.existsSync(p)) fs.unlinkSync(p);
  }
});

// ── Helpers ──────────────────────────────────────────────────────────────────

function suppress(opts: {
  email: string;
  kind: "bounce" | "complaint" | "unsubscribe" | "manual";
  classification?: string | null;
}) {
  db.insert(email_suppressions)
    .values({
      id: crypto.randomUUID(),
      email: opts.email,
      kind: opts.kind,
      classification: opts.classification ?? null,
      suppressed_at_ms: Date.now(),
    })
    .run();
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("canSendTo", () => {
  it("allows a clean address", async () => {
    const r = await canSendTo("clean@example.com", "outreach", "test", db);
    expect(r.allowed).toBe(true);
    expect(r.reason).toBeUndefined();
  });

  // Hard blocks — bounce and complaint block ALL sends including transactional

  it("blocks transactional on hard bounce", async () => {
    suppress({ email: "bounced@example.com", kind: "bounce" });
    const r = await canSendTo(
      "bounced@example.com",
      "transactional",
      "invoice",
      db,
    );
    expect(r.allowed).toBe(false);
    expect(r.reason).toContain("bounce");
    expect(r.reason).toContain("bounced@example.com");
  });

  it("blocks outreach on hard bounce", async () => {
    suppress({ email: "bounced2@example.com", kind: "bounce" });
    const r = await canSendTo(
      "bounced2@example.com",
      "outreach",
      "newsletter",
      db,
    );
    expect(r.allowed).toBe(false);
  });

  it("blocks transactional on spam complaint", async () => {
    suppress({ email: "complaint@example.com", kind: "complaint" });
    const r = await canSendTo(
      "complaint@example.com",
      "transactional",
      "receipt",
      db,
    );
    expect(r.allowed).toBe(false);
    expect(r.reason).toContain("complaint");
  });

  // Soft blocks — unsubscribe and manual bypass for transactional

  it("blocks outreach on unsubscribe", async () => {
    suppress({ email: "unsub@example.com", kind: "unsubscribe" });
    const r = await canSendTo(
      "unsub@example.com",
      "outreach",
      "newsletter",
      db,
    );
    expect(r.allowed).toBe(false);
    expect(r.reason).toContain("unsubscribe");
  });

  it("allows transactional despite unsubscribe", async () => {
    suppress({ email: "unsub2@example.com", kind: "unsubscribe" });
    const r = await canSendTo(
      "unsub2@example.com",
      "transactional",
      "invoice",
      db,
    );
    expect(r.allowed).toBe(true);
  });

  it("allows portal_magic_link_recovery despite unsubscribe", async () => {
    suppress({ email: "unsub3@example.com", kind: "unsubscribe" });
    const r = await canSendTo(
      "unsub3@example.com",
      "portal_magic_link_recovery",
      "magic-link",
      db,
    );
    expect(r.allowed).toBe(true);
  });

  it("blocks outreach on manual suppression", async () => {
    suppress({ email: "manual@example.com", kind: "manual" });
    const r = await canSendTo(
      "manual@example.com",
      "outreach",
      "promo",
      db,
    );
    expect(r.allowed).toBe(false);
    expect(r.reason).toContain("manual");
  });

  it("allows transactional despite manual suppression", async () => {
    suppress({ email: "manual2@example.com", kind: "manual" });
    const r = await canSendTo(
      "manual2@example.com",
      "transactional",
      "receipt",
      db,
    );
    expect(r.allowed).toBe(true);
  });

  // Email normalisation

  it("normalises mixed-case email addresses before lookup", async () => {
    suppress({ email: "mixed@example.com", kind: "bounce" });
    const r = await canSendTo(
      "Mixed@Example.COM",
      "outreach",
      "test",
      db,
    );
    expect(r.allowed).toBe(false);
  });

  it("trims leading/trailing whitespace from email", async () => {
    suppress({ email: "trimmed@example.com", kind: "bounce" });
    const r = await canSendTo(
      "  trimmed@example.com  ",
      "outreach",
      "test",
      db,
    );
    expect(r.allowed).toBe(false);
  });

  // Classification-scoped suppressions

  it("classification-specific suppression blocks matching classification only", async () => {
    suppress({
      email: "partial@example.com",
      kind: "unsubscribe",
      classification: "outreach",
    });

    // Matches → blocked
    const outreach = await canSendTo(
      "partial@example.com",
      "outreach",
      "bulk",
      db,
    );
    expect(outreach.allowed).toBe(false);

    // Different non-transactional classification → not suppressed
    const hiring = await canSendTo(
      "partial@example.com",
      "hiring_invite",
      "hiring",
      db,
    );
    expect(hiring.allowed).toBe(true);
  });

  it("global suppression (null classification) blocks all non-transactional", async () => {
    suppress({
      email: "global@example.com",
      kind: "unsubscribe",
      classification: null,
    });

    const outreach = await canSendTo(
      "global@example.com",
      "outreach",
      "x",
      db,
    );
    expect(outreach.allowed).toBe(false);

    const hiring = await canSendTo(
      "global@example.com",
      "hiring_invite",
      "y",
      db,
    );
    expect(hiring.allowed).toBe(false);

    // Transactional still passes global soft suppression
    const txn = await canSendTo(
      "global@example.com",
      "transactional",
      "invoice",
      db,
    );
    expect(txn.allowed).toBe(true);
  });
});
