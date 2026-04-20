import { and, eq, gte, lte, sql, gt, or } from "drizzle-orm";

import { db } from "@/lib/db";
import { invoices } from "@/lib/db/schema/invoices";
import { compliance_milestones } from "@/lib/db/schema/compliance-milestones";
import settings from "@/lib/settings";
import type { HealthBanner } from "@/lib/tasks/cockpit";

const MS_PER_DAY = 86_400_000;

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function basQuarterEnd(now: Date): { end: Date; label: string } {
  const y = now.getFullYear();
  const m = now.getMonth() + 1;
  if (m >= 1 && m <= 3) return { end: new Date(y, 2, 31), label: `Q3 ${y} (Jan–Mar)` };
  if (m >= 4 && m <= 6) return { end: new Date(y, 5, 30), label: `Q4 ${y} (Apr–Jun)` };
  if (m >= 7 && m <= 9) return { end: new Date(y, 8, 30), label: `Q1 ${y} (Jul–Sep)` };
  return { end: new Date(y, 11, 31), label: `Q2 ${y} (Oct–Dec)` };
}

function fyEnd(now: Date): { end: Date; label: string } {
  const y = now.getFullYear();
  const m = now.getMonth() + 1;
  const fyEndYear = m >= 7 ? y + 1 : y;
  return {
    end: new Date(fyEndYear, 5, 30),
    label: `FY ${fyEndYear - 1}–${fyEndYear}`,
  };
}

function daysUntil(target: Date, now: Date): number {
  return Math.ceil((target.getTime() - now.getTime()) / MS_PER_DAY);
}

async function isMilestoneFiled(
  kind: "bas_filed" | "eofy_filed",
  periodLabel: string,
): Promise<boolean> {
  const row = db
    .select()
    .from(compliance_milestones)
    .where(
      and(
        eq(compliance_milestones.kind, kind),
        eq(compliance_milestones.period_label, periodLabel),
      ),
    )
    .get();
  return !!row;
}

export async function getFinanceHealthBanners(
  nowMs: number = Date.now(),
): Promise<HealthBanner[]> {
  const banners: HealthBanner[] = [];
  const now = new Date(nowMs);

  const basReminderDays = await settings.get("finance.bas_reminder_days_ahead");
  const eofyReminderDays = await settings.get("finance.eofy_reminder_days_ahead");
  const overdueThresholdDays = await settings.get("finance.overdue_invoice_threshold_days");
  const outstandingThresholdAud = await settings.get("finance.outstanding_invoices_threshold_aud");

  // 1. BAS due banner
  const bas = basQuarterEnd(now);
  const basRemaining = daysUntil(bas.end, now);
  if (basRemaining >= 0 && basRemaining <= basReminderDays) {
    const filed = await isMilestoneFiled("bas_filed", bas.label);
    if (!filed) {
      banners.push({
        id: `finance_bas_due:${bas.label}`,
        severity: basRemaining <= 3 ? "critical" : "warning",
        summary: `BAS due in ${basRemaining} day${basRemaining === 1 ? "" : "s"} — ${bas.label}`,
        href: "/lite/finance/export",
        source: "finance-dashboard",
      });
    }
  }

  // 2. EOFY due banner
  const fy = fyEnd(now);
  const fyRemaining = daysUntil(fy.end, now);
  if (fyRemaining >= 0 && fyRemaining <= eofyReminderDays) {
    const filed = await isMilestoneFiled("eofy_filed", fy.label);
    if (!filed) {
      banners.push({
        id: `finance_eofy_due:${fy.label}`,
        severity: fyRemaining <= 7 ? "critical" : "warning",
        summary: `EOFY in ${fyRemaining} day${fyRemaining === 1 ? "" : "s"} — ${fy.label}`,
        href: "/lite/finance/export",
        source: "finance-dashboard",
      });
    }
  }

  // 3. Invoice overdue banner
  const overdueThresholdMs = nowMs - overdueThresholdDays * MS_PER_DAY;

  const overdueAgg = await db
    .select({
      count: sql<number>`count(*)`,
      total: sql<number>`coalesce(sum(${invoices.total_cents_inc_gst}), 0)`,
    })
    .from(invoices)
    .where(
      and(
        eq(invoices.status, "overdue"),
        lte(invoices.due_at_ms, overdueThresholdMs),
      ),
    )
    .get();

  const outstandingAgg = await db
    .select({
      total: sql<number>`coalesce(sum(${invoices.total_cents_inc_gst}), 0)`,
    })
    .from(invoices)
    .where(
      or(
        eq(invoices.status, "sent"),
        eq(invoices.status, "overdue"),
      ),
    )
    .get();

  const overdueCount = overdueAgg?.count ?? 0;
  const overdueTotalCents = overdueAgg?.total ?? 0;
  const outstandingTotalCents = outstandingAgg?.total ?? 0;
  const outstandingTotalAud = outstandingTotalCents / 100;

  const hasDaysOverdue = overdueCount > 0;
  const hasOutstandingThreshold = outstandingTotalAud > outstandingThresholdAud;

  if (hasDaysOverdue || hasOutstandingThreshold) {
    const thresholdKind = hasDaysOverdue ? "days_overdue" : "outstanding_total";
    const summary = hasDaysOverdue
      ? `${overdueCount} invoice${overdueCount === 1 ? "" : "s"} overdue (>${overdueThresholdDays}d) — $${(overdueTotalCents / 100).toLocaleString("en-AU", { minimumFractionDigits: 0 })}`
      : `Outstanding invoices total $${outstandingTotalAud.toLocaleString("en-AU", { minimumFractionDigits: 0 })} (>${outstandingThresholdAud})`;

    banners.push({
      id: `finance_invoice_overdue:${thresholdKind}`,
      severity: (overdueCount >= 3 || outstandingTotalAud > outstandingThresholdAud * 2) ? "critical" : "warning",
      summary,
      href: "/lite/invoices?filter=overdue",
      source: "finance-dashboard",
    });
  }

  return banners;
}
