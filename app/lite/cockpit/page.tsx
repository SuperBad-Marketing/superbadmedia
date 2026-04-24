import { redirect } from "next/navigation";
import type { Metadata } from "next";

import { auth } from "@/lib/auth/session";
import { mergeWaitingItems, mergeHealthBanners } from "@/lib/cockpit/aggregator";
import { getCurrentBrief, getTodayCalendarEvents } from "@/lib/cockpit/queries";
import { getTasksForCockpitKanban } from "@/lib/tasks/cockpit";
import { BriefPanel } from "@/components/lite/cockpit/brief-panel";
import { AttentionRail } from "@/components/lite/cockpit/attention-rail";
import { BannerStrip } from "@/components/lite/cockpit/banner-strip";
import { CalendarPreview } from "@/components/lite/cockpit/calendar-preview";
import { PlanningView } from "@/components/lite/cockpit/planning-view";
import { AiChatFab } from "@/components/lite/cockpit/ai-chat-panel";

export const metadata: Metadata = {
  title: "SuperBad — Cockpit",
  robots: { index: false, follow: false },
};

export default async function CockpitPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    redirect("/lite/login");
  }

  const nowMs = Date.now();

  const [briefResult, waitingItems, banners, calendarEvents, kanban] =
    await Promise.all([
      getCurrentBrief(session.user.id!, nowMs),
      mergeWaitingItems(nowMs),
      mergeHealthBanners(nowMs),
      getTodayCalendarEvents(nowMs),
      getTasksForCockpitKanban(nowMs),
    ]);

  return (
    <div className="min-h-full">
      <AiChatFab />
      <div className="max-w-[720px] mx-auto px-4 pt-6 pb-8">
        {/* Page header */}
        <header className="pb-6">
          <div
            className="font-[family-name:var(--font-label)] text-[10px] uppercase leading-none"
            style={{ letterSpacing: "2px", color: "var(--color-neutral-500)" }}
          >
            Admin · Cockpit
          </div>
          <h1
            className="mt-3 font-[family-name:var(--font-display)] text-[40px] leading-none"
            style={{ letterSpacing: "-0.4px", color: "var(--color-brand-cream)" }}
          >
            Cockpit
          </h1>
        </header>

        {/* Brief card */}
        <div
          className="rounded-xl p-6"
          style={{
            background: "var(--color-surface-2)",
            boxShadow: "var(--surface-highlight), 0 2px 8px rgba(0,0,0,0.2)",
            border: "1px solid rgba(253, 245, 230, 0.06)",
          }}
        >
          <BriefPanel
            brief={briefResult.brief}
            slot={briefResult.slot}
            fallback={briefResult.fallback}
          />
        </div>

        {/* Attention rail */}
        {waitingItems.length > 0 && (
          <div className="mt-6">
            <div
              className="mb-3 font-[family-name:var(--font-label)] text-[10px] uppercase"
              style={{ letterSpacing: "2px", color: "var(--color-brand-orange)" }}
            >
              Needs Attention
            </div>
            <AttentionRail items={waitingItems} />
          </div>
        )}

        {/* Health banners */}
        {banners.length > 0 && (
          <div className="mt-5">
            <BannerStrip banners={banners} />
          </div>
        )}

        {/* Calendar */}
        <div className="mt-6">
          <div
            className="mb-3 font-[family-name:var(--font-label)] text-[10px] uppercase"
            style={{ letterSpacing: "2px", color: "var(--color-neutral-500)" }}
          >
            Calendar
          </div>
          <div
            className="rounded-xl px-5 py-4"
            style={{
              background: "var(--color-surface-2)",
              boxShadow: "var(--surface-highlight)",
              border: "1px solid rgba(253, 245, 230, 0.03)",
            }}
          >
            <CalendarPreview events={calendarEvents} />
          </div>
        </div>

        {/* Planning */}
        <div className="mt-8">
          <div
            className="mb-4 font-[family-name:var(--font-label)] text-[10px] uppercase"
            style={{ letterSpacing: "2px", color: "var(--color-neutral-500)" }}
          >
            Planning
          </div>
          <div
            className="rounded-xl p-5"
            style={{
              background: "var(--color-surface-2)",
              boxShadow: "var(--surface-highlight)",
              border: "1px solid rgba(253, 245, 230, 0.03)",
            }}
          >
            <PlanningView kanban={kanban} />
          </div>
        </div>
      </div>
    </div>
  );
}
