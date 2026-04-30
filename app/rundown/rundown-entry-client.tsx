"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { motion, AnimatePresence, useInView, useReducedMotion } from "framer-motion";
import { useRouter, useSearchParams } from "next/navigation";
import { houseSpring } from "@/lib/design-tokens";
import { submitRundownEntry, type RundownEntryInput } from "./actions";

const EASE = [0.22, 1, 0.36, 1] as const;

let _turnstileToken = "";
let _turnstileRendered = false;

function ensureTurnstile() {
  if (_turnstileRendered) return;
  if (typeof window === "undefined" || !("turnstile" in window)) return;
  const el = document.getElementById("turnstile-container");
  if (!el) return;
  _turnstileRendered = true;
  const api = (window as unknown as { turnstile: { render: (el: HTMLElement, opts: Record<string, unknown>) => void } }).turnstile;
  api.render(el, {
    sitekey: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "",
    size: "invisible",
    callback: (token: string) => { _turnstileToken = token; },
  });
}

interface PrefilledData {
  name?: string;
  email?: string;
  businessName?: string;
  website?: string;
  instagramHandle?: string;
}

/* ── Screen — full-viewport snap section ── */

function Screen({
  children,
  surface = 0,
  align = "center",
  dense = false,
}: {
  children: React.ReactNode;
  surface?: 0 | 1 | "brand" | "cream";
  align?: "left" | "center";
  dense?: boolean;
}) {
  const bg =
    surface === "brand"
      ? "var(--brand-red)"
      : surface === "cream"
        ? "var(--brand-cream)"
        : surface === 1
          ? "var(--surface-1, #252320)"
          : "var(--brand-charcoal, #1A1A18)";

  return (
    <section
      style={{
        height: "100dvh",
        scrollSnapAlign: "start",
        display: "flex",
        flexDirection: "column",
        alignItems: align === "center" ? "center" : "flex-start",
        justifyContent: dense ? "flex-start" : "center",
        textAlign: align,
        padding: dense
          ? "clamp(48px, 7vh, 88px) clamp(32px, 5vw, 96px) clamp(32px, 4vw, 60px)"
          : "clamp(32px, 6vw, 80px) clamp(32px, 5vw, 96px)",
        background: bg,
        position: "relative",
        overflow: "hidden",
      }}
    >
      {children}
    </section>
  );
}

/* ── Statement — spring entrance ── */

function Statement({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.4 });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 40 }}
      animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 40 }}
      transition={{ type: "spring", damping: 18, stiffness: 80, delay }}
    >
      {children}
    </motion.div>
  );
}

/* ── Word reveal — premium blur entrance ── */

function revealWords(
  text: string,
  inView: boolean,
  reduced: boolean | null,
  delayOffset = 0,
  stagger = 0.07,
) {
  return text.split(" ").map((word, i) => (
    <motion.span
      key={`${delayOffset}-${i}`}
      initial={reduced ? false : { opacity: 0, y: 30, filter: "blur(6px)" }}
      animate={inView ? { opacity: 1, y: 0, filter: "blur(0px)" } : {}}
      transition={{ duration: 0.5, delay: delayOffset + i * stagger, ease: EASE }}
      style={{ display: "inline-block", marginRight: "0.3em" }}
    >
      {word}
    </motion.span>
  ));
}

/* ── Redaction — generic → strikethrough → honest ── */

