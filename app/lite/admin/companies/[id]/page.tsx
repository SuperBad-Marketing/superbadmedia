/**
 * /lite/admin/companies/[id] — Company admin view.
 * Spec: docs/specs/client-management.md (Overview archetype),
 *       docs/specs/sales-pipeline.md §9 (Trial Shoot),
 *       docs/specs/branded-invoicing.md §4.2 (Billing).
 * Visual rebuild: sessions/admin-polish-4-brief.md against mockup-admin-interior.html.
 */
import { notFound, redirect } from "next/navigation";
import { desc, eq, max } from "drizzle-orm";
import Link from "next/link";
import type { Metadata } from "next";

import { auth } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { companies } from "@/lib/db/schema/companies";
import { deals, type DealStage } from "@/lib/db/schema/deals";
import { contacts } from "@/lib/db/schema/contacts";
import { invoices, type InvoiceStatus } from "@/lib/db/schema/invoices";
import { activity_log } from "@/lib/db/schema/activity-log";
import { loadInvoiceDetail } from "@/lib/invoicing/detail-query";

import { TrialShootPanel } from "@/components/lite/company/trial-shoot-panel";
import { BillingTab } from "@/components/lite/invoices/billing-tab";
import type { InvoiceIndexRow } from "@/components/lite/invoices/invoice-index-client";
import {
  CompanyStatusBadge,
  type CompanyDerivedStatus,
} from "@/components/lite/admin/companies/company-status-badge";
import {
  CompanyTabStrip,
  type CompanyTab,
} from "@/components/lite/admin/companies/company-tab-strip";
import { InvoiceStatusBadge } from "@/components/lite/invoices/invoice-status-badge";

export const metadata: Metadata = {
  title: "SuperBad — Company",
  robots: { index: false, follow: false },
};

function parseTab(raw: string | undefined): CompanyTab {
  if (raw === "billing") return "billing";
  if (raw === "trial-shoot") return "trial-shoot";
  return "overview";
}

function bankDetailsFromEnv() {
  return {
    account_name: process.env.SUPERBAD_BANK_ACCOUNT_NAME ?? "To be confirmed",
    bsb: process.env.SUPERBAD_BANK_BSB ?? "To be confirmed",
    account_number:
      process.env.SUPERBAD_BANK_ACCOUNT_NUMBER ?? "To be confirmed",
  };
}

function formatCentsCompact(cents: number): string {
  return `$${(cents / 100).toLocaleString("en-AU", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}

function formatCentsExact(cents: number): string {
  return `$${(cents / 100).toLocaleString("en-AU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Australia/Melbourne",
  });
}

function formatMonth(ms: number): string {
  return new Date(ms).toLocaleDateString("en-AU", {
    month: "long",
    year: "numeric",
    timeZone: "Australia/Melbourne",
  });
}

function relativeLabel(tsMs: number, nowMs: number): string {
  const diff = Math.max(0, nowMs - tsMs);
  const dayMs = 24 * 60 * 60 * 1000;
  if (diff < dayMs) return "today";
  const days = Math.floor(diff / dayMs);
  if (days < 30) return `${days} day${days === 1 ? "" : "s"} ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} mo ago`;
  const years = Math.floor(days / 365);
  return `${years} yr${years === 1 ? "" : "s"} ago`;
}

// Righteous-capped shape/size label.
const SHAPE_LABEL: Record<string, string> = {
  solo_founder: "Solo founder",
  founder_led_team: "Founder-led team",
  multi_stakeholder_company: "Multi-stakeholder",
};

const SIZE_LABEL: Record<string, string> = {
  small: "Small",
  medium: "Medium",
  large: "Large",
};

// §5 deal-stage chip. TONE map per stage follows the sales-pipeline warm
// palette — neutrals for cold/gone stages, pink for the quote window,
// orange for negotiating, success for won, strike for lost.
const DEAL_STAGE_TONE: Record<
  DealStage,
  { label: string; bg: string; color: string; strike?: boolean }
