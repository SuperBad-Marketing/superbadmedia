"use client";

import { useRef, useState, useEffect } from "react";
import { motion, useInView, useReducedMotion, AnimatePresence } from "framer-motion";
import { NewsletterSignup } from "@/components/newsletter-signup";

const EASE = [0.22, 1, 0.36, 1] as const;

/* ── Screen — reusable snap section ── */
function Screen({
  children,
  align = "left",
  surface = 0,
  id,
}: {
  children: React.ReactNode;
  align?: "left" | "center";
  surface?: 0 | 1 | "brand";
  id?: string;
}) {
  const bg =
    surface === "brand"
      ? "var(--brand-red)"
      : surface === 1
        ? "var(--surface-1)"
        : "var(--neutral-900)";

  return (
    <section
      id={id}
      className="relative flex h-dvh snap-start flex-col justify-center overflow-hidden"
      style={{ backgroundColor: bg, paddingBottom: "8vh" }}
    >
      <div
        className={`w-full px-8 sm:px-16 md:px-24 ${
          align === "center" ? "text-center mx-auto" : ""
        }`}
        style={{
          maxWidth: align === "center" ? "64ch" : undefined,
        }}
      >
        {children}
      </div>
    </section>
  );
}

/* ── Statement — spring entrance ── */
function Statement({
  children,
  delay = 0,
}: {
  children: React.ReactNode;
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.4 });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 40 }}
      animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 40 }}
      transition={{
        delay,
        type: "spring",
        damping: 18,
        stiffness: 80,
      }}
    >
      {children}
    </motion.div>
  );
}

/* ── Cycling preview — rotates through example topics ── */

const PREVIEW_TOPICS = [
  {
    subject: "Why your content looks expensive but sells cheap",
    preview: "The production quality trap nobody talks about — and the one metric that actually predicts whether content converts.",
  },
  {
    subject: "The algorithm doesn't care about your posting schedule",
    preview: "Every guru says post 3x/week. Here's what the data actually shows about frequency vs. quality.",
  },
  {
    subject: "Stop building audiences. Start building leverage",
    preview: "10,000 followers who don't buy vs. 200 who do. The math that changes how you think about reach.",
  },
  {
    subject: "Your brand isn't boring. Your marketing is just lying",
    preview: "Most businesses are genuinely interesting. Then they hire an agency that sands off every edge.",
  },
];

const PREVIEW_DURATION = 5000;

function PreviewCycle({ inView }: { inView: boolean }) {
  const reduced = useReducedMotion();
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (!inView || reduced) return;
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % PREVIEW_TOPICS.length);
    }, PREVIEW_DURATION);
    return () => clearInterval(id);
  }, [inView, reduced]);

  const topic = PREVIEW_TOPICS[index];

  return (
    <div
      style={{
        maxWidth: 480,
        margin: "0 auto",
        minHeight: 160,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
      }}
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={index}
          initial={reduced ? false : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ duration: 0.4, ease: EASE }}
        >
          <div
            style={{
              backgroundColor: "rgba(253, 245, 230, 0.03)",
              border: "1px solid rgba(253, 245, 230, 0.06)",
              borderRadius: 8,
              padding: "clamp(20px, 3vw, 28px)",
              textAlign: "left",
            }}
          >
            <p
              style={{
                fontFamily: "var(--font-label)",
                fontSize: 10,
                letterSpacing: "0.2em",
                textTransform: "uppercase",
                color: "var(--neutral-600)",
                margin: 0,
              }}
            >
              Subject
            </p>
            <p
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "clamp(16px, 2vw, 20px)",
                lineHeight: 1.2,
                color: "var(--neutral-100)",
                margin: "8px 0 0",
              }}
            >
              {topic.subject}
            </p>
            <p
              style={{
                fontFamily: "var(--font-body)",
                fontSize: "clamp(13px, 1.6vw, 15px)",
                lineHeight: 1.5,
                color: "var(--neutral-400)",
                margin: "12px 0 0",
              }}
            >
              {topic.preview}
            </p>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Progress dots */}
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          gap: 6,
          marginTop: 16,
        }}
      >
        {PREVIEW_TOPICS.map((_, i) => (
          <div
            key={i}
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              backgroundColor:
                i === index ? "var(--brand-red)" : "var(--neutral-700)",
              transition: "background-color 0.3s",
            }}
          />
        ))}
      </div>
    </div>
  );
}

