import { redirect, notFound } from "next/navigation";
import type { Metadata } from "next";
import { auth } from "@/lib/auth/session";
import { getPlanForReview } from "@/lib/six-week-plan/queries";
import { ReviewShell } from "./_components/review-shell";

interface ReviewPageProps {
  params: Promise<{ planId: string }>;
}

const TAB_TITLES = [
  (name: string) => `Review: ${name}'s plan`,
  (_: string, biz: string) => `${biz} — six-week plan`,
  (name: string) => `Plan review — ${name}`,
];

export async function generateMetadata({
  params,
}: ReviewPageProps): Promise<Metadata> {
  const { planId } = await params;
  const data = await getPlanForReview(planId);
  if (!data) return { title: "Plan Review" };
  const idx = Math.floor(Date.now() / 60_000) % TAB_TITLES.length;
  return {
    title: TAB_TITLES[idx](data.prospect.name, data.prospect.businessName),
  };
}

export default async function PlanReviewPage({ params }: ReviewPageProps) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    redirect("/api/auth/signin");
  }

  const { planId } = await params;
  const data = await getPlanForReview(planId);
  if (!data) notFound();

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">
            Plan for {data.prospect.name}
          </h1>
          <p className="text-sm text-muted-foreground">
            {data.prospect.businessName} — v{data.plan.generationVersion}
          </p>
        </div>
        <a
          href={`/lite/admin/pipeline`}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          Back to pipeline
        </a>
      </div>
      <ReviewShell
        plan={data.plan}
        prospect={data.prospect}
      />
    </div>
  );
}
