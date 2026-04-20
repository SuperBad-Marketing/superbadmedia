import { NextResponse } from "next/server";
import { ne, desc } from "drizzle-orm";

import { auth } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { finance_exports } from "@/lib/db/schema/finance-exports";

export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const exports = db
    .select()
    .from(finance_exports)
    .where(ne(finance_exports.status, "purged"))
    .orderBy(desc(finance_exports.created_at_ms))
    .limit(20)
    .all();

  return NextResponse.json({ exports });
}