> = {
  lead: {
    label: "Lead",
    bg: "rgba(128, 127, 115, 0.15)",
    color: "var(--color-neutral-500)",
  },
  contacted: {
    label: "Contacted",
    bg: "rgba(128, 127, 115, 0.15)",
    color: "var(--color-neutral-300)",
  },
  conversation: {
    label: "Conversation",
    bg: "rgba(244, 160, 176, 0.10)",
    color: "var(--color-brand-pink)",
  },
  trial_shoot: {
    label: "Trial Shoot",
    bg: "rgba(244, 160, 176, 0.14)",
    color: "var(--color-brand-pink)",
  },
  quoted: {
    label: "Quoted",
    bg: "rgba(244, 160, 176, 0.10)",
    color: "var(--color-brand-pink)",
  },
  negotiating: {
    label: "Negotiating",
    bg: "rgba(242, 140, 82, 0.14)",
    color: "var(--color-brand-orange)",
  },
  won: {
    label: "Won",
    bg: "rgba(123, 174, 126, 0.14)",
    color: "var(--color-success)",
  },
  lost: {
    label: "Lost",
    bg: "rgba(128, 127, 115, 0.15)",
    color: "var(--color-neutral-500)",
    strike: true,
  },
};

function DealStageChip({ stage }: { stage: DealStage }) {
  const tone = DEAL_STAGE_TONE[stage];
  return (
    <span
      className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-[3px] font-[family-name:var(--font-label)] text-[10px] uppercase leading-none"
      style={{
        letterSpacing: "1.5px",
        background: tone.bg,
        color: tone.color,
        textDecoration: tone.strike ? "line-through" : undefined,
      }}
    >
      <span
        aria-hidden
        className="h-1 w-1 rounded-full"
        style={{ background: "currentColor", opacity: 0.85 }}
      />
      {tone.label}
    </span>
  );
}

function deriveStatus(
  row: { do_not_contact: boolean },
  wonCount: number,
): CompanyDerivedStatus {
  if (row.do_not_contact) return "archived";
  if (wonCount > 0) return "active";
  return "prospect";
}

// Stale threshold for the hero deck mutter. Tracked in PATCHES_OWED row
// `admin_polish_4_company_stale_days_to_settings` for later migration to
// `settings.get()` (polish-3 precedent).
const COMPANY_STALE_DAYS = 14;
const COMPANY_STALE_MS = COMPANY_STALE_DAYS * 24 * 60 * 60 * 1000;

