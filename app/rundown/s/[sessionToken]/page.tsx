import { redirect, notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import type { Metadata } from "next";

import { db } from "@/lib/db";
import { rundownSessions } from "@/lib/db/schema/rundown-sessions";
import { brand_dna_profiles } from "@/lib/db/schema/brand-dna-profiles";

import { AlignmentGateClient } from "@/app/lite/brand-dna/alignment-gate-client";
import { submitRundownAlignmentGate } from "./actions";

export const metadata: Metadata = { title: "Brand DNA — SuperBad" };

interface Props {
  params: Promise<{ sessionToken: string }>;
  searchParams: Promise<{ error?: string }>;
}

export default async function RundownSessionPage({ params, searchParams }: Props) {
  const { sessionToken } = await params;
  const sp = await searchParams;

  const session = await db.query.rundownSessions.findFirst({
    where: eq(rundownSessions.session_token, sessionToken),
  });
  if (!session?.profile_id) notFound();

  const profile = await db
    .select({
      id: brand_dna_profiles.id,
      track: brand_dna_profiles.track,
      current_section: brand_dna_profiles.current_section,
      status: brand_dna_profiles.status,
      business_context: brand_dna_profiles.business_context,
    })
    .from(brand_dna_profiles)
    .where(eq(brand_dna_profiles.id, session.profile_id))
    .limit(1);

  const p = profile[0];
  if (!p) notFound();

  // Resume logic
  if (p.track && p.status !== "complete") {
    if (!p.business_context) {
      redirect(`/rundown/s/${sessionToken}/context`);
    }
    const resumeSection = Math.max(1, p.current_section ?? 1);
    redirect(`/rundown/s/${sessionToken}/section/${resumeSection}`);
  }

  if (p.status === "complete") {
    redirect(`/rundown/s/${sessionToken}/reveal`);
  }

  const boundAction = submitRundownAlignmentGate.bind(null, sessionToken);

  return (
    <AlignmentGateClient
      submitAction={boundAction}
      errorParam={sp.error}
    />
  );
}
