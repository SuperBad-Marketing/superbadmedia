export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { sqliteConnection } from "@/lib/db";

export async function GET(): Promise<NextResponse> {
  const checks: Record<string, unknown> = {};

  try {
    const tables = sqliteConnection
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name",
      )
      .all() as { name: string }[];
    checks.tables = tables.map((t) => t.name);
    checks.tableCount = tables.length;
  } catch (err) {
    checks.tablesError = String(err);
  }

  try {
    const admin = sqliteConnection
      .prepare("SELECT id, email, role FROM user WHERE role = 'admin'")
      .all();
    checks.adminUsers = admin;
  } catch (err) {
    checks.adminUsersError = String(err);
  }

  try {
    const cwd = process.cwd();
    const fs = await import("node:fs");
    const migrationPath = `${cwd}/lib/db/migrations`;
    const migrationExists = fs.existsSync(migrationPath);
    checks.cwd = cwd;
    checks.migrationPath = migrationPath;
    checks.migrationFolderExists = migrationExists;
    if (migrationExists) {
      const files = fs.readdirSync(migrationPath).filter((f: string) => f.endsWith(".sql"));
      checks.migrationFileCount = files.length;
    }
  } catch (err) {
    checks.migrationPathError = String(err);
  }

  return NextResponse.json(checks);
}
