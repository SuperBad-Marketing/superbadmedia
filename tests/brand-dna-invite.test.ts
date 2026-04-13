/**
 * Brand DNA invite issuance and redemption tests — BDA-1.
 *
 * Uses an isolated in-process SQLite DB (not dev.db) so tests are hermetic.
 * logActivity and settings are mocked to avoid global DB + network calls.
 */
import fs from "node:fs";
import path from "node:path";
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate as drizzleMigrate } from "drizzle-orm/better-sqlite3/migrator";
import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import { brand_dna_invites } from "@/lib/db/schema/brand-dna-invites";
import { brand_dna_profiles } from "@/lib/db/schema/brand-dna-profiles";

// ── Mock logActivity (avoids global db) ─────────────────────────────────────
vi.mock("@/lib/activity-log", () => ({
  logActivity: vi.fn().mockResolvedValue(undefined),
}));

// ── Mock settings ────────────────────────────────────────────────────────────
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
const { issueBrandDnaInvite } = await import("@/lib/brand-dna/issue-invite");
const { redeemBrandDnaInvite } = await import("@/lib/brand-dna/redeem-invite");
const { logActivity } = await import("@/lib/activity-log");

const TEST_DB = path.join(process.cwd(), "tests/.test-brand-dna-invite.db");

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

// ── issueBrandDnaInvite ──────────────────────────────────────────────────────
describe("issueBrandDnaInvite", () => {
  it("inserts a brand_dna_invites row and returns a URL + inviteId", async () => {
    const result = await issueBrandDnaInvite(
      { contactId: "contact-bda-001", issuedByUserId: "user-andy-001" },
      db,
    );

    expect(result.url).toMatch(/\/lite\/portal\/r\//);
    expect(result.inviteId).toBeTruthy();

    const rows = await db
      .select()
      .from(brand_dna_invites)
      .where(eq(brand_dna_invites.contact_id, "contact-bda-001"));

    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe(result.inviteId);
    expect(rows[0].contact_id).toBe("contact-bda-001");
    expect(rows[0].created_by).toBe("user-andy-001");
    expect(rows[0].used_at_ms).toBeNull();
    expect(rows[0].expires_at_ms).toBeGreaterThan(Date.now());
  });

  it("stores a SHA-256 hash of the raw token in token_hash", async () => {
    // Extract the raw token from the URL
    const result = await issueBrandDnaInvite(
      { contactId: "contact-bda-002", issuedByUserId: "user-andy-001" },
      db,
    );

    // The URL contains the raw token at the end
    const rawToken = result.url.split("/").pop()!;
    const expectedHash = createHash("sha256").update(rawToken).digest("hex");

    const rows = await db
      .select()
      .from(brand_dna_invites)
      .where(eq(brand_dna_invites.contact_id, "contact-bda-002"));

    expect(rows[0].token_hash).toBe(expectedHash);
  });

  it("logs brand_dna_invite_sent activity", async () => {
    vi.clearAllMocks();

    await issueBrandDnaInvite(
      { contactId: "contact-bda-003", issuedByUserId: "user-andy-001" },
      db,
    );

    expect(logActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "brand_dna_invite_sent",
        contactId: "contact-bda-003",
      }),
    );
  });

  it("sets expires_at_ms ~168 hours from now (portal TTL setting)", async () => {
    const before = Date.now();
    const result = await issueBrandDnaInvite(
      { contactId: "contact-bda-004", issuedByUserId: "user-andy-001" },
      db,
    );
    const after = Date.now();

    const rows = await db
      .select()
      .from(brand_dna_invites)
      .where(eq(brand_dna_invites.id, result.inviteId));

    const expectedTtlMs = 168 * 60 * 60 * 1000;
    expect(rows[0].expires_at_ms).toBeGreaterThanOrEqual(before + expectedTtlMs);
    expect(rows[0].expires_at_ms).toBeLessThanOrEqual(after + expectedTtlMs + 1000);
  });
});

