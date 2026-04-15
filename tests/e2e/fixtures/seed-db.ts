/**
 * Playwright globalSetup — seed hermetic sqlite + pre-signed session cookie.
 *
 * Runs once before the test suite:
 *   1. Clears any previous hermetic DB at `tests/e2e/.test-critical-flight.db`.
 *   2. Applies `lib/db/migrations/*` via drizzle's migrator.
 *   3. Seeds one admin user row.
 *   4. Encodes a NextAuth v5 session JWT with `brand_dna_complete=true` +
 *      `critical_flight_complete=false` and writes Playwright's
 *      `storageState` JSON so every `test.use({ storageState })` run
 *      starts already-signed-in as the test admin.
 *
 * The webServer (see `playwright.config.ts`) is started with the same
 * DATABASE_URL and NEXTAUTH_SECRET, so it decodes the cookie transparently.
 *
 * Consumers (spec files) can import `E2E_USER`, `E2E_DB_PATH`, and
 * `openTestDb()` from this module to assert against the same DB rows the
 * dev server wrote.
 *
 * Owner: SW-5c.
 */
import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate as drizzleMigrate } from "drizzle-orm/better-sqlite3/migrator";
import { encode } from "@auth/core/jwt";

import * as schema from "@/lib/db/schema";
import { E2E_CONSTANTS } from "../../../playwright.config";

export const E2E_USER = {
  id: "e2e-admin-user",
  email: "andy+e2e@superbadmedia.com.au",
  name: "Andy (E2E)",
  role: "admin" as const,
} as const;

export const E2E_DB_PATH = path.isAbsolute(E2E_CONSTANTS.DB_FILE)
  ? E2E_CONSTANTS.DB_FILE
  : path.resolve(process.cwd(), E2E_CONSTANTS.DB_FILE);
const AUTH_STATE_PATH = path.resolve(
  process.cwd(),
  "tests/e2e/.auth-state.json",
);

// NextAuth v5 non-secure cookie name + matching salt.
const SESSION_COOKIE_NAME = "authjs.session-token";

export function openTestDb(): {
  sqlite: Database.Database;
  db: ReturnType<typeof drizzle<typeof schema>>;
} {
  const sqlite = new Database(E2E_DB_PATH);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  const db = drizzle(sqlite, { schema });
  return { sqlite, db };
}

function clearPreviousRun(): void {
  fs.mkdirSync(path.dirname(E2E_DB_PATH), { recursive: true });
  // Wipe schema *in-place* rather than `fs.unlinkSync` — the webServer
  // (started by Playwright BEFORE globalSetup) eagerly opens the DB file
  // from at least one route worker. Unlinking leaves those handles
  // pointing at the old (now-orphaned) inode, so subsequent migrations
  // land on a NEW inode the workers never see — manifesting as
  // intermittent "no such table: webhook_events" inside the Stripe
  // webhook handler. Dropping schema preserves the inode.
  if (fs.existsSync(E2E_DB_PATH)) {
    const sqlite = new Database(E2E_DB_PATH);
    try {
      sqlite.pragma("journal_mode = WAL");
      sqlite.pragma("foreign_keys = OFF");
      const objects = sqlite
        .prepare(
          "SELECT type, name FROM sqlite_master WHERE type IN ('table','index','trigger','view') AND name NOT LIKE 'sqlite_%'",
        )
        .all() as Array<{ type: string; name: string }>;
      for (const o of objects) {
        sqlite.exec(`DROP ${o.type.toUpperCase()} IF EXISTS "${o.name}";`);
      }
      sqlite.exec("VACUUM;");
    } finally {
      sqlite.close();
    }
  }
  if (fs.existsSync(AUTH_STATE_PATH)) fs.unlinkSync(AUTH_STATE_PATH);
}

function migrateAndSeed(): void {
  const sqlite = new Database(E2E_DB_PATH);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  const db = drizzle(sqlite);
  drizzleMigrate(db, {
    migrationsFolder: path.resolve(process.cwd(), "lib/db/migrations"),
  });

  // Drizzle's migrator only runs entries listed in `meta/_journal.json`.
  // Pure-data seed migrations (0001, 0013, 0014, 0015 — settings-only,
  // no schema diff) are intentionally absent from the journal but must
  // still execute for the runtime to find their kill-switch keys. Their
  // statements are `INSERT OR IGNORE` so re-running is safe.
  const journalPath = path.resolve(
    process.cwd(),
    "lib/db/migrations/meta/_journal.json",
  );
  const journal = JSON.parse(fs.readFileSync(journalPath, "utf8")) as {
    entries: Array<{ tag: string }>;
  };
  const journalled = new Set(journal.entries.map((e) => e.tag));
  const migrationsDir = path.resolve(process.cwd(), "lib/db/migrations");
  const seedOnly = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .map((f) => ({ tag: f.replace(/\.sql$/, ""), file: f }))
    .filter((m) => !journalled.has(m.tag))
    .sort((a, b) => a.tag.localeCompare(b.tag));
  for (const m of seedOnly) {
    const sql = fs.readFileSync(path.join(migrationsDir, m.file), "utf8");
    sqlite.exec(sql);
  }

  // Admin user — satisfies completeStripeAdminAction's auth().user.id lookup.
  sqlite
    .prepare(
      `INSERT OR REPLACE INTO user
       (id, email, name, role, timezone, motion_preference,
        sounds_enabled, density_preference, text_size_preference,
        theme_preset, typeface_preset, created_at_ms)
       VALUES (?, ?, ?, 'admin', 'Australia/Melbourne', 'full',
               1, 'comfortable', 'default', 'base-nova', 'default', ?)`,
    )
    .run(E2E_USER.id, E2E_USER.email, E2E_USER.name, Date.now());

  sqlite.close();
}

async function writeAuthState(): Promise<void> {
  // Seven-day JWT — plenty for a single test run.
  const exp = Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60;
  const token = await encode({
    token: {
      sub: E2E_USER.id,
      id: E2E_USER.id,
      email: E2E_USER.email,
      name: E2E_USER.name,
      role: E2E_USER.role,
      brand_dna_complete: true,
      critical_flight_complete: false,
      iat: Math.floor(Date.now() / 1000),
      exp,
    } as Record<string, unknown>,
    secret: E2E_CONSTANTS.NEXTAUTH_SECRET,
    salt: SESSION_COOKIE_NAME,
  });

  const state = {
    cookies: [
      {
        name: SESSION_COOKIE_NAME,
        value: token,
        domain: "127.0.0.1",
        path: "/",
        httpOnly: true,
        secure: false,
        sameSite: "Lax" as const,
        expires: exp,
      },
    ],
    origins: [],
  };
  fs.mkdirSync(path.dirname(AUTH_STATE_PATH), { recursive: true });
  fs.writeFileSync(AUTH_STATE_PATH, JSON.stringify(state, null, 2));
}

export default async function globalSetup(): Promise<void> {
  clearPreviousRun();
  migrateAndSeed();
  await writeAuthState();
}
