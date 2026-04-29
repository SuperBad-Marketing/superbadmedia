"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { houseSpring } from "@/lib/design-tokens";
import type { ViabilityProfile } from "@/lib/lead-gen/types";
import {
  reEnrichCandidate,
  reEnrichCompany,
} from "@/app/lite/admin/actions/re-enrich";

// ── Types ────────────────────────────────────────────────────────────

interface EnrichmentCardProps {
  /** Raw viability_profile_json from the DB (may be null/empty). */
  profile: ViabilityProfile | null;
  /** Provide candidateId OR companyId — determines which re-enrich fires. */
  candidateId?: string;
  companyId?: string;
  /** Default collapsed state. */
  defaultOpen?: boolean;
}

// ── Helpers ──────────────────────────────────────────────────────────

function hasData(profile: ViabilityProfile | null): boolean {
  if (!profile) return false;
  return !!(
    profile.maps ||
    profile.website ||
    profile.instagram ||
    profile.youtube ||
    profile.meta_ads ||
    profile.google_ads ||
    profile.facebook ||
    profile.linkedin ||
    profile.tiktok ||
    profile.website_content ||
    profile.social_profiles
  );
}

function SignalRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-[3px]">
      <span className="font-[family-name:var(--font-body)] text-[12px] text-[color:var(--color-neutral-400)]">
        {label}
      </span>
      <span className="font-[family-name:var(--font-body)] text-[12px] text-[color:var(--color-brand-cream)] text-right">
        {value ?? (
          <span className="text-[color:var(--color-neutral-600)]">&mdash;</span>
        )}
      </span>
    </div>
  );
}

function SignalGroup({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="rounded-lg p-3"
      style={{
        backgroundColor: "rgba(15, 15, 14, 0.35)",
        border: "1px solid rgba(253, 245, 230, 0.03)",
      }}
    >
      <div
        className="mb-2 font-[family-name:var(--font-label)] text-[9px] uppercase text-[color:var(--color-neutral-500)]"
        style={{ letterSpacing: "1.5px" }}
      >
        {title}
      </div>
      <div className="flex flex-col">{children}</div>
    </div>
  );
}

function SocialLink({ url, label }: { url: string | null; label: string }) {
  if (!url) return null;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 font-mono text-[11px] text-[color:var(--color-neutral-300)] underline underline-offset-2 decoration-[color:var(--color-neutral-600)] hover:text-[color:var(--color-brand-pink)] transition-colors"
    >
      {label}
    </a>
  );
}

// ── Component ────────────────────────────────────────────────────────

