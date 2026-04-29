import { redirect } from "next/navigation";
import { eq, and, desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { candidates } from "@/lib/db/schema/candidates";
import { candidate_edit_requests } from "@/lib/db/schema/candidate-edit-requests";
import { getBenchSession } from "@/lib/bench/guard";
import { ProfileSurface } from "@/components/lite/bench/profile-surface";

export const metadata = {
  title: "SuperBad | Profile",
};

export default async function BenchProfilePage() {
  const session = await getBenchSession();
  if (!session) redirect("/bench/expired");

  const candidate = db
    .select({
      name: candidates.name,
      email: candidates.email,
      hourly_rate_aud: candidates.hourly_rate_aud,
      abn: candidates.abn,
      legal_name: candidates.legal_name,
      portfolio_urls_json: candidates.portfolio_urls_json,
      location_city: candidates.location_city,
    })
    .from(candidates)
    .where(eq(candidates.id, session.candidateId))
    .get();

  if (!candidate) redirect("/bench/expired");

  const pendingEdits = db
    .select({
      id: candidate_edit_requests.id,
      field_name: candidate_edit_requests.field_name,
      new_value: candidate_edit_requests.new_value,
      status: candidate_edit_requests.status,
      created_at_ms: candidate_edit_requests.created_at_ms,
    })
    .from(candidate_edit_requests)
    .where(
      and(
        eq(candidate_edit_requests.candidate_id, session.candidateId),
        eq(candidate_edit_requests.status, "pending"),
      ),
    )
    .orderBy(desc(candidate_edit_requests.created_at_ms))
    .all();

  const portfolioUrls = Array.isArray(candidate.portfolio_urls_json)
    ? (candidate.portfolio_urls_json as string[])
    : [];

  return (
    <ProfileSurface
      name={candidate.name}
      email={candidate.email}
      hourlyRateAud={candidate.hourly_rate_aud}
      abn={candidate.abn}
      legalName={candidate.legal_name}
      portfolioUrls={portfolioUrls}
      locationCity={candidate.location_city}
      pendingEdits={pendingEdits}
    />
  );
}
