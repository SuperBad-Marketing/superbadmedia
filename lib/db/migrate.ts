import { randomUUID } from "node:crypto";
import fs from "node:fs";
import { mkdirSync } from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { hashPassword, verifyPassword } from "../auth/password";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate as drizzleMigrate } from "drizzle-orm/better-sqlite3/migrator";

/**
 * Applies schema migrations (via Drizzle's journal) then runs seed SQL
 * files (any `000*_seed_*.sql` or other non-journal SQL), then ensures
 * the admin user exists.
 *
 * Seed files are idempotent (INSERT OR IGNORE) so repeated runs are safe.
 * Used by the dev DB setup, Vitest harness, and the production startup
 * via instrumentation.ts.
 */
export function runMigrations(databaseUrl: string): void {
  const filePath = databaseUrl.startsWith("file:")
    ? databaseUrl.slice("file:".length)
    : databaseUrl;

  mkdirSync(path.dirname(filePath), { recursive: true });

  const sqlite = new Database(filePath);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");

  const db = drizzle(sqlite);
  const migrationsFolder = path.join(process.cwd(), "lib/db/migrations");
  ensureColumns(sqlite);
  patchPendingAlterColumns(sqlite, migrationsFolder);
  drizzleMigrate(db, { migrationsFolder });

  runSeeds(sqlite, migrationsFolder);
  seedAdminUser(sqlite);
  sqlite.close();
}

/**
 * Ensure schema-required columns exist before the Drizzle migrator runs.
 * This guards against bloated or failed migrations leaving the DB without
 * columns that the ORM expects in every SELECT.
 */
function ensureColumns(sqlite: Database.Database): void {
  const required: Array<{ table: string; column: string; type: string }> = [
    { table: "brand_dna_profiles", column: "signal_scores_intro", type: "text" },
    { table: "brand_dna_profiles", column: "signal_descriptions_json", type: "text" },
  ];

  for (const { table, column, type } of required) {
    const cols = sqlite
      .prepare(`PRAGMA table_info(${table})`)
      .all() as { name: string }[];
    if (cols.some((c) => c.name === column)) continue;
    try {
      sqlite.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
      console.info(`[migrate] ensured column ${table}.${column}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!msg.includes("duplicate column")) throw err;
    }
  }
}

/**
 * SQLite ALTER TABLE ADD COLUMN fails if the column already exists, and
 * Drizzle's migrate() propagates that as a hard error. This pre-flight
 * detects pending migrations that contain ADD COLUMN on tables where
 * the column is already present (from a prior manual apply or seed) and
 * marks them as applied so the migrator skips them.
 */
function patchPendingAlterColumns(
  sqlite: Database.Database,
  migrationsFolder: string,
): void {
  const journalPath = path.join(migrationsFolder, "meta", "_journal.json");
  const journal = JSON.parse(fs.readFileSync(journalPath, "utf-8")) as {
    entries: Array<{ tag: string; when: number }>;
  };

  try {
    sqlite.prepare("SELECT 1 FROM __drizzle_migrations LIMIT 1").get();
  } catch {
    return;
  }

  const appliedRows = sqlite
    .prepare("SELECT hash FROM __drizzle_migrations")
    .all() as { hash: string }[];
  const appliedHashes = new Set(appliedRows.map((r) => r.hash));

  for (const entry of journal.entries) {
    const filePath = path.join(migrationsFolder, `${entry.tag}.sql`);
    if (!fs.existsSync(filePath)) continue;

    const raw = fs.readFileSync(filePath, "utf-8");
    const addColMatch = raw.match(
      /ALTER\s+TABLE\s+`?(\w+)`?\s+ADD\s+(?:COLUMN\s+)?`?(\w+)`?/i,
    );
    if (!addColMatch) continue;

    const [, table, column] = addColMatch;
    const existingCols = sqlite
      .prepare(`PRAGMA table_info(${table})`)
      .all() as { name: string }[];
    const columnExists = existingCols.some((c) => c.name === column);
    if (!columnExists) continue;

    const hash = require("crypto")
      .createHash("sha256")
      .update(raw)
      .digest("hex");
    if (appliedHashes.has(hash)) continue;

    sqlite
      .prepare(
        "INSERT OR IGNORE INTO __drizzle_migrations (hash, created_at) VALUES (?, ?)",
      )
      .run(hash, entry.when);
    console.info(
      `[migrate] pre-applied ${entry.tag} — column ${table}.${column} already exists`,
    );
  }
}

export function runSeeds(
  sqlite: Database.Database,
  migrationsFolder: string,
): void {
  const journalPath = path.join(migrationsFolder, "meta", "_journal.json");
  const journal = JSON.parse(fs.readFileSync(journalPath, "utf-8")) as {
    entries: Array<{ tag: string }>;
  };
  const tracked = new Set(journal.entries.map((e) => `${e.tag}.sql`));

  const files = fs
    .readdirSync(migrationsFolder)
    .filter((f) => f.endsWith(".sql") && !tracked.has(f))
    .sort();

  for (const file of files) {
    const raw = fs.readFileSync(path.join(migrationsFolder, file), "utf-8");
    const chunks = raw.includes("--> statement-breakpoint")
      ? raw.split("--> statement-breakpoint")
      : raw.split(/;\s*\n/).map((s) => s.split("\n").filter(l => !l.trim().startsWith("--")).join("\n").trim()).filter(Boolean);
    for (const chunk of chunks) {
      const stmt = chunk.split("\n").filter(l => !l.trim().startsWith("--")).join("\n").trim();
      if (!stmt) continue;
      const execStr = stmt.endsWith(";") ? stmt : `${stmt};`;
      try {
        sqlite.exec(execStr);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes("duplicate column name") || msg.includes("already exists")) continue;
        throw err;
      }
    }
  }
}

function seedAdminUser(sqlite: Database.Database): void {
  const ADMIN_EMAIL = "andy@superbadmedia.com.au";
  const pw = process.env.ADMIN_PASSWORD?.trim() || undefined;

  const existing = sqlite
    .prepare("SELECT id, password_hash FROM user WHERE email = ?")
    .get(ADMIN_EMAIL) as { id: string; password_hash: string | null } | undefined;

  if (!existing) {
    const hasHash = !!pw;
    sqlite
      .prepare(
        `INSERT INTO user (id, email, name, role, timezone, created_at_ms, password_hash)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        randomUUID(),
        ADMIN_EMAIL,
        "Andy Robinson",
        "admin",
        "Australia/Melbourne",
        Date.now(),
        pw ? hashPassword(pw) : null,
      );
    console.info(`[seed] Created admin user (password_hash: ${hasHash})`);
    return;
  }

  if (pw) {
    const needsUpdate =
      !existing.password_hash || !verifyPassword(pw, existing.password_hash);
    if (needsUpdate) {
      sqlite
        .prepare("UPDATE user SET password_hash = ? WHERE id = ?")
        .run(hashPassword(pw), existing.id);
      console.info("[seed] Updated admin password_hash");
    } else {
      console.info("[seed] Admin password_hash already current");
    }
  } else {
    console.info("[seed] Admin user exists, no ADMIN_PASSWORD env var to seed");
  }
}
