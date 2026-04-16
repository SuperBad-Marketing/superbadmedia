"use client";

import * as React from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Inbox, PenSquare, Search, Settings, VolumeX } from "lucide-react";

import { cn } from "@/lib/utils";
import { houseSpring } from "@/lib/design-tokens";
import type {
  InboxAddressFilter,
  InboxListRow,
  InboxSortOrder,
  InboxView,
} from "../_queries/list-threads";
import { MobileThreadList } from "./mobile-thread-list";
import { OfflineBanner } from "./offline-banner";
import { MobileComposeNudge } from "./mobile-compose-nudge";
import { ComposeModal } from "./compose-modal";
import {
  flushQueue,
  type FlushHandlers,
} from "@/lib/offline/inbox-cache";
import {
  archiveThreadAction,
  setThreadKeepAction,
} from "../thread/actions";
import { sendCompose } from "../compose/actions";

export const MOBILE_TABS = ["focus", "search", "noise", "settings"] as const;
export type MobileTab = (typeof MOBILE_TABS)[number];

function parseTab(raw: string | null): MobileTab {
  if (raw && (MOBILE_TABS as readonly string[]).includes(raw)) {
    return raw as MobileTab;
  }
  return "focus";
}

function buildTabHref(tab: MobileTab): string {
  const params = new URLSearchParams();
  if (tab === "noise") {
    params.set("view", "noise");
  } else if (tab === "focus") {
    params.set("view", "focus");
  } else {
    params.set("view", "focus");
  }
  params.set("tab", tab);
  return `/lite/inbox?${params.toString()}`;
}

const TAB_META: Record<
  MobileTab,
  {
    label: string;
    icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string; "aria-hidden"?: boolean }>;
  }
> = {
  focus: { label: "Focus", icon: Inbox },
  search: { label: "Search", icon: Search },
  noise: { label: "Noise", icon: VolumeX },
  settings: { label: "Settings", icon: Settings },
};

