import { redirect } from "next/navigation";
import type { Metadata } from "next";

import { auth } from "@/lib/auth/session";
import { getCurrentBrief, getTodayCalendarEvents, getTodayBraindump } from "@/lib/cockpit/queries";
import { generateBriefForSlot } from "@/lib/cockpit/generate-brief";
import { getCurrentSlot } from "@/lib/cockpit/queries";
import { getTasksForCockpitKanban } from "@/lib/tasks/cockpit";
import { getNeedsYouItems } from "@/lib/cockpit/needs-you";
import { getAvailableQuickMoves } from "@/lib/cockpit/quick-moves";
import { getOvernightPulse } from "@/lib/cockpit/pulse";
import { pickMantra, pickRotatingCard } from "@/lib/cockpit/mantras";

import { BriefPanel } from "@/components/lite/cockpit/brief-panel";
import { NeedsYouFeed } from "@/components/lite/cockpit/needs-you-feed";
import { QuickMoves } from "@/components/lite/cockpit/quick-moves";
import { CalendarPreview } from "@/components/lite/cockpit/calendar-preview";
import { PlanningView } from "@/components/lite/cockpit/planning-view";
import { AiChatFab } from "@/components/lite/cockpit/ai-chat-panel";
import { CockpitShell, CockpitSection } from "@/components/lite/cockpit/cockpit-shell";
import { TickerStrip } from "@/components/lite/cockpit/tickers/ticker-strip";
import { EventCards } from "@/components/lite/cockpit/tickers/event-cards";
import { RotatingCard } from "@/components/lite/cockpit/tickers/rotating-card";
import { SpotifyEmbed } from "@/components/lite/cockpit/tickers/spotify-embed";

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

  const [
    briefResult,
    calendarEvents,
    kanban,
    todayBraindump,
    needsYouItems,
    quickMoves,
    pulse,
  ] = await Promise.all([
    getCurrentBrief(session.user.id!, nowMs),
    getTodayCalendarEvents(nowMs),
    getTasksForCockpitKanban(nowMs),
    getTodayBraindump(session.user.id!, nowMs),
    getNeedsYouItems(nowMs),
    getAvailableQuickMoves(nowMs),
    getOvernightPulse(nowMs),
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
      // Generation failed — show fallback
    }
  }

  const mantra = pickMantra(nowMs);
  const rotatingCard = pickRotatingCard(nowMs);

  return (
    <>
      <AiChatFab />
      <CockpitShell mantra={mantra} braindumpDone={!!todayBraindump}>
        {/* Brief */}
        <CockpitSection className="mt-8">
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

        {/* Needs You */}
        <CockpitSection className="mt-8">
          <div
            className="mb-3 font-[family-name:var(--font-label)] text-[10px] uppercase"
            style={{
              letterSpacing: "2px",
              color: "var(--color-brand-orange)",
            }}
          >
            Needs You
            {needsYouItems.length > 0 && (
              <span
                className="ml-2 inline-flex size-5 items-center justify-center rounded-full text-[10px] tabular-nums"
                style={{
                  background: "var(--color-brand-orange)",
                  color: "var(--color-neutral-950)",
                }}
              >
                {needsYouItems.length}
              </span>
            )}
          </div>
          <NeedsYouFeed items={needsYouItems} />
        </CockpitSection>

        {/* Quick Moves */}
        {quickMoves.length > 0 && (
          <CockpitSection className="mt-8">
            <div
              className="mb-3 font-[family-name:var(--font-label)] text-[10px] uppercase"
              style={{
                letterSpacing: "2px",
                color: "var(--color-neutral-500)",
              }}
            >
              Quick Moves
            </div>
            <QuickMoves moves={quickMoves} />
          </CockpitSection>
        )}

        {/* Tickers — Tier 1 strip */}
        <CockpitSection className="mt-8">
          <TickerStrip pulse={pulse} />
        </CockpitSection>

        {/* Tickers — Tier 2 event cards */}
        <CockpitSection className="mt-3">
          <EventCards />
        </CockpitSection>

        {/* Tickers — Tier 3 rotating card */}
        <CockpitSection className="mt-3">
          <RotatingCard
            type={rotatingCard.type}
            content={rotatingCard.content}
            subtitle={rotatingCard.subtitle}
          />
        </CockpitSection>

        {/* Spotify */}
        <CockpitSection className="mt-4">
          <SpotifyEmbed />
        </CockpitSection>

        {/* Calendar */}
        <CockpitSection className="mt-8">
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
      </CockpitShell>
    </>
  );
}
