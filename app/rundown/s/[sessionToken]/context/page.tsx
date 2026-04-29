import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { rundownSessions } from "@/lib/db/schema/rundown-sessions";
import { BusinessContextClient } from "@/app/lite/brand-dna/context/business-context-client";
import { submitRundownBusinessContext } from "../actions";

interface Props {
  params: Promise<{ sessionToken: string }>;
}

export default async function RundownContextPage({ params }: Props) {
  const { sessionToken } = await params;

  const session = await db.query.rundownSessions.findFirst({
    where: eq(rundownSessions.session_token, sessionToken),
  });
  if (!session?.profile_id) notFound();

  const boundAction = submitRundownBusinessContext.bind(null, sessionToken);

  return (
    <BusinessContextClient
      profileId={session.profile_id}
      submitAction={boundAction}
    />
  );
}