export function MobileInbox({
  view,
  address,
  sort,
  selectedThreadId,
  rows,
  now,
  sendEnabled,
  llmEnabled,
  detail,
  tab: tabProp,
}: {
  view: InboxView;
  address: InboxAddressFilter;
  sort: InboxSortOrder;
  selectedThreadId: string | null;
  rows: InboxListRow[];
  now: number;
  sendEnabled: boolean;
  llmEnabled: boolean;
  detail: React.ReactNode;
  tab: string | null;
}) {
  const reducedMotion = useReducedMotion();
  const activeTab = parseTab(tabProp);
  const [composeNudgeOpen, setComposeNudgeOpen] = React.useState(false);
  const [composeFullscreen, setComposeFullscreen] = React.useState(false);
  const [syncToast, setSyncToast] = React.useState<string | null>(null);

  // Flush offline queue on reconnect.
  React.useEffect(() => {
    const handlers: FlushHandlers = {
      mark_read: async () => {
        /* mark-read wiring lands with the read-state patch; queue entry
         * is still persisted so it won't be lost. */
      },
      reply: async (payload) => {
        await sendCompose({
          threadId: payload.threadId,
          contactId: null,
          companyId: null,
          to: payload.to,
          subject: null,
          bodyText: payload.body,
          sendingAddress: payload.sendingAddress,
          composeDraftId: null,
        });
      },
      keep: async (payload) => {
        await setThreadKeepAction({
          threadId: payload.threadId,
          pinned: payload.pinned,
        });
      },
      archive: async (payload) => {
        await archiveThreadAction({ threadId: payload.threadId });
      },
    };
    async function runFlush() {
      try {
        const result = await flushQueue(handlers);
        if (result.flushed > 0) {
          setSyncToast("Back online. Everything synced.");
          window.setTimeout(() => setSyncToast(null), 3000);
        }
      } catch {
        /* IndexedDB unavailable — silently skip */
      }
    }
    function handleOnline() {
      void runFlush();
    }
    if (typeof navigator !== "undefined" && navigator.onLine) {
      void runFlush();
    }
    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, []);

  // Thread detail takes over the full viewport (spec §4.5).
  if (selectedThreadId) {
    return (
      <div className="flex h-svh flex-col bg-[color:var(--color-background)]">
        <OfflineBanner />
        <div className="flex-1 overflow-hidden">{detail}</div>
      </div>
    );
  }

  const showList = activeTab === "focus" || activeTab === "noise";

  return (
    <div
      data-slot="mobile-inbox"
      className="flex h-svh flex-col bg-[color:var(--color-background)]"
    >
      <OfflineBanner />

      <header className="flex items-center justify-between border-b border-[color:var(--color-neutral-700)] bg-[color:var(--color-surface-1)] px-4 py-3">
        <div className="flex flex-col">
          <span
            className="font-[family-name:var(--font-righteous)] text-[length:var(--text-micro)] uppercase text-[color:var(--color-neutral-500)]"
            style={{ letterSpacing: "2px" }}
          >
            Inbox
          </span>
          <span className="font-[family-name:var(--font-dm-sans)] text-[length:var(--text-h3)] text-[color:var(--color-neutral-100)] capitalize">
            {TAB_META[activeTab].label}
          </span>
        </div>
        <button
          type="button"
          onClick={() => setComposeNudgeOpen(true)}
          aria-label="Compose new message"
          className={cn(
            "flex h-9 w-9 items-center justify-center rounded-sm",
            "bg-[color:var(--color-accent-cta)] text-[color:var(--color-neutral-100)]",
            "outline-none transition-[filter] hover:brightness-110",
          )}
        >
          <PenSquare size={14} strokeWidth={1.75} aria-hidden />
        </button>
      </header>

      <main className="flex-1 overflow-hidden">
        {showList && (
          <MobileThreadList
            rows={rows}
            view={view}
            address={address}
            sort={sort}
            now={now}
            emptyCopy={
              activeTab === "focus"
                ? { title: "Nothing waiting." }
                : { title: "Nothing noisy.", body: "You're set." }
            }
          />
        )}
        {activeTab === "search" && (
          <SearchPlaceholder />
        )}
        {activeTab === "settings" && (
          <SettingsPlaceholder />
        )}
      </main>

      <nav
        aria-label="Inbox tabs"
        className={cn(
          "flex shrink-0 items-stretch border-t border-[color:var(--color-neutral-700)] bg-[color:var(--color-surface-1)]",
          "pb-[env(safe-area-inset-bottom,0)]",
        )}
      >
        {MOBILE_TABS.map((t) => {
          const meta = TAB_META[t];
          const Icon = meta.icon;
          const isActive = t === activeTab;
          return (
            <Link
              key={t}
              href={buildTabHref(t)}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "flex flex-1 flex-col items-center gap-0.5 py-2.5",
                "outline-none transition-colors",
                "focus-visible:bg-[color:var(--color-surface-2)]",
                isActive
                  ? "text-[color:var(--color-accent-cta)]"
                  : "text-[color:var(--color-neutral-500)]",
              )}
            >
              <Icon
                size={18}
                strokeWidth={1.75}
                className={isActive ? "" : "opacity-80"}
                aria-hidden
              />
              <span
                className="font-[family-name:var(--font-dm-sans)] text-[length:var(--text-micro)]"
              >
                {meta.label}
              </span>
            </Link>
          );
        })}
      </nav>

      <MobileComposeNudge
        open={composeNudgeOpen}
        onCancel={() => setComposeNudgeOpen(false)}
        onContinue={() => {
          setComposeNudgeOpen(false);
          setComposeFullscreen(true);
        }}
      />

      <ComposeModal
        open={composeFullscreen}
        onClose={() => setComposeFullscreen(false)}
        sendEnabled={sendEnabled}
        llmEnabled={llmEnabled}
        variant="fullscreen"
      />

      <AnimatePresence>
        {syncToast && (
          <motion.div
            key="sync-toast"
            role="status"
            initial={reducedMotion ? { opacity: 0 } : { y: 24, opacity: 0 }}
            animate={reducedMotion ? { opacity: 1 } : { y: 0, opacity: 1 }}
            exit={reducedMotion ? { opacity: 0 } : { y: 24, opacity: 0 }}
            transition={reducedMotion ? { duration: 0.18 } : houseSpring}
            className={cn(
              "pointer-events-none fixed bottom-20 left-1/2 z-50 -translate-x-1/2 rounded-full px-4 py-2",
              "bg-[color:var(--color-surface-2)] text-[color:var(--color-neutral-100)]",
              "font-[family-name:var(--font-dm-sans)] text-[length:var(--text-small)] shadow-lg",
            )}
          >
            {syncToast}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function SearchPlaceholder() {
  return (
    <div
      role="status"
      className="flex h-full flex-col items-center justify-center gap-2 px-6 py-12 text-center"
    >
      <span
        className="font-[family-name:var(--font-righteous)] text-[length:var(--text-micro)] uppercase text-[color:var(--color-neutral-500)]"
        style={{ letterSpacing: "2px" }}
      >
        Search
      </span>
      <h2 className="font-[family-name:var(--font-dm-sans)] text-[length:var(--text-h3)] text-[color:var(--color-neutral-100)]">
        Start typing. I&rsquo;ll find it.
      </h2>
      <em className="font-[family-name:var(--font-narrative)] text-[length:var(--text-small)] text-[color:var(--color-brand-pink)]">
        Deep search lands in the next drop.
      </em>
    </div>
  );
}

function SettingsPlaceholder() {
  return (
    <div
      role="status"
      className="flex h-full flex-col items-center justify-center gap-2 px-6 py-12 text-center"
    >
      <span
        className="font-[family-name:var(--font-righteous)] text-[length:var(--text-micro)] uppercase text-[color:var(--color-neutral-500)]"
        style={{ letterSpacing: "2px" }}
      >
        Settings
      </span>
      <h2 className="font-[family-name:var(--font-dm-sans)] text-[length:var(--text-h3)] text-[color:var(--color-neutral-100)]">
        Not on mobile.
      </h2>
      <em className="font-[family-name:var(--font-narrative)] text-[length:var(--text-small)] text-[color:var(--color-brand-pink)]">
        Settings live on the laptop for now.
      </em>
    </div>
  );
}