/* ── What you won't get — anti-promise list ── */

const ANTI_PROMISES = [
  "No listicles",
  "No \"10 tips to grow your business\"",
  "No growth-hacking tricks",
  "No sequences or drip campaigns",
  "No sponsored content",
  "No selling your data",
];

/* ════════════════════════════════════════════════════════════════════ */
/* PAGE COMPOSITION                                                   */
/* ════════════════════════════════════════════════════════════════════ */

export function NewsletterClient() {
  const reduced = useReducedMotion();
  const previewRef = useRef<HTMLDivElement>(null);
  const previewInView = useInView(previewRef, { once: true, amount: 0.3 });

  const antiRef = useRef<HTMLDivElement>(null);
  const antiInView = useInView(antiRef, { once: true, amount: 0.3 });

  const revealWords = (text: string, inView: boolean, delayOffset = 0, stagger = 0.07) =>
    text.split(" ").map((word, i) => (
      <motion.span
        key={`${delayOffset}-${i}`}
        style={{ display: "inline-block", marginRight: "0.3em" }}
        initial={reduced ? false : { opacity: 0, y: 30, filter: "blur(6px)" }}
        animate={inView ? { opacity: 1, y: 0, filter: "blur(0px)" } : {}}
        transition={{ duration: 0.5, delay: delayOffset + i * stagger, ease: EASE }}
      >
        {word}
      </motion.span>
    ));

  return (
    <main className="relative h-dvh overflow-hidden">
      {/* ── Ambient background ── */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <motion.div
          aria-hidden
          className="absolute inset-0"
          style={{
            background: [
              "radial-gradient(ellipse 70% 50% at 15% 20%, rgba(242,140,82,0.10), transparent 70%)",
              "radial-gradient(ellipse 60% 55% at 85% 80%, rgba(178,40,72,0.14), transparent 65%)",
              "radial-gradient(ellipse 40% 30% at 50% 50%, rgba(244,160,176,0.03), transparent 60%)",
            ].join(", "),
          }}
          animate={{ opacity: [0.85, 1, 0.85] }}
          transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
        />
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.035] mix-blend-overlay"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")",
          }}
        />
      </div>

      {/* ── Scroll-snap container ── */}
      <div className="relative z-10 h-dvh snap-y snap-mandatory overflow-y-scroll">

        {/* ── Screen 1 — Hero ── */}
        <section
          className="relative flex h-dvh snap-start flex-col overflow-hidden"
          style={{ backgroundColor: "var(--neutral-900)" }}
        >
          {/* Nav */}
          <motion.nav
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: EASE }}
            className="flex w-full items-center justify-between px-8 sm:px-16 md:px-24"
            style={{
              paddingTop: "clamp(24px, 3.5vh, 40px)",
              paddingBottom: "clamp(8px, 1vh, 12px)",
            }}
          >
            <a
              href="/"
              style={{
                fontFamily: "var(--font-logo)",
                fontSize: "clamp(22px, 2.8vw, 32px)",
                color: "var(--brand-cream)",
                textDecoration: "none",
              }}
            >
              SuperBad
            </a>
            <div
              className="flex items-center"
              style={{ gap: "clamp(24px, 3vw, 40px)" }}
            >
              <a
                href="/blog"
                style={{
                  fontFamily: "var(--font-label)",
                  fontSize: 10,
                  letterSpacing: "0.2em",
                  textTransform: "uppercase",
                  color: "var(--neutral-500)",
                  textDecoration: "none",
                  transition: "color 0.2s",
                }}
              >
                Blog
              </a>
              <a
                href="/trial-shoot"
                className="hidden sm:inline"
                style={{
                  fontFamily: "var(--font-label)",
                  fontSize: 10,
                  letterSpacing: "0.2em",
                  textTransform: "uppercase",
                  color: "var(--neutral-500)",
                  textDecoration: "none",
                  transition: "color 0.2s",
                }}
              >
                Trial Shoot
              </a>
            </div>
          </motion.nav>

          {/* Hero content */}
          <div
            className="flex flex-1 flex-col justify-center"
            style={{ paddingBottom: "8vh" }}
          >
            <div className="w-full px-8 sm:px-16 md:px-24">
              <motion.div
                initial="hidden"
                animate="show"
                transition={{ staggerChildren: 0.12, delayChildren: 0.3 }}
              >
                <motion.p
                  variants={{
                    hidden: { opacity: 0, y: 8 },
                    show: { opacity: 1, y: 0 },
                  }}
                  transition={{ duration: 0.5, ease: EASE }}
                  style={{
                    fontFamily: "var(--font-label)",
                    fontSize: "var(--text-micro)",
                    letterSpacing: "0.35em",
                    textTransform: "uppercase",
                    color: "var(--neutral-500)",
                    marginBottom: "clamp(16px, 2vw, 28px)",
                  }}
                >
                  The Newsletter
                </motion.p>

                <motion.h1
                  className="text-balance"
                  variants={{
                    hidden: { opacity: 0, y: 20 },
                    show: { opacity: 1, y: 0 },
                  }}
                  transition={{
                    type: "spring",
                    damping: 16,
                    stiffness: 70,
                  }}
                  style={{
                    fontFamily: "var(--font-display)",
                    fontSize: "clamp(48px, 9vw, 112px)",
                    lineHeight: 0.95,
                    color: "var(--neutral-100)",
                    margin: 0,
                    maxWidth: "14ch",
                  }}
                >
                  Marketing without
                  the marketing
                  <span style={{ color: "var(--brand-red)" }}>.</span>
                </motion.h1>

                <motion.p
                  variants={{
                    hidden: { opacity: 0 },
                    show: { opacity: 1 },
                  }}
                  transition={{ duration: 0.6, delay: 0.2 }}
                  style={{
                    fontFamily: "var(--font-body)",
                    fontSize: "var(--text-small)",
                    color: "var(--neutral-400)",
                    marginTop: "clamp(24px, 3vw, 40px)",
                    maxWidth: "48ch",
                  }}
                  className="text-pretty"
                >
                  Honest observations about content, marketing, and what actually
                  works. One email when something new drops.
                </motion.p>
              </motion.div>
            </div>
          </div>
        </section>

        {/* ── Screen 2 — What you get (preview cycle) ── */}
        <Screen align="center" surface={1}>
          <Statement>
            <span
              style={{
                fontFamily: "var(--font-label)",
                fontSize: "var(--text-micro)",
                letterSpacing: "0.28em",
                textTransform: "uppercase",
                color: "var(--brand-red)",
              }}
            >
              What you get
            </span>
            <h2
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "clamp(28px, 4.5vw, 48px)",
                lineHeight: 1.05,
                color: "var(--brand-cream)",
                textTransform: "uppercase",
                margin: "12px 0 0",
              }}
              className="text-balance"
            >
              Stuff worth reading<span style={{ color: "var(--brand-red)" }}>.</span>
            </h2>
          </Statement>

          <Statement delay={0.15}>
            <p
              className="text-pretty"
              style={{
                fontFamily: "var(--font-body)",
                fontSize: "clamp(15px, 1.8vw, 18px)",
                lineHeight: 1.6,
                color: "var(--neutral-400)",
                margin: "0 auto",
                marginTop: "clamp(12px, 2vw, 20px)",
                maxWidth: "42ch",
              }}
            >
              Each email starts as a thought that won&rsquo;t leave.
              If it survives long enough to be interesting, it becomes a newsletter.
              Then a blog post. You get it first.
            </p>
          </Statement>

          <div ref={previewRef} style={{ marginTop: "clamp(28px, 4vw, 48px)" }}>
            <PreviewCycle inView={previewInView} />
          </div>
        </Screen>

        {/* ── Screen 3 — What you won't get (anti-promises) ── */}
        <Screen surface="brand" align="center">
          <div ref={antiRef}>
            <p
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "clamp(28px, 4.2vw, 56px)",
                lineHeight: 1.05,
                color: "var(--neutral-100)",
                margin: 0,
              }}
              className="text-balance"
            >
              {revealWords("What you won't get", antiInView)}
              <motion.span
                style={{ display: "inline-block", color: "var(--neutral-900)" }}
                initial={reduced ? false : { opacity: 0, y: 30, filter: "blur(6px)" }}
                animate={antiInView ? { opacity: 1, y: 0, filter: "blur(0px)" } : {}}
                transition={{ duration: 0.5, delay: 4 * 0.07, ease: EASE }}
              >
                .
              </motion.span>
            </p>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 0,
                marginTop: "clamp(28px, 4vw, 48px)",
                maxWidth: 400,
                marginInline: "auto",
              }}
            >
              {ANTI_PROMISES.map((item, i) => (
                <motion.div
                  key={item}
                  initial={reduced ? false : { opacity: 0, x: -12 }}
                  animate={antiInView ? { opacity: 1, x: 0 } : {}}
                  transition={
                    reduced
                      ? { duration: 0 }
                      : {
                          duration: 0.5,
                          ease: EASE,
                          delay: 0.4 + i * 0.1,
                        }
                  }
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "12px 0",
                    borderBottom:
                      i < ANTI_PROMISES.length - 1
                        ? "1px solid rgba(253, 245, 230, 0.15)"
                        : "none",
                  }}
                >
                  <span
                    style={{
                      fontFamily: "var(--font-display)",
                      fontSize: "clamp(14px, 1.8vw, 18px)",
                      color: "rgba(253, 245, 230, 0.3)",
                      flexShrink: 0,
                    }}
                  >
                    ✕
                  </span>
                  <span
                    style={{
                      fontFamily: "var(--font-body)",
                      fontSize: "clamp(14px, 1.8vw, 16px)",
                      color: "rgba(253, 245, 230, 0.85)",
                      textAlign: "left",
                    }}
                  >
                    {item}
                  </span>
                </motion.div>
              ))}
            </div>
          </div>
        </Screen>

        {/* ── Screen 4 — The promise ── */}
        <Screen align="center">
          <Statement>
            <p
              style={{
                fontFamily: "var(--font-narrative)",
                fontStyle: "italic",
                fontSize: "clamp(22px, 3.5vw, 40px)",
                lineHeight: 1.3,
                color: "var(--brand-cream)",
                margin: 0,
                textWrap: "balance",
              }}
            >
              Just one email, when there&rsquo;s something worth saying
              <span style={{ color: "var(--brand-red)" }}>.</span>
            </p>
          </Statement>
          <Statement delay={0.12}>
            <p
              className="text-pretty"
              style={{
                fontFamily: "var(--font-body)",
                fontSize: "clamp(15px, 1.8vw, 18px)",
                lineHeight: 1.6,
                color: "var(--neutral-500)",
                margin: "0 auto",
                marginTop: "clamp(16px, 2vw, 28px)",
                maxWidth: "42ch",
              }}
            >
              No cadence. No content calendar. If nothing interesting happened
              this week, you won&rsquo;t hear from me.
              If something did, you&rsquo;ll get it before it hits the blog.
            </p>
          </Statement>
        </Screen>

        {/* ── Screen 5 — CTA ── */}
        <Screen align="center" surface={1}>
          <Statement>
            <div
              aria-hidden
              style={{
                width: 48,
                height: 2,
                backgroundColor: "var(--brand-red)",
                margin: "0 auto clamp(20px, 2vw, 32px)",
                opacity: 0.6,
              }}
            />
            <h2
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "clamp(32px, 5.5vw, 56px)",
                lineHeight: 1.05,
                color: "var(--brand-cream)",
                textTransform: "uppercase",
                margin: 0,
              }}
            >
              Get the newsletter<span style={{ color: "var(--brand-red)" }}>.</span>
            </h2>
          </Statement>
          <Statement delay={0.15}>
            <div style={{ marginTop: "clamp(24px, 3vw, 40px)" }}>
              <NewsletterSignup
                variant="standalone"
                source="embed_form"
                headline="One email when something new drops"
                subtext="No filler, no sequences, no growth-hacking nonsense. Unsubscribe anytime."
              />
            </div>
          </Statement>

          {/* Footer link */}
          <Statement delay={0.25}>
            <p
              style={{
                fontFamily: "var(--font-body)",
                fontSize: "clamp(13px, 1.4vw, 14px)",
                color: "var(--neutral-600)",
                marginTop: "clamp(32px, 4vw, 56px)",
              }}
            >
              or read the{" "}
              <a
                href="/blog"
                style={{
                  color: "var(--brand-red)",
                  textDecoration: "none",
                  borderBottom: "1px solid transparent",
                  transition: "border-color 0.2s",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "var(--brand-red)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "transparent";
                }}
              >
                blog
              </a>{" "}
              first.
            </p>
          </Statement>
        </Screen>
      </div>
    </main>
  );
}
