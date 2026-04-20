import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { candidates } from "@/lib/db/schema/candidates";
import { getBenchSession } from "@/lib/bench/guard";
import { BenchShell } from "@/components/lite/bench/bench-shell";

interface Props {
  children: React.ReactNode;
}

export default async function BenchAuthLayout({ children }: Props) {
  const session = await getBenchSession();
  if (!session) {
    redirect("/bench/expired");
  }

  const candidate = db
    .select({
      id: candidates.id,
      name: candidates.name,
      stage: candidates.stage,
      onboarding_completed_at_ms: candidates.onboarding_completed_at_ms,
    })
    .from(candidates)
    .where(eq(candidates.id, session.candidateId))
    .get();

  if (!candidate || candidate.stage === "archived") {
    redirect("/bench/expired");
  }

  if (!candidate.onboarding_completed_at_ms) {
    redirect("/bench/onboard");
  }

  return (
    <BenchShell candidateName={candidate.name}>
      {children}
    </BenchShell>
  );
}
