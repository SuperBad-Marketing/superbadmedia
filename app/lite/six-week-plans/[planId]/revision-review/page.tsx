import { redirect, notFound } from "next/navigation";
import type { Metadata } from "next";
import { auth } from "@/lib/auth/session";
import { getPlanForReview } from "@/lib/six-week-plan/queries";
import { RevisionReviewShell } from "./_components/revision-review-shell";

interface Props {
  params: Promise<{ planId: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { planId } = await params;
  const data = await getPlanForReview(planId);
  if (!data) return { title: "Revision Review" };
  return { title: `Revision: ${data.prospect.name}'s plan` };
}

export default async function RevisionReviewPage({ params }: Props) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    redirect("/api/auth/signin");
  }

  const { planId } = await params;
  const data = await getPlanForReview(planId);
  if (!data) notFound();

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">
            Revision request — {data.prospect.name}
          </h1>
          <p className="text-sm text-muted-foreground">
            {data.prospect.businessName} — v{data.plan.generationVersion}
          </p>
        </div>
        <a
          href={`/lite/six-week-plans/${planId}/review`}
          className="text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          Back to plan review
        </a>
      </div>
      <RevisionReviewShell plan={data.plan} prospect={data.prospect} />
    </div>
  );
}
