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

interface MirrorFact {
  label: string;
  observation: string;
  tone: "neutral" | "gentle";
}

function buildMirrorFacts(
  data: ViabilityProfile | null,
  businessName: string,
): MirrorFact[] {
  if (!data) return [];
  const facts: MirrorFact[] = [];

  if (data.instagram) {
    const { follower_count, posts_last_30d } = data.instagram;
    if (posts_last_30d !== null && posts_last_30d !== undefined && posts_last_30d === 0) {
      facts.push({
        label: "Instagram",
        observation: `${businessName} hasn't posted on Instagram in the last 30 days.`,
        tone: "gentle",
      });
    } else if (posts_last_30d !== null && posts_last_30d !== undefined && posts_last_30d <= 2) {
      facts.push({
        label: "Instagram",
        observation: `${posts_last_30d} Instagram ${posts_last_30d === 1 ? "post" : "posts"} in the last month.`,
        tone: "gentle",
      });
    } else if (follower_count < 500) {
      facts.push({
        label: "Instagram",
        observation: `${follower_count.toLocaleString()} followers. Still early days.`,
        tone: "neutral",
      });
    }
  }

  if (data.facebook) {
    if (data.facebook.has_active_page === false) {
      facts.push({
        label: "Facebook",
        observation: "No active Facebook page found.",
        tone: "gentle",
      });
    } else if (data.facebook.posts_last_30d !== null && data.facebook.posts_last_30d === 0) {
      facts.push({
        label: "Facebook",
        observation: "Facebook page exists but hasn't posted recently.",
        tone: "gentle",
      });
    }
  }

  if (data.maps) {
    const { review_count, rating } = data.maps;
    if (review_count < 10) {
      facts.push({
        label: "Google",
        observation: `${review_count} Google ${review_count === 1 ? "review" : "reviews"}. Most people check before they visit.`,
        tone: "gentle",
      });
    } else if (rating !== null && rating < 4.0) {
      facts.push({
        label: "Google",
        observation: `${rating} star average across ${review_count} reviews.`,
        tone: "neutral",
      });
    } else if (rating !== null) {
      facts.push({
        label: "Google",
        observation: `${rating} stars across ${review_count} reviews. That's solid.`,
        tone: "neutral",
      });
    }
  }

  if (data.website) {
    const { pagespeed_performance_score, has_about_page } = data.website;
    if (pagespeed_performance_score !== null && pagespeed_performance_score < 50) {
      facts.push({
        label: "Website",
        observation: `Performance score of ${pagespeed_performance_score}/100. That's costing you visitors.`,
        tone: "gentle",
      });
    }
    if (!has_about_page) {
      facts.push({
        label: "Website",
        observation: "No about page found. People want to know who they're buying from.",
        tone: "gentle",
      });
    }
  }

  if (data.youtube) {
    if (data.youtube.video_count === 0) {
      facts.push({
        label: "YouTube",
        observation: "No YouTube presence yet.",
        tone: "neutral",
      });
    }
  }

  if (data.tiktok) {
    if (data.tiktok.has_active_profile === false) {
      facts.push({
        label: "TikTok",
        observation: "No TikTok presence found.",
        tone: "neutral",
      });
    }
  }

  if (data.linkedin) {
    if (data.linkedin.has_active_page === false) {
      facts.push({
        label: "LinkedIn",
        observation: "No active LinkedIn company page.",
        tone: "neutral",
      });
    }
  }

  return facts.slice(0, 6);
}

