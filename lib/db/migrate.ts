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
    const raw = fs.readFileSync(path.join(migrationsFolder, file), "utf-8");
    const chunks = raw.includes("--> statement-breakpoint")
      ? raw.split("--> statement-breakpoint")
      : raw.split(/;\s*\n/).map((s) => s.trim()).filter((s) => s && !s.startsWith("--"));
    for (const chunk of chunks) {
      const stmt = chunk.trim();
      if (!stmt || stmt.startsWith("--")) continue;
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