function Redaction({
  generic,
  honest,
  honestSub,
}: {
  generic: string;
  honest: React.ReactNode;
  honestSub?: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.5 });
  const [struck, setStruck] = useState(false);

  useEffect(() => {
    if (inView) {
      const timer = setTimeout(() => setStruck(true), 600);
      return () => clearTimeout(timer);
    }
  }, [inView]);

  return (
    <div ref={ref} style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <p
        style={{
          fontFamily: "var(--font-body)",
          fontSize: "clamp(18px, 2.2vw, 26px)",
          lineHeight: 1.5,
          margin: 0,
          textWrap: "pretty",
        }}
      >
        <motion.span
          style={{
            color: inView ? "rgba(253, 245, 230, 0.35)" : "transparent",
            transition:
              "color 0.4s, background-size 0.8s cubic-bezier(0.22, 1, 0.36, 1)",
            backgroundImage:
              "linear-gradient(transparent 46%, var(--brand-red) 46%, var(--brand-red) 54%, transparent 54%)",
            backgroundSize: struck ? "100% 1.5em" : "0% 1.5em",
            backgroundRepeat: "repeat-y",
            backgroundPosition: "left center",
            WebkitBoxDecorationBreak: "clone",
            boxDecorationBreak: "clone" as never,
          }}
        >
          {generic}
        </motion.span>
      </p>

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
        transition={{
          delay: 1.0,
          type: "spring",
          damping: 20,
          stiffness: 100,
        }}
      >
        <div
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "clamp(28px, 4.5vw, 56px)",
            lineHeight: 1.05,
            color: "var(--neutral-100, #FDF5E6)",
            textWrap: "balance",
          }}
        >
          {honest}
        </div>
        {honestSub && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={inView ? { opacity: 1 } : { opacity: 0 }}
            transition={{ delay: 1.6, duration: 0.5 }}
            style={{ marginTop: 24 }}
          >
            {honestSub}
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}

/* ── Deliverable items ── */

const DELIVERABLES = [
  {
    number: "01",
    title: "Brand identity reveal",
    desc: "Signal tags, section insights, and a first impression written by someone who's never met you.",
  },
  {
    number: "02",
    title: "Prose portrait",
    desc: "A narrative profile of who you are, how you operate, and what people feel when they encounter your brand.",
  },
  {
    number: "03",
    title: "Brand Pack",
    desc: "Typography, colour palette, content pillars, voice guide, photography direction. Yours to keep.",
  },
];

/* ════════════════════════════════════════════════════════════════════ */
/* MAIN COMPONENT                                                     */
/* ════════════════════════════════════════════════════════════════════ */

