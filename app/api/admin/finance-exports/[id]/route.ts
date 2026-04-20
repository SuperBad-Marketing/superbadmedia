import fs from "node:fs";
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

  if (!exp || exp.status !== "ready" || !exp.file_path) {
    return NextResponse.json({ error: "Export not found or not ready" }, { status: 404 });
  }

  let buffer: Buffer;
  try {
    buffer = fs.readFileSync(exp.file_path);
  } catch {
    return NextResponse.json({ error: "Export file missing from disk" }, { status: 410 });
  }

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${exp.filename ?? "finance-export.zip"}"`,
      "Content-Length": String(buffer.length),
    },
  });
}