export default async function CompanyAdminPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string; invoice?: string }>;
}) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    redirect("/api/auth/signin");
  }

  const { id } = await params;
  const sp = await searchParams;
  const activeTab = parseTab(sp.tab);

  const company = await db
    .select()
    .from(companies)
    .where(eq(companies.id, id))
    .get();
  if (!company) notFound();

  // Parallel loads: deals + invoices + contacts + last-activity for this company.
  const [dealRows, invoiceRows, contactRows, lastActivityRow] =
    await Promise.all([
      db
        .select()
        .from(deals)
        .where(eq(deals.company_id, id))
        .orderBy(desc(deals.last_stage_change_at_ms)),
      db
        .select({
          id: invoices.id,
          invoice_number: invoices.invoice_number,
          status: invoices.status,
          total_cents_inc_gst: invoices.total_cents_inc_gst,
          issue_date_ms: invoices.issue_date_ms,
          due_at_ms: invoices.due_at_ms,
          paid_at_ms: invoices.paid_at_ms,
          company_id: invoices.company_id,
        })
        .from(invoices)
        .where(eq(invoices.company_id, id))
        .orderBy(desc(invoices.issue_date_ms)),
      db
        .select()
        .from(contacts)
        .where(eq(contacts.company_id, id))
        .orderBy(desc(contacts.is_primary), desc(contacts.updated_at_ms)),
      db
        .select({ last_at: max(activity_log.created_at_ms) })
        .from(activity_log)
        .where(eq(activity_log.company_id, id))
        .get(),
    ]);

  const nowMs = Date.now();
  const wonCount = dealRows.filter((d) => d.stage === "won").length;
  const openDealCount = dealRows.filter(
    (d) => d.stage !== "won" && d.stage !== "lost",
  ).length;
  const overdueCount = invoiceRows.filter((i) => i.status === "overdue").length;
  const paidLtvCents = invoiceRows
    .filter((i) => i.status === "paid")
    .reduce((acc, i) => acc + i.total_cents_inc_gst, 0);

  const status = deriveStatus(company, wonCount);
  const lastTouchMs = lastActivityRow?.last_at ?? company.updated_at_ms;
  const isStale =
    status !== "archived" && nowMs - lastTouchMs > COMPANY_STALE_MS;

  // Rule 07 mutter — one per surface, voiced on the hero deck. Conditions
  // cascade; first match wins. `archived` suppresses (the §11 cool banner
  // carries that voice).
  const heroMutter: string | null = (() => {
    if (status === "archived") return null;
    if (overdueCount > 0) {
      return overdueCount === 1
        ? "they owe you one."
        : `they owe you ${overdueCount}.`;
    }
    if (isStale) return `quiet since ${formatMonth(lastTouchMs)}.`;
    if (openDealCount > 0) return "live work in the calendar.";
    return null;
  })();

  // One earned §9 BHS moment on the hero card — LTV if any cash in the
  // door, else Deal-Won count if any wins, else suppress (rule 05).
  const bhsMoment: { value: string; label: string; caption: string } | null =
    (() => {
      if (paidLtvCents > 0) {
        return {
          value: formatCentsCompact(paidLtvCents),
          label: "Lifetime value",
          caption:
            paidLtvCents >= 100000 * 100
              ? "six figures and counting."
              : "cash through the door.",
        };
      }
      if (wonCount > 0) {
        return {
          value: String(wonCount),
          label: wonCount === 1 ? "Deal won" : "Deals won",
          caption: "one in the bank, more on the board.",
        };
      }
      return null;
    })();

  // Billing tab rows (InvoiceIndexClient shape) — assemble once; consumed
  // only on the billing branch below. Keeping the shape aligned with
  // polish-3 output means the tab renders identically to the global index.
  const billingRows: InvoiceIndexRow[] = invoiceRows.map((r) => ({
    ...r,
    status: r.status as InvoiceStatus,
    company_name: company.name,
  }));
  let focusedDetail = null;
  if (activeTab === "billing" && sp.invoice) {
    focusedDetail = await loadInvoiceDetail(sp.invoice);
  }

  const daysSinceFirstSeen = Math.max(
    1,
    Math.floor((nowMs - company.first_seen_at_ms) / (24 * 60 * 60 * 1000)),
  );
  const primaryContact =
    contactRows.find((c) => c.is_primary) ?? contactRows[0] ?? null;

  return (
    <div className="mx-auto max-w-4xl">
      {/* ——— §3 entity-detail header ——— */}
      <div className="px-4 pt-6 pb-3">
        <Link
          href="/lite/admin/pipeline"
          className="font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-neutral-500)] transition duration-[180ms] ease-[cubic-bezier(0.16,1,0.3,1)] hover:text-[color:var(--color-brand-cream)]"
          style={{ letterSpacing: "1.8px" }}
        >
          ← Pipeline
        </Link>
      </div>

      <header className="px-4 pb-5">
        <div
          className="font-[family-name:var(--font-label)] text-[10px] uppercase leading-none text-[color:var(--color-neutral-500)]"
          style={{ letterSpacing: "2px" }}
        >
          Admin · Companies · {company.name}
        </div>
        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 flex-col gap-2">
            <div className="flex flex-wrap items-center gap-3">
              <h1
                className="font-[family-name:var(--font-display)] text-[40px] leading-none text-[color:var(--color-brand-cream)]"
                style={{ letterSpacing: "-0.4px" }}
              >
                {company.name}
              </h1>
              <CompanyStatusBadge status={status} />
            </div>
            <p className="max-w-[640px] font-[family-name:var(--font-body)] text-[16px] leading-[1.55] text-[color:var(--color-neutral-300)]">
              Tracked for {daysSinceFirstSeen} day
              {daysSinceFirstSeen === 1 ? "" : "s"}. Last touch{" "}
              {relativeLabel(lastTouchMs, nowMs)}.{" "}
              {heroMutter ? (
                <em className="font-[family-name:var(--font-narrative)] text-[color:var(--color-brand-pink)]">
                  {heroMutter}
                </em>
              ) : null}
            </p>
            <dl className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-[11px] text-[color:var(--color-neutral-500)]">
              {company.industry ? (
                <MetaItem label="Vertical" value={company.industry} />
              ) : null}
              {company.size_band ? (
                <MetaItem label="Size" value={SIZE_LABEL[company.size_band]} />
              ) : null}
              {company.shape ? (
                <MetaItem label="Shape" value={SHAPE_LABEL[company.shape]} />
              ) : null}
              {primaryContact ? (
                <MetaItem
                  label="Primary"
                  value={
                    primaryContact.role
                      ? `${primaryContact.name} · ${primaryContact.role}`
                      : primaryContact.name
                  }
                />
              ) : null}
              <MetaItem
                label="First seen"
                value={formatDate(company.first_seen_at_ms)}
              />
            </dl>
          </div>
        </div>
      </header>

      {/* ——— tab strip (polished §3 vocabulary, layoutId underline) ——— */}
      <div className="px-4 pb-5">
        <CompanyTabStrip companyId={company.id} activeTab={activeTab} />
      </div>

      {activeTab === "overview" ? (
        <OverviewTab
          company={company}
          status={status}
          primaryContact={primaryContact}
          deals={dealRows}
          invoices={invoiceRows}
          contacts={contactRows}
          overdueCount={overdueCount}
          bhsMoment={bhsMoment}
          nowMs={nowMs}
        />
      ) : null}

      {activeTab === "trial-shoot" ? (
        <div className="px-4 pb-10">
          <TrialShootPanel
            companyId={company.id}
            initialStatus={company.trial_shoot_status}
            initialPlan={company.trial_shoot_plan}
            completedAtMs={company.trial_shoot_completed_at_ms}
            feedback={company.trial_shoot_feedback}
          />
        </div>
      ) : null}

      {activeTab === "billing" ? (
        <BillingTab
          companyId={company.id}
          companyName={company.name}
          paymentTermsDays={company.payment_terms_days}
          bankDetails={bankDetailsFromEnv()}
          rows={billingRows}
          focusedInvoiceId={sp.invoice ?? null}
          focusedDetail={focusedDetail}
        />
      ) : null}
    </div>
  );
}

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-2">
      <dt
        className="font-[family-name:var(--font-label)] uppercase"
        style={{ letterSpacing: "1.5px" }}
      >
        {label}
      </dt>
      <dd className="text-[color:var(--color-neutral-300)]">{value}</dd>
    </div>
  );
}

