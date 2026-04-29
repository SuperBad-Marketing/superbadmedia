import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import type { Metadata } from "next";

import { db } from "@/lib/db";
import { rundownSessions } from "@/lib/db/schema/rundown-sessions";
import { AssessmentIntroClient } from "@/components/lite/brand-dna/assessment-intro-client";

export const metadata: Metadata = { title: "Brand DNA — SuperBad" };

interface Props {
  params: Promise<{ sessionToken: string }>;
}

export default async function RundownIntroPage({ params }: Props) {
  const { sessionToken } = await params;

  const session = await db.query.rundownSessions.findFirst({
    where: eq(rundownSessions.session_token, sessionToken),
  });
  if (!session?.profile_id) notFound();

  return (
    <AssessmentIntroClient
      continueHref={`/rundown/s/${sessionToken}/section/1`}
    />
  );
}
