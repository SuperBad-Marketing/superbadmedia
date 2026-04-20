import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { auth } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { finance_exports } from "@/lib/db/schema/finance-exports";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const exp = db
    .select()
    .from(finance_exports)
    .where(eq(finance_exports.id, id))
    .get();

  if (!exp) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({
    id: exp.id,
    status: exp.status,
    filename: exp.filename,
    file_size_bytes: exp.file_size_bytes,
    error_message: exp.error_message,
    completed_at_ms: exp.completed_at_ms,
  });
}