// ————————————————————————————————————————————————————————————
// Overview tab
// ————————————————————————————————————————————————————————————

function OverviewTab({
  company,
  status,
  primaryContact,
  deals: dealRows,
  invoices: invoiceRows,
  contacts: contactRows,
  overdueCount,
  bhsMoment,
  nowMs,
}: {
  company: typeof companies.$inferSelect;
  status: CompanyDerivedStatus;
  primaryContact: (typeof contacts.$inferSelect) | null;
  deals: (typeof deals.$inferSelect)[];
  invoices: {
    id: string;
    invoice_number: string;
    status: InvoiceStatus;
    total_cents_inc_gst: number;
    issue_date_ms: number;
    due_at_ms: number;
    paid_at_ms: number | null;
    company_id: string;
  }[];
  contacts: (typeof contacts.$inferSelect)[];
  overdueCount: number;
  bhsMoment: { value: string; label: string; caption: string } | null;
  nowMs: number;
}) {
  return (
    <div className="space-y-5 px-4 pb-10">
      {status === "archived" ? <ArchivedBanner /> : null}

      <HeroSummaryCard
        company={company}
        primaryContact={primaryContact}
        bhsMoment={bhsMoment}
      />

      <LinkedDealsPanel deals={dealRows} nowMs={nowMs} />

      <LinkedInvoicesPanel
        invoices={invoiceRows}
        overdueCount={overdueCount}
        companyId={company.id}
      />

      <LinkedContactsPanel contacts={contactRows} nowMs={nowMs} />
    </div>
  );
}

