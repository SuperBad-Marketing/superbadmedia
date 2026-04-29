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

// ── Shared sub-components ─────────────────────────────────────────────

function Screen({
  children,
  surface = 0,
  align = "center",
}: {
  children: React.ReactNode;
  surface?: 0 | 1 | "brand";
  align?: "left" | "center";
}) {
  const bg =
    surface === "brand"
      ? "var(--brand-red)"
      : surface === 1
        ? "var(--color-neutral-800, #252320)"
        : "var(--brand-charcoal, #1A1A18)";

  return (
    <section
      style={{
        height: "100dvh",
        scrollSnapAlign: "start",
        display: "flex",
        alignItems: "center",
        justifyContent: align === "center" ? "center" : "flex-start",
        textAlign: align,
        padding: "clamp(32px, 6vw, 80px)",
        background: bg,
        position: "relative",
        overflow: "hidden",
      }}
    >
      {children}
    </section>
  );
}

function Statement({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.4 });
  const reduced = useReducedMotion();

  return (
    <motion.div
      ref={ref}
      initial={reduced ? false : { opacity: 0, y: 32 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ type: "spring", damping: 18, stiffness: 70, delay }}
    >
      {children}
    </motion.div>
  );
}

function revealWords(text: string, inView: boolean, reduced: boolean | null) {
  const words = text.split(" ");
  return words.map((word, i) => (
    <motion.span
      key={i}
      initial={reduced ? false : { opacity: 0, y: 16, filter: "blur(4px)" }}
      animate={inView ? { opacity: 1, y: 0, filter: "blur(0px)" } : {}}
      transition={{ duration: 0.5, delay: 0.08 * i, ease: EASE }}
      style={{ display: "inline-block", marginRight: "0.3em" }}
    >
      {word}
    </motion.span>
  ));
}

function Redaction({
  generic,
  honest,
}: {
  generic: string;
  honest: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.5 });
  const reduced = useReducedMotion();

  return (
    <div ref={ref} style={{ display: "flex", flexDirection: "column", gap: 20, maxWidth: 620 }}>
      <p
        style={{
          fontFamily: "var(--font-body)",
          fontSize: "clamp(18px, 2.5vw, 22px)",
          lineHeight: 1.6,
          color: "var(--brand-cream)",
          opacity: 0.35,
          margin: 0,
          position: "relative",
        }}
      >
        <motion.span
          initial={{ backgroundSize: "0% 2px" }}
          animate={inView ? { backgroundSize: "100% 2px" } : {}}
          transition={{ duration: 0.8, delay: 0.3, ease: EASE }}
          style={{
            backgroundImage: "linear-gradient(var(--brand-cream), var(--brand-cream))",
            backgroundRepeat: "no-repeat",
            backgroundPosition: "0 55%",
          }}
        >
          {generic}
        </motion.span>
      </p>
      <motion.p
        initial={reduced ? false : { opacity: 0, y: 12 }}
        animate={inView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.6, delay: 1.0, ease: EASE }}
        style={{
          fontFamily: "var(--font-body)",
          fontSize: "clamp(16px, 2vw, 19px)",
          lineHeight: 1.7,
          color: "var(--brand-cream)",
          opacity: 0.8,
          margin: 0,
        }}
      >
        {honest}
      </motion.p>
    </div>
  );
}

// ── Deliverable items ─────────────────────────────────────────────────

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

// ── Main component ────────────────────────────────────────────────────