const TIERS = [
  {
    id: "session" as const,
    name: "Session",
    price: 397,
    recommended: false,
    duration: "60–90 min on-site",
    deliverables: [
      "1 short-form video",
      "10–15 edited photographs",
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
    duration: "Up to 2 hours on-site",
    deliverables: [
      "2 short-form videos (1 × under 60s, 1 × under 30s)",
      "20–25 edited photographs",
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
        minWidth: 280,
        background: "rgba(34,34,31,0.6)",
        backdropFilter: "blur(10px)",
        border: tier.recommended
          ? "1px solid rgba(178,40,72,0.5)"
          : "1px solid rgba(253,245,230,0.08)",
        borderRadius: 20,
        padding: "40px 32px",
        display: "flex",
        flexDirection: "column",
        gap: 20,
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
              fontSize: 9,
              letterSpacing: "2px",
              textTransform: "uppercase",
              color: "var(--brand-red)",
              background: "rgba(178,40,72,0.15)",
              border: "1px solid rgba(178,40,72,0.3)",
              borderRadius: 6,
              padding: "4px 10px",
              display: "inline-block",
              marginBottom: 16,
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
            fontSize: "clamp(3rem, 5vw, 4rem)",
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
              fontSize: 14,
              color: "var(--brand-pink)",
              fontWeight: 400,
              verticalAlign: "super",
              marginLeft: 8,
            }}
          >
            once. nothing recurring.
          </sup>
        </div>
        <p
          style={{
            marginTop: 12,
            fontFamily: "var(--font-narrative)",
            fontStyle: "italic",
            fontSize: 15,
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
          gap: 12,
          borderTop: "1px solid rgba(253,245,230,0.08)",
          margin: 0,
          padding: "16px 0 0",
          position: "relative",
          flex: 1,
        }}
      >
        {tier.deliverables.map((item) => (
          <li
            key={item}
            style={{
              display: "flex",
              gap: 12,
              alignItems: "flex-start",
              fontSize: 15,
              lineHeight: 1.5,
              fontFamily: "var(--font-body)",
              color: "var(--neutral-300)",
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: "var(--brand-red)",
                marginTop: 10,
                flexShrink: 0,
              }}
            />
            {item}
          </li>
        ))}
      </ul>

      <div style={{ position: "relative", paddingTop: 8 }}>
        <button
          type="button"
          onClick={onSelect}
          style={{
            width: "100%",
            padding: 18,
            fontFamily: "var(--font-label)",
            fontSize: 12,
            letterSpacing: "2px",
            textTransform: "uppercase",
            background: "var(--brand-red)",
            color: "var(--brand-cream)",
            border: "none",
            borderRadius: 10,
            cursor: "pointer",
            transition: "all 200ms cubic-bezier(0.16, 1, 0.3, 1)",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "#8F1D3A";
            e.currentTarget.style.transform = "translateY(-1px)";
            e.currentTarget.style.boxShadow = "0 10px 30px rgba(178, 40, 72, 0.3)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "var(--brand-red)";
            e.currentTarget.style.transform = "translateY(0)";
            e.currentTarget.style.boxShadow = "none";
          }}
        >
          Choose {tier.name}
        </button>
      </div>
    </motion.div>
  );
}

