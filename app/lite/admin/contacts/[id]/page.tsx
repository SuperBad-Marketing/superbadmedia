/**
 * /lite/admin/contacts/[id] — Contact admin view (5-tab profile).
 * Spec: docs/specs/client-management.md §3.
 */
import { notFound, redirect } from "next/navigation";
import { and, desc, eq } from "drizzle-orm";
import Link from "next/link";
import type { Metadata } from "next";

import { auth } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { contacts } from "@/lib/db/schema/contacts";
import { companies } from "@/lib/db/schema/companies";
import { deals, type DealStage } from "@/lib/db/schema/deals";
import { activity_log } from "@/lib/db/schema/activity-log";
import { private_notes } from "@/lib/db/schema/private-notes";
import { brand_dna_profiles } from "@/lib/db/schema/brand-dna-profiles";
import { threads, messages } from "@/lib/db/schema/messages";
import { portal_chat_messages } from "@/lib/db/schema/portal-chat-messages";

import {
  ContactTabStrip,
  type ContactTab,
} from "@/components/lite/admin/contacts/contact-tab-strip";
import { ContactBrandDnaTab } from "@/components/lite/admin/contacts/contact-brand-dna-tab";
import { ContactCommsTab } from "@/components/lite/admin/contacts/contact-comms-tab";
import { ContactPortalChatTab } from "@/components/lite/admin/contacts/contact-portal-chat-tab";
import { ActivityTab } from "@/components/lite/admin/companies/activity-tab";
import { PrivateNotesFeed } from "@/components/lite/admin/contacts/private-notes-feed";
import { ContextEngineOverview } from "@/components/lite/admin/contacts/context-engine-overview";
import { addNote, toggleVisibility } from "./actions";
import {
  getContextSummary,
  getSignalsForContact,
  getActionItems,
} from "@/lib/context-engine";
import { context_summaries } from "@/lib/db/schema/context-summaries";
import { getTasksByEntity } from "@/lib/tasks/queries";
import { EntityTasksPanel } from "@/components/lite/admin/tasks/entity-tasks-panel";

export const metadata: Metadata = {
  title: "SuperBad — Contact",
  robots: { index: false, follow: false },
};

const VALID_TABS: ContactTab[] = [
  "overview", "tasks", "comms", "brand-dna", "portal-chat", "activity",
];

function parseTab(raw: string | undefined): ContactTab {
  if (raw && VALID_TABS.includes(raw as ContactTab)) return raw as ContactTab;
  return "overview";
}

function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
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

