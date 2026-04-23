import { redirect, notFound } from "next/navigation";
import type { Metadata } from "next";
import { auth } from "@/lib/auth/session";
import { getCandidateById } from "@/lib/lead-gen/queries";
import type { ViabilityProfile } from "@/lib/lead-gen/types";
import { CandidateActions } from "./candidate-actions";

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

function SignalCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      className="rounded-xl p-4"
      style={{
        backgroundColor: "var(--color-surface-2)",
        boxShadow: "var(--surface-highlight)",
        border: "1px solid rgba(253, 245, 230, 0.03)",
      }}
    >
      <div
        className="mb-3 font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-neutral-500)]"
        style={{ letterSpacing: "1.5px" }}
      >
        {title}
      </div>
      <div className="flex flex-col gap-1.5">{children}</div>
    </div>
  );
}

function SignalRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="font-[family-name:var(--font-body)] text-[13px] text-[color:var(--color-neutral-400)]">
        {label}
      </span>
      <span className="font-[family-name:var(--font-body)] text-[13px] text-[color:var(--color-brand-cream)] text-right">
        {value ?? <span className="text-[color:var(--color-neutral-600)]">—</span>}
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
  const fetchErrors = profile.fetch_errors ?? {};

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
        <div
          className="font-[family-name:var(--font-label)] text-[10px] uppercase leading-none text-[color:var(--color-neutral-500)]"
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

      {/* Contact */}
      <div className="mt-8 px-4">
        <div
          className="mb-4 font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-neutral-500)]"
          style={{ letterSpacing: "2px" }}
        >
          Contact
        </div>
        <SignalCard title="Contact info">
          <SignalRow label="Email" value={candidate.contact_email} />
          <SignalRow label="Name" value={candidate.contact_name} />
          <SignalRow label="Role" value={candidate.contact_role} />
          <SignalRow label="Confidence" value={candidate.email_confidence} />
        </SignalCard>
      </div>

      {/* Enrichment signals */}
      <div className="mt-8 px-4">
        <div
          className="mb-4 font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-neutral-500)]"
          style={{ letterSpacing: "2px" }}
        >
          Enrichment
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {profile.maps && (
            <SignalCard title="Google Maps">
              <SignalRow label="Category" value={profile.maps.category} />
              <SignalRow label="Rating" value={profile.maps.rating !== null ? `${profile.maps.rating} ★` : null} />
              <SignalRow label="Reviews" value={profile.maps.review_count} />
              <SignalRow label="Photos" value={profile.maps.photo_count} />
              <SignalRow label="Last photo" value={profile.maps.last_photo_date} />
            </SignalCard>
          )}

          {profile.website && (
            <SignalCard title="Website">
              <SignalRow label="PageSpeed" value={profile.website.pagespeed_performance_score !== null ? `${profile.website.pagespeed_performance_score}/100` : null} />
              <SignalRow label="Domain age" value={profile.website.domain_age_years !== null ? `${profile.website.domain_age_years.toFixed(1)} yrs` : null} />
              <SignalRow label="Team size" value={profile.website.team_size_signal !== "unknown" ? profile.website.team_size_signal : null} />
              <SignalRow label="Pricing tier" value={profile.website.stated_pricing_tier !== "unknown" ? profile.website.stated_pricing_tier : null} />
              <SignalRow label="About page" value={profile.website.has_about_page ? "Yes" : "No"} />
              <SignalRow label="Pricing page" value={profile.website.has_pricing_page ? "Yes" : "No"} />
            </SignalCard>
          )}

          {profile.instagram && (
            <SignalCard title="Instagram">
              <SignalRow label="Followers" value={profile.instagram.follower_count.toLocaleString()} />
              <SignalRow label="Total posts" value={profile.instagram.post_count.toLocaleString()} />
              <SignalRow label="Posts (30d)" value={profile.instagram.posts_last_30d} />
            </SignalCard>
          )}

          {profile.youtube && (
            <SignalCard title="YouTube">
              <SignalRow label="Subscribers" value={profile.youtube.subscriber_count.toLocaleString()} />
              <SignalRow label="Videos" value={profile.youtube.video_count} />
              <SignalRow label="Uploads (90d)" value={profile.youtube.uploads_last_90d} />
            </SignalCard>
          )}

          {profile.meta_ads && (
            <SignalCard title="Meta Ads">
              <SignalRow label="Active ads" value={profile.meta_ads.active_ad_count} />
              <SignalRow label="Spend bracket" value={profile.meta_ads.estimated_spend_bracket} />
              <SignalRow label="Active creatives" value={profile.meta_ads.has_active_creatives ? "Yes" : "No"} />
            </SignalCard>
          )}

          {profile.google_ads && (
            <SignalCard title="Google Ads">
              <SignalRow label="Active creatives" value={profile.google_ads.active_creative_count} />
              <SignalRow label="Active campaigns" value={profile.google_ads.has_active_campaigns ? "Yes" : "No"} />
            </SignalCard>
          )}
        </div>

        {Object.keys(fetchErrors).length > 0 && (
          <div className="mt-3">
            <SignalCard title="Enrichment errors">
              {Object.entries(fetchErrors).map(([key, msg]) => (
                <SignalRow key={key} label={key} value={<span className="text-[color:var(--color-neutral-500)]">{msg as string}</span>} />
              ))}
            </SignalCard>
          </div>
        )}
      </div>
    </div>
  );
}