// ——— §11 cool info banner ———

function ArchivedBanner() {
  return (
    <div
      className="flex flex-col gap-1 rounded-[10px] px-4 py-3"
      style={{
        background: "rgba(15, 15, 14, 0.45)",
        border: "1px solid rgba(253, 245, 230, 0.05)",
      }}
      role="status"
    >
      <div
        className="font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-neutral-500)]"
        style={{ letterSpacing: "1.5px" }}
      >
        Archived · do not contact
      </div>
      <p className="text-[14px] text-[color:var(--color-neutral-300)]">
        Hidden from outreach. Automations and nudges won&apos;t fire against this
        company until the flag is cleared.
      </p>
      <p className="text-[12px] italic text-[color:var(--color-neutral-500)]">
        History stays visible. Flip the flag to bring them back in.
      </p>
    </div>
  );
}

// ——— §6 hero summary card ———

function HeroSummaryCard({
  company,
  primaryContact,
  bhsMoment,
}: {
  company: typeof companies.$inferSelect;
  primaryContact: (typeof contacts.$inferSelect) | null;
  bhsMoment: { value: string; label: string; caption: string } | null;
}) {
  return (
    <section
      aria-label="Summary"
      className="rounded-[12px] p-5"
      style={{
        background: "var(--color-surface-2)",
        boxShadow: "var(--surface-highlight)",
      }}
    >
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 flex-col gap-3">
          <div>
            <p
              className="font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-neutral-500)]"
              style={{ letterSpacing: "1.8px" }}
            >
              Primary contact
            </p>
            {primaryContact ? (
              <p className="mt-1 font-[family-name:var(--font-body)] text-[14px] text-[color:var(--color-brand-cream)]">
                <span className="font-medium">{primaryContact.name}</span>
                {primaryContact.role ? (
                  <span className="text-[color:var(--color-neutral-500)]">
                    {" · "}
                    {primaryContact.role}
                  </span>
                ) : null}
                {primaryContact.email ? (
                  <span className="block text-[12px] italic text-[color:var(--color-neutral-500)]">
                    {primaryContact.email}
                  </span>
                ) : null}
              </p>
            ) : (
              <p className="mt-1 text-[13px] italic text-[color:var(--color-neutral-500)]">
                No contact recorded yet.
              </p>
            )}
          </div>
          {company.domain ? (
            <div>
              <p
                className="font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-neutral-500)]"
                style={{ letterSpacing: "1.8px" }}
              >
                Domain
              </p>
              <a
                href={`https://${company.domain.replace(/^https?:\/\//, "")}`}
                target="_blank"
                rel="noreferrer"
                className="mt-1 inline-block font-mono text-[12px] text-[color:var(--color-neutral-300)] underline underline-offset-2 transition-colors duration-[180ms] ease-[cubic-bezier(0.16,1,0.3,1)] hover:text-[color:var(--color-brand-cream)]"
              >
                {company.domain}
              </a>
            </div>
          ) : null}
        </div>

        {bhsMoment ? (
          <div
            className="sm:text-right"
            style={{
              background:
                "linear-gradient(135deg, rgba(178, 40, 72, 0.10), rgba(244, 160, 176, 0.04) 60%, rgba(34, 34, 31, 0) 95%)",
              borderLeft: "1px solid rgba(178, 40, 72, 0.25)",
              padding: "8px 14px",
              borderRadius: "8px",
            }}
          >
            <p
              className="font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-neutral-500)]"
              style={{ letterSpacing: "2px" }}
            >
              {bhsMoment.label}
            </p>
            <p
              className="mt-1 font-[family-name:var(--font-display)] tabular-nums text-[color:var(--color-brand-cream)]"
              style={{
                fontSize: "32px",
                lineHeight: 1,
                letterSpacing: "-0.3px",
              }}
            >
              {bhsMoment.value}
            </p>
            <p className="mt-2 font-[family-name:var(--font-narrative)] text-[12px] italic text-[color:var(--color-brand-pink)]">
              {bhsMoment.caption}
            </p>
          </div>
        ) : null}
      </div>
    </section>
  );
}

