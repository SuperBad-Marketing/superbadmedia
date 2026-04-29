"use client";

import * as React from "react";
import { motion, useInView, useReducedMotion } from "framer-motion";
import { houseSpring } from "@/lib/design-tokens";
import type { ViabilityProfile } from "@/lib/lead-gen/types";
import { trackRundownCtaClick } from "../actions";

interface RundownPostRevealProps {
  sessionToken: string;
  profileId: string;
  businessName: string;
  enrichmentData: ViabilityProfile | null;
  signalTags?: string[];
  firstImpression?: string;
}

const EASE = [0.22, 1, 0.36, 1] as const;

function Reveal({
  children,
  delay = 0,
}: {
  children: React.ReactNode;
  delay?: number;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.3 });
  const reduced = useReducedMotion();

  return (
    <motion.div
      ref={ref}
      initial={reduced ? false : { opacity: 0, y: 24 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.5, delay, ease: EASE }}
    >
      {children}
    </motion.div>
  );
}

// ── Enrichment cards with brand-referenced notes ──────────────────────

interface EnrichmentCard {
  label: string;
  stat: string;
  observation: string;
  brandNote: string | null;
}

function buildEnrichmentCards(
  data: ViabilityProfile | null,
  businessName: string,
  topTags: string[],
): EnrichmentCard[] {
  if (!data) return [];
  const cards: EnrichmentCard[] = [];

  const hasCraftSignals = topTags.some((t) =>
    ["admires craft", "admires_craft", "maker ethos", "maker_ethos", "tactile craft", "tactile_craft"].includes(t.toLowerCase()),
  );
  const hasProcessSignals = topTags.some((t) =>
    ["process driven", "process_driven", "perfectionism", "conscientiousness", "precision"].includes(t.toLowerCase()),
  );
  const hasCommunitySignals = topTags.some((t) =>
    ["local roots", "local_roots", "community building", "community_building", "word of mouth", "word_of_mouth", "affiliation"].includes(t.toLowerCase()),
  );
  const hasVisualSignals = topTags.some((t) =>
    ["visual storytelling", "visual_storytelling", "cinematic eye", "cinematic_eye", "aesthetic", "curation instinct", "curation_instinct"].includes(t.toLowerCase()),
  );

  if (data.instagram) {
    const { follower_count, posts_last_30d } = data.instagram;
    if (posts_last_30d !== null && posts_last_30d !== undefined && posts_last_30d <= 2) {
      const stat = posts_last_30d === 0 ? "No posts" : `${posts_last_30d} ${posts_last_30d === 1 ? "post" : "posts"}`;
      let brandNote: string | null = null;
      if (hasCraftSignals || hasProcessSignals) {
        brandNote = `Your DNA says craft and process matter to you, but your feed isn't showing any of it. The sourcing, the making, the details people don't see. That's your content.`;
      } else if (hasVisualSignals) {
        brandNote = `Strong visual instincts in your DNA, but your Instagram isn't reflecting them. Your feed should feel like an extension of the brand, not an afterthought.`;
      }
      cards.push({
        label: "Instagram",
        stat: stat + " this month",
        observation: `${follower_count !== undefined ? follower_count.toLocaleString() + " followers. " : ""}Last 30 days ${posts_last_30d === 0 ? "have been silent" : `had ${posts_last_30d} ${posts_last_30d === 1 ? "post" : "posts"}`}.`,
        brandNote,
      });
    } else if (follower_count !== undefined && follower_count < 500) {
      cards.push({
        label: "Instagram",
        stat: `${follower_count.toLocaleString()} followers`,
        observation: "Still early days. Room to grow.",
        brandNote: hasVisualSignals
          ? "Your visual instincts are strong. The audience will come once the feed reflects what you actually care about."
          : null,
      });
    }
  }

  if (data.maps) {
    const { review_count, rating } = data.maps;
    if (review_count < 10) {
      cards.push({
        label: "Google Reviews",
        stat: `${review_count} ${review_count === 1 ? "review" : "reviews"}`,
        observation: "Most people check reviews before they visit.",
        brandNote: hasCommunitySignals
          ? "Your DNA is built on community and word of mouth. Those conversations are happening, they're just not landing on Google yet."
          : null,
      });
    } else if (rating !== null) {
      const ratingStr = `${rating} stars`;
      cards.push({
        label: "Google Reviews",
        stat: ratingStr,
        observation: `${review_count} reviews. ${rating >= 4.5 ? "Solid foundation." : "Room to improve."}`,
        brandNote: hasCommunitySignals && rating >= 4.0
          ? "Your regulars are already saying the things your brand should be saying. Those reviews are more authentic than any copy you could write."
          : null,
      });
    }
  }

  if (data.facebook) {
    if (data.facebook.has_active_page === false) {
      cards.push({
        label: "Facebook",
        stat: "No page",
        observation: "No active Facebook page found.",
        brandNote: null,
      });
    } else if (data.facebook.posts_last_30d !== null && data.facebook.posts_last_30d === 0) {
      cards.push({
        label: "Facebook",
        stat: "Dormant",
        observation: "Page exists but hasn't posted recently.",
        brandNote: "A dormant page that's up-to-date is better than posting content that doesn't feel like you. Focus where your audience actually is.",
      });
    }
  }

  if (data.website) {
    const { pagespeed_performance_score, has_about_page } = data.website;
    const parts: string[] = [];
    if (pagespeed_performance_score !== null && pagespeed_performance_score < 50) {
      parts.push(`Performance score of ${pagespeed_performance_score}/100.`);
    }
    if (!has_about_page) {
      parts.push("No about page found.");
    }
    if (parts.length > 0) {
      const stat = pagespeed_performance_score !== null && pagespeed_performance_score < 50
        ? `${pagespeed_performance_score}/100`
        : "Missing pages";
      cards.push({
        label: "Website",
        stat,
        observation: parts.join(" ") + (pagespeed_performance_score !== null && pagespeed_performance_score < 50 ? " Mobile visitors feel it." : ""),
        brandNote: hasCraftSignals
          ? "Your brand is built on the in-person experience, but most people check your site before they visit. Right now it doesn't reflect the care you put into everything else."
          : !has_about_page
            ? "People want to know who they're buying from. An about page is where your brand voice gets to do what it does best."
            : null,
      });
    }
  }

  if (data.youtube) {
    if (data.youtube.video_count === 0) {
      cards.push({
        label: "YouTube",
        stat: "No presence",
        observation: "No YouTube content found.",
        brandNote: null,
      });
    }
  }

  if (data.linkedin) {
    if (data.linkedin.has_active_page === false) {
      cards.push({
        label: "LinkedIn",
        stat: "No page",
        observation: "No active LinkedIn company page.",
        brandNote: null,
      });
    }
  }

  return cards.slice(0, 6);
}

