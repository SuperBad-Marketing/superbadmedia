import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { candidates } from "@/lib/db/schema/candidates";
import { getBenchSession } from "@/lib/bench/guard";
import { AvailabilitySurface } from "@/components/lite/bench/availability-surface";

export const metadata = {
  title: "SuperBad | Availability",
};

export default async function BenchAvailabilityPage() {
  const session = await getBenchSession();
  if (!session) redirect("/bench/expired");

  const candidate = db
    .select({
      bench_status: candidates.bench_status,
      paused_until_ms: candidates.paused_until_ms,
      weekly_capacity_hours: candidates.weekly_capacity_hours,
    })
    .from(candidates)
    .where(eq(candidates.id, session.candidateId))
    .get();

  if (!candidate) redirect("/bench/expired");

  return (
    <AvailabilitySurface
      benchStatus={candidate.bench_status}
      pausedUntilMs={candidate.paused_until_ms}
      weeklyCapacityHours={candidate.weekly_capacity_hours ?? 0}
    />
  );
}
