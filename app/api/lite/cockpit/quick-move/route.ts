import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/session";
import { logActivity } from "@/lib/activity-log";
import type { QuickMoveType } from "@/lib/cockpit/quick-moves";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const type = body.type as QuickMoveType;
  const meta = body.meta as Record<string, unknown> | undefined;

  await logActivity({
    kind: "cockpit_quick_move_triggered",
    body: `Quick move: ${type}`,
    meta: { type, ...meta },
  });

  switch (type) {
    case "generate_post":
      return handleGeneratePost();
    case "draft_followup":
      return handleDraftFollowup(meta);
    case "prep_shoot_brief":
      return handlePrepShootBrief(meta);
    case "chase_invoices":
      return handleChaseInvoices();
    default:
      return NextResponse.json({ error: "Unknown move type" }, { status: 400 });
  }
}

async function handleGeneratePost() {
  return NextResponse.json({
    ok: true,
    result: { queued: true, message: "Post generation queued" },
  });
}

async function handleDraftFollowup(meta?: Record<string, unknown>) {
  const deals = meta?.deals as Array<{ dealId: string; companyName: string }> | undefined;
  if (!deals?.length) {
    return NextResponse.json({ ok: false, error: "No deals specified" }, { status: 400 });
  }

  await logActivity({
    kind: "cockpit_followup_drafted",
    body: `Follow-up drafts requested for ${deals.length} deal(s)`,
    meta: { dealIds: deals.map((d) => d.dealId) },
  });

  return NextResponse.json({
    ok: true,
    result: { queued: true, dealCount: deals.length },
  });
}

async function handlePrepShootBrief(meta?: Record<string, unknown>) {
  const bookingId = meta?.bookingId as string | undefined;
  if (!bookingId) {
    return NextResponse.json({ ok: false, error: "No booking specified" }, { status: 400 });
  }

  await logActivity({
    kind: "cockpit_shoot_brief_prepped",
    body: `Shoot brief prep requested`,
    meta: { bookingId },
  });

  return NextResponse.json({
    ok: true,
    result: { queued: true, bookingId },
  });
}

async function handleChaseInvoices() {
  await logActivity({
    kind: "cockpit_invoice_chase_triggered",
    body: `Invoice chase triggered from cockpit`,
  });

  return NextResponse.json({
    ok: true,
    result: { queued: true },
  });
}