// ── Tier data ─────────────────────────────────────────────────────────

const TIERS = [
  {
    id: "session" as const,
    name: "Session",
    price: 397,
    recommended: false,
    duration: "60 min on-site",
    deliverables: [
      "1 short-form video",
      "10-15 edited photographs",
      "A six-week marketing plan, written for you",
      "Everything delivered inside your own private portal",
      "Reschedule any time up to 48 hours before",
    ],
  },
  {
    id: "production" as const,
    name: "Production",
    price: 597,
    recommended: true,
    duration: "60-90 min on-site",
    deliverables: [
      "2 short-form videos (1 under 60s, 1 under 30s)",
      "20-25 edited photographs",
      "A six-week marketing plan, written for you",
      "Everything delivered inside your own private portal",
      "Reschedule any time up to 48 hours before",
    ],
  },
];

function TierCard({
  tier,
  onSelect,
}: {
  tier: (typeof TIERS)[number];
  onSelect: () => void;
}) {
  return (
    <motion.div
      whileHover={{ y: -4 }}
      transition={houseSpring}
      style={{
        flex: 1,
        minWidth: 260,
        background: "rgba(34,34,31,0.6)",
        backdropFilter: "blur(10px)",
        border: tier.recommended
          ? "1px solid rgba(178,40,72,0.5)"
          : "1px solid rgba(253,245,230,0.08)",
        borderRadius: 20,
        padding: "32px 28px",
        display: "flex",
        flexDirection: "column",
        gap: 16,
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: tier.recommended
            ? "linear-gradient(135deg, rgba(178,40,72,0.15), transparent 50%)"
            : "linear-gradient(135deg, rgba(178,40,72,0.05), transparent 50%)",
          borderRadius: 20,
          pointerEvents: "none",
        }}
      />
      <div style={{ position: "relative" }}>
        {tier.recommended && (
          <div
            style={{
              fontFamily: "var(--font-label)",
              fontSize: 8,
              letterSpacing: "2px",
              textTransform: "uppercase",
              color: "var(--brand-red)",
              background: "rgba(178,40,72,0.15)",
              border: "1px solid rgba(178,40,72,0.3)",
              borderRadius: 6,
              padding: "4px 10px",
              display: "inline-block",
              marginBottom: 12,
            }}
          >
            Recommended
          </div>
        )}
        <div
          style={{
            fontFamily: "var(--font-label)",
            fontSize: 10,
            letterSpacing: "2px",
            textTransform: "uppercase",
            color: "var(--brand-orange)",
          }}
        >
          {tier.name}
        </div>
        <div
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "clamp(2.5rem, 4vw, 3.5rem)",
            lineHeight: 1,
            letterSpacing: "-1px",
            color: "var(--brand-cream)",
            marginTop: 8,
          }}
        >
          ${tier.price}
          <sup
            style={{
              fontFamily: "var(--font-body)",
              fontSize: 13,
              color: "var(--brand-pink)",
              fontWeight: 400,
              verticalAlign: "super",
              marginLeft: 8,
            }}
          >
            once
          </sup>
        </div>
        <p
          style={{
            marginTop: 10,
            fontFamily: "var(--font-narrative)",
            fontStyle: "italic",
            fontSize: 14,
            color: "var(--neutral-300)",
          }}
        >
          {tier.duration}
        </p>
      </div>
      <ul
        style={{
          listStyle: "none",
          display: "flex",
          flexDirection: "column",
          gap: 10,
          borderTop: "1px solid rgba(253,245,230,0.08)",
          margin: 0,
          padding: "14px 0 0",
          position: "relative",
          flex: 1,
        }}
      >
        {tier.deliverables.map((item) => (
          <li
            key={item}
            style={{
              display: "flex",
              gap: 10,
              alignItems: "flex-start",
              fontSize: 14,
              lineHeight: 1.5,
              fontFamily: "var(--font-body)",
              color: "var(--neutral-300)",
            }}
          >
            <span
              style={{
                width: 5,
                height: 5,
                borderRadius: "50%",
                background: "var(--brand-red)",
                marginTop: 8,
                flexShrink: 0,
              }}
            />
            {item}
          </li>
        ))}
      </ul>
      <div style={{ position: "relative", paddingTop: 4 }}>
        <button
          type="button"
          onClick={onSelect}
          style={{
            width: "100%",
            padding: 16,
            fontFamily: "var(--font-label)",
            fontSize: 11,
            letterSpacing: "2px",
            textTransform: "uppercase",
            background: tier.recommended ? "var(--brand-red)" : "transparent",
            color: "var(--brand-cream)",
            border: tier.recommended
              ? "none"
              : "1px solid rgba(253,245,230,0.15)",
            borderRadius: 10,
            cursor: "pointer",
            transition: "all 200ms cubic-bezier(0.16, 1, 0.3, 1)",
          }}
          onMouseEnter={(e) => {
            if (tier.recommended) {
              e.currentTarget.style.background = "#8F1D3A";
            } else {
              e.currentTarget.style.background = "rgba(253,245,230,0.06)";
            }
            e.currentTarget.style.transform = "translateY(-1px)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = tier.recommended
              ? "var(--brand-red)"
              : "transparent";
            e.currentTarget.style.transform = "translateY(0)";
          }}
        >
          Choose {tier.name}
        </button>
      </div>
    </motion.div>
  );
}

