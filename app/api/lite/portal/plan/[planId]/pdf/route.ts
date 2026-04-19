import { NextResponse } from "next/server";
import { getPortalSession } from "@/lib/portal/guard";
import { renderPlanPdf } from "@/lib/six-week-plan/render-plan-pdf";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ planId: string }> },
) {
  const session = await getPortalSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { planId } = await params;
  const result = await renderPlanPdf(planId, session.contactId);

  if (!result) {
    return NextResponse.json(
      { error: "Plan not found or not ready" },
      { status: 404 },
    );
  }

  return new NextResponse(new Uint8Array(result.buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${result.filename}"`,
      "Content-Length": String(result.buffer.length),
      "Cache-Control": "private, max-age=86400",
    },
  });
}