function formatCentsCompact(cents: number): string {
  return `$${(cents / 100).toLocaleString("en-AU", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}

const DEAL_STAGE_TONE: Record<
  DealStage,
  { label: string; bg: string; color: string; strike?: boolean }
> = {
  lead: { label: "Lead", bg: "rgba(128, 127, 115, 0.15)", color: "var(--color-neutral-500)" },
  contacted: { label: "Contacted", bg: "rgba(128, 127, 115, 0.15)", color: "var(--color-neutral-300)" },
  conversation: { label: "Conversation", bg: "rgba(244, 160, 176, 0.10)", color: "var(--color-brand-pink)" },
  trial_shoot: { label: "Trial Shoot", bg: "rgba(244, 160, 176, 0.14)", color: "var(--color-brand-pink)" },
  quoted: { label: "Quoted", bg: "rgba(244, 160, 176, 0.10)", color: "var(--color-brand-pink)" },
  negotiating: { label: "Negotiating", bg: "rgba(242, 140, 82, 0.14)", color: "var(--color-brand-orange)" },
  won: { label: "Won", bg: "rgba(123, 174, 126, 0.14)", color: "var(--color-success)" },
  lost: { label: "Lost", bg: "rgba(128, 127, 115, 0.15)", color: "var(--color-neutral-500)", strike: true },
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

export default async function ContactAdminPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string; thread?: string }>;
}) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    redirect("/api/auth/signin");
  }

  const { id } = await params;
  const sp = await searchParams;
  const activeTab = parseTab(sp.tab);

  const contact = await db
    .select()
    .from(contacts)
    .where(eq(contacts.id, id))
    .get();
  if (!contact) notFound();

  const company = await db
    .select()
    .from(companies)
    .where(eq(companies.id, contact.company_id))
    .get();

  const dealRows = await db
    .select()
    .from(deals)
    .where(eq(deals.company_id, contact.company_id))
    .orderBy(desc(deals.last_stage_change_at_ms));

  const nowMs = Date.now();
  const lastTouchMs = contact.updated_at_ms;
  const primaryDeal = dealRows[0] ?? null;

  // Tab-specific data loads.
  const brandDnaData = activeTab === "brand-dna"
    ? await db.select().from(brand_dna_profiles).where(eq(brand_dna_profiles.contact_id, id)).orderBy(desc(brand_dna_profiles.created_at_ms))
    : null;

  const commsData = activeTab === "comms"
    ? await db.select().from(threads).where(eq(threads.contact_id, id)).orderBy(desc(threads.last_message_at_ms))
    : null;

  const focusedThreadId = activeTab === "comms" ? (sp.thread ?? null) : null;
  const focusedThread = focusedThreadId && commsData
    ? commsData.find((t) => t.id === focusedThreadId) ?? null
    : null;
  const focusedMessages = focusedThread
    ? await db.select().from(messages).where(eq(messages.thread_id, focusedThread.id)).orderBy(messages.created_at_ms)
    : null;

  const portalChatData = activeTab === "portal-chat"
    ? await db.select().from(portal_chat_messages).where(eq(portal_chat_messages.contact_id, id)).orderBy(desc(portal_chat_messages.created_at_ms)).limit(200)
    : null;

  const activityData = activeTab === "activity"
    ? await db.select().from(activity_log).where(eq(activity_log.contact_id, id)).orderBy(desc(activity_log.created_at_ms)).limit(200)
    : null;

  const privateNotesData = activeTab === "overview" || activeTab === "activity"
    ? await db.select().from(private_notes).where(eq(private_notes.contact_id, id)).orderBy(desc(private_notes.created_at_ms))
    : null;

  const activityNotesData = activeTab === "overview"
    ? await db.select().from(activity_log).where(and(eq(activity_log.contact_id, id), eq(activity_log.kind, "note"))).orderBy(desc(activity_log.created_at_ms))
    : null;

  const entityTasks = activeTab === "tasks"
    ? await getTasksByEntity("contact", id)
    : null;

  // Context Engine data (overview tab)
  const [contextSummaryRow, contextSignals, contextActionItems] =
    activeTab === "overview"
      ? await Promise.all([
          db.select().from(context_summaries).where(eq(context_summaries.contact_id, id)).get(),
          getSignalsForContact(id),
          getActionItems(id),
        ])
      : [null, null, null];

  return (
    <div className="mx-auto max-w-4xl">
      {/* ——— breadcrumb ——— */}
      <div className="px-4 pt-6 pb-3">
        {company ? (
          <Link
            href={`/lite/admin/companies/${company.id}`}
            className="font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-neutral-500)] transition duration-[180ms] ease-[cubic-bezier(0.16,1,0.3,1)] hover:text-[color:var(--color-brand-cream)]"
            style={{ letterSpacing: "1.8px" }}
          >
            ← {company.name}
          </Link>
        ) : (
          <Link
            href="/lite/admin/pipeline"
            className="font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-neutral-500)] transition duration-[180ms] ease-[cubic-bezier(0.16,1,0.3,1)] hover:text-[color:var(--color-brand-cream)]"
            style={{ letterSpacing: "1.8px" }}
          >
            ← Pipeline
          </Link>
        )}
      </div>

      <header className="px-4 pb-5">
        <div
          className="font-[family-name:var(--font-label)] text-[10px] uppercase leading-none text-[color:var(--color-neutral-500)]"
          style={{ letterSpacing: "2px" }}
        >
          Admin · Contacts · {contact.name}
        </div>
        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 flex-col gap-2">
            <div className="flex flex-wrap items-center gap-3">
              <h1
                className="font-[family-name:var(--font-display)] text-[40px] leading-none text-[color:var(--color-brand-cream)]"
                style={{ letterSpacing: "-0.4px" }}
              >
                {contact.name}
              </h1>
              {contact.is_primary && <PrimaryPill />}
            </div>
            <p className="max-w-[640px] font-[family-name:var(--font-body)] text-[16px] leading-[1.55] text-[color:var(--color-neutral-300)]">
              {company ? (
                <Link
                  href={`/lite/admin/companies/${company.id}`}
                  className="transition-colors duration-[180ms] ease-[cubic-bezier(0.16,1,0.3,1)] hover:text-[color:var(--color-brand-cream)]"
                >
                  {company.name}
                </Link>
              ) : null}
              {company && contact.role ? " · " : null}
              {contact.role ?? null}
              {(company || contact.role) ? ". " : null}
              Last touch {relativeLabel(lastTouchMs, nowMs)}.
            </p>
            <dl className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-[11px] text-[color:var(--color-neutral-500)]">
              {contact.email ? (
                <MetaItem label="Email" value={contact.email} />
              ) : null}
              {contact.phone ? (
                <MetaItem label="Phone" value={contact.phone} />
              ) : null}
              {contact.relationship_type ? (
                <MetaItem label="Type" value={contact.relationship_type.replace(/_/g, " ")} />
              ) : null}
              <MetaItem
                label="First seen"
                value={formatDate(contact.created_at_ms)}
              />
            </dl>
          </div>
        </div>
      </header>

      {/* ——— tab strip ——— */}
      <div className="px-4 pb-5">
        <ContactTabStrip contactId={contact.id} activeTab={activeTab} />
      </div>

      {activeTab === "overview" ? (
        <OverviewTab
          contact={contact}
          company={company}
          deals={dealRows}
          primaryDeal={primaryDeal}
          nowMs={nowMs}
          privateNotes={privateNotesData ?? []}
          activityNotes={activityNotesData ?? []}
          contextSummaryRow={contextSummaryRow ?? null}
          contextSignals={contextSignals}
          contextActionItems={contextActionItems ?? []}
        />
      ) : null}

      {activeTab === "tasks" && entityTasks !== null ? (
        <EntityTasksPanel
          tasks={entityTasks}
          emptyHero="No tasks for this contact."
          emptyMutter="nothing on the list. yet."
        />
      ) : null}

      {activeTab === "comms" && commsData !== null ? (
        <ContactCommsTab
          threads={commsData}
          contactId={contact.id}
          focusedThreadId={focusedThreadId}
          focusedThread={focusedThread}
          focusedMessages={focusedMessages}
        />
      ) : null}

      {activeTab === "brand-dna" && brandDnaData !== null ? (
        <ContactBrandDnaTab profiles={brandDnaData} />
      ) : null}

      {activeTab === "portal-chat" ? (
        <ContactPortalChatTab chatMessages={portalChatData ?? []} />
      ) : null}

      {activeTab === "activity" ? (
        <ActivityTab
          activities={activityData ?? []}
          privateNotes={privateNotesData ?? []}
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

// ————————————————————————————————————————————————————————————
// Overview tab — §3.3
// ————————————————————————————————————————————————————————————

function OverviewTab({
  contact,
  company,
  deals: dealRows,
  primaryDeal,
  nowMs,
  privateNotes,
  activityNotes,
  contextSummaryRow,
  contextSignals,
  contextActionItems,
}: {
  contact: typeof contacts.$inferSelect;
  company: typeof companies.$inferSelect | undefined;
  deals: (typeof deals.$inferSelect)[];
  primaryDeal: typeof deals.$inferSelect | null;
  nowMs: number;
  privateNotes: (typeof private_notes.$inferSelect)[];
  activityNotes: (typeof activity_log.$inferSelect)[];
  contextSummaryRow: typeof context_summaries.$inferSelect | null;
  contextSignals: Awaited<ReturnType<typeof getSignalsForContact>> | null;
  contextActionItems: Awaited<ReturnType<typeof getActionItems>>;
}) {
  const signals = contextSignals ?? {
    health_label: "stale" as const,
    days_since_last_contact: Infinity,
    overdue_action_items_you: 0,
    overdue_action_items_them: 0,
    total_open_action_items: 0,
    has_unsent_draft: false,
    last_contact_direction: null,
    deal_stage: primaryDeal?.stage ?? null,
    outstanding_invoice: false,
  };

  const actionItemsForPanel = contextActionItems.map((item) => ({
    id: item.id,
    description: item.description,
    owner: item.owner as "you" | "them",
    due_date_ms: item.due_date_ms,
    source: item.source as "claude_extract" | "manual",
    status: item.status as "open" | "done" | "dismissed",
    created_at_ms: item.created_at_ms,
    completed_at_ms: item.completed_at_ms,
  }));

  return (
    <div className="space-y-5 px-4 pb-10">
      {/* Context Engine: summary + action items + draft trigger */}
      <ContextEngineOverview
        contactId={contact.id}
        contextSummary={contextSummaryRow ? {
          conversation_summary: contextSummaryRow.conversation_summary,
          summary_generated_at_ms: contextSummaryRow.summary_generated_at_ms,
          draft_content: contextSummaryRow.draft_content,
          draft_channel: contextSummaryRow.draft_channel,
          draft_nudge_history: contextSummaryRow.draft_nudge_history as string[] | null,
          draft_generated_at_ms: contextSummaryRow.draft_generated_at_ms,
        } : null}
        signals={signals}
        actionItems={actionItemsForPanel}
        preferredChannel={contact.preferred_channel}
      />

      {/* Deal snapshot */}
      {dealRows.length > 0 ? (
        <section
          aria-label="Deals"
          className="overflow-hidden rounded-[12px]"
          style={{ background: "var(--color-surface-2)", boxShadow: "var(--surface-highlight)" }}
        >
          <div
            className="flex items-baseline justify-between px-5 py-3"
            style={{ borderBottom: "1px solid rgba(253, 245, 230, 0.05)" }}
          >
            <h2
              className="font-[family-name:var(--font-label)] text-[11px] uppercase text-[color:var(--color-neutral-300)]"
              style={{ letterSpacing: "1.8px" }}
            >
              Deals
            </h2>
            <span
              className="font-[family-name:var(--font-label)] text-[11px] tabular-nums text-[color:var(--color-neutral-500)]"
              style={{ letterSpacing: "1.5px" }}
            >
              {dealRows.length}
            </span>
          </div>
          <div>
            {dealRows.map((d) => (
              <div
                key={d.id}
                className="flex items-center justify-between px-5 py-3"
                style={{ borderBottom: "1px solid rgba(253, 245, 230, 0.03)" }}
              >
                <div className="flex min-w-0 flex-col gap-0.5">
                  <p className="font-[family-name:var(--font-body)] text-[13px] font-medium text-[color:var(--color-brand-cream)]">
                    {d.title}
                  </p>
                  {d.next_action_text && (
                    <p className="text-[12px] text-[color:var(--color-neutral-500)]">
                      {d.next_action_text}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  {d.value_cents != null && (
                    <span className="font-[family-name:var(--font-label)] tabular-nums text-[12px] text-[color:var(--color-brand-cream)]">
                      {d.value_estimated ? "est. " : ""}
                      {formatCentsCompact(d.value_cents)}
                    </span>
                  )}
                  <DealStageChip stage={d.stage} />
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : (
        <section
          aria-label="Deals"
          className="overflow-hidden rounded-[12px]"
          style={{ background: "var(--color-surface-2)", boxShadow: "var(--surface-highlight)" }}
        >
          <VoicedEmpty
            hero="No deals yet."
            mutter="just a name so far."
          />
        </section>
      )}

      {/* Private notes feed */}
      <PrivateNotesFeed
        privateNotes={privateNotes}
        activityNotes={activityNotes}
        contactId={contact.id}
        addNoteAction={addNote}
        toggleVisibilityAction={toggleVisibility}
      />
    </div>
  );
}
