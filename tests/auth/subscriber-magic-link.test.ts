/**
 * SB-6a: `issueSubscriberMagicLink` + `redeemSubscriberMagicLink` tests.
 *
 * Hermetic sqlite. Covers:
 *   - happy-path redeem promotes `prospect → client`
 *   - second redeem of the same token fails `consumed`
 *   - expired token fails `expired`
 *   - issue for an already-client user does not re-promote on redeem
 *   - raw token never appears in the stored row
 */
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
  vi,
} from "vitest";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate as drizzleMigrate } from "drizzle-orm/better-sqlite3/migrator";
import { eq } from "drizzle-orm";

const TEST_DB = path.join(
  process.cwd(),
  "tests/.test-sb6a-subscriber-magic-link.db",
);
let sqlite: Database.Database;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let testDb: any;

vi.mock("@/lib/db", () => ({
  get db() {
    return testDb;
  },
}));

const {
  issueSubscriberMagicLink,
  redeemSubscriberMagicLink,
} = await import("@/lib/auth/subscriber-magic-link");
const { user } = await import("@/lib/db/schema/user");
const { subscriber_magic_link_tokens } = await import(
  "@/lib/db/schema/subscriber-magic-link-tokens"
);
const { activity_log } = await import("@/lib/db/schema/activity-log");

const NOW = 1_700_000_000_000;

function seedUser(overrides: Partial<{ id: string; role: "prospect" | "client" | "admin"; email: string }> = {}) {
  const id = overrides.id ?? "u_1";
  testDb
    .insert(user)
    .values({
      id,
      email: overrides.email ?? `${id}@example.com`,
      role: overrides.role ?? "prospect",
      created_at_ms: NOW,
    })
    .run();
  return id;
}

beforeAll(async () => {
  if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);
  sqlite = new Database(TEST_DB);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  testDb = drizzle(sqlite, { schema: await import("@/lib/db/schema") });
  await drizzleMigrate(testDb, {
    migrationsFolder: path.join(process.cwd(), "lib/db/migrations"),
  });
  // Execute seed-only migrations drizzle skipped.
  const journal = JSON.parse(
    fs.readFileSync(
      path.join(process.cwd(), "lib/db/migrations/meta/_journal.json"),
      "utf8",
    ),
  ) as { entries: { tag: string }[] };
  const applied = new Set(journal.entries.map((e) => e.tag));
  const files = fs
    .readdirSync(path.join(process.cwd(), "lib/db/migrations"))
    .filter((f) => f.endsWith(".sql"))
    .sort();
  for (const f of files) {
    const tag = f.replace(/\.sql$/, "");
    if (applied.has(tag)) continue;
    const sql = fs.readFileSync(
      path.join(process.cwd(), "lib/db/migrations", f),
      "utf8",
    );
    sqlite.exec(sql);
  }
});

afterAll(() => {
  sqlite?.close();
  if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);
});

beforeEach(() => {
  sqlite.exec("DELETE FROM activity_log");
  sqlite.exec("DELETE FROM subscriber_magic_link_tokens");
  sqlite.exec("DELETE FROM user");
});

describe("issueSubscriberMagicLink", () => {
  it("persists only the token hash, never the raw token", async () => {
    const uid = seedUser();
    const result = await issueSubscriberMagicLink({ userId: uid }, testDb);
    const rows = testDb
      .select()
      .from(subscriber_magic_link_tokens)
      .all() as Array<{ token_hash: string }>;
    expect(rows).toHaveLength(1);
    const expectedHash = createHash("sha256").update(result.rawToken).digest("hex");
    expect(rows[0].token_hash).toBe(expectedHash);
    // Raw token must not appear verbatim in any column.
    for (const col of Object.values(rows[0])) {
      if (typeof col === "string") {
        expect(col).not.toBe(result.rawToken);
      }
    }
    expect(result.url).toContain(`token=${result.rawToken}`);
  });
});