export function RundownEntryClient({ prefilled }: { prefilled?: PrefilledData }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [name, setName] = useState(prefilled?.name ?? "");
  const [email, setEmail] = useState(prefilled?.email ?? "");
  const [businessName, setBusinessName] = useState(prefilled?.businessName ?? "");
  const [website, setWebsite] = useState(prefilled?.website ?? "");
  const [instagramHandle, setInstagramHandle] = useState(prefilled?.instagramHandle ?? "");
  const [city, setCity] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showClientOverride, setShowClientOverride] = useState(false);
  const [clientName, setClientName] = useState("");

  const formRef = useRef<HTMLElement>(null);
  const heroRef = useRef<HTMLDivElement>(null);
  const heroInView = useInView(heroRef, { once: true, amount: 0.4 });
  const reduced = useReducedMotion();

  useEffect(() => {
    const t = setInterval(() => { ensureTurnstile(); if (_turnstileRendered) clearInterval(t); }, 1000);
    return () => clearInterval(t);
  }, []);

  const scrollToForm = useCallback(() => {
    formRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (submitting) return;
      setError(null);
      setSubmitting(true);

      try {
        ensureTurnstile();
        const token = _turnstileToken;

        const input: RundownEntryInput = {
          name: name.trim(),
          email: email.trim(),
          businessName: businessName.trim(),
          website: website.trim() || undefined,
          instagramHandle: instagramHandle.trim() || undefined,
          city: city.trim() || undefined,
          turnstileToken: token,
          utmSource: searchParams.get("utm_source") ?? undefined,
          utmMedium: searchParams.get("utm_medium") ?? undefined,
          utmCampaign: searchParams.get("utm_campaign") ?? undefined,
          referrer: typeof document !== "undefined" ? document.referrer || undefined : undefined,
        };

        const result = await submitRundownEntry(input);

        if (result.ok) {
          router.push(`/rundown/s/${result.sessionToken}`);
          return;
        }

        if (result.reason === "existing_client") {
          setClientName(result.contactName);
          setShowClientOverride(true);
          return;
        }

        if (result.reason === "existing_rundown") {
          router.push(`/rundown/s/${result.sessionToken}`);
          return;
        }

        setError(result.message);
      } catch {
        setError("Something went wrong. Please try again.");
      } finally {
        setSubmitting(false);
      }
    },
    [name, email, businessName, website, instagramHandle, city, submitting, searchParams, router],
  );

  const delRef = useRef<HTMLDivElement>(null);
  const delInView = useInView(delRef, { once: true, amount: 0.15 });

  return (
    <main
      className="rundown-scroll-root"
      style={{
        height: "100dvh",
        overflowY: "scroll",
        scrollSnapType: "y mandatory",
        background: "var(--brand-charcoal, #1A1A18)",
      }}
    >
      {/* ── Ambient background ── */}
      <div
        aria-hidden
        style={{
          position: "fixed",
          inset: 0,
          pointerEvents: "none",
          zIndex: 0,
        }}
      >
        <motion.div
          style={{
            position: "absolute",
            inset: 0,
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
          style={{
            position: "absolute",
            inset: 0,
            opacity: 0.035,
            mixBlendMode: "overlay",
            backgroundImage:
              "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")",
          }}
        />
      </div>

      {/* ═══ SCREEN 1: Hero ═══ */}
      <section
        style={{
          height: "100dvh",
          scrollSnapAlign: "start",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          position: "relative",
        }}
      >
        <motion.nav
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: EASE }}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "clamp(24px, 3.5vh, 40px) clamp(32px, 5vw, 96px) clamp(8px, 1vh, 12px)",
          }}
        >
          <a
            href="/"
            style={{
              fontFamily: "var(--font-logo)",
              fontSize: "clamp(22px, 2.8vw, 32px)",
              color: "var(--brand-cream)",
              textDecoration: "none",
              position: "relative",
              zIndex: 1,
            }}
          >
            SuperBad
          </a>
        </motion.nav>

        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            paddingBottom: "8vh",
            paddingLeft: "clamp(32px, 5vw, 96px)",
            paddingRight: "clamp(32px, 5vw, 96px)",
          }}
        >
          <div ref={heroRef} style={{ position: "relative", zIndex: 1 }}>
            <motion.p
              initial={reduced ? false : { opacity: 0, y: 8 }}
              animate={heroInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, ease: EASE }}
              style={{
                fontFamily: "var(--font-label)",
                fontSize: "var(--text-micro, 10px)",
                letterSpacing: "0.35em",
                textTransform: "uppercase",
                color: "var(--brand-pink)",
                margin: 0,
                marginBottom: "clamp(16px, 2vw, 28px)",
              }}
            >
              Brand DNA
            </motion.p>

            <h1
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "clamp(48px, 9vw, 112px)",
                lineHeight: 0.95,
                color: "var(--neutral-100, #FDF5E6)",
                margin: 0,
              }}
            >
              {revealWords("Every brand has a DNA", heroInView, reduced)}
              <motion.span
                style={{ display: "inline-block", color: "var(--brand-red)" }}
                initial={reduced ? false : { opacity: 0, y: 30, filter: "blur(6px)" }}
                animate={heroInView ? { opacity: 1, y: 0, filter: "blur(0px)" } : {}}
                transition={{ duration: 0.5, delay: 5 * 0.07, ease: EASE }}
              >
                .
              </motion.span>
            </h1>
            <h1
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "clamp(48px, 9vw, 112px)",
                lineHeight: 0.95,
                color: "var(--brand-red)",
                margin: 0,
              }}
            >
              {revealWords("Most have never seen theirs", heroInView, reduced, 0.5)}
              <motion.span
                style={{ display: "inline-block", color: "var(--neutral-100, #FDF5E6)" }}
                initial={reduced ? false : { opacity: 0, y: 30, filter: "blur(6px)" }}
                animate={heroInView ? { opacity: 1, y: 0, filter: "blur(0px)" } : {}}
                transition={{ duration: 0.5, delay: 0.5 + 5 * 0.07, ease: EASE }}
              >
                .
              </motion.span>
            </h1>

            <motion.p
              initial={reduced ? false : { opacity: 0 }}
              animate={heroInView ? { opacity: 1 } : {}}
              transition={{ duration: 0.6, delay: 1.2 }}
              style={{
                fontFamily: "var(--font-body)",
                fontSize: "var(--text-small, 15px)",
                color: "var(--neutral-400, rgba(253,245,230,0.5))",
                marginTop: "clamp(24px, 3vw, 40px)",
                maxWidth: "48ch",
                textWrap: "pretty",
              }}
            >
              102 questions. No right answers. A portrait of who you already are.
            </motion.p>
          </div>
        </div>
      </section>

      {/* ═══ SCREEN 2: Redaction ═══ */}
      <Screen>
        <div style={{ maxWidth: 720, position: "relative", zIndex: 1 }}>
          <Redaction
            generic="Comprehensive brand audit with actionable insights and strategic recommendations for multi-channel growth."
            honest={
              <>
                Most businesses look like everyone else in their industry
                <span style={{ color: "var(--brand-red)" }}>.</span>
              </>
            }
            honestSub={
              <p
                style={{
                  fontFamily: "var(--font-body)",
                  fontSize: "clamp(16px, 1.8vw, 22px)",
                  lineHeight: 1.6,
                  color: "var(--neutral-400, rgba(253,245,230,0.5))",
                  margin: 0,
                  textWrap: "pretty",
                }}
              >
                Same stock photos. Same blue. Same nothing. Brand DNA doesn&rsquo;t audit
                what you have. It uncovers what you are.
              </p>
            }
          />
        </div>
      </Screen>

      {/* ═══ SCREEN 3: What you walk away with ═══ */}
      <Screen surface={1} align="left" dense>
        <div
          style={{
            width: "100%",
            maxWidth: 640,
            position: "relative",
            zIndex: 1,
          }}
        >
          <Statement>
            <span
              style={{
                fontFamily: "var(--font-label)",
                fontSize: "var(--text-micro, 10px)",
                letterSpacing: "0.28em",
                textTransform: "uppercase",
                color: "var(--brand-red)",
              }}
            >
              What you walk away with
            </span>
            <h2
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "clamp(28px, 5vw, 48px)",
                lineHeight: 1.05,
                color: "var(--brand-cream, #FDF5E6)",
                textTransform: "uppercase",
                margin: "12px 0 0",
                textWrap: "balance",
              }}
            >
              A complete portrait of your brand.
            </h2>
          </Statement>

          <div
            ref={delRef}
            style={{
              marginTop: "clamp(32px, 4vw, 56px)",
              display: "flex",
              flexDirection: "column",
              gap: 0,
            }}
          >
            {DELIVERABLES.map((d, i) => (
              <motion.div
                key={d.number}
                initial={reduced ? false : { opacity: 0, y: 20 }}
                animate={delInView ? { opacity: 1, y: 0 } : {}}
                transition={
                  reduced
                    ? { duration: 0 }
                    : {
                        type: "spring",
                        damping: 20,
                        stiffness: 90,
                        delay: 0.2 + i * 0.15,
                      }
                }
                style={{
                  padding: "clamp(20px, 2.5vw, 32px) 0",
                  borderTop: "1px solid rgba(253,245,230,0.06)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "baseline",
                    gap: "clamp(12px, 2vw, 20px)",
                    marginBottom: 8,
                  }}
                >
                  <span
                    style={{
                      fontFamily: "var(--font-label)",
                      fontSize: 10,
                      letterSpacing: "0.15em",
                      color: i === DELIVERABLES.length - 1 ? "var(--brand-red)" : "rgba(253,245,230,0.2)",
                      flexShrink: 0,
                    }}
                  >
                    {d.number}
                  </span>
                  <p
                    style={{
                      fontFamily: "var(--font-display)",
                      fontSize: "clamp(20px, 3vw, 28px)",
                      lineHeight: 1.1,
                      color: "var(--brand-cream, #FDF5E6)",
                      textTransform: "uppercase",
                      margin: 0,
                    }}
                  >
                    {d.title}
                  </p>
                </div>
                <p
                  style={{
                    fontFamily: "var(--font-body)",
                    fontSize: "clamp(14px, 1.6vw, 16px)",
                    lineHeight: 1.6,
                    color: "rgba(253,245,230,0.45)",
                    margin: 0,
                    paddingLeft: "clamp(28px, 3.5vw, 40px)",
                    maxWidth: "48ch",
                  }}
                >
                  {d.desc}
                </p>
              </motion.div>
            ))}
          </div>

          <motion.p
            initial={reduced ? false : { opacity: 0 }}
            animate={delInView ? { opacity: 1 } : {}}
            transition={
              reduced ? { duration: 0 } : { duration: 0.6, delay: 0.9 }
            }
            style={{
              fontFamily: "var(--font-narrative)",
              fontStyle: "italic",
              fontSize: "clamp(15px, 1.8vw, 20px)",
              lineHeight: 1.5,
              color: "var(--brand-pink, #F4A0B0)",
              margin: 0,
              marginTop: "clamp(16px, 2vw, 24px)",
            }}
          >
            Takes about 10 minutes. Worth it.
          </motion.p>
        </div>
      </Screen>

      {/* ═══ SCREEN 4: The form ═══ */}
      <section
        ref={formRef}
        style={{
          minHeight: "100dvh",
          scrollSnapAlign: "start",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "clamp(40px, 6vw, 80px) clamp(20px, 4vw, 40px)",
          position: "relative",
          zIndex: 1,
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: 440,
            display: "flex",
            flexDirection: "column",
            gap: 36,
          }}
        >
          <Statement>
            <div style={{ textAlign: "center" }}>
              <p
                style={{
                  fontFamily: "var(--font-label)",
                  fontSize: "var(--text-micro, 10px)",
                  letterSpacing: "0.28em",
                  textTransform: "uppercase",
                  color: "var(--brand-red)",
                  margin: "0 0 16px 0",
                }}
              >
                Start here
              </p>
              <h2
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: "clamp(28px, 5vw, 48px)",
                  lineHeight: 1.05,
                  color: "var(--brand-cream, #FDF5E6)",
                  textTransform: "uppercase",
                  margin: "0 0 16px 0",
                }}
              >
                Ready when you are.
              </h2>
              <p
                style={{
                  fontFamily: "var(--font-body)",
                  fontSize: "clamp(14px, 1.6vw, 16px)",
                  lineHeight: 1.6,
                  color: "var(--neutral-500, rgba(253,245,230,0.4))",
                  margin: 0,
                }}
              >
                We just need the basics. Everything else comes from your answers.
              </p>
            </div>
          </Statement>

          <AnimatePresence mode="wait">
            {showClientOverride ? (
              <ClientOverridePrompt
                key="override"
                clientName={clientName}
                onProceed={() => {
                  setShowClientOverride(false);
                  setError(null);
                }}
                onCancel={() => setShowClientOverride(false)}
              />
            ) : (
              <motion.form
                key="form"
                onSubmit={handleSubmit}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                style={{ display: "flex", flexDirection: "column", gap: 18 }}
              >
                <InputField
                  label="Your name"
                  value={name}
                  onChange={setName}
                  required
                  autoFocus={false}
                />
                <InputField
                  label="Email"
                  type="email"
                  value={email}
                  onChange={setEmail}
                  required
                />
                <InputField
                  label="Business name"
                  value={businessName}
                  onChange={setBusinessName}
                  required
                />
                <InputField
                  label="Website"
                  type="text"
                  value={website}
                  onChange={setWebsite}
                  placeholder="superbadmedia.com.au"
                />
                <InputField
                  label="Instagram"
                  value={instagramHandle}
                  onChange={setInstagramHandle}
                  placeholder="@yourbusiness"
                />
                <InputField
                  label="City"
                  value={city}
                  onChange={setCity}
                  placeholder="Melbourne"
                />

                {error && (
                  <p
                    style={{
                      fontFamily: "var(--font-body)",
                      fontSize: 14,
                      color: "var(--brand-red)",
                      margin: 0,
                    }}
                  >
                    {error}
                  </p>
                )}

                <motion.button
                  type="submit"
                  disabled={submitting || !name.trim() || !email.trim() || !businessName.trim()}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  transition={houseSpring}
                  style={{
                    fontFamily: "var(--font-label)",
                    fontSize: 11,
                    letterSpacing: "0.15em",
                    textTransform: "uppercase",
                    color: "var(--brand-cream, #FDF5E6)",
                    background: "var(--brand-red)",
                    border: "none",
                    borderRadius: 4,
                    padding: "14px 28px",
                    cursor: submitting ? "wait" : "pointer",
                    opacity: submitting ? 0.6 : 1,
                    marginTop: 4,
                    transition: "opacity 0.2s",
                  }}
                >
                  {submitting ? "Setting up..." : "Start the assessment"}
                </motion.button>

                <div id="turnstile-container" />
              </motion.form>
            )}
          </AnimatePresence>

          <p
            style={{
              fontFamily: "var(--font-body)",
              fontSize: 12,
              color: "var(--brand-cream, #FDF5E6)",
              opacity: 0.2,
              textAlign: "center",
              margin: 0,
              lineHeight: 1.6,
            }}
          >
            Free. No account required. Results delivered by email.
          </p>
        </div>
      </section>

      <style>{`
        .rundown-scroll-root {
          scroll-behavior: smooth;
        }
        .rundown-scroll-root::-webkit-scrollbar {
          display: none;
        }
        @media (max-width: 640px) {
          .rundown-scroll-root section {
            padding-left: 24px !important;
            padding-right: 24px !important;
          }
        }
      `}</style>
    </main>
  );
}