export function RundownEntryClient({ prefilled }: { prefilled?: PrefilledData }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [name, setName] = useState(prefilled?.name ?? "");
  const [email, setEmail] = useState(prefilled?.email ?? "");
  const [businessName, setBusinessName] = useState(prefilled?.businessName ?? "");
  const [website, setWebsite] = useState(prefilled?.website ?? "");
  const [instagramHandle, setInstagramHandle] = useState(prefilled?.instagramHandle ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showClientOverride, setShowClientOverride] = useState(false);
  const [clientName, setClientName] = useState("");

  const formRef = useRef<HTMLElement>(null);
  const heroWordRef = useRef<HTMLDivElement>(null);
  const heroInView = useInView(heroWordRef, { once: true, amount: 0.4 });
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
    [name, email, businessName, website, instagramHandle, submitting, searchParams, router],
  );

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
      {/* Ambient background */}
      <div
        aria-hidden
        className="rundown-ambient"
        style={{
          position: "fixed",
          inset: 0,
          pointerEvents: "none",
          zIndex: 0,
        }}
      >
        <div style={{
          position: "absolute", inset: 0,
          background: "radial-gradient(ellipse at 20% 30%, rgba(242,140,82,0.06), transparent 60%)",
        }} />
        <div style={{
          position: "absolute", inset: 0,
          background: "radial-gradient(ellipse at 80% 70%, rgba(178,40,72,0.07), transparent 55%)",
        }} />
        <div style={{
          position: "absolute", inset: 0,
          background: "radial-gradient(ellipse at 50% 50%, rgba(244,160,176,0.04), transparent 70%)",
        }} />
      </div>

      {/* ═══ SCREEN 1: Hero ═══ */}
      <Screen>
        <div
          style={{
            maxWidth: 780,
            margin: "0 auto",
            position: "relative",
            zIndex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            textAlign: "center",
            gap: 0,
          }}
        >
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.2, ease: EASE }}
            style={{
              fontFamily: "var(--font-label)",
              fontSize: 10,
              letterSpacing: "4px",
              textTransform: "uppercase",
              color: "var(--brand-pink)",
              margin: "0 0 28px 0",
            }}
          >
            Brand DNA
          </motion.p>

          <div ref={heroWordRef}>
            <h1
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "clamp(2.5rem, 6vw, 4.5rem)",
                lineHeight: 1.05,
                color: "var(--brand-cream)",
                margin: "0 0 28px 0",
                letterSpacing: "-1px",
              }}
            >
              {revealWords("Every brand has a DNA.", heroInView, reduced)}
              <br />
              {revealWords("Most have never seen theirs.", heroInView, reduced)}
            </h1>
          </div>

          <motion.p
            initial={reduced ? false : { opacity: 0, y: 12 }}
            animate={heroInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6, delay: 1.6, ease: EASE }}
            style={{
              fontFamily: "var(--font-narrative)",
              fontStyle: "italic",
              fontSize: "clamp(16px, 2vw, 19px)",
              lineHeight: 1.6,
              color: "var(--brand-cream)",
              opacity: 0.5,
              margin: "0 0 40px 0",
              maxWidth: 460,
            }}
          >
            102 questions. No right answers. A portrait of who you already are.
          </motion.p>

          <motion.button
            initial={reduced ? false : { opacity: 0 }}
            animate={heroInView ? { opacity: 1 } : {}}
            transition={{ duration: 0.5, delay: 2.0, ease: EASE }}
            onClick={scrollToForm}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            style={{
              fontFamily: "var(--font-label)",
              fontSize: 11,
              letterSpacing: "2.5px",
              textTransform: "uppercase",
              color: "var(--brand-cream)",
              background: "var(--brand-red)",
              border: "none",
              borderRadius: 999,
              padding: "16px 40px",
              cursor: "pointer",
            }}
          >
            Take the assessment
          </motion.button>

          <motion.div
            initial={reduced ? false : { opacity: 0 }}
            animate={heroInView ? { opacity: 0.3 } : {}}
            transition={{ duration: 0.5, delay: 2.4, ease: EASE }}
            aria-hidden
            style={{
              position: "absolute",
              bottom: -60,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 8,
            }}
          >
            <span style={{ fontFamily: "var(--font-body)", fontSize: 12, color: "var(--brand-cream)" }}>scroll</span>
            <motion.div
              animate={{ y: [0, 6, 0] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              style={{ width: 1, height: 20, background: "var(--brand-cream)", opacity: 0.4 }}
            />
          </motion.div>
        </div>
      </Screen>

      {/* ═══ SCREEN 2: Redaction ═══ */}
      <Screen surface="brand">
        <div style={{ maxWidth: 680, margin: "0 auto", position: "relative", zIndex: 1 }}>
          <Redaction
            generic={`"Comprehensive brand audit with actionable insights and strategic recommendations."`}
            honest="Most businesses look like everyone else in their industry. Same stock photos. Same blue. Same nothing. Brand DNA doesn't audit what you have. It uncovers what you are."
          />
        </div>
      </Screen>

      {/* ═══ SCREEN 3: What you get ═══ */}
      <Screen surface={1}>
        <div
          style={{
            maxWidth: 720,
            margin: "0 auto",
            position: "relative",
            zIndex: 1,
            display: "flex",
            flexDirection: "column",
            gap: 0,
          }}
        >
          <Statement>
            <p
              style={{
                fontFamily: "var(--font-label)",
                fontSize: 10,
                letterSpacing: "3px",
                textTransform: "uppercase",
                color: "var(--brand-pink)",
                margin: "0 0 16px 0",
              }}
            >
              What you walk away with
            </p>
          </Statement>

          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            {DELIVERABLES.map((d, i) => (
              <Statement key={d.number} delay={0.15 * (i + 1)}>
                <div
                  style={{
                    display: "flex",
                    gap: "clamp(16px, 3vw, 28px)",
                    alignItems: "flex-start",
                    padding: "28px 0",
                    borderTop: i > 0 ? "1px solid rgba(253,245,230,0.06)" : "none",
                  }}
                >
                  <span
                    style={{
                      fontFamily: "var(--font-label)",
                      fontSize: 10,
                      letterSpacing: "2px",
                      color: "var(--brand-red)",
                      flexShrink: 0,
                      paddingTop: 4,
                    }}
                  >
                    {d.number}
                  </span>
                  <div>
                    <p
                      style={{
                        fontFamily: "var(--font-narrative)",
                        fontSize: "clamp(20px, 2.5vw, 24px)",
                        fontWeight: 500,
                        color: "var(--brand-cream)",
                        margin: "0 0 8px 0",
                        lineHeight: 1.3,
                      }}
                    >
                      {d.title}
                    </p>
                    <p
                      style={{
                        fontFamily: "var(--font-body)",
                        fontSize: 15,
                        lineHeight: 1.65,
                        color: "var(--brand-cream)",
                        opacity: 0.55,
                        margin: 0,
                        maxWidth: 440,
                      }}
                    >
                      {d.desc}
                    </p>
                  </div>
                </div>
              </Statement>
            ))}
          </div>

          <Statement delay={0.65}>
            <p
              style={{
                fontFamily: "var(--font-body)",
                fontStyle: "italic",
                fontSize: 14,
                color: "var(--brand-cream)",
                opacity: 0.35,
                margin: "12px 0 0 0",
              }}
            >
              Takes about 10 minutes. Worth it.
            </p>
          </Statement>
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
                  fontSize: 10,
                  letterSpacing: "3px",
                  textTransform: "uppercase",
                  color: "var(--brand-pink)",
                  margin: "0 0 14px 0",
                }}
              >
                Start here
              </p>
              <h2
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: "clamp(1.75rem, 3.5vw, 2.5rem)",
                  lineHeight: 1.1,
                  color: "var(--brand-cream)",
                  margin: "0 0 12px 0",
                }}
              >
                Ready when you are.
              </h2>
              <p
                style={{
                  fontFamily: "var(--font-body)",
                  fontSize: 15,
                  lineHeight: 1.6,
                  color: "var(--brand-cream)",
                  opacity: 0.5,
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
                  autoFocus={!prefilled?.name}
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
                    letterSpacing: "2.5px",
                    textTransform: "uppercase",
                    color: "var(--brand-cream)",
                    background: "var(--brand-red)",
                    border: "none",
                    borderRadius: 999,
                    padding: "16px 32px",
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
              color: "var(--brand-cream)",
              opacity: 0.25,
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

// ── Sub-components ────────────────────────────────────────────────────

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
          color: "var(--brand-cream)",
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
          color: "var(--brand-cream)",
          background: "rgba(253, 245, 230, 0.04)",
          border: "1px solid rgba(253, 245, 230, 0.08)",
          borderRadius: 10,
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
        borderRadius: 16,
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
          color: "var(--brand-cream)",
          margin: 0,
        }}
      >
        Hey {clientName.split(" ")[0]}, looks like you already have a Brand DNA profile with us. Taking this again will replace your current one.
      </p>
      <p
        style={{
          fontFamily: "var(--font-body)",
          fontSize: 14,
          color: "var(--brand-cream)",
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
            letterSpacing: "1.5px",
            textTransform: "uppercase",
            color: "var(--brand-cream)",
            background: "var(--brand-red)",
            border: "none",
            borderRadius: 999,
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
            letterSpacing: "1.5px",
            textTransform: "uppercase",
            color: "var(--brand-cream)",
            background: "transparent",
            border: "1px solid rgba(253, 245, 230, 0.15)",
            borderRadius: 999,
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