// ——— §6 linked-panel chrome + §7 table rows ———

function PanelShell({
  title,
  count,
  banner,
  children,
}: {
  title: string;
  count: number;
  banner?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section
      aria-label={title}
      className="overflow-hidden rounded-[12px]"
      style={{
        background: "var(--color-surface-2)",
        boxShadow: "var(--surface-highlight)",
      }}
    >
      <div
        className="flex items-baseline justify-between px-5 py-3"
        style={{ borderBottom: "1px solid rgba(253, 245, 230, 0.05)" }}
      >
        <h2
          className="font-[family-name:var(--font-label)] text-[11px] uppercase text-[color:var(--color-neutral-300)]"
          style={{ letterSpacing: "1.8px" }}
        >
          {title}
        </h2>
        <span
          className="font-[family-name:var(--font-label)] text-[11px] tabular-nums text-[color:var(--color-neutral-500)]"
          style={{ letterSpacing: "1.5px" }}
        >
          {count}
        </span>
      </div>
      {banner}
      <div>{children}</div>
    </section>
  );
}

function OverduePanelBanner({ count }: { count: number }) {
  return (
    <div
      className="flex flex-col gap-1 px-5 py-3"
      style={{
        background:
          "linear-gradient(135deg, rgba(178, 40, 72, 0.12), rgba(242, 140, 82, 0.06))",
        borderBottom: "1px solid rgba(178, 40, 72, 0.25)",
      }}
      role="status"
    >
      <div
        className="font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-brand-orange)]"
        style={{ letterSpacing: "1.5px" }}
      >
        Overdue · {count}
      </div>
      <p className="text-[13px] text-[color:var(--color-neutral-300)]">
        {count === 1
          ? "One invoice is past due. Send a reminder or follow up directly."
          : `${count} invoices are past due. Worth a sweep.`}
      </p>
      <p className="font-[family-name:var(--font-narrative)] text-[12px] italic text-[color:var(--color-brand-pink)]">
        the float can&apos;t carry forever.
      </p>
    </div>
  );
}

function TableHead({
  cols,
}: {
  cols: { label: string; align?: "left" | "right" }[];
}) {
  return (
    <thead>
      <tr>
        {cols.map((c) => (
          <th
            key={c.label}
            className="font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-neutral-500)]"
            style={{
              letterSpacing: "2px",
              padding: "12px 20px",
              borderBottom: "1px solid rgba(253, 245, 230, 0.05)",
              textAlign: c.align ?? "left",
            }}
          >
            {c.label}
          </th>
        ))}
      </tr>
    </thead>
  );
}

const TD_BASE: React.CSSProperties = {
  padding: "14px 20px",
  borderBottom: "1px solid rgba(253, 245, 230, 0.03)",
};

