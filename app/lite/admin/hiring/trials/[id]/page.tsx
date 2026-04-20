import { redirect, notFound } from "next/navigation";
import type { Metadata } from "next";

import { auth } from "@/lib/auth/session";
import { getTrialTaskById, getCandidateById, getRoleBriefById } from "@/lib/hiring/queries";
import { TrialReviewClient } from "@/components/lite/hiring-pipeline/trial-review-client";

interface TrialReviewPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({
  params,
}: TrialReviewPageProps): Promise<Metadata> {
  const { id } = await params;
  const task = await getTrialTaskById(id);
  if (!task) return { title: "Trial Task — Hiring" };
  const candidate = await getCandidateById(task.candidate_id);
  return {
    title: candidate
      ? `Review: ${candidate.name} — Trial Task`
      : "Review — Trial Task",
  };
}

export default async function TrialReviewPage({ params }: TrialReviewPageProps) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    redirect("/api/auth/signin");
  }

  const { id } = await params;
  const task = await getTrialTaskById(id);
  if (!task) notFound();

  const candidate = await getCandidateById(task.candidate_id);
  if (!candidate) notFound();

  const brief = task.role_brief_id
    ? await getRoleBriefById(task.role_brief_id)
    : null;

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col p-4">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <div
            className="font-[family-name:var(--font-label)] text-[10px] uppercase leading-none text-[color:var(--color-neutral-500)]"
            style={{ letterSpacing: "2px" }}
          >
            Hiring · Trial Review
          </div>
          <h1
            className="mt-2 font-[family-name:var(--font-display)] text-[28px] leading-none text-[color:var(--color-brand-cream)]"
            style={{ letterSpacing: "-0.3px" }}
          >
            {candidate.name}
          </h1>
          {brief && (
            <p className="mt-1 text-[13px] text-[color:var(--color-neutral-400)]">
              {brief.role_name}
            </p>
          )}
        </div>
        <a
          href="/lite/admin/hiring"
          className="font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-neutral-500)] transition-colors duration-[180ms] ease-[cubic-bezier(0.16,1,0.3,1)] hover:text-[color:var(--color-brand-cream)]"
          style={{ letterSpacing: "1.5px" }}
        >
          Back to pipeline
        </a>
      </div>
      <div className="flex-1 min-h-0">
        <TrialReviewClient
          task={{
            id: task.id,
            candidateId: task.candidate_id,
            candidateName: candidate.name,
            taskDescription: task.task_description,
            budgetCapAud: task.budget_cap_aud,
            ratePerUnitAud: task.rate_per_unit_aud,
            rateUnit: task.rate_unit,
            sentAtMs: task.sent_at_ms,
            dueAtMs: task.due_at_ms,
            deliveredAtMs: task.delivered_at_ms,
            deliveryUrl: task.delivery_url_or_asset,
            notes: task.andy_review_notes,
            rating: task.rating,
            disposition: task.disposition,
          }}
        />
      </div>
    </div>
  );
}
