"use client";

import * as React from "react";
import { motion, useInView, useReducedMotion } from "framer-motion";
import { houseSpring } from "@/lib/design-tokens";

const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

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

interface TrialShootCtaProps {
  trialShootUrl: string;
  sessionToken?: string;
  onTierSelect?: (tierId: string) => void;
}

export function TrialShootCta({
  trialShootUrl,
  onTierSelect,
}: TrialShootCtaProps) {
  const ref = React.useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.2 });
  const reduced = useReducedMotion();

  function handleSelect(tierId: string) {
    if (onTierSelect) onTierSelect(tierId);
    const url = `${trialShootUrl}${trialShootUrl.includes("?") ? "&" : "?"}tier=${tierId}`;
    window.location.href = url;
  }

  return (
    <div
      ref={ref}
      style={{
        background: "var(--color-neutral-900, #1A1A18)",
        padding: "72px 24px 80px",
      }}
    >
      <div style={{ maxWidth: 900, margin: "0 auto", textAlign: "center" }}>
        <motion.div
          initial={reduced ? false : { opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, ease: EASE }}
        >
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
            Or let us handle it
          </span>
          <p
            style={{
              fontFamily: "var(--font-body)",
              fontSize: 16,
              lineHeight: 1.7,
              color: "var(--neutral-300)",
              maxWidth: 520,
              margin: "0 auto 36px",
            }}
          >
            We come to you, shoot, edit, and deliver. You keep everything
            whether you come back or not. Plus a six-week marketing plan
            written for your business, not a template.
          </p>
        </motion.div>

        <motion.div
          initial={reduced ? false : { opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.1, ease: EASE }}
          style={{ maxWidth: 640, margin: "0 auto" }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 20,
            }}
            className="trial-shoot-tier-grid"
          >
            {TIERS.map((tier) => (
              <TierCard
                key={tier.id}
                tier={tier}
                onSelect={() => handleSelect(tier.id)}
              />
            ))}
          </div>
          <p
            style={{
              fontSize: 13,
              color: "var(--neutral-500)",
              fontFamily: "var(--font-narrative)",
              fontStyle: "italic",
              textAlign: "center",
              marginTop: 24,
            }}
          >
            Both include the same six-week plan. The difference is what you
            walk away with from the shoot itself.
          </p>
        </motion.div>
      </div>

      <style>{`
        @media (max-width: 640px) {
          .trial-shoot-tier-grid {
            grid-template-columns: 1fr !important;
            gap: 16px !important;
          }
        }
      `}</style>
    </div>
  );
}
