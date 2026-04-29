"use client";

import { useState, useRef } from "react";
import { motion, AnimatePresence, useInView, useReducedMotion } from "framer-motion";
import { useRouter } from "next/navigation";
import { houseSpring } from "@/lib/design-tokens";
import type { TrialShootTier } from "@/lib/db/schema/intro-funnel-submissions";
import { Section1Form } from "./section-1-form";

const QUOTES = {
  pullquote: {
    text: "The content itself is exactly what I wanted but would have struggled to physically come up with.",
    attr: "Melissa, founder",
  },
  process: {
    text: "There was no extra fluff, just down-to-earth and honest.",
    attr: "Eleni, Melbourne",
  },
  experience: {
    text: "If the boys didn't have a camera they would have blended into the rest of the session.",
    attr: "Josh, franchise operator",
  },
  strategy: {
    text: "As a small business owner, I find these strategies often too much to even start, so I appreciated that this was step-by-step.",
    attr: "Hayley, studio owner",
  },
  vibe: {
    text: "It showed what we are authentically. Our personalities were embedded.",
    attr: "Marco, Melbourne",
  },
};

interface TierDef {
  id: TrialShootTier;
  name: string;
  price: number;
  recommended: boolean;
  duration: string;
  deliverables: string[];
}

const TIERS: TierDef[] = [
  {
    id: "session",
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
    id: "production",
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

function PullQuote({
  text,
  attr,
  align = "center",
}: {
  text: string;
  attr: string;
  align?: "center" | "left";
}) {
  return (
    <blockquote style={{ margin: 0, textAlign: align }}>
      <p
        style={{
          fontFamily: "var(--font-narrative)",
          fontStyle: "italic",
          fontSize: "clamp(1.125rem, 2.5vw, 1.375rem)",
          lineHeight: 1.5,
          color: "var(--brand-cream)",
          margin: 0,
        }}
      >
        &ldquo;{text}&rdquo;
      </p>
      <footer
        style={{
          marginTop: 16,
          fontFamily: "var(--font-label)",
          fontSize: 10,
          letterSpacing: "2px",
          textTransform: "uppercase",
          color: "var(--brand-pink)",
        }}
      >
        {attr}
      </footer>
    </blockquote>
  );
}

function TierCard({
  tier,
  onSelect,
}: {
  tier: TierDef;
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
          className="landing-cta-btn"
        >
          Choose {tier.name}
        </button>
      </div>
    </motion.div>
  );
}

const EASE = [0.22, 1, 0.36, 1] as const;

function Reveal({
  children,
  delay = 0,
}: {
  children: React.ReactNode;
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
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

export function LandingClient() {
  const [selectedTier, setSelectedTier] = useState<TrialShootTier | null>(null);
  const [showForm, setShowForm] = useState(false);
  const formRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const reduced = useReducedMotion();

  function handleTierSelect(tier: TrialShootTier) {
    setSelectedTier(tier);
    setShowForm(true);
    setTimeout(() => {
      formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
  }

  function handleFormSuccess(token: string) {
    router.push(`/lite/intro/${token}`);
  }

  return (
    <main
      className="landing-page snap-y snap-proximity overflow-y-scroll"
      style={{
        height: "100dvh",
        background: "var(--neutral-900)",
        position: "relative",
      }}
    >
      <style>{`
        .landing-page { --lp-px: 40px; }
        .landing-tier-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 24px;
          align-items: stretch;
        }
        .landing-what-grid {
          display: grid;
          grid-template-columns: 1fr 1.5fr;
          gap: 80px;
          align-items: start;
        }
        @media (max-width: 860px) {
          .landing-page { --lp-px: 20px; }
          .landing-tier-grid {
            grid-template-columns: 1fr;
            gap: 20px;
          }
          .landing-what-grid {
            grid-template-columns: 1fr;
            gap: 32px;
          }
        }
        .landing-cta-btn {
          width: 100%;
          padding: 18px;
          font-family: var(--font-label);
          font-size: 12px;
          letter-spacing: 2px;
          text-transform: uppercase;
          background: var(--brand-red);
          color: var(--brand-cream);
          border: none;
          border-radius: 10px;
          cursor: pointer;
          transition: all 200ms cubic-bezier(0.16, 1, 0.3, 1);
        }
        .landing-cta-btn:hover {
          background: #8F1D3A;
          transform: translateY(-1px);
          box-shadow: 0 10px 30px rgba(178, 40, 72, 0.3);
        }
      `}</style>

      {/* Atmosphere */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 0,
          pointerEvents: "none",
          background: [
            "radial-gradient(ellipse 70% 40% at 80% 10%, rgba(242,140,82,0.12), transparent 60%)",
            "radial-gradient(ellipse 50% 40% at 10% 60%, rgba(178,40,72,0.08), transparent 60%)",
          ].join(","),
        }}
      />
      {/* Noise */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          pointerEvents: "none",
          zIndex: 1,
          opacity: 0.04,
          mixBlendMode: "overlay",
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><filter id='n'><feTurbulence baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>\")",
        }}
      />

      <div style={{ position: "relative", zIndex: 2 }}>
        <AnimatePresence mode="wait">
          {!showForm && (
            <motion.div
              key="landing"
              initial={{ opacity: 1 }}
              exit={{ opacity: 0, y: -20 }}
              transition={houseSpring}
            >
              {/* ---- Hero (full viewport) ---- */}
              <section
                className="flex h-dvh snap-start flex-col overflow-hidden"
                style={{ position: "relative" }}
              >
                <nav
                  style={{
                    padding: "24px var(--lp-px)",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <span
                    style={{
                      fontFamily: "var(--font-logo)",
                      fontSize: 26,
                      color: "var(--brand-cream)",
                    }}
                  >
                    SuperBad
                  </span>
                </nav>

                <div
                  className="flex flex-1 flex-col items-center justify-center"
                  style={{ paddingBottom: "8vh" }}
                >
                  <div
                    style={{
                      maxWidth: 900,
                      padding: "0 var(--lp-px)",
                      textAlign: "center",
                    }}
                  >
                    <motion.div
                      initial={reduced ? false : { opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.5, ease: EASE }}
                      style={{
                        fontFamily: "var(--font-label)",
                        fontSize: 10,
                        letterSpacing: "3px",
                        textTransform: "uppercase",
                        color: "var(--brand-pink)",
                        marginBottom: 24,
                      }}
                    >
                      Trial shoots &middot; Melbourne &middot; we come to you
                    </motion.div>
                    <h1
                      style={{
                        fontFamily: "var(--font-display)",
                        fontSize: "clamp(3rem, 7vw, 5.5rem)",
                        lineHeight: 0.95,
                        letterSpacing: "-2px",
                        color: "var(--brand-cream)",
                        margin: 0,
                      }}
                    >
                      {["Find", "out", "if"].map((word, i) => (
                        <motion.span
                          key={`l1-${i}`}
                          style={{ display: "inline-block", marginRight: "0.3em" }}
                          initial={reduced ? false : { opacity: 0, y: 30, filter: "blur(6px)" }}
                          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                          transition={{ duration: 0.5, delay: 0.3 + i * 0.07, ease: EASE }}
                        >
                          {word}
                        </motion.span>
                      ))}
                      <br />
                      {["we’re", "right"].map((word, i) => (
                        <motion.span
                          key={`l2-${i}`}
                          style={{ display: "inline-block", marginRight: "0.3em" }}
                          initial={reduced ? false : { opacity: 0, y: 30, filter: "blur(6px)" }}
                          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                          transition={{ duration: 0.5, delay: 0.3 + (3 + i) * 0.07, ease: EASE }}
                        >
                          {word}
                        </motion.span>
                      ))}
                      <br />
                      {["for", "each", "other"].map((word, i) => (
                        <motion.span
                          key={`l3-${i}`}
                          style={{ display: "inline-block", marginRight: "0.3em" }}
                          initial={reduced ? false : { opacity: 0, y: 30, filter: "blur(6px)" }}
                          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                          transition={{ duration: 0.5, delay: 0.3 + (5 + i) * 0.07, ease: EASE }}
                        >
                          {word}
                        </motion.span>
                      ))}
                      <br />
                      <motion.span
                        style={{
                          display: "inline-block",
                          fontFamily: "var(--font-narrative)",
                          fontStyle: "italic",
                          color: "var(--brand-pink)",
                          fontWeight: 500,
                        }}
                        initial={reduced ? false : { opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6, delay: 0.3 + 8 * 0.07 + 0.1, ease: EASE }}
                      >
                        before either of us commits.
                      </motion.span>
                    </h1>
                  </div>
                </div>
              </section>

              {/* ---- Subtitle + intro ---- */}
              <section
                className="snap-start"
                style={{
                  maxWidth: 900,
                  margin: "0 auto",
                  padding: "60px var(--lp-px) 20px",
                  textAlign: "center",
                }}
              >
                <Reveal>
                  <p
                    style={{
                      fontFamily: "var(--font-narrative)",
                      fontStyle: "italic",
                      fontSize: "clamp(1rem, 2vw, 1.375rem)",
                      lineHeight: 1.45,
                      color: "var(--neutral-300)",
                      maxWidth: 600,
                      margin: "0 auto 12px",
                    }}
                  >
                    A small, paid piece of real work.{" "}
                    <span style={{ color: "var(--brand-cream)" }}>
                      Real deliverables, a six-week marketing plan,
                      and 60 days of portal access
                    </span>{" "}
                    , yours to keep whether you come back or not.
                  </p>
                </Reveal>
              </section>

              {/* ---- Tier cards (side by side) ---- */}
              <section
                style={{
                  maxWidth: 900,
                  margin: "0 auto",
                  padding: "0 var(--lp-px) 100px",
                }}
              >
                <Reveal>
                  <div className="landing-tier-grid">
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
                      marginTop: 16,
                      textAlign: "center",
                      fontSize: 13,
                      color: "var(--neutral-500)",
                      fontStyle: "italic",
                    }}
                  >
                    Both include the same six-week plan. The difference is what
                    you walk away with from the shoot itself.
                  </p>
                </Reveal>
              </section>

              {/* ---- Pullquote ---- */}
              <section
                style={{
                  padding: "80px var(--lp-px)",
                  maxWidth: 900,
                  margin: "0 auto",
                  textAlign: "center",
                }}
              >
                <Reveal>
                  <blockquote style={{ margin: 0 }}>
                    <p
                      style={{
                        fontFamily: "var(--font-narrative)",
                        fontStyle: "italic",
                        fontSize: "clamp(1.5rem, 3.5vw, 2.25rem)",
                        lineHeight: 1.3,
                        color: "var(--brand-cream)",
                        letterSpacing: "-0.3px",
                        margin: 0,
                      }}
                    >
                      &ldquo;{QUOTES.pullquote.text}&rdquo;
                    </p>
                    <footer
                      style={{
                        marginTop: 24,
                        fontFamily: "var(--font-label)",
                        fontSize: 11,
                        letterSpacing: "2px",
                        textTransform: "uppercase",
                        color: "var(--brand-pink)",
                      }}
                    >
                      {QUOTES.pullquote.attr}
                    </footer>
                  </blockquote>
                </Reveal>
              </section>

              {/* ---- How it works ---- */}
              <section
                className="snap-start"
                style={{
                  maxWidth: 900,
                  margin: "0 auto",
                  padding: "80px var(--lp-px) 100px",
                }}
              >
                <Reveal>
                  <div
                    style={{
                      fontFamily: "var(--font-label)",
                      fontSize: 10,
                      letterSpacing: "3px",
                      textTransform: "uppercase",
                      color: "var(--brand-orange)",
                      marginBottom: 32,
                      textAlign: "center",
                    }}
                  >
                    How it works
                  </div>
                </Reveal>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                    gap: 32,
                  }}
                >
                  {[
                    {
                      step: "01",
                      title: "You book",
                      body: "Pick a tier, fill in the basics. Takes about two minutes. We’ll confirm a date that works.",
                    },
                    {
                      step: "02",
                      title: "We come to you",
                      body: "On-site at your business. We shoot, you do your thing. No posing, no scripts, no awkward directing.",
                    },
                    {
                      step: "03",
                      title: "Everything lands in your portal",
                      body: "Edited content, your six-week marketing plan, and 60 days of access. Yours to keep either way.",
                    },
                  ].map((item, i) => (
                    <Reveal key={item.step} delay={i * 0.1}>
                      <div
                        style={{
                          padding: "28px 24px",
                          borderTop: "1px solid rgba(253,245,230,0.08)",
                        }}
                      >
                        <div
                          style={{
                            fontFamily: "var(--font-display)",
                            fontSize: 32,
                            lineHeight: 1,
                            color: "var(--brand-red)",
                            marginBottom: 12,
                          }}
                        >
                          {item.step}
                        </div>
                        <p
                          style={{
                            fontFamily: "var(--font-display)",
                            fontSize: 20,
                            lineHeight: 1.2,
                            color: "var(--brand-cream)",
                            margin: "0 0 10px",
                          }}
                        >
                          {item.title}
                        </p>
                        <p
                          style={{
                            fontFamily: "var(--font-body)",
                            fontSize: 15,
                            lineHeight: 1.6,
                            color: "var(--neutral-400)",
                            margin: 0,
                          }}
                        >
                          {item.body}
                        </p>
                      </div>
                    </Reveal>
                  ))}
                </div>
              </section>

              {/* ---- Editorial explainer ---- */}
              <section
                className="landing-what-grid snap-start"
                style={{
                  maxWidth: 1200,
                  margin: "0 auto",
                  padding: "60px var(--lp-px) 100px",
                }}
              >
                <Reveal>
                  <div>
                    <div
                      style={{
                        fontFamily: "var(--font-label)",
                        fontSize: 10,
                        letterSpacing: "3px",
                        textTransform: "uppercase",
                        color: "var(--brand-orange)",
                        marginBottom: 16,
                      }}
                    >
                      What a trial shoot actually is
                    </div>
                    <h2
                      style={{
                        fontFamily: "var(--font-display)",
                        fontSize: "clamp(2.5rem, 5vw, 3.5rem)",
                        lineHeight: 1,
                        letterSpacing: "-1px",
                        color: "var(--brand-cream)",
                        margin: 0,
                      }}
                    >
                      Not a sales call.
                      <br />
                      <span
                        style={{
                          fontFamily: "var(--font-narrative)",
                          fontStyle: "italic",
                          color: "var(--brand-pink)",
                          fontWeight: 500,
                        }}
                      >
                        Not a free sample.
                      </span>
                    </h2>
                  </div>
                </Reveal>
                <Reveal delay={0.15}>
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 24,
                    }}
                  >
                    <p
                      style={{
                        fontSize: 18,
                        lineHeight: 1.65,
                        fontFamily: "var(--font-body)",
                        color: "var(--neutral-300)",
                        margin: 0,
                      }}
                    >
                      We come to you, we shoot, we edit, we deliver ,
                      inside a portal that&rsquo;s yours to keep whether you
                      come back or not.{" "}
                      <em
                        style={{
                          fontFamily: "var(--font-narrative)",
                          color: "var(--brand-cream)",
                        }}
                      >
                        The brief is deliberately narrow
                      </em>{" "}
                      so we can&rsquo;t fake it with volume.
                    </p>
                    <p
                      style={{
                        fontSize: 18,
                        lineHeight: 1.65,
                        fontFamily: "var(--font-body)",
                        color: "var(--neutral-300)",
                        margin: 0,
                      }}
                    >
                      A few days later, you&rsquo;ll get a six-week marketing
                      plan , written for your business, not a template.{" "}
                      <em
                        style={{
                          fontFamily: "var(--font-narrative)",
                          color: "var(--brand-cream)",
                        }}
                      >
                        It&rsquo;s a step-by-step plan we&rsquo;d happily run
                        ourselves.
                      </em>{" "}
                      If you&rsquo;d rather take it and run it in-house,
                      you&rsquo;re welcome to. It&rsquo;s yours either way.
                    </p>
                    <p
                      style={{
                        fontSize: 18,
                        lineHeight: 1.65,
                        fontFamily: "var(--font-body)",
                        color: "var(--neutral-300)",
                        margin: 0,
                      }}
                    >
                      About a third of the people who do a trial shoot end up on
                      a retainer. About a third take the plan and run it
                      themselves. About a third disappear entirely.{" "}
                      <em
                        style={{
                          fontFamily: "var(--font-narrative)",
                          color: "var(--brand-cream)",
                        }}
                      >
                        All three are fine.
                      </em>
                    </p>
                  </div>
                </Reveal>
              </section>

              {/* ---- Scattered quote ---- */}
              <section
                style={{
                  padding: "0 var(--lp-px) 80px",
                  maxWidth: 700,
                  margin: "0 auto",
                }}
              >
                <Reveal>
                  <PullQuote
                    text={QUOTES.experience.text}
                    attr={QUOTES.experience.attr}
                    align="center"
                  />
                </Reveal>
              </section>

              {/* ---- You don't need to... (objection handler) ---- */}
              <section
                className="snap-start"
                style={{
                  maxWidth: 700,
                  margin: "0 auto",
                  padding: "80px var(--lp-px)",
                  textAlign: "center",
                }}
              >
                <Reveal>
                  <div
                    style={{
                      fontFamily: "var(--font-label)",
                      fontSize: 10,
                      letterSpacing: "3px",
                      textTransform: "uppercase",
                      color: "var(--brand-orange)",
                      marginBottom: 32,
                    }}
                  >
                    Before you ask
                  </div>
                </Reveal>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 20,
                    textAlign: "left",
                  }}
                >
                  {[
                    {
                      q: "Do I need to prepare anything?",
                      a: "No. We handle the brief, the shot list, the direction. You just need to be there and do what you normally do.",
                    },
                    {
                      q: "What if I’m awkward on camera?",
                      a: "Most people are. We don’t pose you or hand you a script. We shoot you working, talking, existing, and edit it so it looks like you knew what you were doing the whole time.",
                    },
                    {
                      q: "What if I don’t know what I need?",
                      a: "That’s the point of the six-week plan. We figure that out for you, based on your business, your audience, and what’s actually going to move the needle.",
                    },
                    {
                      q: "Is there a sales pitch at the end?",
                      a: "No. About a third of people end up on a retainer. About a third take the plan and run it themselves. About a third disappear entirely. All three are fine.",
                    },
                  ].map((item, i) => (
                    <Reveal key={i} delay={i * 0.08}>
                      <div
                        style={{
                          padding: "20px 24px",
                          borderLeft: "2px solid rgba(178,40,72,0.3)",
                        }}
                      >
                        <p
                          style={{
                            fontFamily: "var(--font-body)",
                            fontSize: 16,
                            fontWeight: 500,
                            color: "var(--brand-cream)",
                            margin: "0 0 8px",
                          }}
                        >
                          {item.q}
                        </p>
                        <p
                          style={{
                            fontFamily: "var(--font-body)",
                            fontSize: 15,
                            lineHeight: 1.6,
                            color: "var(--neutral-400)",
                            margin: 0,
                          }}
                        >
                          {item.a}
                        </p>
                      </div>
                    </Reveal>
                  ))}
                </div>
              </section>

              {/* ---- Scattered quote: strategy ---- */}
              <section
                style={{
                  padding: "0 var(--lp-px) 100px",
                  maxWidth: 700,
                  margin: "0 auto",
                }}
              >
                <Reveal>
                  <PullQuote
                    text={QUOTES.strategy.text}
                    attr={QUOTES.strategy.attr}
                    align="center"
                  />
                </Reveal>
              </section>

              {/* ---- Final CTA ---- */}
              <section
                className="snap-start"
                style={{
                  padding: "80px var(--lp-px) 100px",
                  maxWidth: 900,
                  margin: "0 auto",
                }}
              >
                <Reveal>
                  <h2
                    style={{
                      fontFamily: "var(--font-display)",
                      fontSize: "clamp(2.5rem, 6vw, 4.5rem)",
                      lineHeight: 0.95,
                      letterSpacing: "-1px",
                      color: "var(--brand-cream)",
                      margin: 0,
                    }}
                  >
                    Two minutes.
                    <br />
                    No obligation
                    <span style={{ color: "var(--brand-red)" }}>.</span>
                  </h2>
                </Reveal>
                <Reveal delay={0.1}>
                  <p
                    style={{
                      fontFamily: "var(--font-body)",
                      fontSize: 18,
                      lineHeight: 1.6,
                      color: "var(--neutral-400)",
                      margin: "24px 0 0",
                      maxWidth: "44ch",
                    }}
                  >
                    Pick a tier. Fill in the basics. We&rsquo;ll be in touch to
                    lock in a date.
                  </p>
                </Reveal>
                <Reveal delay={0.18}>
                  <div
                    className="flex flex-col gap-4 sm:flex-row sm:gap-5"
                    style={{ marginTop: 36 }}
                  >
                    <button
                      type="button"
                      onClick={() => handleTierSelect("session")}
                      style={{
                        padding: "16px 28px",
                        fontFamily: "var(--font-label)",
                        fontSize: 12,
                        letterSpacing: "2px",
                        textTransform: "uppercase",
                        background: "var(--brand-cream)",
                        color: "var(--neutral-900)",
                        border: "none",
                        cursor: "pointer",
                        transition: "opacity 0.2s",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.opacity = "0.85";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.opacity = "1";
                      }}
                    >
                      Session · $397
                    </button>
                    <button
                      type="button"
                      onClick={() => handleTierSelect("production")}
                      style={{
                        padding: "16px 28px",
                        fontFamily: "var(--font-label)",
                        fontSize: 12,
                        letterSpacing: "2px",
                        textTransform: "uppercase",
                        background: "var(--brand-red)",
                        color: "var(--brand-cream)",
                        border: "none",
                        cursor: "pointer",
                        transition: "opacity 0.2s",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.opacity = "0.85";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.opacity = "1";
                      }}
                    >
                      Production · $597
                    </button>
                  </div>
                </Reveal>
              </section>

              {/* ---- Footer ---- */}
              <footer
                style={{
                  padding: "80px var(--lp-px) 40px",
                  textAlign: "center",
                  borderTop: "1px solid rgba(253,245,230,0.06)",
                }}
              >
                <div
                  style={{
                    fontFamily: "var(--font-logo)",
                    fontSize: 28,
                    color: "var(--brand-cream)",
                    marginBottom: 16,
                  }}
                >
                  SuperBad
                </div>
                <p
                  style={{
                    fontFamily: "var(--font-narrative)",
                    fontStyle: "italic",
                    color: "var(--brand-pink)",
                    fontSize: 15,
                    maxWidth: 500,
                    margin: "0 auto 24px",
                  }}
                >
                  Marketing for people who&rsquo;d rather be doing something
                  else. Melbourne, Australia.
                </p>
                <div
                  style={{
                    fontSize: 12,
                    color: "var(--neutral-500)",
                    display: "flex",
                    justifyContent: "center",
                    gap: 24,
                  }}
                >
                  <a
                    href="/lite/legal/privacy"
                    style={{
                      color: "var(--neutral-500)",
                      textDecoration: "none",
                    }}
                  >
                    Privacy
                  </a>
                  <span>&middot;</span>
                  <a
                    href="/lite/legal/terms"
                    style={{
                      color: "var(--neutral-500)",
                      textDecoration: "none",
                    }}
                  >
                    Terms
                  </a>
                  <span>&middot;</span>
                  <span>&copy; 2026 SuperBad Media</span>
                </div>
              </footer>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Section 1 Form, slides in when tier CTA clicked */}
        <AnimatePresence>
          {showForm && selectedTier && (
            <motion.div
              key="form"
              ref={formRef}
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={houseSpring}
              style={{
                maxWidth: 520,
                margin: "0 auto",
                padding: "96px 24px",
              }}
            >
              <Section1Form
                selectedTier={selectedTier}
                onSuccess={handleFormSuccess}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </main>
  );
}
