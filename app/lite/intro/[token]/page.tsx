import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { loadSubmissionByToken } from "./loaders";
import { PortalShell } from "./portal-shell";
import { requireIntroSession } from "@/lib/portal/require-intro-session";

interface Props {
  params: Promise<{ token: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params;
  const data = await loadSubmissionByToken(token);
  if (!data) return { title: "Not found" };
  return {
    title: `${data.submission.submitted_name} | SuperBad`,
    robots: { index: false, follow: false },
  };
}

export default async function IntroPortalPage({ params }: Props) {
  const { token } = await params;
  const data = await loadSubmissionByToken(token);
  if (!data) notFound();

  await requireIntroSession(token);

  return (
    <PortalShell
      token={token}
      submission={data.submission}
      contact={data.contact}
      deal={data.deal}
      company={data.company}
      payment={data.payment}
      booking={data.booking}
      reflection={data.reflection}
    />
  );
}