// ── Main component ────────────────────────────────────────────────────

export function RundownPostReveal({
  sessionToken,
  profileId,
  businessName,
  enrichmentData,
  signalTags = [],
  firstImpression = "",
}: RundownPostRevealProps) {
  const [tiersExpanded, setTiersExpanded] = React.useState(false);

  const enrichmentCards = React.useMemo(
    () => buildEnrichmentCards(enrichmentData, businessName, signalTags),
    [enrichmentData, businessName, signalTags],
  );

  const hasEnrichment = enrichmentCards.length > 0;

  function handleTierSelect(tier: "session" | "production") {
    trackRundownCtaClick(sessionToken, tier).catch(() => {});
    window.location.href = `/trial-shoot?tier=${tier}&ref=rundown&sid=${sessionToken}`;
  }

  return (
    <div className="rundown-post-reveal-root">
      {/* ═══ ENRICHMENT SECTION ═══ */}
      {hasEnrichment && (
        <div
          style={{
            background: "var(--color-neutral-900, #1A1A18)",
            padding: "80px 24px",
          }}
        >
          <div
            style={{
              maxWidth: 900,
              margin: "0 auto",
              display: "flex",
              flexDirection: "column",
              gap: 32,
            }}
          >
            <Reveal>
              <div
                style={{
                  height: 1,
                  background:
                    "linear-gradient(to right, transparent, rgba(253,245,230,0.1), transparent)",
                  marginBottom: 16,
                }}
              />
              <span
                style={{
                  fontFamily: "var(--font-label)",
                  fontSize: 10,
                  letterSpacing: "3px",
                  textTransform: "uppercase",
                  color: "var(--brand-orange)",
                }}
              >
                While you were here, we had a look around
              </span>
              <p
                style={{
                  fontFamily: "var(--font-narrative)",
                  fontStyle: "italic",
                  fontSize: "clamp(17px, 2vw, 20px)",
                  color: "var(--brand-cream)",
                  opacity: 0.6,
                  marginTop: 12,
                  maxWidth: 460,
                  lineHeight: 1.7,
                }}
              >
                Not a judgement. Just how things look from the outside, compared
                to what we learned about you from the inside.
              </p>
            </Reveal>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 20,
              }}
              className="enrichment-grid"
            >
              {enrichmentCards.map((card, i) => (
                <Reveal key={`${card.label}-${i}`} delay={0.1 + i * 0.08}>
                  <div
                    style={{
                      padding: "24px 28px",
                      borderRadius: 14,
                      border: "1px solid rgba(253,245,230,0.06)",
                      background: "var(--color-neutral-800, #252320)",
                      display: "flex",
                      flexDirection: "column",
                      gap: 12,
                    }}
                  >
                    <span
                      style={{
                        fontFamily: "var(--font-label)",
                        fontSize: 9,
                        letterSpacing: "2px",
                        textTransform: "uppercase",
                        color: "var(--brand-pink)",
                      }}
                    >
                      {card.label}
                    </span>
                    <span
                      style={{
                        fontFamily: "var(--font-display)",
                        fontSize: 28,
                        color: "var(--brand-cream)",
                        lineHeight: 1,
                      }}
                    >
                      {card.stat}
                    </span>
                    <p
                      style={{
                        fontFamily: "var(--font-body)",
                        fontSize: 14,
                        lineHeight: 1.6,
                        color: "var(--brand-cream)",
                        opacity: 0.75,
                        margin: 0,
                      }}
                    >
                      {card.observation}
                    </p>
                    {card.brandNote && (
                      <p
                        style={{
                          fontFamily: "var(--font-narrative)",
                          fontStyle: "italic",
                          fontSize: 13,
                          lineHeight: 1.6,
                          color: "var(--brand-pink)",
                          opacity: 0.8,
                          paddingLeft: 16,
                          borderLeft: "2px solid rgba(178, 40, 72, 0.3)",
                          marginTop: 4,
                        }}
                      >
                        {card.brandNote}
                      </p>
                    )}
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ═══ BRAND PACK DOWNLOAD ═══ */}
      <div
        style={{
          background: "var(--color-neutral-800, #252320)",
          padding: "64px 24px",
        }}
      >
        <div
          style={{
            maxWidth: 900,
            margin: "0 auto",
            textAlign: "center",
          }}
        >
          <Reveal>
            <span
              style={{
                fontFamily: "var(--font-label)",
                fontSize: 10,
                letterSpacing: "3px",
                textTransform: "uppercase",
                color: "var(--brand-pink)",
                display: "block",
                marginBottom: 16,
              }}
            >
              Your brand pack
            </span>
            <p
              style={{
                fontFamily: "var(--font-narrative)",
                fontStyle: "italic",
                fontSize: "clamp(15px, 2vw, 18px)",
                lineHeight: 1.7,
                color: "var(--brand-cream)",
                opacity: 0.7,
                maxWidth: 420,
                margin: "0 auto 28px",
              }}
            >
              Colours, typography, content pillars, voice guide, photography
              direction. Yours to keep.
            </p>
          </Reveal>
          <Reveal delay={0.1}>
            <button
              type="button"
              onClick={() => {
                window.open(
                  `/api/rundown/${sessionToken}/brand-pack`,
                  "_blank",
                );
              }}
              style={{
                fontFamily: "var(--font-label)",
                fontSize: 11,
                letterSpacing: "2px",
                textTransform: "uppercase",
                color: "var(--brand-cream)",
                padding: "16px 36px",
                background: "rgba(253, 245, 230, 0.04)",
                border: "1px solid rgba(253, 245, 230, 0.15)",
                borderRadius: 999,
                cursor: "pointer",
                backdropFilter: "blur(8px)",
                transition: "background 300ms, border-color 300ms",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background =
                  "rgba(253, 245, 230, 0.08)";
                e.currentTarget.style.borderColor =
                  "rgba(253, 245, 230, 0.25)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background =
                  "rgba(253, 245, 230, 0.04)";
                e.currentTarget.style.borderColor =
                  "rgba(253, 245, 230, 0.15)";
              }}
            >
              Download Brand Pack &rarr;
            </button>
          </Reveal>
        </div>
      </div>

      {/* ═══ SOFT CTA (expands to tiers) ═══ */}
      <div
        style={{
          background: "var(--color-neutral-900, #1A1A18)",
          padding: "56px 24px",
        }}
      >
        <div
          style={{
            maxWidth: 900,
            margin: "0 auto",
            textAlign: "center",
          }}
        >
          <Reveal>
            <span
              style={{
                fontFamily: "var(--font-label)",
                fontSize: 10,
                letterSpacing: "3px",
                textTransform: "uppercase",
                color: "var(--brand-orange)",
                display: "block",
                marginBottom: 16,
              }}
            >
              {hasEnrichment
                ? "If any of that landed"
                : "One more thing before you go"}
            </span>
            <p
              style={{
                fontFamily: "var(--font-body)",
                fontSize: 16,
                lineHeight: 1.7,
                color: "var(--neutral-300)",
                maxWidth: 520,
                margin: "0 auto 28px",
              }}
            >
              We come to you, shoot, edit, and deliver. You keep everything
              whether you come back or not. Plus a six-week marketing plan
              written for your business, not a template.
            </p>
          </Reveal>

          {!tiersExpanded && (
            <Reveal delay={0.1}>
              <button
                type="button"
                onClick={() => setTiersExpanded(true)}
                style={{
                  fontFamily: "var(--font-body)",
                  fontSize: 14,
                  color: "var(--brand-cream)",
                  padding: "14px 32px",
                  border: "1px solid rgba(253, 245, 230, 0.15)",
                  borderRadius: 999,
                  cursor: "pointer",
                  background: "rgba(253, 245, 230, 0.03)",
                  transition: "all 0.2s",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background =
                    "rgba(253, 245, 230, 0.08)";
                  e.currentTarget.style.borderColor =
                    "rgba(253, 245, 230, 0.25)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background =
                    "rgba(253, 245, 230, 0.03)";
                  e.currentTarget.style.borderColor =
                    "rgba(253, 245, 230, 0.15)";
                }}
              >
                Book a trial shoot &rarr;
              </button>
              <p
                style={{
                  fontFamily: "var(--font-body)",
                  fontStyle: "italic",
                  fontSize: 13,
                  color: "var(--neutral-500)",
                  marginTop: 20,
                }}
              >
                From $397. 60 minutes on-site.
              </p>
            </Reveal>
          )}

          {tiersExpanded && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: EASE }}
              style={{ maxWidth: 640, margin: "0 auto" }}
            >
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 20,
                  marginTop: 8,
                }}
                className="rundown-tier-grid"
              >
                {TIERS.map((tier) => (
                  <TierCard
                    key={tier.id}
                    tier={tier}
                    onSelect={() => handleTierSelect(tier.id)}
                  />
                ))}
              </div>
              <p
                style={{
                  fontSize: 13,
                  color: "var(--neutral-500)",
                  fontStyle: "italic",
                  textAlign: "center",
                  marginTop: 20,
                }}
              >
                Both include the same six-week plan. The difference is what you
                walk away with from the shoot itself.
              </p>
            </motion.div>
          )}
        </div>
      </div>

      {/* ═══ FOOTER ═══ */}
      <footer
        style={{
          textAlign: "center",
          padding: "60px 24px 64px",
          borderTop: "1px solid rgba(253, 245, 230, 0.04)",
        }}
      >
        <div
          style={{
            fontFamily: "var(--font-logo)",
            fontSize: 28,
            color: "var(--brand-cream)",
            marginBottom: 12,
          }}
        >
          SuperBad
        </div>
        <p
          style={{
            fontFamily: "var(--font-narrative)",
            fontStyle: "italic",
            color: "var(--brand-pink)",
            fontSize: 14,
            margin: 0,
          }}
        >
          Marketing for people who&rsquo;d rather be doing something else.
        </p>
      </footer>

      <style>{`
        @media (max-width: 640px) {
          .enrichment-grid {
            grid-template-columns: 1fr !important;
          }
          .rundown-tier-grid {
            grid-template-columns: 1fr !important;
            gap: 16px !important;
          }
        }
      `}</style>
    </div>
  );
}