function VoicedEmpty({ hero, mutter }: { hero: string; mutter: string }) {
  return (
    <div className="px-8 py-10 text-center">
      <p
        className="font-[family-name:var(--font-display)] leading-none text-[color:var(--color-brand-cream)]"
        style={{ fontSize: "24px", letterSpacing: "-0.2px" }}
      >
        {hero}
      </p>
      <p className="mt-3 font-[family-name:var(--font-narrative)] text-[13px] italic text-[color:var(--color-brand-pink)]">
        {mutter}
      </p>
    </div>
  );
}

function LinkedDealsPanel({
  deals: dealRows,
  nowMs,
}: {
  deals: (typeof deals.$inferSelect)[];
  nowMs: number;
}) {
  return (
    <PanelShell title="Deals" count={dealRows.length}>
      {dealRows.length === 0 ? (
        <VoicedEmpty
          hero="No deals yet."
          mutter="we haven&rsquo;t tried to sell them anything."
        />
      ) : (
        <table className="w-full text-left">
          <TableHead
            cols={[
              { label: "Deal" },
              { label: "Stage" },
              { label: "Value", align: "right" },
              { label: "Next action" },
              { label: "Last change" },
            ]}
          />
          <tbody>
            {dealRows.map((d) => (
              <tr key={d.id}>
                <td
                  style={{ ...TD_BASE, color: "var(--color-brand-cream)" }}
                  className="font-[family-name:var(--font-body)] text-[13px] font-medium"
                >
                  {d.title}
                </td>
                <td style={TD_BASE}>
                  <DealStageChip stage={d.stage} />
                </td>
                <td
                  style={{
                    ...TD_BASE,
                    textAlign: "right",
                    color: "var(--color-brand-cream)",
                  }}
                  className="font-[family-name:var(--font-label)] tabular-nums text-[13px]"
                >
                  {d.value_cents == null
                    ? "—"
                    : d.value_estimated
                      ? `est. ${formatCentsCompact(d.value_cents)}`
                      : formatCentsCompact(d.value_cents)}
                </td>
                <td
                  style={{ ...TD_BASE, color: "var(--color-neutral-300)" }}
                  className="text-[12px]"
                >
                  {d.next_action_text ?? (
                    <span className="italic text-[color:var(--color-neutral-500)]">
                      —
                    </span>
                  )}
                </td>
                <td
                  style={{ ...TD_BASE, color: "var(--color-neutral-500)" }}
                  className="font-[family-name:var(--font-body)] text-[12px] italic"
                >
                  {relativeLabel(d.last_stage_change_at_ms, nowMs)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </PanelShell>
  );
}

function LinkedInvoicesPanel({
  invoices: invoiceRows,
  overdueCount,
  companyId,
}: {
  invoices: {
    id: string;
    invoice_number: string;
    status: InvoiceStatus;
    total_cents_inc_gst: number;
    issue_date_ms: number;
    due_at_ms: number;
    paid_at_ms: number | null;
    company_id: string;
  }[];
  overdueCount: number;
  companyId: string;
}) {
  return (
    <PanelShell
      title="Invoices"
      count={invoiceRows.length}
      banner={
        overdueCount > 0 ? <OverduePanelBanner count={overdueCount} /> : null
      }
    >
      {invoiceRows.length === 0 ? (
        <VoicedEmpty
          hero="No invoices yet."
          mutter="either free work or a fresh name."
        />
      ) : (
        <table className="w-full text-left">
          <TableHead
            cols={[
              { label: "Invoice" },
              { label: "Issued" },
              { label: "Due" },
              { label: "Total", align: "right" },
              { label: "Status" },
            ]}
          />
          <tbody>
            {invoiceRows.map((r) => (
              <tr key={r.id}>
                <td
                  style={{ ...TD_BASE, color: "var(--color-brand-cream)" }}
                  className="font-[family-name:var(--font-label)] text-[11px] tabular-nums"
                >
                  <Link
                    href={`/lite/admin/companies/${companyId}?tab=billing&invoice=${r.id}`}
                    className="transition-colors duration-[180ms] ease-[cubic-bezier(0.16,1,0.3,1)] hover:text-[color:var(--color-brand-pink)]"
                    style={{ letterSpacing: "1px" }}
                  >
                    {r.invoice_number}
                  </Link>
                </td>
                <td
                  style={{ ...TD_BASE, color: "var(--color-neutral-500)" }}
                  className="font-[family-name:var(--font-body)] text-[12px] italic"
                >
                  {formatDate(r.issue_date_ms)}
                </td>
                <td
                  style={{ ...TD_BASE, color: "var(--color-neutral-500)" }}
                  className="font-[family-name:var(--font-body)] text-[12px] italic"
                >
                  {formatDate(r.due_at_ms)}
                </td>
                <td
                  style={{
                    ...TD_BASE,
                    textAlign: "right",
                    color:
                      r.status === "paid"
                        ? "var(--color-success)"
                        : "var(--color-brand-cream)",
                  }}
                  className="font-[family-name:var(--font-label)] tabular-nums text-[13px]"
                >
                  {formatCentsExact(r.total_cents_inc_gst)}
                </td>
                <td style={TD_BASE}>
                  <InvoiceStatusBadge status={r.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </PanelShell>
  );
}

function LinkedContactsPanel({
  contacts: contactRows,
  nowMs,
}: {
  contacts: (typeof contacts.$inferSelect)[];
  nowMs: number;
}) {
  return (
    <PanelShell title="Contacts" count={contactRows.length}>
      {contactRows.length === 0 ? (
        <VoicedEmpty hero="One lonely contact." mutter="orgs are made of people." />
      ) : (
        <table className="w-full text-left">
          <TableHead
            cols={[
              { label: "Name" },
              { label: "Role" },
              { label: "Email" },
              { label: "Last touch" },
            ]}
          />
          <tbody>
            {contactRows.map((c) => (
              <tr key={c.id}>
                <td
                  style={{ ...TD_BASE, color: "var(--color-brand-cream)" }}
                  className="font-[family-name:var(--font-body)] text-[13px] font-medium"
                >
                  <span className="inline-flex items-center gap-2">
                    {c.name}
                    {c.is_primary ? <PrimaryPill /> : null}
                  </span>
                </td>
                <td
                  style={{ ...TD_BASE, color: "var(--color-neutral-300)" }}
                  className="text-[12px]"
                >
                  {c.role ?? (
                    <span className="italic text-[color:var(--color-neutral-500)]">
                      —
                    </span>
                  )}
                </td>
                <td
                  style={{ ...TD_BASE, color: "var(--color-neutral-300)" }}
                  className="text-[12px]"
                >
                  {c.email ? (
                    <a
                      href={`mailto:${c.email}`}
                      className="transition-colors duration-[180ms] ease-[cubic-bezier(0.16,1,0.3,1)] hover:text-[color:var(--color-brand-cream)]"
                    >
                      {c.email}
                    </a>
                  ) : (
                    <span className="italic text-[color:var(--color-neutral-500)]">
                      —
                    </span>
                  )}
                </td>
                <td
                  style={{ ...TD_BASE, color: "var(--color-neutral-500)" }}
                  className="font-[family-name:var(--font-body)] text-[12px] italic"
                >
                  {relativeLabel(c.updated_at_ms, nowMs)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </PanelShell>
  );
}

function PrimaryPill() {
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-[1px] font-[family-name:var(--font-label)] text-[9px] uppercase"
      style={{
        letterSpacing: "1.5px",
        background: "rgba(244, 160, 176, 0.10)",
        color: "var(--color-brand-pink)",
      }}
    >
      primary
    </span>
  );
}
