import { Suspense } from "react";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { leadCandidates } from "@/lib/db/schema/lead-candidates";
import { RundownEntryClient } from "../rundown-entry-client";

interface Props {
  params: Promise<{ token: string }>;
}

export default async function RundownPrefilledPage({ params }: Props) {
  const { token } = await params;

  // Look up the outreach candidate by their pending_draft_id or a custom token field
  // For now, use the candidate ID directly as the token
  const candidate = await db.query.leadCandidates.findFirst({
    where: eq(leadCandidates.id, token),
  });

  if (!candidate) {
    notFound();
  }

  const prefilled = {
    name: candidate.contact_name ?? undefined,
    email: candidate.contact_email ?? undefined,
    businessName: candidate.company_name,
    website: candidate.domain ? `https://${candidate.domain}` : undefined,
  };

  return (
    <Suspense>
      <RundownEntryClient prefilled={prefilled} />
    </Suspense>
  );
}