/* ── Sub-components ── */

function InputField({
  label,
  value,
  onChange,
  type = "text",
  required = false,
  autoFocus = false,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
  autoFocus?: boolean;
  placeholder?: string;
}) {
  const id = `rundown-${label.toLowerCase().replace(/\s+/g, "-")}`;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <label
        htmlFor={id}
        style={{
          fontFamily: "var(--font-label)",
          fontSize: 10,
          letterSpacing: "1.5px",
          textTransform: "uppercase",
          color: "var(--brand-cream, #FDF5E6)",
          opacity: 0.45,
        }}
      >
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        autoFocus={autoFocus}
        placeholder={placeholder}
        style={{
          fontFamily: "var(--font-body)",
          fontSize: 16,
          color: "var(--brand-cream, #FDF5E6)",
          background: "rgba(253, 245, 230, 0.04)",
          border: "1px solid rgba(253, 245, 230, 0.08)",
          borderRadius: 4,
          padding: "14px 16px",
          outline: "none",
          transition: "border-color 0.3s, background 0.3s",
        }}
        onFocus={(e) => {
          e.currentTarget.style.borderColor = "rgba(178, 40, 72, 0.4)";
          e.currentTarget.style.background = "rgba(253, 245, 230, 0.06)";
        }}
        onBlur={(e) => {
          e.currentTarget.style.borderColor = "rgba(253, 245, 230, 0.08)";
          e.currentTarget.style.background = "rgba(253, 245, 230, 0.04)";
        }}
      />
    </div>
  );
}

