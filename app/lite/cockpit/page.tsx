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
      <div className="max-w-[720px] mx-auto px-4 pt-6 pb-8">
        <BriefPanel
          brief={briefResult.brief}
          slot={briefResult.slot}
          fallback={briefResult.fallback}
        />

        <div className="mt-6">
          <AttentionRail items={waitingItems} />
        </div>

        <div className="mt-5">
          <BannerStrip banners={banners} />
        </div>

        <div className="mt-5">
          <CalendarPreview events={calendarEvents} />
        </div>

        <hr
          className="my-6"
          style={{ borderColor: "var(--color-surface-1)" }}
        />

        <PlanningView kanban={kanban} />
      </div>
    </div>
  );
}
