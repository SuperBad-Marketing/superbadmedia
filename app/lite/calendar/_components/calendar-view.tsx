"use client";

import { useState, useMemo } from "react";
import { ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";
import { syncCalendarAction } from "../actions";

interface CalendarEvent {
  id: string;
  booking_type: string;
  start_at_ms: number;
  end_at_ms: number;
  status: string;
  metadata_json: unknown;
}

type ViewMode = "month" | "week";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function getMonday(d: Date): Date {
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d);
  monday.setDate(diff);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function formatTime(ms: number): string {
  return new Date(ms).toLocaleTimeString("en-AU", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "Australia/Melbourne",
  });
}

function getEventLabel(event: CalendarEvent): string {
  const meta = event.metadata_json as Record<string, unknown> | null;
  if (meta?.subject && typeof meta.subject === "string") return meta.subject;
  const typeLabels: Record<string, string> = {
    intro_funnel_shoot: "Shoot",
    followup_conversation: "Meeting",
    marketing_site_booking: "Booking",
  };
  return typeLabels[event.booking_type] ?? event.booking_type;
}

function getEventColor(event: CalendarEvent): { bg: string; text: string; dot: string } {
  const meta = event.metadata_json as Record<string, unknown> | null;
  if (meta?.source === "outlook_sync") {
    return {
      bg: "rgba(59, 130, 246, 0.12)",
      text: "var(--color-neutral-200)",
      dot: "#3b82f6",
    };
  }
  if (event.booking_type === "intro_funnel_shoot") {
    return {
      bg: "rgba(178, 40, 72, 0.12)",
      text: "var(--color-brand-pink)",
      dot: "var(--color-brand-red)",
    };
  }
  return {
    bg: "rgba(242, 140, 82, 0.12)",
    text: "var(--color-brand-orange)",
    dot: "var(--color-brand-orange)",
  };
}

