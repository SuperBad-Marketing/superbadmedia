import { redirect, notFound } from "next/navigation";
import type { Metadata } from "next";
import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { rundownSessions } from "@/lib/db/schema/rundown-sessions";
import { ReflectionClient } from "@/app/lite/brand-dna/section/[n]/reflection/reflection-client";
import { submitRundownReflection } from "../../../actions";

export const metadata: Metadata = { title: "Reflection — Brand DNA — SuperBad" };

interface Props {
  params: Promise<{ sessionToken: string; n: string }>;
}

export default async function RundownReflectionPage({ params }: Props) {
  const { sessionToken, n } = await params;
  const section = parseInt(n, 10);
  if (section !== 5) {
    redirect(`/rundown/s/${sessionToken}/section/${n}/insight`);
  }

  const session = await db.query.rundownSessions.findFirst({
    where: eq(rundownSessions.session_token, sessionToken),
  });
  if (!session?.profile_id) notFound();

  const boundAction = submitRundownReflection.bind(null, sessionToken);

  return (
    <ReflectionClient profileId={session.profile_id} submitAction={boundAction} />
  );
}
