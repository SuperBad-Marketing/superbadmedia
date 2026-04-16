"use client";

import * as React from "react";

import { cn } from "@/lib/utils";
import type {
  InboxAddressFilter,
  InboxListRow,
  InboxSortOrder,
  InboxView,
} from "../_queries/list-threads";
import { ViewFilterTabs } from "./view-filter-tabs";
import { ThreadList } from "./thread-list";
import { ComposeModal } from "./compose-modal";
import { MobileHolding } from "./mobile-holding";

const MIN_DESKTOP_VIEWPORT = 900;

export function InboxShell({
  view,
  address,
  sort,
  selectedThreadId,
  selectedDraftId,
  rows,
  hasMore,
  now,
  sendEnabled,
  llmEnabled,
  detail,
}: {
  view: InboxView;
  address: InboxAddressFilter;
  sort: InboxSortOrder;
  selectedThreadId: string | null;
  selectedDraftId: string | null;
  rows: InboxListRow[];
  hasMore: boolean;
  now: number;
  sendEnabled: boolean;
  llmEnabled: boolean;
  detail: React.ReactNode;
}) {
  const [composeOpen, setComposeOpen] = React.useState(false);
  const [isMobile, setIsMobile] = React.useState(false);

  React.useEffect(() => {
    function evaluate() {
      setIsMobile(window.innerWidth < MIN_DESKTOP_VIEWPORT);
    }
    evaluate();
    window.addEventListener("resize", evaluate);
    return () => window.removeEventListener("resize", evaluate);
  }, []);

  if (isMobile) {
    return <MobileHolding />;
  }

  return (
    <div
      data-slot="inbox-shell"
      className={cn(
        "grid min-h-svh",
        "grid-cols-[240px_360px_1fr] bg-[color:var(--color-background)]",
      )}
    >
      <aside
        data-slot="inbox-nav"
        className="sticky top-0 h-svh overflow-y-auto border-r border-[color:var(--color-neutral-700)] bg-[color:var(--color-surface-1)]"
      >
        <ViewFilterTabs
          activeView={view}
          activeAddress={address}
          onComposeClick={() => setComposeOpen(true)}
        />
      </aside>

      <section
        data-slot="inbox-list"
        aria-label="Thread list"
        className="sticky top-0 h-svh overflow-hidden border-r border-[color:var(--color-neutral-700)] bg-[color:var(--color-background)]"
      >
        <ThreadList
          rows={rows}
          view={view}
          address={address}
          sort={sort}
          selectedThreadId={selectedThreadId}
          selectedDraftId={selectedDraftId}
          hasMore={hasMore}
          now={now}
        />
      </section>

      <section
        data-slot="inbox-detail"
        aria-label="Thread detail"
        className="h-svh overflow-hidden bg-[color:var(--color-background)]"
      >
        {detail}
      </section>

      <ComposeModal
        open={composeOpen}
        onClose={() => setComposeOpen(false)}
        sendEnabled={sendEnabled}
        llmEnabled={llmEnabled}
      />
    </div>
  );
}
