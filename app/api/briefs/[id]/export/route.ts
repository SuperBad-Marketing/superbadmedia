export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { auth } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { briefs } from "@/lib/db/schema/briefs";
import { brief_storyboards } from "@/lib/db/schema/brief-storyboards";
import { briefToMarkdown, briefToHtml } from "@/lib/briefs/export-brief";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const format = req.nextUrl.searchParams.get("format");

  if (format !== "md" && format !== "html") {
    return NextResponse.json({ error: "format must be md or html" }, { status: 400 });
  }

  const brief = await db.select().from(briefs).where(eq(briefs.id, id)).get();
  if (!brief) {
    return NextResponse.json({ error: "Brief not found" }, { status: 404 });
  }

  let scenes = undefined;
  let shotlist = undefined;
  try {
    const sb = await db
      .select()
      .from(brief_storyboards)
      .where(eq(brief_storyboards.brief_id, id))
      .get();
    if (sb && sb.status === "ready") {
      scenes = sb.scenes_json ?? undefined;
      shotlist = sb.shotlist_json ?? undefined;
    }
  } catch {
    // no storyboard
  }

  const exportData = { ...brief, scenes, shotlist };
  const filename = `SuperBad-Brief-${brief.reference_number}`;

  if (format === "md") {
    const md = briefToMarkdown(exportData);
    return new NextResponse(md, {
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}.md"`,
      },
    });
  }

  const html = briefToHtml(exportData);
  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
    },
  });
}
