"use client";

import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { houseSpring } from "@/lib/design-tokens";
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
    text: "If the boys didn’t have a camera they would have blended into the rest of the session.",
    attr: "Josh, franchise operator",
  },
  strategy: {
    text: "As a small business owner, I find these strategies often too much to even start — so I appreciated that this was step-by-step.",
    attr: "Hayley, studio owner",
  },
  vibe: {
    text: "It showed what we are authentically. Our personalities were embedded.",
    attr: "Marco, Melbourne",
  },
};

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
    <blockquote
      style={{
        margin: 0,
        textAlign: align,
      }}
    >
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
        &mdash; {attr}
      </footer>
    </blockquote>
  );
}

export function LandingClient() {
  const [showForm, setShowForm] = useState(false);
  const formRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  function handleCtaClick() {
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
      className="landing-page"
      style={{
        minHeight: "100vh",
        background: "var(--neutral-900)",
        position: "relative",
      }}
    >
      <style>{`
        .landing-page { --lp-px: 40px; }
        .landing-hero-grid {
          display: grid;
          grid-template-columns: 1.1fr 1fr;
          gap: 80px;
          align-items: start;
        }
        .landing-what-grid {
          display: grid;
          grid-template-columns: 1fr 1.5fr;
          gap: 80px;
          align-items: start;
        }
        @media (max-width: 860px) {
          .landing-page { --lp-px: 20px; }
          .landing-hero-grid {
            grid-template-columns: 1fr;
            gap: 48px;
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
              {/* ---- Nav ---- */}
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

              {/* ---- Hero (two-column) ---- */}
              <section
                className="landing-hero-grid"
                style={{
                  maxWidth: 1200,
                  margin: "0 auto",
                  padding: "40px var(--lp-px) 100px",
                }}
              >
                {/* Left — editorial */}
                <div>
                  <div
                    style={{
                      fontFamily: "var(--font-label)",
                      fontSize: 10,
                      letterSpacing: "3px",
                      textTransform: "uppercase",
                      color: "var(--brand-pink)",
                      marginBottom: 24,
                    }}
                  >
                    A $297 trial shoot &middot; Melbourne &middot; we come to you
                  </div>
                  <h1
                    style={{
                      fontFamily: "var(--font-display)",
                      fontSize: "clamp(3rem, 7vw, 5.5rem)",
                      lineHeight: 0.95,
                      letterSpacing: "-2px",
                      color: "var(--brand-cream)",
                      margin: "0 0 32px",
                    }}
                  >
                    Find out if
                    <br />
                    we&rsquo;re right
                    <br />
                    for each other
                    <br />
                    <span
                      style={{
                        fontFamily: "var(--font-narrative)",
                        fontStyle: "italic",
                        color: "var(--brand-pink)",
                        fontWeight: 500,
                      }}
                    >
                      before either of us commits.
                    </span>
                  </h1>
                  <p
                    style={{
                      fontFamily: "var(--font-narrative)",
                      fontStyle: "italic",
                      fontSize: "clamp(1rem, 2vw, 1.375rem)",
                      lineHeight: 1.45,
                      color: "var(--neutral-300)",
                      maxWidth: 520,
                      marginBottom: 16,
                    }}
                  >
                    Sixty minutes on-site. Real deliverables you&rsquo;d
                    actually use.{" "}
                    <span style={{ color: "var(--brand-cream)" }}>
                      And a six-week marketing plan written for you
                    </span>{" "}
                    &mdash; one you can run yourself if you decide
                    we&rsquo;re not the right call.
                  </p>
                  <p
                    style={{
                      fontSize: 14,
                      fontStyle: "italic",
                      color: "var(--brand-pink)",
                      opacity: 0.8,
                    }}
                  >
                    no subscriptions to cancel. no upsell in the follow-up. we
                    don&rsquo;t do that.
                  </p>
                </div>

                {/* Right — price card */}
                <div
                  style={{
                    background: "rgba(34,34,31,0.6)",
                    backdropFilter: "blur(10px)",
                    border: "1px solid rgba(253,245,230,0.08)",
                    borderRadius: 20,
                    padding: "40px 36px",
                    display: "flex",
                    flexDirection: "column",
                    gap: 22,
                    position: "relative",
                    overflow: "hidden",
                  }}
                >
                  {/* Gradient overlay */}
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      background:
                        "linear-gradient(135deg, rgba(178,40,72,0.1), transparent 50%)",
                      borderRadius: 20,
                      pointerEvents: "none",
                    }}
                  />
                  <div style={{ position: "relative" }}>
                    <div
                      style={{
                        fontFamily: "var(--font-label)",
                        fontSize: 10,
                        letterSpacing: "2px",
                        textTransform: "uppercase",
                        color: "var(--brand-orange)",
                      }}
                    >
                      The whole thing
                    </div>
                    <div
                      style={{
                        fontFamily: "var(--font-display)",
                        fontSize: "clamp(3.5rem, 6vw, 4.5rem)",
                        lineHeight: 1,
                        letterSpacing: "-1px",
                        color: "var(--brand-cream)",
                        marginTop: 8,
                      }}
                    >
                      $297
                      <sup
                        style={{
                          fontFamily: "var(--font-body)",
                          fontSize: 16,
                          color: "var(--brand-pink)",
                          fontWeight: 400,
                          verticalAlign: "super",
                          marginLeft: 8,
                        }}
                      >
                        once. nothing recurring.
                      </sup>
                    </div>
                  </div>
                  <ul
                    style={{
                      listStyle: "none",
                      display: "flex",
                      flexDirection: "column",
                      gap: 12,
                      paddingTop: 12,
                      borderTop: "1px solid rgba(253,245,230,0.08)",
                      margin: 0,
                      padding: "12px 0 0",
                      position: "relative",
                    }}
                  >
                    {[
                      "A 60-minute on-site shoot at your place",
                      "Edited hero stills + one short-form video",
                      "A six-week marketing plan, written for you — yours to run with",
                      "Everything delivered inside your own private portal",
                      "Reschedule any time up to 48 hours before — life happens, we get it",
                    ].map((item) => (
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
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 8,
                      paddingTop: 8,
                      position: "relative",
                    }}
                  >
                    <button
                      type="button"
                      onClick={handleCtaClick}
                      className="landing-cta-btn"
                    >
                      Start &mdash; takes 90 seconds
                    </button>
                    <p
                      style={{
                        fontSize: 12,
                        color: "var(--neutral-500)",
                        fontStyle: "italic",
                        textAlign: "center",
                        margin: 0,
                      }}
                    >
                      we&rsquo;ll ask a few questions, then your contact details,
                      then you pay.
                    </p>
                  </div>
                </div>
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
                    &mdash; {QUOTES.pullquote.attr}
                  </footer>
                </blockquote>
              </section>

              {/* ---- Editorial explainer ---- */}
              <section
                className="landing-what-grid"
                style={{
                  maxWidth: 1200,
                  margin: "0 auto",
                  padding: "60px var(--lp-px) 100px",
                }}
              >
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
                    It&rsquo;s a small, paid piece of real work. An hour on-site,
                    we shoot, we edit, we deliver &mdash; inside a portal
                    that&rsquo;s yours to keep whether you come back or not.{" "}
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
                    A few days later, you&rsquo;ll get a six-week marketing plan
                    &mdash; written for your business, not a template.{" "}
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
                    About a third of the people who do a trial shoot end up on a
                    retainer. About a third take the plan and run it themselves.
                    About a third disappear entirely.{" "}
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
              </section>

              {/* ---- Scattered quote: process ---- */}
              <section
                style={{
                  padding: "0 var(--lp-px) 80px",
                  maxWidth: 700,
                  margin: "0 auto",
                }}
              >
                <PullQuote
                  text={QUOTES.experience.text}
                  attr={QUOTES.experience.attr}
                  align="center"
                />
              </section>

              {/* ---- Vertical range statement (typography-as-image) ---- */}
              <section
                style={{
                  padding: "80px var(--lp-px)",
                  maxWidth: 1200,
                  margin: "0 auto",
                  textAlign: "center",
                }}
              >
                <h2
                  style={{
                    fontFamily: "var(--font-display)",
                    fontSize: "clamp(2rem, 5vw, 4rem)",
                    lineHeight: 1.05,
                    letterSpacing: "-1.5px",
                    color: "var(--brand-cream)",
                    margin: 0,
                  }}
                >
                  Cafes. Tradies. Podcasters.
                  <br />
                  <span
                    style={{
                      fontFamily: "var(--font-narrative)",
                      fontStyle: "italic",
                      color: "var(--brand-pink)",
                      fontWeight: 500,
                    }}
                  >
                    A motorsport team running on vibes.
                  </span>
                </h2>
                <p
                  style={{
                    marginTop: 24,
                    fontFamily: "var(--font-body)",
                    fontSize: 18,
                    lineHeight: 1.6,
                    color: "var(--neutral-300)",
                  }}
                >
                  If it&rsquo;s a real business, we&rsquo;ll find the story.
                </p>
              </section>

              {/* ---- Six-week plan callout ---- */}
              <section
                style={{
                  padding: "0 var(--lp-px) 60px",
                  maxWidth: 700,
                  margin: "0 auto",
                }}
              >
                <div
                  style={{
                    fontFamily: "var(--font-label)",
                    fontSize: 10,
                    letterSpacing: "3px",
                    textTransform: "uppercase",
                    color: "var(--brand-orange)",
                    marginBottom: 20,
                    textAlign: "center",
                  }}
                >
                  The part nobody else does
                </div>
                <p
                  style={{
                    fontFamily: "var(--font-body)",
                    fontSize: 18,
                    lineHeight: 1.7,
                    color: "var(--neutral-300)",
                    textAlign: "center",
                    margin: 0,
                  }}
                >
                  You&rsquo;ll also get a six-week marketing plan. Not a
                  template. Written for your business, by someone who&rsquo;s
                  already done the research. Take it and run it yourself if you
                  want.{" "}
                  <em
                    style={{
                      fontFamily: "var(--font-narrative)",
                      color: "var(--brand-cream)",
                    }}
                  >
                    It&rsquo;s yours either way.
                  </em>
                </p>
              </section>

              {/* ---- Scattered quote: strategy ---- */}
              <section
                style={{
                  padding: "0 var(--lp-px) 100px",
                  maxWidth: 700,
                  margin: "0 auto",
                }}
              >
                <PullQuote
                  text={QUOTES.strategy.text}
                  attr={QUOTES.strategy.attr}
                  align="center"
                />
              </section>

              {/* ---- Final CTA ---- */}
              <section
                style={{
                  padding: "0 var(--lp-px) 100px",
                  maxWidth: 520,
                  margin: "0 auto",
                  textAlign: "center",
                }}
              >
                <div
                  style={{
                    background: "rgba(34,34,31,0.6)",
                    backdropFilter: "blur(10px)",
                    border: "1px solid rgba(253,245,230,0.08)",
                    borderRadius: 20,
                    padding: "40px 36px",
                    position: "relative",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      background:
                        "linear-gradient(135deg, rgba(178,40,72,0.08), transparent 50%)",
                      borderRadius: 20,
                      pointerEvents: "none",
                    }}
                  />
                  <div style={{ position: "relative" }}>
                    <p
                      style={{
                        fontFamily: "var(--font-display)",
                        fontSize: "clamp(2.5rem, 6vw, 3.5rem)",
                        lineHeight: 1,
                        color: "var(--brand-cream)",
                        margin: "0 0 8px",
                      }}
                    >
                      $297
                    </p>
                    <p
                      style={{
                        fontFamily: "var(--font-body)",
                        fontSize: 14,
                        color: "var(--neutral-300)",
                        margin: "0 0 24px",
                      }}
                    >
                      GST inclusive. That&rsquo;s the whole number.
                    </p>
                    <button
                      type="button"
                      onClick={handleCtaClick}
                      className="landing-cta-btn"
                    >
                      Book your shoot
                    </button>
                    <p
                      style={{
                        marginTop: 12,
                        fontSize: 12,
                        fontStyle: "italic",
                        color: "var(--neutral-500)",
                      }}
                    >
                      takes about two minutes. no obligation after that.
                    </p>
                  </div>
                </div>
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

        {/* Section 1 Form — slides in when CTA clicked */}
        <AnimatePresence>
          {showForm && (
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
              <Section1Form onSuccess={handleFormSuccess} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </main>
  );
}
