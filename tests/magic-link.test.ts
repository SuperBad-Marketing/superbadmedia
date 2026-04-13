/**
 * Magic-link issue + redeem tests — A8.
 *
 * Uses an in-memory SQLite DB (via dbOverride) to stay isolated. Runs the
 * full migration set so both `portal_magic_links` and `activity_log` tables
 * exist. Mocks `settings.get()` to return fixed TTL values.
 *
 * Acceptance criteria tested:
 *   - issueMagicLink() writes a row + returns a URL
 *   - redeemMagicLink() validates TTL + single-use
 *   - /lite/portal/r/${token} exchanges a valid OTT for a redirect (tested
 *     here via redeemMagicLink directly; route handler tested via build check)
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { migrate as drizzleMigrate } from "drizzle-orm/better-sqlite3/migrator";
import { eq } from "drizzle-orm";
import { portal_magic_links } from "@/lib/db/schema/portal-magic-links";
import { issueMagicLink } from "@/lib/portal/issue-magic-link";
import { redeemMagicLink } from "@/lib/portal/redeem-magic-link";

type AnyDrizzle = BetterSQLite3Database<Record<string, unknown>>;

// ── Mock settings.get() so tests don't need a real settings table ─────────────
vi.mock("@/lib/settings", () => ({
  default: {
    get: vi.fn(async (key: string) => {
      if (key === "portal.magic_link_ttl_hours") return 168;
      if (key === "portal.session_cookie_ttl_days") return 90;
      throw new Error(`Unmocked settings key: ${key}`);
    }),
    set: vi.fn(),
    invalidateCache: vi.fn(),
    keys: [],
  },
}));

// ── Test DB setup ────────────────────────────────────────────────────────────

const TEST_DB = path.join(process.cwd(), "tests/.test-magic-link.db");

let sqlite: Database.Database;
let db: AnyDrizzle;

beforeAll(() => {
  if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);
  sqlite = new Database(TEST_DB);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  db = drizzle(sqlite) as AnyDrizzle;
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

// ── Helper ───────────────────────────────────────────────────────────────────

const CONTACT_ID = "contact_test_001";

// ── issueMagicLink tests ─────────────────────────────────────────────────────

describe("issueMagicLink", () => {
  it("returns a URL containing the raw token", async () => {
    const result = await issueMagicLink({
      contactId: CONTACT_ID,
      issuedFor: "recovery_form",
      dbOverride: db,
    });
    expect(result.url).toContain("/lite/portal/r/");
    expect(result.url.length).toBeGreaterThan(50);
  });

  it("writes a row to portal_magic_links", async () => {
    const result = await issueMagicLink({
      contactId: CONTACT_ID,
      issuedFor: "recovery_form",
      dbOverride: db,
    });

    const rows = await db
      .select()
      .from(portal_magic_links)
      .where(eq(portal_magic_links.ott_hash, result.ottHash));

    expect(rows).toHaveLength(1);
    expect(rows[0].contact_id).toBe(CONTACT_ID);
    expect(rows[0].issued_for).toBe("recovery_form");
    expect(rows[0].consumed_at_ms).toBeNull();
    expect(rows[0].ttl_hours).toBe(168);
  });

  it("stores a SHA-256 hash, not the raw token", async () => {
    const result = await issueMagicLink({
      contactId: CONTACT_ID,
      issuedFor: "section_1",
      dbOverride: db,
    });

    // Extract raw token from URL
    const rawToken = result.url.split("/lite/portal/r/")[1];
    const expectedHash = crypto
      .createHash("sha256")
      .update(rawToken)
      .digest("hex");

    expect(result.ottHash).toBe(expectedHash);

    // Confirm the DB stores the hash, not the raw token
    const rows = await db
      .select()
      .from(portal_magic_links)
      .where(eq(portal_magic_links.ott_hash, result.ottHash));
    expect(rows[0].ott_hash).toBe(expectedHash);
    expect(rows[0].ott_hash).not.toBe(rawToken);
  });

  it("respects optional submission_id and client_id", async () => {
    const result = await issueMagicLink({
      contactId: CONTACT_ID,
      submissionId: "sub_999",
      clientId: "client_123",
      issuedFor: "journey_email",
      dbOverride: db,
    });

    const rows = await db
      .select()
      .from(portal_magic_links)
      .where(eq(portal_magic_links.ott_hash, result.ottHash));

    expect(rows[0].submission_id).toBe("sub_999");
    expect(rows[0].client_id).toBe("client_123");
  });

  it("each call generates a unique token", async () => {
    const r1 = await issueMagicLink({
      contactId: CONTACT_ID,
      issuedFor: "recovery_form",
      dbOverride: db,
    });
    const r2 = await issueMagicLink({
      contactId: CONTACT_ID,
      issuedFor: "recovery_form",
      dbOverride: db,
    });
    expect(r1.url).not.toBe(r2.url);
    expect(r1.ottHash).not.toBe(r2.ottHash);
  });
});

// ── redeemMagicLink tests ────────────────────────────────────────────────────

describe("redeemMagicLink", () => {
  async function issue() {
    return issueMagicLink({
      contactId: CONTACT_ID,
      issuedFor: "recovery_form",
      dbOverride: db,
    });
  }

  function extractToken(url: string) {
    return url.split("/lite/portal/r/")[1];
  }

  it("returns success + contactId for a valid token", async () => {
    const { url } = await issue();
    const result = await redeemMagicLink(extractToken(url), undefined, db);
    expect(result.success).toBe(true);
    if (result.success) expect(result.contactId).toBe(CONTACT_ID);
  });

  it("marks the row as consumed after redemption", async () => {
    const { url, ottHash } = await issue();
    await redeemMagicLink(extractToken(url), undefined, db);

    const rows = await db
      .select()
      .from(portal_magic_links)
      .where(eq(portal_magic_links.ott_hash, ottHash));

    expect(rows[0].consumed_at_ms).not.toBeNull();
  });

  it("returns already_consumed on second redemption", async () => {
    const { url } = await issue();
    const token = extractToken(url);
    await redeemMagicLink(token, undefined, db);
    const second = await redeemMagicLink(token, undefined, db);
    expect(second.success).toBe(false);
    if (!second.success) expect(second.reason).toBe("already_consumed");
  });

  it("returns not_found for an unknown token", async () => {
    const result = await redeemMagicLink("totallyinvalidtoken", undefined, db);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.reason).toBe("not_found");
  });

  it("returns expired for a past-TTL token", async () => {
    // Insert a row with issued_at_ms in the past beyond the TTL
    const rawToken = crypto.randomBytes(32).toString("base64url");
    const ottHash = crypto.createHash("sha256").update(rawToken).digest("hex");
    const twoWeeksAgo = Date.now() - 14 * 24 * 60 * 60 * 1000;

    await db.insert(portal_magic_links).values({
      id: crypto.randomUUID(),
      contact_id: CONTACT_ID,
      ott_hash: ottHash,
      issued_for: "recovery_form",
      issued_at_ms: twoWeeksAgo,
      ttl_hours: 168, // 7 days — expired 7 days ago
      consumed_at_ms: null,
      consumed_from_ip: null,
      created_at_ms: twoWeeksAgo,
    });

    const result = await redeemMagicLink(rawToken, undefined, db);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.reason).toBe("expired");
  });

  it("stores the client IP in consumed_from_ip", async () => {
    const { url, ottHash } = await issue();
    await redeemMagicLink(extractToken(url), "1.2.3.4", db);

    const rows = await db
      .select()
      .from(portal_magic_links)
      .where(eq(portal_magic_links.ott_hash, ottHash));

    expect(rows[0].consumed_from_ip).toBe("1.2.3.4");
  });
});
