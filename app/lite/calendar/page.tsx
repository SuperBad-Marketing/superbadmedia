import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { auth } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { calendar_bookings } from "@/lib/db/schema/calendar";
import { and, gte, lte } from "drizzle-orm";
import { CalendarView } from "./_components/calendar-view";

export const metadata: Metadata = {
  title: "Calendar | SuperBad",
  robots: { index: false, follow: false },
};

export default async function CalendarPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    redirect("/lite/login");
  }

  const now = Date.now();
  const threeMonthsAgo = now - 90 * 24 * 60 * 60 * 1000;
  const threeMonthsAhead = now + 90 * 24 * 60 * 60 * 1000;

  const events = await db
    .select()
    .from(calendar_bookings)
    .where(
      and(
        gte(calendar_bookings.start_at_ms, threeMonthsAgo),
        lte(calendar_bookings.start_at_ms, threeMonthsAhead),
      ),
    )
    .orderBy(calendar_bookings.start_at_ms);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <header className="pb-6">
        <div
          className="font-[family-name:var(--font-label)] text-[10px] uppercase leading-none"
          style={{ letterSpacing: "2px", color: "var(--color-neutral-500)" }}
        >
          Admin · Calendar
        </div>
        <h1
          className="mt-3 font-[family-name:var(--font-display)] text-[40px] leading-none"
          style={{ letterSpacing: "-0.4px", color: "var(--color-brand-cream)" }}
        >
          Calendar
        </h1>
        <p className="mt-3 max-w-[640px] font-[family-name:var(--font-body)] text-[16px] leading-[1.55] text-[color:var(--color-neutral-300)]">
          Bookings, shoots, and meetings.{" "}
          <em className="font-[family-name:var(--font-narrative)] text-[color:var(--color-brand-pink)]">
            synced from Outlook.
          </em>
        </p>
      </header>

      <CalendarView events={events} />
    </div>
  );
}
