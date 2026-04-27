import { redirect } from "next/navigation";
import type { Metadata } from "next";

import { auth } from "@/lib/auth/session";
import { mergeWaitingItems, mergeHealthBanners } from "@/lib/cockpit/aggregator";
import { getCurrentBrief, getTodayCalendarEvents, getTodayBraindump } from "@/lib/cockpit/queries";
import { generateBriefForSlot } from "@/lib/cockpit/generate-brief";
import { getCurrentSlot } from "@/lib/cockpit/queries";
import { getTasksForCockpitKanban } from "@/lib/tasks/cockpit";
import { getTodayHabits } from "@/lib/habits/queries";
import { BriefPanel } from "@/components/lite/cockpit/brief-panel";
import { HabitsPanel } from "@/components/lite/cockpit/habits-panel";
import { AttentionRail } from "@/components/lite/cockpit/attention-rail";
import { BannerStrip } from "@/components/lite/cockpit/banner-strip";
import { CalendarPreview } from "@/components/lite/cockpit/calendar-preview";
import { PlanningView } from "@/components/lite/cockpit/planning-view";
import { BraindumpSection } from "@/components/lite/cockpit/braindump-section";
import { AiChatFab } from "@/components/lite/cockpit/ai-chat-panel";
import {
  CockpitContent,
  CockpitSection,
} from "@/components/lite/cockpit/cockpit-content";

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

  const [briefResult, waitingItems, banners, calendarEvents, kanban, todayBraindump, todayHabits] =
    await Promise.all([
      getCurrentBrief(session.user.id!, nowMs),
      mergeWaitingItems(nowMs),
      mergeHealthBanners(nowMs),
      getTodayCalendarEvents(nowMs),
      getTasksForCockpitKanban(nowMs),
      getTodayBraindump(session.user.id!, nowMs),
      getTodayHabits(nowMs),
    ]);

  if (briefResult.fallback) {
    try {
      const slot = getCurrentSlot(nowMs);
      const gen = await generateBriefForSlot(slot, { trigger: "cron" });
      if (gen.generated) {
        briefResult.brief = {
          id: gen.briefId,
          user_id: session.user.id!,
          slot,
          brief_date: new Date(nowMs).toISOString().slice(0, 10),
          generated_at_ms: nowMs,
          trigger: "cron",
          trigger_event: null,
          prose: gen.prose,
          signals_snapshot: "{}",
          model_version: "auto-generated",
          created_at_ms: nowMs,
        };
        briefResult.fallback = false;
      }
    } catch {
      // Generation failed — show fallback rather than crash
    }
  }

  return (
    <>
      <AiChatFab />
      <CockpitContent>
        {/* Brief — hero card */}
        <CockpitSection>
          <div
            className="rounded-2xl p-8"
            style={{
              background: "var(--color-surface-2)",
              boxShadow:
                "var(--surface-highlight), 0 4px 24px rgba(0,0,0,0.25)",
              border: "1px solid rgba(253, 245, 230, 0.06)",
            }}
          >
            <BriefPanel
              brief={briefResult.brief}
              slot={briefResult.slot}
              fallback={briefResult.fallback}
            />
          </div>
        </CockpitSection>

        {/* Habits */}
        {todayHabits.length > 0 && (
          <CockpitSection className="mt-6">
            <div
              className="mb-3 font-[family-name:var(--font-label)] text-[10px] uppercase"
              style={{
                letterSpacing: "2px",
                color: "var(--color-neutral-500)",
              }}
            >
              Habits
            </div>
            <div
              className="rounded-xl px-5 py-4"
              style={{
                background: "var(--color-surface-2)",
                boxShadow: "var(--surface-highlight)",
                border: "1px solid rgba(253, 245, 230, 0.03)",
              }}
            >
              <HabitsPanel habits={todayHabits} />
            </div>
          </CockpitSection>
        )}

        {/* Morning braindump */}
        <CockpitSection className="mt-6">
          <div
            className="mb-3 font-[family-name:var(--font-label)] text-[10px] uppercase"
            style={{
              letterSpacing: "2px",
              color: "var(--color-neutral-500)",
            }}
          >
            Braindump
          </div>
          <BraindumpSection todayBraindump={todayBraindump} />
        </CockpitSection>

        {/* Attention rail */}
        {waitingItems.length > 0 && (
          <CockpitSection className="mt-6">
            <div
              className="mb-3 font-[family-name:var(--font-label)] text-[10px] uppercase"
              style={{
                letterSpacing: "2px",
                color: "var(--color-brand-orange)",
              }}
            >
              Needs Attention
            </div>
            <AttentionRail items={waitingItems} />
          </CockpitSection>
        )}

        {/* Health banners */}
        {banners.length > 0 && (
          <CockpitSection className="mt-5">
            <BannerStrip banners={banners} />
          </CockpitSection>
        )}

        {/* Calendar */}
        <CockpitSection className="mt-6">
          <div
            className="mb-3 font-[family-name:var(--font-label)] text-[10px] uppercase"
            style={{
              letterSpacing: "2px",
              color: "var(--color-neutral-500)",
            }}
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
        </CockpitSection>

        {/* Planning */}
        <CockpitSection className="mt-8">
          <div
            className="mb-4 font-[family-name:var(--font-label)] text-[10px] uppercase"
            style={{
              letterSpacing: "2px",
              color: "var(--color-neutral-500)",
            }}
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
        </CockpitSection>
      </CockpitContent>
    </>
  );
}
