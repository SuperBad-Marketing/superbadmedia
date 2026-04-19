"use client";

import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { houseSpring } from "@/lib/design-tokens";
import { Section1Form } from "./section-1-form";

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
      style={{
        minHeight: "100vh",
        background: "var(--neutral-900)",
        position: "relative",
      }}
    >
      {/* Atmosphere gradients */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 0,
          pointerEvents: "none",
          background: [
            "radial-gradient(ellipse 80% 50% at 50% 0%, rgba(242,140,82,0.18), transparent 60%)",
            "radial-gradient(ellipse 60% 60% at 100% 100%, rgba(178,40,72,0.15), transparent 60%)",
            "radial-gradient(ellipse 60% 60% at 0% 80%, rgba(244,160,176,0.10), transparent 60%)",
          ].join(","),
        }}
      />
      {/* Noise texture */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          pointerEvents: "none",
          zIndex: 1,
          opacity: 0.035,
          mixBlendMode: "overlay",
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><filter id='n'><feTurbulence baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>\")",
        }}
      />

      <div style={{ position: "relative", zIndex: 2 }}>
        <AnimatePresence mode="wait">
          {!showForm && (
            <motion.div
              key="hero"
              initial={{ opacity: 1 }}
              exit={{ opacity: 0, y: -20 }}
              transition={houseSpring}
            >
              {/* Block 1 — Understated opener */}
              <section
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  minHeight: "70vh",
                  padding: "96px 24px 64px",
                  textAlign: "center",
                }}
              >
                <h1
                  style={{
                    fontFamily: "var(--font-display)",
                    fontSize: "clamp(2.5rem, 6vw, 5.5rem)",
                    lineHeight: 0.95,
                    letterSpacing: "-1.5px",
                    color: "var(--brand-cream)",
                    margin: 0,
                    maxWidth: 780,
                  }}
                >
                  Most marketing looks like marketing.
                </h1>
                <p
                  style={{
                    marginTop: 24,
                    maxWidth: 540,
                    fontFamily: "var(--font-narrative)",
                    fontStyle: "italic",
                    fontSize: "clamp(1rem, 2vw, 1.375rem)",
                    lineHeight: 1.45,
                    color: "var(--neutral-300)",
                  }}
                >
                  We make the kind of content people actually stop for. Then we
                  build a strategy around it.
                </p>
              </section>

              {/* Block 2 — Delight moment */}
              <section style={{ padding: "0 24px 80px" }}>
                <div
                  style={{
                    maxWidth: 900,
                    margin: "0 auto",
                    borderRadius: 16,
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      aspectRatio: "16/9",
                      background: "var(--neutral-800)",
                      boxShadow:
                        "inset 0 1px 0 rgba(253,245,230,0.04)",
                    }}
                  />
                </div>
                <p
                  style={{
                    maxWidth: 900,
                    margin: "16px auto 0",
                    fontFamily: "var(--font-narrative)",
                    fontStyle: "italic",
                    fontSize: 15,
                    color: "var(--brand-pink)",
                  }}
                >
                  She didn&rsquo;t know we were rolling. That&rsquo;s sort of the
                  point.
                </p>
              </section>

              {/* Block 3 — Value drop */}
              <section
                style={{
                  maxWidth: 520,
                  margin: "0 auto",
                  padding: "0 24px 80px",
                }}
              >
                <div
                  style={{
                    borderRadius: 16,
                    border: "1px solid rgba(253,245,230,0.12)",
                    background: "rgba(34,34,31,0.7)",
                    backdropFilter: "blur(24px)",
                    boxShadow: "inset 0 1px 0 rgba(253,245,230,0.08), 0 2px 12px rgba(0,0,0,0.3)",
                    padding: "32px 36px",
                  }}
                >
                  <h2
                    style={{
                      fontFamily: "var(--font-label)",
                      fontSize: 10,
                      letterSpacing: "3px",
                      textTransform: "uppercase",
                      color: "var(--brand-pink)",
                      margin: "0 0 24px",
                      textAlign: "center",
                    }}
                  >
                    What you walk away with
                  </h2>
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 16,
                    }}
                  >
                    {[
                      "1 short-form video",
                      "10 edited photographs",
                      "A bespoke 6-week marketing plan",
                      "60 days of portal access",
                    ].map((item) => (
                      <p
                        key={item}
                        style={{
                          margin: 0,
                          fontFamily: "var(--font-body)",
                          fontSize: "clamp(1rem, 2vw, 1.125rem)",
                          color: "var(--brand-cream)",
                          paddingLeft: 16,
                          borderLeft: "2px solid rgba(178,40,72,0.5)",
                        }}
                      >
                        {item}
                      </p>
                    ))}
                  </div>
                </div>
                <p
                  style={{
                    marginTop: 20,
                    textAlign: "center",
                    fontFamily: "var(--font-narrative)",
                    fontStyle: "italic",
                    fontSize: 16,
                    lineHeight: 1.5,
                    color: "var(--neutral-300)",
                  }}
                >
                  That&rsquo;s what you walk away with. Whether you work with us
                  after or not.
                </p>
              </section>

              {/* Block 4 — What happens */}
              <section
                style={{
                  maxWidth: 600,
                  margin: "0 auto",
                  padding: "0 24px 80px",
                }}
              >
                <h2
                  style={{
                    fontFamily: "var(--font-label)",
                    fontSize: 10,
                    letterSpacing: "3px",
                    textTransform: "uppercase",
                    color: "var(--neutral-500)",
                    marginBottom: 32,
                  }}
                >
                  What happens
                </h2>
                <ol
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 20,
                    listStyle: "none",
                    padding: 0,
                    margin: 0,
                  }}
                >
                  {[
                    "You tell us about your business. Takes two minutes.",
                    "We do our homework — your competitors, your audience, your neighbourhood.",
                    "We come to you. Sixty minutes, on-site, no studio.",
                    "You go back to work. We handle the rest.",
                    "About a week later, everything lands in your portal — photos, video, and a six-week marketing plan, all at once.",
                  ].map((text, i) => (
                    <li
                      key={i}
                      style={{
                        fontFamily: "var(--font-body)",
                        fontSize: 16,
                        lineHeight: 1.6,
                        color: "var(--neutral-300)",
                      }}
                    >
                      <span
                        style={{
                          fontFamily: "var(--font-label)",
                          fontSize: 12,
                          color: "var(--brand-cream)",
                          marginRight: 12,
                        }}
                      >
                        {i + 1}.
                      </span>
                      {text}
                    </li>
                  ))}
                </ol>
              </section>

              {/* Block 5 — Recent work */}
              <section
                style={{
                  maxWidth: 900,
                  margin: "0 auto",
                  padding: "0 24px 80px",
                }}
              >
                <h2
                  style={{
                    fontFamily: "var(--font-label)",
                    fontSize: 10,
                    letterSpacing: "3px",
                    textTransform: "uppercase",
                    color: "var(--neutral-500)",
                    marginBottom: 32,
                  }}
                >
                  Recent work
                </h2>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                    gap: 24,
                  }}
                >
                  {[
                    "A mortgage broker who hates talking about mortgages. We found something better.",
                    "The café that leads with cold brew. We ran with it.",
                    "Three partners, one story. It took us twenty minutes to find it.",
                  ].map((caption, i) => (
                    <div key={i}>
                      <div
                        style={{
                          aspectRatio: "4/5",
                          borderRadius: 12,
                          background: "var(--neutral-800)",
                          boxShadow:
                            "inset 0 1px 0 rgba(253,245,230,0.04)",
                          border:
                            "1px solid rgba(253,245,230,0.06)",
                        }}
                      />
                      <p
                        style={{
                          marginTop: 12,
                          fontFamily: "var(--font-narrative)",
                          fontStyle: "italic",
                          fontSize: 14,
                          lineHeight: 1.5,
                          color: "var(--brand-pink)",
                        }}
                      >
                        {caption}
                      </p>
                    </div>
                  ))}
                </div>
              </section>

              {/* Block 6 — Quiet commitment */}
              <section
                style={{
                  maxWidth: 600,
                  margin: "0 auto",
                  padding: "0 24px 80px",
                  textAlign: "center",
                }}
              >
                <p
                  style={{
                    fontFamily: "var(--font-body)",
                    fontSize: 16,
                    lineHeight: 1.7,
                    color: "var(--neutral-300)",
                    margin: 0,
                  }}
                >
                  We take three shoots a week, max.
                </p>
                <p
                  style={{
                    fontFamily: "var(--font-body)",
                    fontSize: 16,
                    lineHeight: 1.7,
                    color: "var(--neutral-300)",
                    margin: "8px 0 0",
                  }}
                >
                  We ask for five business days&rsquo; notice — enough time to do
                  the research that makes your shoot worth showing up for.
                </p>
              </section>

              {/* Block 7 — Price */}
              <section
                style={{
                  maxWidth: 480,
                  margin: "0 auto",
                  padding: "0 24px 48px",
                  textAlign: "center",
                }}
              >
                <div
                  style={{
                    display: "inline-block",
                    padding: "32px 48px",
                    borderRadius: 16,
                    background: "rgba(34,34,31,0.6)",
                    backdropFilter: "blur(10px)",
                    border: "1px solid rgba(253,245,230,0.08)",
                    boxShadow:
                      "inset 0 1px 0 rgba(253,245,230,0.06)",
                  }}
                >
                  <p
                    style={{
                      fontFamily: "var(--font-display)",
                      fontSize: "clamp(3rem, 8vw, 4.5rem)",
                      lineHeight: 1,
                      color: "var(--brand-cream)",
                      margin: 0,
                    }}
                  >
                    <sup
                      style={{
                        fontFamily: "var(--font-body)",
                        fontSize: 16,
                        color: "var(--brand-pink)",
                        verticalAlign: "super",
                      }}
                    >
                      $
                    </sup>
                    297
                  </p>
                  <p
                    style={{
                      marginTop: 8,
                      fontFamily: "var(--font-body)",
                      fontSize: 14,
                      color: "var(--neutral-300)",
                    }}
                  >
                    GST inclusive. That&rsquo;s the whole number.
                  </p>
                </div>
              </section>

              {/* Block 8 — CTA */}
              <section
                style={{
                  maxWidth: 600,
                  margin: "0 auto",
                  padding: "0 24px 96px",
                  textAlign: "center",
                }}
              >
                <p
                  style={{
                    marginBottom: 16,
                    fontFamily: "var(--font-body)",
                    fontSize: 14,
                    color: "var(--neutral-500)",
                  }}
                >
                  Takes about two minutes. No obligation after that.
                </p>
                <button
                  type="button"
                  onClick={handleCtaClick}
                  style={{
                    fontFamily: "var(--font-label)",
                    fontSize: 12,
                    letterSpacing: "2px",
                    textTransform: "uppercase",
                    background: "var(--brand-red)",
                    color: "var(--brand-cream)",
                    border: "none",
                    borderRadius: 10,
                    padding: "16px 40px",
                    cursor: "pointer",
                    boxShadow:
                      "0 10px 30px rgba(178,40,72,0.3), inset 0 1px 0 rgba(253,245,230,0.1)",
                    transition:
                      "transform 280ms cubic-bezier(0.2,0.8,0.2,1.05), box-shadow 280ms cubic-bezier(0.2,0.8,0.2,1.05)",
                  }}
                  onMouseEnter={(e) => {
                    const el = e.currentTarget;
                    el.style.transform = "translateY(-2px)";
                    el.style.boxShadow =
                      "0 14px 40px rgba(178,40,72,0.45), inset 0 1px 0 rgba(253,245,230,0.15)";
                  }}
                  onMouseLeave={(e) => {
                    const el = e.currentTarget;
                    el.style.transform = "translateY(0)";
                    el.style.boxShadow =
                      "0 10px 30px rgba(178,40,72,0.3), inset 0 1px 0 rgba(253,245,230,0.1)";
                  }}
                >
                  Book your shoot
                </button>
              </section>
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

        {/* Block 9 — Footer */}
        <footer
          style={{
            padding: "0 24px 32px",
            textAlign: "center",
            fontFamily: "var(--font-body)",
            fontSize: 12,
            color: "var(--neutral-500)",
          }}
        >
          <p style={{ margin: 0 }}>© SuperBad Media Pty Ltd · Melbourne</p>
          <p style={{ margin: "4px 0 0" }}>
            <a
              href="/lite/legal/privacy"
              style={{
                color: "var(--neutral-500)",
                textDecoration: "underline",
                textUnderlineOffset: 2,
              }}
            >
              Privacy
            </a>
            {" · "}
            <a
              href="/lite/legal/terms"
              style={{
                color: "var(--neutral-500)",
                textDecoration: "underline",
                textUnderlineOffset: 2,
              }}
            >
              Terms
            </a>
          </p>
        </footer>
      </div>
    </main>
  );
}
