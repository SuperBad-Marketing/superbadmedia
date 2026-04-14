import "server-only";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";

const databaseUrl = process.env.DATABASE_URL ?? "file:./dev.db";
const filePath = databaseUrl.startsWith("file:")
  ? databaseUrl.slice("file:".length)
  : databaseUrl;

const globalForDb = globalThis as unknown as {
  __sblite_sqlite?: Database.Database;
};

const sqlite =
  globalForDb.__sblite_sqlite ?? new Database(filePath);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

if (process.env.NODE_ENV !== "production") {
  globalForDb.__sblite_sqlite = sqlite;
}

export const db = drizzle(sqlite, { schema });
export { sqlite as sqliteConnection };
