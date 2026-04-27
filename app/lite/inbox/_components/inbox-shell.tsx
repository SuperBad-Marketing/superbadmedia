"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { cn } from "@/lib/utils";
import { useAdminEvents } from "@/lib/events/use-admin-events";
import type {
  InboxAddressFilter,
  InboxListRow,
  InboxSortOrder,
  InboxView,
} from "../_queries/list-threads";
import { triggerInboxSync } from "../_actions/sync";
import { ViewFilterTabs } from "./view-filter-tabs";
import { ThreadList } from "./thread-list";
import { ComposeModal } from "./compose-modal";
import { CleanupModal } from "./cleanup-modal";
import { MobileInbox } from "./mobile-inbox";

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
  mobileDetail,
  mobileTab,
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
  mobileDetail: React.ReactNode;
  mobileTab: string | null;
}) {
  const router = useRouter();
  const [composeOpen, setComposeOpen] = React.useState(false);
  const [cleanupOpen, setCleanupOpen] = React.useState(false);
  const [syncing, setSyncing] = React.useState(false);
  const [isMobile, setIsMobile] = React.useState(false);

  useAdminEvents((event) => {
    if (event.type === "inbox_sync") router.refresh();
  });

  const handleSync = React.useCallback(async () => {
    setSyncing(true);
    try {
      await triggerInboxSync();
      router.refresh();
    } finally {
      setSyncing(false);
    }
  }, [router]);

  React.useEffect(() => {
    function evaluate() {
      setIsMobile(window.innerWidth < MIN_DESKTOP_VIEWPORT);
    }
    evaluate();
    window.addEventListener("resize", evaluate);
    return () => window.removeEventListener("resize", evaluate);
  }, []);

  if (isMobile) {
    return (
      <MobileInbox
        view={view}
        address={address}
        sort={sort}
        selectedThreadId={selectedThreadId}
        rows={rows}
        now={now}
        sendEnabled={sendEnabled}
        llmEnabled={llmEnabled}
        detail={mobileDetail}
        tab={mobileTab}
      />
    );
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
        className="sticky top-0 h-svh overflow-y-auto bg-[color:var(--color-surface-1)]"
        style={{
          background:
            "linear-gradient(180deg, var(--color-surface-1) 0%, color-mix(in srgb, var(--color-surface-1), var(--color-brand-red) 3%) 100%)",
          boxShadow:
            "var(--surface-highlight), 1px 0 0 rgba(253, 245, 230, 0.06), 4px 0 16px rgba(0, 0, 0, 0.15)",
        }}
      >
        <ViewFilterTabs
          activeView={view}
          activeAddress={address}
          onComposeClick={() => setComposeOpen(true)}
          onSyncClick={handleSync}
          onCleanupClick={() => setCleanupOpen(true)}
          syncing={syncing}
        />
      </aside>

      <section
        data-slot="inbox-list"
        aria-label="Thread list"
        className="sticky top-0 h-svh overflow-hidden bg-[color:var(--color-background)]"
        style={{
          borderRight: "1px solid rgba(253, 245, 230, 0.06)",
        }}
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
        className="relative h-svh overflow-hidden bg-[color:var(--color-background)]"
      >
        <div
          aria-hidden
          className="pointer-events-none fixed inset-0 z-0"
          style={{
            background:
              "radial-gradient(ellipse at 70% 0%, rgba(242, 140, 82, 0.14), transparent 55%), radial-gradient(ellipse at 0% 100%, rgba(178, 40, 72, 0.10), transparent 60%)",
          }}
        />
        {detail}
      </section>

      <ComposeModal
        open={composeOpen}
        onClose={() => setComposeOpen(false)}
        sendEnabled={sendEnabled}
        llmEnabled={llmEnabled}
      />

      <CleanupModal
        open={cleanupOpen}
        onClose={() => setCleanupOpen(false)}
      />
    </div>
  );
}
