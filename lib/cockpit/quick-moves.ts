import { db } from "@/lib/db";
import { calendar_bookings } from "@/lib/db/schema/calendar";
import { companies } from "@/lib/db/schema/companies";
import { and, eq, gte, lte } from "drizzle-orm";
import { melbourneStartAndEndOfDay } from "@/lib/time/melbourne";

export type QuickMoveType =
  | "generate_post"
  | "draft_followup"
  | "prep_shoot_brief"
  | "chase_invoices";

export interface QuickMove {
  type: QuickMoveType;
  label: string;
  sublabel: string;
  meta?: Record<string, unknown>;
}

export async function getAvailableQuickMoves(
  nowMs: number = Date.now(),
): Promise<QuickMove[]> {
  const moves: QuickMove[] = [];

  moves.push({
    type: "generate_post",
    label: "Generate today's post",
    sublabel: "Pull from strategy or brainstorm fresh",
  });

  const { deals } = await import("@/lib/db/schema/deals");
  const { sql } = await import("drizzle-orm");

  const overdueFollowups = await db
    .select({
      id: deals.id,
      company_name: companies.name,
    })
    .from(deals)
    .innerJoin(companies, eq(deals.company_id, companies.id))
    .where(
      and(
        eq(deals.stage, "quoted"),
        lte(deals.updated_at_ms, nowMs - 3 * 86400000),
      ),
    )
    .limit(3);

  if (overdueFollowups.length > 0) {
    const name = overdueFollowups[0].company_name;
    const extra = overdueFollowups.length > 1 ? ` +${overdueFollowups.length - 1}` : "";
    moves.push({
      type: "draft_followup",
      label: `Draft follow-up to ${name}${extra}`,
      sublabel: "Proposal sent, no response yet",
      meta: {
        deals: overdueFollowups.map((d) => ({
          dealId: d.id,
          companyName: d.company_name,
        })),
      },
    });
  }

  const twoDaysMs = 2 * 86400000;
  const { startMs } = melbourneStartAndEndOfDay(nowMs);
  const shoots = await db
    .select({
      id: calendar_bookings.id,
      metadata_json: calendar_bookings.metadata_json,
      start_at_ms: calendar_bookings.start_at_ms,
      subject_ref_id: calendar_bookings.subject_ref_id,
    })
    .from(calendar_bookings)
    .where(
      and(
        eq(calendar_bookings.booking_type, "intro_funnel_shoot"),
        eq(calendar_bookings.status, "active"),
        gte(calendar_bookings.start_at_ms, startMs),
        lte(calendar_bookings.start_at_ms, nowMs + twoDaysMs),
      ),
    )
    .limit(1);

  if (shoots.length > 0) {
    const meta = shoots[0].metadata_json as Record<string, unknown> | null;
    const subject = (meta?.subject as string) ?? "Upcoming shoot";
    moves.push({
      type: "prep_shoot_brief",
      label: "Prep shoot brief",
      sublabel: subject,
      meta: { bookingId: shoots[0].id, subjectRefId: shoots[0].subject_ref_id },
    });
  }

  const { invoices } = await import("@/lib/db/schema/invoices");
  const overdueInvoices = await db
    .select({ count: sql<number>`count(*)` })
    .from(invoices)
    .where(
      and(
        eq(invoices.status, "sent"),
        lte(invoices.due_at_ms, nowMs),
      ),
    )
    .then((rows) => rows[0]?.count ?? 0);

  if (overdueInvoices > 0) {
    moves.push({
      type: "chase_invoices",
      label: `Chase ${overdueInvoices} overdue invoice${overdueInvoices === 1 ? "" : "s"}`,
      sublabel: "Draft polite follow-ups",
      meta: { count: overdueInvoices },
    });
  }

  return moves;
}