export function RundownPostReveal({
  sessionToken,
  profileId,
  businessName,
  enrichmentData,
}: RundownPostRevealProps) {
  const mirrorFacts = React.useMemo(
    () => buildMirrorFacts(enrichmentData, businessName),
    [enrichmentData, businessName],
  );

  const hasMirror = mirrorFacts.length > 0;

  function handleTierSelect(tier: "session" | "production") {
    trackRundownCtaClick(sessionToken, tier).catch(() => {});
    window.location.href = `/trial-shoot?tier=${tier}&ref=rundown&sid=${sessionToken}`;
  }

  return (
    <div
      style={{
        width: "100%",
        maxWidth: 900,
        margin: "0 auto",
        padding: "0 24px 120px",
        display: "flex",
        flexDirection: "column",
        gap: 80,
      }}
    >
      {/* Divider from reveal */}
      <Reveal>
        <div
          style={{
            height: 1,
            background:
              "linear-gradient(to right, transparent, rgba(253, 245, 230, 0.12), transparent)",
          }}
        />
      </Reveal>

      {/* Mirror section, quiet enrichment facts */}
      {hasMirror && (
        <section
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 32,
          }}
        >
          <Reveal>
            <div style={{ textAlign: "center" }}>
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
            </div>
          </Reveal>

          <Reveal delay={0.1}>
            <p
              style={{
                fontFamily: "var(--font-narrative)",
                fontStyle: "italic",
                fontSize: "clamp(17px, 2vw, 20px)",
                lineHeight: 1.7,
                color: "var(--brand-cream)",
                opacity: 0.7,
                textAlign: "center",
                maxWidth: 560,
                margin: "0 auto",
              }}
            >
              Not a judgement. Just what we found.
            </p>
          </Reveal>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 16,
              maxWidth: 640,
              margin: "0 auto",
              width: "100%",
            }}
          >
            {mirrorFacts.map((fact, i) => (
              <Reveal key={`${fact.label}-${i}`} delay={0.15 + i * 0.08}>
                <div
                  style={{
                    display: "flex",
                    gap: 20,
                    alignItems: "flex-start",
                    padding: "20px 24px",
                    borderLeft:
                      fact.tone === "gentle"
                        ? "2px solid rgba(178, 40, 72, 0.35)"
                        : "2px solid rgba(253, 245, 230, 0.12)",
                  }}
                >
                  <span
                    style={{
                      fontFamily: "var(--font-label)",
                      fontSize: 9,
                      letterSpacing: "2px",
                      textTransform: "uppercase",
                      color:
                        fact.tone === "gentle"
                          ? "var(--brand-pink)"
                          : "var(--neutral-500)",
                      whiteSpace: "nowrap",
                      minWidth: 72,
                      paddingTop: 3,
                    }}
                  >
                    {fact.label}
                  </span>
                  <p
                    style={{
                      fontFamily: "var(--font-body)",
                      fontSize: 15,
                      lineHeight: 1.6,
                      color: "var(--neutral-300)",
                      margin: 0,
                    }}
                  >
                    {fact.observation}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </section>
      )}

      {/* Trial shoot CTA */}
      <section
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 32,
          alignItems: "center",
        }}
      >
        <Reveal>
          <div style={{ textAlign: "center", maxWidth: 600 }}>
            <span
              style={{
                fontFamily: "var(--font-label)",
                fontSize: 10,
                letterSpacing: "3px",
                textTransform: "uppercase",
                color: "var(--brand-orange)",
                display: "block",
                marginBottom: 20,
              }}
            >
              {hasMirror
                ? "If any of that landed"
                : "One more thing before you go"}
            </span>
            <h2
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "clamp(2rem, 5vw, 3rem)",
                lineHeight: 1,
                letterSpacing: "-1px",
                color: "var(--brand-cream)",
                margin: 0,
              }}
            >
              A trial shoot
              <span style={{ color: "var(--brand-red)" }}>.</span>
              <br />
              <span
                style={{
                  fontFamily: "var(--font-narrative)",
                  fontStyle: "italic",
                  color: "var(--brand-pink)",
                  fontWeight: 500,
                  fontSize: "clamp(1.25rem, 3vw, 1.75rem)",
                }}
              >
                real work, not a sales call.
              </span>
            </h2>
          </div>
        </Reveal>

        <Reveal delay={0.1}>
          <p
            style={{
              fontFamily: "var(--font-body)",
              fontSize: 17,
              lineHeight: 1.65,
              color: "var(--neutral-400)",
              maxWidth: 540,
              textAlign: "center",
              margin: 0,
            }}
          >
            We come to you, shoot, edit, and deliver, inside a portal
            that&rsquo;s yours to keep whether you come back or not. Plus a
            six-week marketing plan written for your business, not a template.
          </p>
        </Reveal>

        <Reveal delay={0.18}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 24,
              width: "100%",
              maxWidth: 700,
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
        </Reveal>

        <Reveal delay={0.25}>
          <p
            style={{
              fontSize: 13,
              color: "var(--neutral-500)",
              fontStyle: "italic",
              textAlign: "center",
              margin: 0,
            }}
          >
            Both include the same six-week plan. The difference is what you walk
            away with from the shoot itself.
          </p>
        </Reveal>
      </section>

      {/* Brand Pack download, placeholder until PDF generation is built */}
      <section
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 20,
          paddingTop: 40,
          borderTop: "1px solid rgba(253, 245, 230, 0.06)",
        }}
      >
        <Reveal>
          <div style={{ textAlign: "center" }}>
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
                lineHeight: 1.6,
                color: "var(--brand-cream)",
                opacity: 0.7,
                maxWidth: 440,
                margin: "0 auto",
              }}
            >
              A downloadable summary of your brand identity, colours,
              typography, content pillars, voice guide. Yours to keep.
            </p>
          </div>
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
              e.currentTarget.style.background = "rgba(253, 245, 230, 0.08)";
              e.currentTarget.style.borderColor = "rgba(253, 245, 230, 0.25)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "rgba(253, 245, 230, 0.04)";
              e.currentTarget.style.borderColor = "rgba(253, 245, 230, 0.15)";
            }}
          >
            Download Brand Pack →
          </button>
        </Reveal>
      </section>

      {/* Footer */}
      <footer
        style={{
          textAlign: "center",
          paddingTop: 60,
          borderTop: "1px solid rgba(253, 245, 230, 0.06)",
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
          .rundown-tier-grid {
            grid-template-columns: 1fr !important;
            gap: 20px !important;
          }
        }
      `}</style>
    </div>
  );
}