export function CalendarView({ events }: { events: CalendarEvent[] }) {
  const [viewMode, setViewMode] = useState<ViewMode>("month");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);

  const today = new Date();

  function navigate(dir: -1 | 1) {
    const d = new Date(currentDate);
    if (viewMode === "month") {
      d.setMonth(d.getMonth() + dir);
    } else {
      d.setDate(d.getDate() + 7 * dir);
    }
    setCurrentDate(d);
  }

  function goToToday() {
    setCurrentDate(new Date());
  }

  async function handleSync() {
    setSyncing(true);
    setSyncResult(null);
    const result = await syncCalendarAction();
    setSyncing(false);
    if (result.ok) {
      setSyncResult(`Synced ${result.synced} events`);
    } else {
      setSyncResult(result.error);
    }
  }

  const title =
    viewMode === "month"
      ? `${MONTHS[currentDate.getMonth()]} ${currentDate.getFullYear()}`
      : (() => {
          const monday = getMonday(currentDate);
          const sunday = new Date(monday);
          sunday.setDate(sunday.getDate() + 6);
          const mStr = monday.toLocaleDateString("en-AU", { day: "numeric", month: "short" });
          const sStr = sunday.toLocaleDateString("en-AU", { day: "numeric", month: "short" });
          return `${mStr} – ${sStr}`;
        })();

  return (
    <div>
      {/* Controls */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="p-2 rounded-lg transition-colors hover:bg-[color:var(--color-surface-3)]"
            style={{ color: "var(--color-neutral-400)" }}
          >
            <ChevronLeft size={18} />
          </button>
          <h2
            className="font-[family-name:var(--font-display)] text-[24px] leading-none min-w-[200px] text-center"
            style={{ letterSpacing: "-0.2px", color: "var(--color-brand-cream)" }}
          >
            {title}
          </h2>
          <button
            onClick={() => navigate(1)}
            className="p-2 rounded-lg transition-colors hover:bg-[color:var(--color-surface-3)]"
            style={{ color: "var(--color-neutral-400)" }}
          >
            <ChevronRight size={18} />
          </button>
          <button
            onClick={goToToday}
            className="ml-2 rounded-md px-3 py-1.5 font-[family-name:var(--font-label)] text-[10px] uppercase transition-colors border"
            style={{
              letterSpacing: "1.5px",
              borderColor: "var(--color-neutral-600)",
              color: "var(--color-neutral-400)",
            }}
          >
            Today
          </button>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleSync}
            disabled={syncing}
            className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 font-[family-name:var(--font-label)] text-[10px] uppercase transition-colors hover:border-[color:var(--color-brand-pink)] hover:text-[color:var(--color-brand-pink)] disabled:opacity-40"
            style={{
              letterSpacing: "1.5px",
              borderColor: "var(--color-neutral-600)",
              color: "var(--color-neutral-300)",
            }}
          >
            <RefreshCw size={12} className={syncing ? "animate-spin" : ""} />
            {syncing ? "Syncing…" : "Sync Outlook"}
          </button>

          <div
            className="flex rounded-lg p-0.5"
            style={{ backgroundColor: "var(--color-surface-1)" }}
          >
            {(["month", "week"] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className="rounded-md px-3 py-1.5 font-[family-name:var(--font-label)] text-[10px] uppercase transition-colors"
                style={{
                  letterSpacing: "1px",
                  backgroundColor:
                    viewMode === mode ? "var(--color-surface-2)" : "transparent",
                  color:
                    viewMode === mode
                      ? "var(--color-neutral-100)"
                      : "var(--color-neutral-500)",
                }}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>
      </div>

      {syncResult && (
        <p
          className="mb-4 text-[12px] font-[family-name:var(--font-body)]"
          style={{ color: "var(--color-neutral-400)" }}
        >
          {syncResult}
        </p>
      )}

      {/* Calendar grid */}
      {viewMode === "month" ? (
        <MonthView
          currentDate={currentDate}
          today={today}
          events={events}
        />
      ) : (
        <WeekView
          currentDate={currentDate}
          today={today}
          events={events}
        />
      )}
    </div>
  );
}

function MonthView({
  currentDate,
  today,
  events,
}: {
  currentDate: Date;
  today: Date;
  events: CalendarEvent[];
}) {
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const days = useMemo(() => {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    let startOffset = firstDay.getDay() - 1;
    if (startOffset < 0) startOffset = 6;

    const cells: Array<{ date: Date; inMonth: boolean }> = [];

    for (let i = startOffset - 1; i >= 0; i--) {
      const d = new Date(year, month, -i);
      cells.push({ date: d, inMonth: false });
    }

    for (let i = 1; i <= lastDay.getDate(); i++) {
      cells.push({ date: new Date(year, month, i), inMonth: true });
    }

    const remaining = 7 - (cells.length % 7);
    if (remaining < 7) {
      for (let i = 1; i <= remaining; i++) {
        cells.push({ date: new Date(year, month + 1, i), inMonth: false });
      }
    }

    return cells;
  }, [year, month]);

  function getEventsForDate(date: Date): CalendarEvent[] {
    return events.filter((e) => isSameDay(new Date(e.start_at_ms), date));
  }

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{
        border: "1px solid rgba(253, 245, 230, 0.06)",
      }}
    >
      {/* Header */}
      <div
        className="grid grid-cols-7"
        style={{ backgroundColor: "var(--color-surface-2)" }}
      >
        {DAYS.map((day) => (
          <div
            key={day}
            className="py-3 text-center font-[family-name:var(--font-label)] text-[10px] uppercase"
            style={{ letterSpacing: "1.5px", color: "var(--color-neutral-500)" }}
          >
            {day}
          </div>
        ))}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-7">
        {days.map(({ date, inMonth }, i) => {
          const isToday = isSameDay(date, today);
          const dayEvents = getEventsForDate(date);

          return (
            <div
              key={i}
              className="min-h-[100px] p-2 border-t"
              style={{
                borderColor: "rgba(253, 245, 230, 0.04)",
                backgroundColor: isToday
                  ? "rgba(178, 40, 72, 0.04)"
                  : "var(--color-surface-1)",
              }}
            >
              <span
                className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-[13px] font-[family-name:var(--font-body)] ${
                  isToday ? "font-medium" : ""
                }`}
                style={{
                  color: !inMonth
                    ? "var(--color-neutral-600)"
                    : isToday
                      ? "var(--color-brand-cream)"
                      : "var(--color-neutral-300)",
                  backgroundColor: isToday
                    ? "var(--color-brand-red)"
                    : "transparent",
                }}
              >
                {date.getDate()}
              </span>
              <div className="mt-1 flex flex-col gap-0.5">
                {dayEvents.slice(0, 3).map((ev) => {
                  const colors = getEventColor(ev);
                  return (
                    <div
                      key={ev.id}
                      className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] truncate"
                      style={{ backgroundColor: colors.bg, color: colors.text }}
                    >
                      <span
                        className="w-1 h-1 rounded-full shrink-0"
                        style={{ backgroundColor: colors.dot }}
                      />
                      <span className="truncate">
                        {formatTime(ev.start_at_ms)} {getEventLabel(ev)}
                      </span>
                    </div>
                  );
                })}
                {dayEvents.length > 3 && (
                  <span
                    className="text-[9px] px-1.5"
                    style={{ color: "var(--color-neutral-500)" }}
                  >
                    +{dayEvents.length - 3} more
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function WeekView({
  currentDate,
  today,
  events,
}: {
  currentDate: Date;
  today: Date;
  events: CalendarEvent[];
}) {
  const monday = getMonday(currentDate);

  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday);
      d.setDate(d.getDate() + i);
      return d;
    });
  }, [monday]);

  function getEventsForDate(date: Date): CalendarEvent[] {
    return events.filter((e) => isSameDay(new Date(e.start_at_ms), date));
  }

  return (
    <div className="grid grid-cols-7 gap-3">
      {weekDays.map((date, i) => {
        const isToday = isSameDay(date, today);
        const dayEvents = getEventsForDate(date);

        return (
          <div
            key={i}
            className="rounded-xl p-3 min-h-[300px]"
            style={{
              backgroundColor: isToday
                ? "rgba(178, 40, 72, 0.06)"
                : "var(--color-surface-2)",
              border: isToday
                ? "1px solid rgba(178, 40, 72, 0.2)"
                : "1px solid rgba(253, 245, 230, 0.03)",
              boxShadow: "var(--surface-highlight)",
            }}
          >
            <div className="text-center mb-3">
              <div
                className="font-[family-name:var(--font-label)] text-[9px] uppercase"
                style={{ letterSpacing: "1.5px", color: "var(--color-neutral-500)" }}
              >
                {DAYS[i]}
              </div>
              <div
                className={`mt-1 inline-flex items-center justify-center w-8 h-8 rounded-full font-[family-name:var(--font-body)] text-[16px] ${
                  isToday ? "font-medium" : ""
                }`}
                style={{
                  color: isToday ? "var(--color-brand-cream)" : "var(--color-neutral-300)",
                  backgroundColor: isToday ? "var(--color-brand-red)" : "transparent",
                }}
              >
                {date.getDate()}
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              {dayEvents.map((ev) => {
                const colors = getEventColor(ev);
                return (
                  <div
                    key={ev.id}
                    className="rounded-lg p-2"
                    style={{ backgroundColor: colors.bg }}
                  >
                    <div
                      className="text-[10px] font-[family-name:var(--font-label)] uppercase"
                      style={{ letterSpacing: "0.5px", color: "var(--color-neutral-500)" }}
                    >
                      {formatTime(ev.start_at_ms)}
                    </div>
                    <div
                      className="mt-0.5 text-[12px] font-[family-name:var(--font-body)] leading-tight"
                      style={{ color: colors.text }}
                    >
                      {getEventLabel(ev)}
                    </div>
                  </div>
                );
              })}
              {dayEvents.length === 0 && (
                <p
                  className="text-[11px] font-[family-name:var(--font-body)] italic text-center py-4"
                  style={{ color: "var(--color-neutral-600)" }}
                >
                  Clear
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
