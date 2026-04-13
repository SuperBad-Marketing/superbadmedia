/**
 * Portal magic-link issuance and redemption tests — A8.
 *
 * Uses an isolated in-process SQLite DB (not dev.db) so tests are hermetic.
 * `logActivity` is mocked to avoid the global `db` import.
 */
import fs from "node:fs";
import path from "node:path";
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate as drizzleMigrate } from "drizzle-orm/better-sqlite3/migrator";
import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import { portal_magic_links } from "@/lib/db/schema/portal-magic-links";

// ── Mock logActivity so it doesn't hit the global db ────────────────────────
vi.mock("@/lib/activity-log", () => ({
  logActivity: vi.fn().mockResolvedValue(undefined),
}));

// ── Mock settings to return a predictable TTL ────────────────────────────────
vi.mock("@/lib/settings", () => ({
  default: {
    get: vi.fn(async (key: string) => {
      if (key === "portal.magic_link_ttl_hours") return 168;
      if (key === "portal.session_cookie_ttl_days") return 90;
      throw new Error(`Unexpected settings key in test: ${key}`);
    }),
  },
}));

// ── Import after mocks ───────────────────────────────────────────────────────
const { issueMagicLink } = await import("@/lib/portal/issue-magic-link");
const { redeemMagicLink } = await import("@/lib/portal/redeem-magic-link");

const TEST_DB = path.join(process.cwd(), "tests/.test-magic-link.db");

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

describe("issueMagicLink", () => {
  it("inserts a row and returns a portal URL with raw token", async () => {
    const result = await issueMagicLink(
      { contactId: "contact-001", issuedFor: "portal_access" },
      db,
    );

    expect(result.url).toMatch(/\/lite\/portal\/r\//);
    expect(result.rawToken).toBeTruthy();
    expect(result.rawToken.length).toBeGreaterThan(20);

    const rows = await db
      .select()
      .from(portal_magic_links)
      .where(eq(portal_magic_links.contact_id, "contact-001"));
    expect(rows).toHaveLength(1);
    expect(rows[0].ott_hash).toBe(
      createHash("sha256").update(result.rawToken).digest("hex"),
    );
    expect(rows[0].consumed_at_ms).toBeNull();
  });

  it("respects TTL from settings (168 h by default)", async () => {
    const before = Date.now();
    const result = await issueMagicLink(
      { contactId: "contact-ttl", issuedFor: "test" },
      db,
    );
    const rows = await db
      .select()
      .from(portal_magic_links)
      .where(eq(portal_magic_links.contact_id, "contact-ttl"));
    const row = rows[0];
    const expectedTtlMs = 168 * 60 * 60 * 1000;
    expect(row.expires_at_ms).toBeGreaterThanOrEqual(before + expectedTtlMs);
    expect(result.rawToken).toBeTruthy();
  });

  it("stores nullable client_id and submission_id", async () => {
    await issueMagicLink(
      {
        contactId: "contact-cm",
        clientId: "client-001",
        submissionId: "sub-001",
        issuedFor: "cm_portal",
      },
      db,
    );
    const rows = await db
      .select()
      .from(portal_magic_links)
      .where(eq(portal_magic_links.contact_id, "contact-cm"));
    expect(rows[0].client_id).toBe("client-001");
    expect(rows[0].submission_id).toBe("sub-001");
  });
});

describe("redeemMagicLink", () => {
  it("returns session data on valid token and marks consumed", async () => {
    const { rawToken } = await issueMagicLink(
      { contactId: "contact-redeem", issuedFor: "test" },
      db,
    );

    const session = await redeemMagicLink(rawToken, db);

    expect(session).not.toBeNull();
    expect(session!.contactId).toBe("contact-redeem");

    // Row should be consumed
    const hash = createHash("sha256").update(rawToken).digest("hex");
    const rows = await db
      .select()
      .from(portal_magic_links)
      .where(eq(portal_magic_links.ott_hash, hash));
    expect(rows[0].consumed_at_ms).not.toBeNull();
  });

  it("returns null for a non-existent token", async () => {
    const result = await redeemMagicLink("this-token-does-not-exist", db);
    expect(result).toBeNull();
  });

  it("returns null for an already-consumed token (single-use)", async () => {
    const { rawToken } = await issueMagicLink(
      { contactId: "contact-single-use", issuedFor: "test" },
      db,
    );

    const first = await redeemMagicLink(rawToken, db);
    expect(first).not.toBeNull();

    const second = await redeemMagicLink(rawToken, db);
    expect(second).toBeNull();
  });

  it("returns null for an expired token", async () => {
    // Issue a link, then manually backdate its expiry
    const { rawToken } = await issueMagicLink(
      { contactId: "contact-expired", issuedFor: "test" },
      db,
    );
    const hash = createHash("sha256").update(rawToken).digest("hex");

    await db
      .update(portal_magic_links)
      .set({ expires_at_ms: Date.now() - 1000 }) // 1 second in the past
      .where(eq(portal_magic_links.ott_hash, hash));

    const result = await redeemMagicLink(rawToken, db);
    expect(result).toBeNull();
  });

  it("returns client_id and submission_id when present", async () => {
    const { rawToken } = await issueMagicLink(
      {
        contactId: "contact-fields",
        clientId: "client-xyz",
        submissionId: "sub-xyz",
        issuedFor: "test",
      },
      db,
    );

    const session = await redeemMagicLink(rawToken, db);
    expect(session!.clientId).toBe("client-xyz");
    expect(session!.submissionId).toBe("sub-xyz");
  });
});
