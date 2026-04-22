import { randomUUID } from "node:crypto";
import fs from "node:fs";
import { mkdirSync } from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { hashPassword } from "../auth/password";
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
  drizzleMigrate(db, { migrationsFolder });

  runSeeds(sqlite, migrationsFolder);
  seedAdminUser(sqlite);
  sqlite.close();
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
    const sql = fs.readFileSync(path.join(migrationsFolder, file), "utf-8");
    const statements = sql
      .split("--> statement-breakpoint")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    const tx = sqlite.transaction(() => {
      for (const stmt of statements) sqlite.exec(stmt);
    });
    tx();
  }
}

function seedAdminUser(sqlite: Database.Database): void {
  const ADMIN_EMAIL = "andy@superbadmedia.com.au";
  const pw = process.env.ADMIN_PASSWORD;

  const existing = sqlite
    .prepare("SELECT id, password_hash FROM user WHERE email = ?")
    .get(ADMIN_EMAIL) as { id: string; password_hash: string | null } | undefined;

  if (!existing) {
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
    return;
  }

  if (!existing.password_hash && pw) {
    sqlite
      .prepare("UPDATE user SET password_hash = ? WHERE id = ?")
      .run(hashPassword(pw), existing.id);
  }
}