// ── redeemBrandDnaInvite ─────────────────────────────────────────────────────
describe("redeemBrandDnaInvite", () => {
  it("creates a brand_dna_profiles row and returns profileCreated=true", async () => {
    const issued = await issueBrandDnaInvite(
      { contactId: "contact-redeem-001", issuedByUserId: "user-andy-001" },
      db,
    );
    const rawToken = issued.url.split("/").pop()!;

    const result = await redeemBrandDnaInvite(rawToken, db);

    expect(result).not.toBeNull();
    expect(result!.contactId).toBe("contact-redeem-001");
    expect(result!.profileCreated).toBe(true);
    expect(result!.profileId).toBeTruthy();

    // Profile row should exist
    const profiles = await db
      .select()
      .from(brand_dna_profiles)
      .where(eq(brand_dna_profiles.id, result!.profileId));

    expect(profiles).toHaveLength(1);
    expect(profiles[0].contact_id).toBe("contact-redeem-001");
    expect(profiles[0].status).toBe("pending");
    expect(profiles[0].subject_type).toBe("client");
    expect(profiles[0].is_current).toBe(true);
  });

  it("marks the invite as used (used_at_ms set)", async () => {
    const issued = await issueBrandDnaInvite(
      { contactId: "contact-redeem-002", issuedByUserId: "user-andy-001" },
      db,
    );
    const rawToken = issued.url.split("/").pop()!;

    const before = Date.now();
    await redeemBrandDnaInvite(rawToken, db);
    const after = Date.now();

    const rows = await db
      .select()
      .from(brand_dna_invites)
      .where(eq(brand_dna_invites.id, issued.inviteId));

    expect(rows[0].used_at_ms).toBeGreaterThanOrEqual(before);
    expect(rows[0].used_at_ms).toBeLessThanOrEqual(after + 100);
  });

  it("logs brand_dna_invite_redeemed activity", async () => {
    vi.clearAllMocks();

    const issued = await issueBrandDnaInvite(
      { contactId: "contact-redeem-003", issuedByUserId: "user-andy-001" },
      db,
    );
    const rawToken = issued.url.split("/").pop()!;

    await redeemBrandDnaInvite(rawToken, db);

    expect(logActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "brand_dna_invite_redeemed",
        contactId: "contact-redeem-003",
      }),
    );
  });

  it("returns null for an unknown token", async () => {
    const result = await redeemBrandDnaInvite("not-a-real-token-abc123", db);
    expect(result).toBeNull();
  });

  it("returns null when token is already used", async () => {
    const issued = await issueBrandDnaInvite(
      { contactId: "contact-redeem-004", issuedByUserId: "user-andy-001" },
      db,
    );
    const rawToken = issued.url.split("/").pop()!;

    // First redeem succeeds
    const first = await redeemBrandDnaInvite(rawToken, db);
    expect(first).not.toBeNull();

    // Second redeem is rejected
    const second = await redeemBrandDnaInvite(rawToken, db);
    expect(second).toBeNull();
  });

  it("returns null for an expired token", async () => {
    const issued = await issueBrandDnaInvite(
      { contactId: "contact-redeem-005", issuedByUserId: "user-andy-001" },
      db,
    );

    // Force expiry by updating expires_at_ms to the past
    await db
      .update(brand_dna_invites)
      .set({ expires_at_ms: Date.now() - 1000 })
      .where(eq(brand_dna_invites.id, issued.inviteId));

    const rawToken = issued.url.split("/").pop()!;
    const result = await redeemBrandDnaInvite(rawToken, db);
    expect(result).toBeNull();
  });

  it("attaches to pre-existing profile when one already exists for the contact", async () => {
    const contactId = "contact-redeem-006";

    // Pre-create a profile for this contact
    const existingProfileId = "bda-profile-existing-001";
    await db.insert(brand_dna_profiles).values({
      id: existingProfileId,
      subject_type: "client",
      subject_id: contactId,
      contact_id: contactId,
      status: "in_progress",
      is_current: true,
      is_superbad_self: false,
      version: 1,
      created_at_ms: Date.now() - 5000,
      updated_at_ms: Date.now() - 5000,
    });

    const issued = await issueBrandDnaInvite(
      { contactId, issuedByUserId: "user-andy-001" },
      db,
    );
    const rawToken = issued.url.split("/").pop()!;

    const result = await redeemBrandDnaInvite(rawToken, db);

    expect(result).not.toBeNull();
    expect(result!.profileCreated).toBe(false);
    expect(result!.profileId).toBe(existingProfileId);
  });
});