describe("redeemSubscriberMagicLink", () => {
  it("promotes prospect → client on first redeem and logs activity", async () => {
    const uid = seedUser({ role: "prospect" });
    const { rawToken } = await issueSubscriberMagicLink({ userId: uid }, testDb);
    const outcome = await redeemSubscriberMagicLink(rawToken, testDb);
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.promoted).toBe(true);
    expect(outcome.userId).toBe(uid);

    const u = testDb
      .select({ role: user.role, first_signed_in_at_ms: user.first_signed_in_at_ms })
      .from(user)
      .where(eq(user.id, uid))
      .get() as { role: string; first_signed_in_at_ms: number | null };
    expect(u.role).toBe("client");
    expect(u.first_signed_in_at_ms).not.toBeNull();

    const logs = testDb.select().from(activity_log).all() as Array<{
      meta: unknown;
    }>;
    const kinds = logs.map((l) => {
      const m = l.meta as { kind?: string } | string | null;
      if (typeof m === "string") return JSON.parse(m).kind;
      return m?.kind;
    });
    expect(kinds).toContain("subscriber_promoted_from_prospect");
    expect(kinds).toContain("subscriber_logged_in");
  });

  it("does not re-promote an already-client user", async () => {
    const uid = seedUser({ role: "client" });
    const { rawToken } = await issueSubscriberMagicLink({ userId: uid }, testDb);
    const outcome = await redeemSubscriberMagicLink(rawToken, testDb);
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.promoted).toBe(false);
  });

  it("rejects a consumed token on second redeem", async () => {
    const uid = seedUser();
    const { rawToken } = await issueSubscriberMagicLink({ userId: uid }, testDb);
    const first = await redeemSubscriberMagicLink(rawToken, testDb);
    expect(first.ok).toBe(true);
    const second = await redeemSubscriberMagicLink(rawToken, testDb);
    expect(second.ok).toBe(false);
    if (second.ok) return;
    expect(second.reason).toBe("consumed");
  });

  it("rejects an expired token", async () => {
    const uid = seedUser();
    const { rawToken, tokenId } = await issueSubscriberMagicLink(
      { userId: uid },
      testDb,
    );
    // Force expiry into the past.
    testDb
      .update(subscriber_magic_link_tokens)
      .set({ expires_at_ms: 1 })
      .where(eq(subscriber_magic_link_tokens.id, tokenId))
      .run();
    const outcome = await redeemSubscriberMagicLink(rawToken, testDb);
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.reason).toBe("expired");
  });

  it("rejects an unknown token", async () => {
    const outcome = await redeemSubscriberMagicLink("not-a-real-token", testDb);
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.reason).toBe("not_found");
  });

  it("sets emailVerified on successful redeem (OS-3)", async () => {
    const uid = seedUser({ role: "prospect" });
    const { rawToken } = await issueSubscriberMagicLink({ userId: uid }, testDb);
    const outcome = await redeemSubscriberMagicLink(rawToken, testDb);
    expect(outcome.ok).toBe(true);

    const u = testDb
      .select({ emailVerified: user.emailVerified })
      .from(user)
      .where(eq(user.id, uid))
      .get() as { emailVerified: number | null };
    expect(u.emailVerified).not.toBeNull();
    expect(typeof u.emailVerified).toBe("number");
  });

  it("does not overwrite emailVerified on re-login (OS-3)", async () => {
    // Create a client with emailVerified already set
    const uid = seedUser({ role: "client" });
    const earlyTimestamp = 1_600_000_000_000;
    testDb
      .update(user)
      .set({ emailVerified: earlyTimestamp })
      .where(eq(user.id, uid))
      .run();

    const { rawToken } = await issueSubscriberMagicLink({ userId: uid }, testDb);
    await redeemSubscriberMagicLink(rawToken, testDb);

    const u = testDb
      .select({ emailVerified: user.emailVerified })
      .from(user)
      .where(eq(user.id, uid))
      .get() as { emailVerified: number | null };
    // Should NOT have been overwritten — the WHERE clause includes isNull(emailVerified)
    expect(u.emailVerified).toBe(earlyTimestamp);
  });
});
