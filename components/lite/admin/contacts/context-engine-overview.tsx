"use client";

import * as React from "react";
import { ProfileSummaryTile } from "./profile-summary-tile";
import { ActionItemsPanel } from "./action-items-panel";
import { DraftDrawer } from "./draft-drawer";

interface ContextSummaryData {
  conversation_summary: string | null;
  summary_generated_at_ms: number | null;
  draft_content: string | null;
  draft_channel: string | null;
  draft_nudge_history: string[] | null;
  draft_generated_at_ms: number | null;
}

interface SignalData {
  health_label: string;
  days_since_last_contact: number;
  overdue_action_items_you: number;
  overdue_action_items_them: number;
  total_open_action_items: number;
  has_unsent_draft: boolean;
  last_contact_direction: "inbound" | "outbound" | null;
  deal_stage: string | null;
  outstanding_invoice: boolean;
}

interface ActionItemData {
  id: string;
  description: string;
  owner: "you" | "them";
  due_date_ms: number | null;
  source: "claude_extract" | "manual";
  status: "open" | "done" | "dismissed";
  created_at_ms: number;
  completed_at_ms: number | null;
}

interface ContextEngineOverviewProps {
  contactId: string;
  contextSummary: ContextSummaryData | null;
  signals: SignalData;
  actionItems: ActionItemData[];
  preferredChannel: string;
}

export function ContextEngineOverview({
  contactId,
  contextSummary,
  signals,
  actionItems,
  preferredChannel,
}: ContextEngineOverviewProps) {
  const [drawerOpen, setDrawerOpen] = React.useState(false);

  const initialDraft =
    contextSummary?.draft_content
      ? {
          content: contextSummary.draft_content,
          channel: contextSummary.draft_channel ?? "email",
          nudgeHistory: contextSummary.draft_nudge_history ?? [],
        }
      : null;

  return (
    <>
      {/* Summary tile */}
      <ProfileSummaryTile
        summary={contextSummary?.conversation_summary ?? null}
        summaryGeneratedAtMs={contextSummary?.summary_generated_at_ms ?? null}
        healthLabel={signals.health_label}
        daysSinceLastContact={signals.days_since_last_contact}
        overdueYou={signals.overdue_action_items_you}
        overdueThey={signals.overdue_action_items_them}
        totalOpenItems={signals.total_open_action_items}
        dealStage={signals.deal_stage}
        hasUnsentDraft={signals.has_unsent_draft}
        lastContactDirection={signals.last_contact_direction}
      />

      {/* Action items panel */}
      <ActionItemsPanel contactId={contactId} items={actionItems} />

      {/* Draft trigger button */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          className="relative rounded-full bg-[color:var(--color-brand-pink)] px-5 py-2.5 font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-brand-charcoal)] transition-opacity hover:opacity-90"
          style={{ letterSpacing: "1.5px" }}
        >
          {initialDraft ? "Continue draft" : "Generate draft"}
          {signals.has_unsent_draft && <UnsentDraftPulse />}
        </button>
      </div>

      {/* Draft drawer */}
      <DraftDrawer
        contactId={contactId}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        initialDraft={initialDraft}
        preferredChannel={preferredChannel}
      />
    </>
  );
}

function UnsentDraftPulse() {
  return (
    <span className="absolute -right-0.5 -top-0.5 flex h-2.5 w-2.5">
      <span
        className="absolute inline-flex h-full w-full rounded-full opacity-40 motion-safe:animate-ping"
        style={{ background: "var(--color-brand-pink)" }}
      />
      <span
        className="relative inline-flex h-2.5 w-2.5 rounded-full"
        style={{ background: "var(--color-brand-pink)" }}
      />
    </span>
  );
}
