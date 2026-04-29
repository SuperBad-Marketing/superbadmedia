import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { candidates } from "@/lib/db/schema/candidates";
import { getBenchSession } from "@/lib/bench/guard";
import { ContractorOnboardingFlow } from "@/components/lite/bench/contractor-onboarding-flow";

export const metadata = {
  title: "SuperBad | Onboarding",
};

export default async function BenchOnboardPage() {
  const session = await getBenchSession();
  if (!session) redirect("/bench/expired");

  const candidate = db
    .select({
      id: candidates.id,
      name: candidates.name,
      stage: candidates.stage,
      onboarding_completed_at_ms: candidates.onboarding_completed_at_ms,
      hourly_rate_aud: candidates.hourly_rate_aud,
      weekly_capacity_hours: candidates.weekly_capacity_hours,
    })
    .from(candidates)
    .where(eq(candidates.id, session.candidateId))
    .get();

  if (!candidate || candidate.stage === "archived") {
    redirect("/bench/expired");
  }

  if (candidate.onboarding_completed_at_ms) {
    redirect("/bench");
  }

  return (
    <ContractorOnboardingFlow
      candidateId={candidate.id}
      candidateName={candidate.name}
      defaultRate={candidate.hourly_rate_aud}
      defaultCapacity={candidate.weekly_capacity_hours}
    />
  );
}
