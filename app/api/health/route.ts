export const dynamic = "force-dynamic";

import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { sqliteConnection } from "@/lib/db";

const ADMIN_EMAIL = "andy@superbadmedia.com.au";

export async function GET(): Promise<NextResponse> {
  const checks: Record<string, unknown> = {};

  try {
    const tables = sqliteConnection
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name",
      )
      .all() as { name: string }[];
    checks.tableCount = tables.length;
  } catch (err) {
    checks.tablesError = String(err);
  }

  try {
    const existing = sqliteConnection
      .prepare("SELECT id, email, role FROM user WHERE email = ?")
      .get(ADMIN_EMAIL) as { id: string; email: string; role: string } | undefined;

    if (!existing) {
      const id = randomUUID();
      sqliteConnection
        .prepare(
          `INSERT INTO user (id, email, name, role, timezone)
           VALUES (?, ?, ?, ?, ?)`,
        )
        .run(id, ADMIN_EMAIL, "Andy Robinson", "admin", "Australia/Melbourne");
      checks.adminSeeded = true;
      checks.adminId = id;
    } else {
      checks.adminExists = true;
      checks.adminId = existing.id;
      checks.adminRole = existing.role;
    }
  } catch (err) {
    checks.adminSeedError = String(err);
  }

  return NextResponse.json(checks);
}