function ClientOverridePrompt({
  clientName,
  onProceed,
  onCancel,
}: {
  clientName: string;
  onProceed: () => void;
  onCancel: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={houseSpring}
      style={{
        background: "rgba(178, 40, 72, 0.1)",
        border: "1px solid rgba(178, 40, 72, 0.25)",
        borderRadius: 8,
        padding: 28,
        display: "flex",
        flexDirection: "column",
        gap: 16,
      }}
    >
      <p
        style={{
          fontFamily: "var(--font-body)",
          fontSize: 16,
          lineHeight: 1.6,
          color: "var(--brand-cream, #FDF5E6)",
          margin: 0,
        }}
      >
        Hey {clientName.split(" ")[0]}, looks like you already have a Brand DNA profile with us. Taking this again will replace your current one.
      </p>
      <p
        style={{
          fontFamily: "var(--font-body)",
          fontSize: 14,
          color: "var(--brand-cream, #FDF5E6)",
          opacity: 0.6,
          margin: 0,
        }}
      >
        Your previous results will be archived, not deleted.
      </p>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <button
          onClick={onProceed}
          style={{
            fontFamily: "var(--font-label)",
            fontSize: 11,
            letterSpacing: "0.15em",
            textTransform: "uppercase",
            color: "var(--brand-cream, #FDF5E6)",
            background: "var(--brand-red)",
            border: "none",
            borderRadius: 4,
            padding: "12px 24px",
            cursor: "pointer",
          }}
        >
          Start fresh
        </button>
        <button
          onClick={onCancel}
          style={{
            fontFamily: "var(--font-label)",
            fontSize: 11,
            letterSpacing: "0.15em",
            textTransform: "uppercase",
            color: "var(--brand-cream, #FDF5E6)",
            background: "transparent",
            border: "1px solid rgba(253, 245, 230, 0.15)",
            borderRadius: 4,
            padding: "12px 24px",
            cursor: "pointer",
          }}
        >
          Never mind
        </button>
      </div>
    </motion.div>
  );
}
