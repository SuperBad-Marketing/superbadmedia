import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { auth } from "@/lib/auth/session";
import { getCandidateById } from "@/lib/lead-gen/queries";
import type { ViabilityProfile } from "@/lib/lead-gen/types";
import { CandidateActions } from "./candidate-actions";
import { CandidateContactEdit } from "./candidate-contact-edit";
import { EnrichmentCard } from "@/components/lite/enrichment-card";

export const metadata: Metadata = {
  title: "Candidate Detail — Lead Gen — SuperBad",
};

function ScoreBar({ label, score, floor }: { label: string; score: number; floor: number }) {
  const qualifies = score >= floor;
  return (
    <div className="flex items-center gap-3">
      <span className="w-[70px] shrink-0 font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-neutral-500)]" style={{ letterSpacing: "1.2px" }}>
        {label}
      </span>
      <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ backgroundColor: "rgba(253, 245, 230, 0.06)" }}>
        <div
          className="h-full rounded-full transition-all"
          style={{
            width: `${Math.min(score, 100)}%`,
            backgroundColor: qualifies ? "var(--color-brand-pink)" : "var(--color-neutral-500)",
          }}
        />
      </div>
      <span className="w-[40px] shrink-0 text-right font-mono text-[14px]" style={{ color: qualifies ? "var(--color-brand-cream)" : "var(--color-neutral-500)" }}>
        {score}
      </span>
    </div>
  );
}

function TrackBadge({ track }: { track: string }) {
  const isSaas = track === "saas";
  return (
    <span
      className="inline-block rounded-full px-2.5 py-1 font-[family-name:var(--font-label)] text-[10px] uppercase"
      style={{
        letterSpacing: "1.2px",
        backgroundColor: isSaas ? "rgba(168, 85, 247, 0.15)" : "rgba(59, 130, 246, 0.15)",
        color: isSaas ? "#c084fc" : "#93c5fd",
      }}
    >
      {track}
    </span>
  );
}

export default async function CandidateDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    redirect("/api/auth/signin");
  }

  const { id } = await params;
  const candidate = await getCandidateById(id);
  if (!candidate) notFound();

  const profile = candidate.viability_profile_json as ViabilityProfile;

  const createdDate = candidate.created_at
    ? new Intl.DateTimeFormat("en-AU", {
        timeZone: "Australia/Melbourne",
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(candidate.created_at as unknown as number))
    : "Unknown";

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <header className="px-4 pt-6 pb-5">
        <Link
          href="/lite/admin/lead-gen"
          className="inline-flex items-center gap-1.5 font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-neutral-500)] hover:text-[color:var(--color-brand-pink)] transition-colors"
          style={{ letterSpacing: "1.5px" }}
        >
          <span aria-hidden="true">&larr;</span>
          Back to candidates
        </Link>
        <div
          className="mt-3 font-[family-name:var(--font-label)] text-[10px] uppercase leading-none text-[color:var(--color-neutral-500)]"
          style={{ letterSpacing: "2px" }}
        >
          Admin · Lead Gen · Candidates
        </div>
        <div className="mt-3 flex items-center gap-3">
          <h1
            className="font-[family-name:var(--font-display)] text-[36px] leading-none text-[color:var(--color-brand-cream)]"
            style={{ letterSpacing: "-0.4px" }}
          >
            {candidate.company_name}
          </h1>
          <TrackBadge track={candidate.qualified_track} />
        </div>
        <div className="mt-2 flex items-center gap-3 font-[family-name:var(--font-body)] text-[14px] text-[color:var(--color-neutral-400)]">
          {candidate.domain && (
            <a
              href={`https://${candidate.domain}`}
              target="_blank"
              rel="noopener noreferrer"
              className="underline decoration-[color:var(--color-neutral-600)] underline-offset-2 hover:text-[color:var(--color-brand-pink)]"
            >
              {candidate.domain}
            </a>
          )}
          {candidate.domain && <span className="text-[color:var(--color-neutral-600)]">·</span>}
          <span>{candidate.sourced_from.replace(/_/g, " ")}</span>
          <span className="text-[color:var(--color-neutral-600)]">·</span>
          <span>{createdDate}</span>
        </div>
      </header>

      <div className="mt-2 px-4">
        <CandidateActions
          candidateId={candidate.id}
          isSkipped={!!candidate.skipped_at}
          skipReason={candidate.skipped_reason}
          currentTrack={candidate.qualified_track}
          isPromoted={!!candidate.promoted_to_deal_id}
        />
      </div>

      {/* Scoring */}
      <div className="mt-8 px-4">
        <div
          className="mb-4 font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-neutral-500)]"
          style={{ letterSpacing: "2px" }}
        >
          Scoring
        </div>
        <div
          className="rounded-xl p-5"
          style={{
            backgroundColor: "var(--color-surface-2)",
            boxShadow: "var(--surface-highlight)",
            border: "1px solid rgba(253, 245, 230, 0.03)",
          }}
        >
          <div className="flex flex-col gap-3">
            <ScoreBar label="SaaS" score={candidate.saas_score} floor={8} />
            <ScoreBar label="Retainer" score={candidate.retainer_score} floor={14} />
          </div>
        </div>
      </div>

      {/* Contact + AI Summary + Draft Email */}
      <div className="mt-8 px-4">
        <div
          className="mb-4 font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-neutral-500)]"
          style={{ letterSpacing: "2px" }}
        >
          Contact & Outreach
        </div>
        <CandidateContactEdit
          candidateId={candidate.id}
          contactEmail={candidate.contact_email}
          contactName={candidate.contact_name}
          contactRole={candidate.contact_role}
          emailConfidence={candidate.email_confidence}
          notes={candidate.notes}
          aiSummary={candidate.ai_summary}
        />
      </div>

      {/* Enrichment — collapsible card with re-enrich */}
      <div className="mt-8 px-4">
        <EnrichmentCard
          profile={profile}
          candidateId={candidate.id}
          defaultOpen
        />
      </div>
    </div>
  );
}
