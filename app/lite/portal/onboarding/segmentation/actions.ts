"use server";

/**
 * Revenue Segmentation server actions.
 *
 * Saves 5 MC answers + optional industry_vertical_other to the company
 * record and stamps `revenue_segmentation_completed_at_ms`. SaaS-only.
 *
 * Owner: OS-2.
 */
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { companies, REVENUE_RANGES, TEAM_SIZES, BIGGEST_CONSTRAINTS, TWELVE_MONTH_GOALS, INDUSTRY_VERTICALS } from "@/lib/db/schema/companies";
import { contacts } from "@/lib/db/schema/contacts";
import { getPortalSession } from "@/lib/portal/guard";
import { logActivity } from "@/lib/activity-log";

const SubmitRevSegSchema = z.object({
  revenue_range: z.enum(REVENUE_RANGES),
  team_size: z.enum(TEAM_SIZES),
  biggest_constraint: z.enum(BIGGEST_CONSTRAINTS),
  twelve_month_goal: z.enum(TWELVE_MONTH_GOALS),
  industry_vertical: z.enum(INDUSTRY_VERTICALS),
  industry_vertical_other: z.string().max(200).optional().nullable(),
});

export type SubmitRevSegInput = z.infer<typeof SubmitRevSegSchema>;

export async function submitRevenueSegmentation(
  input: SubmitRevSegInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await getPortalSession();
  if (!session?.contactId) return { ok: false, error: "no_session" };

  const parsed = SubmitRevSegSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid_input" };

  // Resolve company from contact
  const contact = db
    .select({ company_id: contacts.company_id })
    .from(contacts)
    .where(eq(contacts.id, session.contactId))
    .get();

  if (!contact?.company_id) return { ok: false, error: "no_company" };

  // Check not already completed (idempotent — don't overwrite)
  const existing = db
    .select({ revenue_segmentation_completed_at_ms: companies.revenue_segmentation_completed_at_ms })
    .from(companies)
    .where(eq(companies.id, contact.company_id))
    .get();

  if (existing?.revenue_segmentation_completed_at_ms != null) {
    return { ok: true }; // already done — no-op
  }

  const now = Date.now();
  db.update(companies)
    .set({
      revenue_range: parsed.data.revenue_range,
      team_size: parsed.data.team_size,
      biggest_constraint: parsed.data.biggest_constraint,
      twelve_month_goal: parsed.data.twelve_month_goal,
      industry_vertical: parsed.data.industry_vertical,
      industry_vertical_other:
        parsed.data.industry_vertical === "other"
          ? (parsed.data.industry_vertical_other ?? null)
          : null,
      revenue_segmentation_completed_at_ms: now,
      updated_at_ms: now,
    })
    .where(eq(companies.id, contact.company_id))
    .run();

  void logActivity({
    companyId: contact.company_id,
    contactId: session.contactId,
    kind: "onboarding_revenue_seg_completed",
    body: "Revenue Segmentation completed",
    meta: {
      revenue_range: parsed.data.revenue_range,
      team_size: parsed.data.team_size,
      biggest_constraint: parsed.data.biggest_constraint,
      twelve_month_goal: parsed.data.twelve_month_goal,
      industry_vertical: parsed.data.industry_vertical,
    },
  });

  return { ok: true };
}