export function EnrichmentCard({
  profile,
  candidateId,
  companyId,
  defaultOpen = false,
}: EnrichmentCardProps) {
  const [open, setOpen] = React.useState(defaultOpen);
  const [enriching, setEnriching] = React.useState(false);
  const [enrichResult, setEnrichResult] = React.useState<string | null>(null);
  const enrichable = !!(candidateId || companyId);
  const data = hasData(profile);

  const handleReEnrich = async () => {
    setEnriching(true);
    setEnrichResult(null);
    try {
      const result = candidateId
        ? await reEnrichCandidate(candidateId)
        : companyId
          ? await reEnrichCompany(companyId)
          : null;
      if (!result) {
        setEnrichResult("No target specified.");
      } else if (result.ok) {
        setEnrichResult(
          `Done. ${result.signalsSucceeded}/${result.signalsAttempted} signals.`,
        );
      } else {
        setEnrichResult(result.error);
      }
    } catch {
      setEnrichResult("Enrichment failed.");
    }
    setEnriching(false);
  };

  return (
    <section
      className="overflow-hidden rounded-[12px]"
      style={{
        background: "var(--color-surface-2)",
        boxShadow: "var(--surface-highlight)",
      }}
    >
      {/* Header — always visible */}
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full items-center justify-between px-5 py-3.5 cursor-pointer"
        style={{ borderBottom: "1px solid rgba(253, 245, 230, 0.05)" }}
      >
        <div className="flex items-center gap-3">
          <h2
            className="font-[family-name:var(--font-label)] text-[11px] uppercase text-[color:var(--color-neutral-300)]"
            style={{ letterSpacing: "1.8px" }}
          >
            Enrichment
          </h2>
          {!data && (
            <span className="font-[family-name:var(--font-body)] text-[11px] italic text-[color:var(--color-neutral-500)]">
              no data yet
            </span>
          )}
        </div>
        <motion.span
          animate={{ rotate: open ? 180 : 0 }}
          transition={houseSpring}
          className="text-[color:var(--color-neutral-500)] text-[12px]"
          aria-hidden
        >
          &#9662;
        </motion.span>
      </button>

      {/* Collapsible body */}
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={houseSpring}
            style={{ overflow: "hidden" }}
          >
            <div className="px-5 py-4 space-y-3">
              {/* Re-enrich button */}
              {enrichable && (
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={handleReEnrich}
                    disabled={enriching}
                    className="rounded-full px-3.5 py-1.5 font-[family-name:var(--font-label)] text-[10px] uppercase tracking-wider text-[color:var(--color-brand-pink)] transition-colors disabled:opacity-50 cursor-pointer"
                    style={{
                      letterSpacing: "1.2px",
                      background: "rgba(244, 160, 176, 0.10)",
                      border: "1px solid rgba(244, 160, 176, 0.15)",
                    }}
                  >
                    {enriching ? "Enriching..." : "Re-enrich"}
                  </button>
                  {enrichResult && (
                    <span
                      className={`text-[11px] ${
                        enrichResult.startsWith("Done")
                          ? "text-[color:var(--color-success)]"
                          : "text-[color:var(--color-brand-red)]"
                      }`}
                    >
                      {enrichResult}
                    </span>
                  )}
                </div>
              )}

              {!data ? (
                <div className="py-4 text-center">
                  <p className="font-[family-name:var(--font-body)] text-[13px] text-[color:var(--color-neutral-500)]">
                    No enrichment data.
                  </p>
                  <p className="mt-1 font-[family-name:var(--font-narrative)] text-[12px] italic text-[color:var(--color-brand-pink)]">
                    hit re-enrich to pull signals.
                  </p>
                </div>
              ) : (
                <>
                  {/* Social profile links */}
                  {profile?.social_profiles && (
                    <div className="flex flex-wrap gap-3">
                      <SocialLink
                        url={profile.social_profiles.instagram_url}
                        label="Instagram"
                      />
                      <SocialLink
                        url={profile.social_profiles.facebook_url}
                        label="Facebook"
                      />
                      <SocialLink
                        url={profile.social_profiles.linkedin_url}
                        label="LinkedIn"
                      />
                      <SocialLink
                        url={profile.social_profiles.tiktok_url}
                        label="TikTok"
                      />
                      <SocialLink
                        url={profile.social_profiles.youtube_url}
                        label="YouTube"
                      />
                      <SocialLink
                        url={profile.social_profiles.twitter_url}
                        label="Twitter"
                      />
                    </div>
                  )}

                  {/* Signal cards grid */}
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {profile?.instagram && (
                      <SignalGroup title="Instagram">
                        <SignalRow
                          label="Followers"
                          value={profile.instagram.follower_count.toLocaleString()}
                        />
                        <SignalRow
                          label="Posts"
                          value={profile.instagram.post_count.toLocaleString()}
                        />
                        <SignalRow
                          label="Posts (30d)"
                          value={profile.instagram.posts_last_30d}
                        />
                      </SignalGroup>
                    )}

                    {profile?.facebook && (
                      <SignalGroup title="Facebook">
                        <SignalRow
                          label="Page"
                          value={profile.facebook.page_name}
                        />
                        <SignalRow
                          label="Followers"
                          value={
                            profile.facebook.follower_count?.toLocaleString() ??
                            null
                          }
                        />
                        <SignalRow
                          label="Posts (30d)"
                          value={profile.facebook.posts_last_30d}
                        />
                        <SignalRow
                          label="Active"
                          value={
                            profile.facebook.has_active_page ? "Yes" : "No"
                          }
                        />
                      </SignalGroup>
                    )}

                    {profile?.tiktok && (
                      <SignalGroup title="TikTok">
                        <SignalRow
                          label="Followers"
                          value={
                            profile.tiktok.follower_count?.toLocaleString() ??
                            null
                          }
                        />
                        <SignalRow
                          label="Videos"
                          value={profile.tiktok.video_count}
                        />
                        <SignalRow
                          label="Posts (30d)"
                          value={profile.tiktok.posts_last_30d}
                        />
                      </SignalGroup>
                    )}

                    {profile?.linkedin && (
                      <SignalGroup title="LinkedIn">
                        <SignalRow
                          label="Company"
                          value={profile.linkedin.company_name}
                        />
                        <SignalRow
                          label="Employees"
                          value={profile.linkedin.employee_count_range}
                        />
                        <SignalRow
                          label="Followers"
                          value={
                            profile.linkedin.follower_count?.toLocaleString() ??
                            null
                          }
                        />
                      </SignalGroup>
                    )}

                    {profile?.youtube && (
                      <SignalGroup title="YouTube">
                        <SignalRow
                          label="Subscribers"
                          value={profile.youtube.subscriber_count.toLocaleString()}
                        />
                        <SignalRow
                          label="Videos"
                          value={profile.youtube.video_count}
                        />
                        <SignalRow
                          label="Uploads (90d)"
                          value={profile.youtube.uploads_last_90d}
                        />
                      </SignalGroup>
                    )}

                    {profile?.website && (
                      <SignalGroup title="Website">
                        <SignalRow
                          label="PageSpeed"
                          value={
                            profile.website.pagespeed_performance_score !== null
                              ? `${profile.website.pagespeed_performance_score}/100`
                              : null
                          }
                        />
                        <SignalRow
                          label="Domain age"
                          value={
                            profile.website.domain_age_years !== null
                              ? `${profile.website.domain_age_years.toFixed(1)} yrs`
                              : null
                          }
                        />
                        <SignalRow
                          label="Team size"
                          value={
                            profile.website.team_size_signal !== "unknown"
                              ? profile.website.team_size_signal
                              : null
                          }
                        />
                        <SignalRow
                          label="Pricing tier"
                          value={
                            profile.website.stated_pricing_tier !== "unknown"
                              ? profile.website.stated_pricing_tier
                              : null
                          }
                        />
                        <SignalRow
                          label="About page"
                          value={profile.website.has_about_page ? "Yes" : "No"}
                        />
                        <SignalRow
                          label="Pricing page"
                          value={
                            profile.website.has_pricing_page ? "Yes" : "No"
                          }
                        />
                      </SignalGroup>
                    )}

                    {profile?.maps && (
                      <SignalGroup title="Google Maps">
                        <SignalRow
                          label="Category"
                          value={profile.maps.category}
                        />
                        <SignalRow
                          label="Rating"
                          value={
                            profile.maps.rating !== null
                              ? `${profile.maps.rating}`
                              : null
                          }
                        />
                        <SignalRow
                          label="Reviews"
                          value={profile.maps.review_count}
                        />
                        <SignalRow
                          label="Photos"
                          value={profile.maps.photo_count}
                        />
                        <SignalRow
                          label="Last photo"
                          value={profile.maps.last_photo_date}
                        />
                      </SignalGroup>
                    )}

                    {profile?.meta_ads && (
                      <SignalGroup title="Meta Ads">
                        <SignalRow
                          label="Active ads"
                          value={profile.meta_ads.active_ad_count}
                        />
                        <SignalRow
                          label="Spend bracket"
                          value={profile.meta_ads.estimated_spend_bracket}
                        />
                        <SignalRow
                          label="Active creatives"
                          value={
                            profile.meta_ads.has_active_creatives ? "Yes" : "No"
                          }
                        />
                      </SignalGroup>
                    )}

                    {profile?.google_ads && (
                      <SignalGroup title="Google Ads">
                        <SignalRow
                          label="Active creatives"
                          value={profile.google_ads.active_creative_count}
                        />
                        <SignalRow
                          label="Active campaigns"
                          value={
                            profile.google_ads.has_active_campaigns
                              ? "Yes"
                              : "No"
                          }
                        />
                      </SignalGroup>
                    )}

                    {profile?.website_content && (
                      <SignalGroup title="Website Content">
                        <SignalRow
                          label="Content quality"
                          value={profile.website_content.content_quality}
                        />
                        {profile.website_content.services_offered.length > 0 && (
                          <SignalRow
                            label="Services"
                            value={profile.website_content.services_offered
                              .slice(0, 3)
                              .join(", ")}
                          />
                        )}
                      </SignalGroup>
                    )}
                  </div>

                  {/* Deep enrichment meta */}
                  {profile?.deep_enrichment && (
                    <div className="pt-1">
                      <span className="font-[family-name:var(--font-label)] text-[9px] uppercase text-[color:var(--color-neutral-600)]" style={{ letterSpacing: "1.2px" }}>
                        Deep enrichment: {profile.deep_enrichment.actors_succeeded}/{profile.deep_enrichment.actors_attempted} actors
                        {profile.deep_enrichment.soft_adjustment !== 0 && (
                          <> &middot; adj: {profile.deep_enrichment.soft_adjustment > 0 ? "+" : ""}{profile.deep_enrichment.soft_adjustment}</>
                        )}
                      </span>
                    </div>
                  )}

                  {/* Fetch errors */}
                  {profile?.fetch_errors &&
                    Object.keys(profile.fetch_errors).length > 0 && (
                      <SignalGroup title="Enrichment Errors">
                        {Object.entries(profile.fetch_errors).map(
                          ([key, msg]) => (
                            <SignalRow
                              key={key}
                              label={key}
                              value={
                                <span className="text-[color:var(--color-neutral-500)]">
                                  {msg as string}
                                </span>
                              }
                            />
                          ),
                        )}
                      </SignalGroup>
                    )}
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
