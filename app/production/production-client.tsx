"use client";

import { useRef, useState, useEffect } from "react";
import { motion, useInView, useReducedMotion, AnimatePresence } from "framer-motion";
import { submitProductionInquiry } from "./actions";
/* ── Constants ── */

const EASE = [0.22, 1, 0.36, 1] as const;

const NAV_LINKS = [
  { label: "The Flywheel", id: "flywheel" },
  { label: "Deliverables", id: "deliverables" },
  { label: "Pricing", id: "pricing" },
];

/* ── Screen — a single snap section ── */
function Screen({
  children,
  align = "left",
  surface = 0,
  wide = false,
  id,
  dense = false,
}: {
  children: React.ReactNode;
  align?: "left" | "center";
  surface?: 0 | 1 | "brand" | "cream";
  wide?: boolean;
  id?: string;
  dense?: boolean;
}) {
  const bg =
    surface === "brand"
      ? "var(--brand-red)"
      : surface === "cream"
        ? "var(--brand-cream)"
        : surface === 1
          ? "var(--surface-1)"
          : "var(--neutral-900)";

  return (
    <section
      id={id}
      className={`relative flex h-dvh snap-start flex-col ${dense ? "justify-start" : "justify-center"} overflow-hidden`}
      style={{
        backgroundColor: bg,
        paddingBottom: dense ? undefined : "8vh",
        paddingTop: dense ? "clamp(48px, 7vh, 88px)" : undefined,
      }}
    >
      <div
        className={`w-full px-8 sm:px-16 md:px-24 ${
          align === "center" ? "text-center mx-auto" : ""
        }`}
        style={{
          maxWidth: wide ? "1080px" : align === "center" ? "64ch" : undefined,
          marginInline: wide ? "auto" : undefined,
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
  className,
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.4 });

  return (
    <motion.div
      ref={ref}
      className={className}
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
    <div ref={ref} className="flex flex-col gap-6">
      <p
        style={{
          fontFamily: "var(--font-body)",
          fontSize: "clamp(18px, 2.2vw, 26px)",
          lineHeight: 1.5,
          margin: 0,
        }}
        className="text-pretty"
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
          className="text-balance"
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "clamp(28px, 4.5vw, 56px)",
            lineHeight: 1.05,
            color: "var(--neutral-100)",
          }}
        >
          {honest}
        </div>
        {honestSub && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={inView ? { opacity: 1 } : { opacity: 0 }}
            transition={{ delay: 1.6, duration: 0.5 }}
            className="mt-6"
          >
            {honestSub}
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}

/* ── Flywheel — kinetic typography loop ── */

const FLYWHEEL_STAGES = [
  {
    headline: "We shoot your YouTube episode.",
    sub: "One production day. Broadcast quality.",
    accent: null,
  },
  {
    headline: "We cut 12 clips.",
    sub: "Reels. TikTok. Shorts. All from the same shoot.",
    accent: "12",
  },
  {
    headline: "You post them. We run them as ads.",
    sub: "Same content. Organic reach and paid reach.",
    accent: null,
  },
  {
    headline: "Every viewer gets retargeted.",
    sub: "They already know your name when your offer lands.",
    accent: null,
  },
  {
    headline: "Your channel. More clips. Your offer.",
    sub: "Three touches. All warm. None wasted.",
    accent: null,
  },
  {
    headline: "Lookalikes refill the top.",
    sub: "Meta builds audiences that match your best viewers.",
    accent: null,
  },
  {
    headline: "The loop compounds.",
    sub: "Every cycle feeds the next. Self-funding.",
    accent: null,
  },
];

const STAGE_DURATION = 3400;

const EXIT_EASE = [0.4, 0, 1, 1] as const;

const wordEntrance = {
  hidden: { opacity: 0, y: 40, filter: "blur(6px)" },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: {
      duration: 0.5,
      delay: i * 0.08,
      ease: EASE,
    },
  }),
  exit: {
    opacity: 0,
    y: -20,
    filter: "blur(4px)",
    transition: { duration: 0.3, ease: EXIT_EASE },
  },
};

const subEntrance = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, delay: 0.5, ease: EASE },
  },
  exit: {
    opacity: 0,
    transition: { duration: 0.2, ease: EXIT_EASE },
  },
};

function FlywheelLoop({ inView }: { inView: boolean }) {
  const reduced = useReducedMotion();
  const [stage, setStage] = useState(0);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    if (!inView || started) return;
    setStarted(true);
  }, [inView, started]);

  useEffect(() => {
    if (!started || reduced) return;
    const id = setInterval(() => {
      setStage((s) => (s + 1) % FLYWHEEL_STAGES.length);
    }, STAGE_DURATION);
    return () => clearInterval(id);
  }, [started, reduced]);

  const current = FLYWHEEL_STAGES[stage];

  return (
    <motion.div
      style={{
        width: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
      }}
      initial={reduced ? false : { opacity: 0, scale: 0.92 }}
      animate={started ? { opacity: 1, scale: 1 } : {}}
      transition={{ duration: 0.7, ease: EASE }}
    >
      {/* Stage counter with pip indicators */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          marginBottom: 20,
        }}
      >
        {FLYWHEEL_STAGES.map((_, i) => (
          <motion.div
            key={i}
            style={{
              width: i === stage ? 16 : 4,
              height: 4,
              borderRadius: 2,
              backgroundColor: i === stage ? "var(--brand-red)" : "rgba(253, 245, 230, 0.12)",
            }}
            animate={{
              width: i === stage ? 16 : 4,
              backgroundColor: i === stage ? "var(--brand-red)" : "rgba(253, 245, 230, 0.12)",
            }}
            transition={{ duration: 0.3, ease: EASE }}
          />
        ))}
      </div>

      {/* Content area — fixed height so position doesn't jump */}
      <div style={{ height: "clamp(180px, 28vh, 280px)", display: "flex", alignItems: "center" }}>
        <AnimatePresence mode="wait">
          <motion.div
            key={stage}
            style={{
              textAlign: "center",
              width: "100%",
            }}
            initial="hidden"
            animate={started ? "visible" : "hidden"}
            exit="exit"
          >
            {/* Headline — word-by-word stagger */}
            <div
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "clamp(28px, 5vw, 56px)",
                lineHeight: 1.1,
                color: "var(--brand-cream)",
                textTransform: "uppercase",
                maxWidth: "clamp(400px, 60vw, 680px)",
                margin: "0 auto",
              }}
            >
              {current.headline.split(" ").map((word, wi) => {
                const isAccent = current.accent && word.replace(/[.,]/g, "") === current.accent;
                return (
                  <motion.span
                    key={`${stage}-${wi}`}
                    custom={wi}
                    variants={reduced ? {} : wordEntrance}
                    style={{
                      display: "inline-block",
                      marginRight: "0.3em",
                      color: isAccent ? "var(--brand-red)" : undefined,
                    }}
                  >
                    {word}
                  </motion.span>
                );
              })}
            </div>

            {/* Supporting text */}
            <motion.p
              variants={reduced ? {} : subEntrance}
              style={{
                fontFamily: "var(--font-body)",
                fontSize: "clamp(14px, 2vw, 18px)",
                lineHeight: 1.5,
                color: "var(--neutral-400)",
                marginTop: "clamp(12px, 2vw, 20px)",
                maxWidth: 480,
                marginLeft: "auto",
                marginRight: "auto",
              }}
            >
              {current.sub}
            </motion.p>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Progress bar */}
      <div
        style={{
          width: "60%",
          maxWidth: 400,
          height: 2,
          background: "rgba(253, 245, 230, 0.06)",
          borderRadius: 2,
          overflow: "hidden",
          marginTop: 32,
        }}
      >
        <motion.div
          key={`${stage}-${started}`}
          style={{
            height: "100%",
            background: "var(--brand-red)",
            borderRadius: 2,
            transformOrigin: "left",
          }}
          initial={{ scaleX: 0 }}
          animate={started ? { scaleX: 1 } : { scaleX: 0 }}
          transition={{
            duration: started ? STAGE_DURATION / 1000 : 0,
            ease: "linear",
          }}
        />
      </div>
    </motion.div>
  );
}

/* ── Rolling counter — infinite odometer ── */

function RollingCounter({ active }: { active: boolean }) {
  const [count, setCount] = useState(0);
  const reduced = useReducedMotion();

  useEffect(() => {
    if (!active) return;
    if (reduced) {
      setCount(148_207);
      return;
    }
    const base = 147_382;
    const start = performance.now();
    let raf: number;
    const tick = (now: number) => {
      const elapsed = (now - start) / 1000;
      setCount(base + Math.floor(elapsed * 19));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active, reduced]);

  return (
    <span style={{ fontVariantNumeric: "tabular-nums" }}>
      {count.toLocaleString()}
    </span>
  );
}

/* ── Inquiry form — soft CTA ── */

const inputStyle: React.CSSProperties = {
  fontFamily: "var(--font-body)",
  fontSize: "clamp(14px, 1.6vw, 16px)",
  color: "var(--brand-cream)",
  backgroundColor: "transparent",
  border: "1px solid var(--neutral-700)",
  borderRadius: 4,
  padding: "10px 14px",
  outline: "none",
  transition: "border-color 0.2s",
  width: "100%",
};

function InquiryForm() {
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">(
    "idle",
  );
  const reduced = useReducedMotion();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("sending");
    const fd = new FormData(e.currentTarget);
    const res = await submitProductionInquiry(fd);
    setStatus(res.success ? "sent" : "error");
  }

  if (status === "sent") {
    return (
      <motion.p
        initial={reduced ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        style={{
          fontFamily: "var(--font-narrative)",
          fontStyle: "italic",
          fontSize: "clamp(16px, 2vw, 20px)",
          color: "var(--brand-pink)",
          marginTop: "clamp(20px, 2vw, 28px)",
        }}
      >
        Got it. Andy will be in touch.
      </motion.p>
    );
  }

  return (
    <div style={{ marginTop: "clamp(20px, 2.5vw, 32px)" }}>
      <form
        onSubmit={handleSubmit}
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 12,
          maxWidth: 360,
          margin: "0 auto",
        }}
      >
        <input
          name="name"
          placeholder="Name"
          required
          style={inputStyle}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = "var(--neutral-500)";
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = "var(--neutral-700)";
          }}
        />
        <input
          name="email"
          type="email"
          placeholder="Email"
          required
          style={inputStyle}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = "var(--neutral-500)";
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = "var(--neutral-700)";
          }}
        />
        <input
          name="phone"
          type="tel"
          placeholder="Phone (optional)"
          style={inputStyle}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = "var(--neutral-500)";
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = "var(--neutral-700)";
          }}
        />
        <button
          type="submit"
          disabled={status === "sending"}
          style={{
            fontFamily: "var(--font-label)",
            fontSize: 11,
            letterSpacing: "0.15em",
            textTransform: "uppercase",
            color: "var(--brand-cream)",
            backgroundColor: "var(--brand-red)",
            border: "none",
            borderRadius: 4,
            padding: "12px 24px",
            cursor: status === "sending" ? "wait" : "pointer",
            opacity: status === "sending" ? 0.6 : 1,
            transition: "opacity 0.2s",
            marginTop: 4,
          }}
        >
          {status === "sending" ? "Sending..." : "Leave your details"}
        </button>
      </form>

      <p
        style={{
          fontFamily: "var(--font-body)",
          fontSize: "clamp(13px, 1.4vw, 14px)",
          color: "var(--neutral-600)",
          marginTop: "clamp(16px, 2vw, 24px)",
        }}
      >
        or email{" "}
        <a
          href="mailto:andy@superbadmedia.com.au"
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
          andy@superbadmedia.com.au
        </a>
      </p>

      {status === "error" && (
        <p
          style={{
            fontFamily: "var(--font-body)",
            fontSize: 14,
            color: "var(--brand-red)",
            marginTop: 8,
          }}
        >
          Something went wrong. Try emailing directly.
        </p>
      )}
    </div>
  );
}

/* ── Data ── */

const SYSTEM_STEPS = [
  { value: "1", label: "Production day", sub: "planned, directed, shot at broadcast quality" },
  { value: "1", label: "YouTube episode", sub: "15–20 minutes, fully produced" },
  { value: "12", label: "Short-form clips", sub: "cut for Reels, TikTok, and Shorts" },
  { value: "∞", label: "Retarget every viewer", sub: "they already know your name when your offer lands" },
  { value: "rolling", label: "Lookalike prospects", sub: "Meta finds people who match your best viewers — always growing" },
];

const DELIVERABLES = [
  "Creative direction, planning, and location scouting",
  "Full production day — broadcast-grade cameras, audio, lighting",
  "One 15–20 minute YouTube episode, fully edited",
  "8–16 short-form clips for Reels, TikTok, and Shorts",
  "Meta ad campaign — strategy, setup, and management",
  "Retargeting and lookalike audiences built from your viewers",
  "Conversion ads from your best-performing content",
  "30 days of reporting and optimisation",
];

/* ════════════════════════════════════════════════════════════════════ */
/* PAGE COMPOSITION                                                   */
/* ════════════════════════════════════════════════════════════════════ */

export function ProductionClient() {
  const [menuOpen, setMenuOpen] = useState(false);

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth" });
    setMenuOpen(false);
  };

  const reduced = useReducedMotion();

  const qualityRef = useRef<HTMLDivElement>(null);
  const qualityInView = useInView(qualityRef, { once: true, amount: 0.4 });

  const audienceRef = useRef<HTMLDivElement>(null);
  const audienceInView = useInView(audienceRef, { once: true, amount: 0.4 });

  const numberRef = useRef<HTMLDivElement>(null);
  const numberInView = useInView(numberRef, { once: true, amount: 0.4 });

  const [displayCount, setDisplayCount] = useState("0.0");
  useEffect(() => {
    if (!numberInView) return;
    if (reduced) {
      setDisplayCount("3.3");
      return;
    }
    const target = 3.3;
    const duration = 1200;
    const start = performance.now();
    let raf: number;
    const tick = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayCount((eased * target).toFixed(1));
      if (progress < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [numberInView, reduced]);

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

  const flywheelRef = useRef<HTMLDivElement>(null);
  const flywheelInView = useInView(flywheelRef, { once: true, amount: 0.2 });

  const cascadeRef = useRef<HTMLDivElement>(null);
  const cascadeInView = useInView(cascadeRef, { once: true, amount: 0.15 });

  const delRef = useRef<HTMLDivElement>(null);
  const delInView = useInView(delRef, { once: true, amount: 0.15 });

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
        {/* ── Screen 1 — Hero (custom section with nav) ── */}
        <section
          className="relative flex h-dvh snap-start flex-col overflow-hidden"
          style={{ backgroundColor: "var(--neutral-900)" }}
        >
          {/* ── Nav (hero only, not sticky) ── */}
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

            {/* Desktop links */}
            <div
              className="hidden sm:flex items-center"
              style={{ gap: "clamp(24px, 3vw, 40px)" }}
            >
              {NAV_LINKS.map((link) => (
                <button
                  key={link.label}
                  onClick={() => scrollToSection(link.id)}
                  style={{
                    fontFamily: "var(--font-label)",
                    fontSize: 10,
                    letterSpacing: "0.2em",
                    textTransform: "uppercase" as const,
                    color: "var(--neutral-500)",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    padding: 0,
                    transition: "color 0.2s",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = "var(--brand-cream)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = "var(--neutral-500)";
                  }}
                >
                  {link.label}
                </button>
              ))}
            </div>

            {/* Mobile menu toggle */}
            <button
              className="flex flex-col gap-[5px] sm:hidden"
              onClick={() => setMenuOpen((o) => !o)}
              aria-label="Menu"
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: 8,
              }}
            >
              <motion.span
                style={{
                  display: "block",
                  width: 22,
                  height: 1.5,
                  backgroundColor: "var(--brand-cream)",
                  borderRadius: 1,
                }}
                animate={
                  menuOpen
                    ? { rotate: 45, y: 6.5 }
                    : { rotate: 0, y: 0 }
                }
              />
              <motion.span
                style={{
                  display: "block",
                  width: 22,
                  height: 1.5,
                  backgroundColor: "var(--brand-cream)",
                  borderRadius: 1,
                }}
                animate={menuOpen ? { opacity: 0 } : { opacity: 1 }}
              />
              <motion.span
                style={{
                  display: "block",
                  width: 22,
                  height: 1.5,
                  backgroundColor: "var(--brand-cream)",
                  borderRadius: 1,
                }}
                animate={
                  menuOpen
                    ? { rotate: -45, y: -6.5 }
                    : { rotate: 0, y: 0 }
                }
              />
            </button>
          </motion.nav>

          {/* Mobile dropdown */}
          <AnimatePresence>
            {menuOpen && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="sm:hidden overflow-hidden px-8"
              >
                <div
                  style={{
                    paddingBottom: 16,
                    display: "flex",
                    flexDirection: "column",
                    gap: 4,
                  }}
                >
                  {NAV_LINKS.map((link) => (
                    <button
                      key={link.label}
                      onClick={() => scrollToSection(link.id)}
                      style={{
                        fontFamily: "var(--font-label)",
                        fontSize: 11,
                        letterSpacing: "0.15em",
                        textTransform: "uppercase" as const,
                        color: "var(--neutral-400)",
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        padding: "8px 0",
                        textAlign: "left" as const,
                      }}
                    >
                      {link.label}
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Hero content — fills remaining space, vertically centred */}
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
                  SuperBad Production
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
                  Ads disappear
                  <span style={{ color: "var(--brand-red)" }}>.</span>
                </motion.h1>
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
                    color: "var(--brand-red)",
                    margin: 0,
                    maxWidth: "14ch",
                  }}
                >
                  Channels compound
                  <span style={{ color: "var(--neutral-100)" }}>.</span>
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
                  Make something worth watching. The audience does the rest.
                </motion.p>
              </motion.div>
            </div>
          </div>
        </section>

        {/* ── Screen 2 — The problem (Redaction) ── */}
        <Screen>
          <Redaction
            generic="We create data-driven content strategies that drive engagement and build brand awareness across all digital channels."
            honest={
              <>
                Most brands spend money to interrupt people who don&rsquo;t
                care
                <span style={{ color: "var(--brand-red)" }}>.</span>
              </>
            }
            honestSub={
              <p
                className="text-pretty"
                style={{
                  fontFamily: "var(--font-body)",
                  fontSize: "clamp(16px, 1.8vw, 22px)",
                  lineHeight: 1.6,
                  color: "var(--neutral-500)",
                  margin: 0,
                }}
              >
                A 15-second skip ad. A carousel nobody saves. A boosted post
                that disappears on Thursday.
              </p>
            }
          />
        </Screen>

        {/* ── Screen 3 — Quality thesis (red surface) ── */}
        <Screen surface="brand" align="center">
          <div ref={qualityRef}>
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
              {revealWords("If it looks cheap, so do you", qualityInView)}
              <motion.span
                style={{ display: "inline-block", color: "var(--neutral-900)" }}
                initial={reduced ? false : { opacity: 0, y: 30, filter: "blur(6px)" }}
                animate={qualityInView ? { opacity: 1, y: 0, filter: "blur(0px)" } : {}}
                transition={{ duration: 0.5, delay: 7 * 0.07, ease: EASE }}
              >
                .
              </motion.span>
            </p>
            <motion.p
              className="text-balance"
              style={{
                fontFamily: "var(--font-narrative)",
                fontSize: "clamp(22px, 3vw, 36px)",
                lineHeight: 1.25,
                fontStyle: "italic",
                color: "rgba(253, 245, 230, 0.7)",
                margin: 0,
                marginTop: "clamp(12px, 2vw, 24px)",
              }}
              initial={reduced ? false : { opacity: 0, y: 16 }}
              animate={qualityInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.6, delay: 0.8, ease: EASE }}
            >
              People judge your business by your content. Not the other way around.
            </motion.p>
          </div>
        </Screen>

        {/* ── Screen 4 — Audience (cream surface) ── */}
        <Screen surface="cream" align="center">
          <div ref={audienceRef}>
            <p
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "clamp(32px, 5.5vw, 72px)",
                lineHeight: 1,
                color: "var(--neutral-900)",
                margin: 0,
              }}
              className="text-balance"
            >
              {revealWords("You don’t need more ads", audienceInView)}
              <motion.span
                style={{ display: "inline-block", color: "var(--brand-red)" }}
                initial={reduced ? false : { opacity: 0, y: 30, filter: "blur(6px)" }}
                animate={audienceInView ? { opacity: 1, y: 0, filter: "blur(0px)" } : {}}
                transition={{ duration: 0.5, delay: 5 * 0.07, ease: EASE }}
              >
                .
              </motion.span>
              <br />
              {revealWords("You need an audience", audienceInView, 0.55)}
              <motion.span
                style={{ display: "inline-block", color: "var(--brand-red)" }}
                initial={reduced ? false : { opacity: 0, y: 30, filter: "blur(6px)" }}
                animate={audienceInView ? { opacity: 1, y: 0, filter: "blur(0px)" } : {}}
                transition={{ duration: 0.5, delay: 0.55 + 4 * 0.07, ease: EASE }}
              >
                .
              </motion.span>
            </p>
            <motion.p
              className="text-pretty"
              style={{
                fontFamily: "var(--font-body)",
                fontSize: "clamp(16px, 2vw, 22px)",
                lineHeight: 1.6,
                color: "var(--neutral-900)",
                margin: "0 auto",
                marginTop: "clamp(20px, 3vw, 36px)",
                maxWidth: "44ch",
              }}
              initial={reduced ? { opacity: 0.5 } : { opacity: 0, y: 16 }}
              animate={audienceInView ? { opacity: 0.5, y: 0 } : {}}
              transition={{ duration: 0.6, delay: 1.2, ease: EASE }}
            >
              Ads stop working the day you stop paying. An audience keeps
              working whether you pay or not.
            </motion.p>
          </div>
        </Screen>

        {/* ── Screen 5 — Bridge: "How" ── */}
        <Screen align="center">
          <Statement>
            <p
              style={{
                fontFamily: "var(--font-label)",
                fontSize: "var(--text-micro)",
                letterSpacing: "0.35em",
                textTransform: "uppercase",
                color: "var(--brand-red)",
                margin: 0,
                marginBottom: "clamp(16px, 2vw, 28px)",
              }}
            >
              The model
            </p>
            <p
              className="text-balance"
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "clamp(28px, 4.5vw, 52px)",
                lineHeight: 1.05,
                color: "var(--neutral-100)",
                textTransform: "uppercase",
                margin: 0,
              }}
            >
              One shoot day becomes a compounding audience machine.
            </p>
          </Statement>
          <Statement delay={0.15}>
            <p
              className="text-pretty"
              style={{
                fontFamily: "var(--font-body)",
                fontSize: "clamp(15px, 1.8vw, 20px)",
                lineHeight: 1.6,
                color: "var(--neutral-500)",
                margin: "0 auto",
                marginTop: "clamp(16px, 2vw, 28px)",
                maxWidth: "40ch",
              }}
            >
              We stopped throwing budget at impressions and built a system
              where every piece of content feeds the next.
            </p>
          </Statement>
        </Screen>

        {/* ── Screen 6 — The flywheel (kinetic typography) ── */}
        <Screen align="center" id="flywheel">
          <div
            ref={flywheelRef}
            style={{
              width: "100%",
              maxWidth: 900,
              margin: "0 auto",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "clamp(20px, 3vw, 32px)",
            }}
          >
            <span
              style={{
                fontFamily: "var(--font-label)",
                fontSize: "var(--text-micro)",
                letterSpacing: "0.28em",
                textTransform: "uppercase",
                color: "var(--brand-red)",
              }}
            >
              The flywheel
            </span>
            <FlywheelLoop inView={flywheelInView} />
          </div>
        </Screen>

        {/* ── Screen 7 — The system ── */}
        <Screen surface={1} dense>
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
              One shoot day
            </span>
            <h2
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "clamp(24px, 4vw, 36px)",
                lineHeight: 1.05,
                color: "var(--brand-cream)",
                textTransform: "uppercase",
                margin: "12px 0 0",
              }}
              className="text-balance"
            >
              Everything else follows.
            </h2>
          </Statement>
          <div
            ref={cascadeRef}
            style={{ marginTop: "clamp(16px, 2vw, 24px)" }}
          >
            {SYSTEM_STEPS.map((step, i) => (
              <motion.div
                key={step.label}
                initial={reduced ? false : { opacity: 0, x: -16 }}
                animate={cascadeInView ? { opacity: 1, x: 0 } : {}}
                transition={
                  reduced
                    ? { duration: 0 }
                    : {
                        type: "spring",
                        damping: 20,
                        stiffness: 90,
                        delay: 0.15 + i * 0.12,
                      }
                }
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  gap: "clamp(16px, 3vw, 32px)",
                  padding: "clamp(8px, 1vw, 12px) 0",
                  borderBottom:
                    i < SYSTEM_STEPS.length - 1
                      ? "1px solid var(--neutral-700)"
                      : "none",
                }}
              >
                <span
                  style={{
                    fontFamily: "var(--font-display)",
                    fontSize: step.value === "rolling" ? "clamp(16px, 2.2vw, 24px)" : "clamp(24px, 3.5vw, 36px)",
                    lineHeight: 1,
                    color:
                      i >= 3 ? "var(--brand-red)" : "var(--brand-cream)",
                    minWidth: "clamp(56px, 8vw, 80px)",
                    textAlign: "right",
                    flexShrink: 0,
                  }}
                >
                  {step.value === "rolling" ? (
                    <RollingCounter active={cascadeInView} />
                  ) : (
                    step.value
                  )}
                </span>
                <div>
                  <p
                    style={{
                      fontFamily: "var(--font-body)",
                      fontSize: "clamp(15px, 1.8vw, 18px)",
                      color: "var(--brand-cream)",
                      margin: 0,
                      fontWeight: 500,
                    }}
                  >
                    {step.label}
                  </p>
                  <p
                    style={{
                      fontFamily: "var(--font-body)",
                      fontSize: "clamp(13px, 1.4vw, 15px)",
                      color: "var(--neutral-500)",
                      margin: "2px 0 0",
                    }}
                  >
                    {step.sub}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
          <motion.p
            initial={reduced ? false : { opacity: 0 }}
            animate={cascadeInView ? { opacity: 1 } : {}}
            transition={
              reduced ? { duration: 0 } : { duration: 0.6, delay: 0.8 }
            }
            className="text-pretty"
            style={{
              fontFamily: "var(--font-narrative)",
              fontStyle: "italic",
              fontSize: "clamp(15px, 1.8vw, 20px)",
              lineHeight: 1.5,
              color: "var(--brand-pink)",
              margin: 0,
              marginTop: "clamp(12px, 1.5vw, 20px)",
              maxWidth: "48ch",
            }}
          >
            Meta and Google have spent years profiling your future
            customers — every search, every purchase, every 2am scroll.
            We point that at the people already watching your content.
          </motion.p>
        </Screen>

        {/* ── Screen 8 — The numbers ── */}
        <Screen align="center">
          <div ref={numberRef}>
            <motion.p
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "clamp(72px, 16vw, 180px)",
                lineHeight: 0.9,
                color: "var(--brand-red)",
                margin: 0,
              }}
              initial={reduced ? false : { opacity: 0, scale: 0.7, filter: "blur(10px)" }}
              animate={numberInView ? { opacity: 1, scale: 1, filter: "blur(0px)" } : {}}
              transition={{ duration: 0.8, ease: EASE }}
            >
              {displayCount}×
            </motion.p>
          </div>
          <Statement delay={0.12}>
            <p
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "clamp(22px, 3.5vw, 36px)",
                lineHeight: 1.1,
                color: "var(--brand-cream)",
                textTransform: "uppercase",
                margin: 0,
                marginTop: "clamp(8px, 1.5vw, 16px)",
              }}
            >
              More clicks. Same budget.
            </p>
          </Statement>
          <Statement delay={0.22}>
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                gap: "clamp(24px, 5vw, 56px)",
                marginTop: "clamp(24px, 3vw, 40px)",
                alignItems: "center",
              }}
            >
              <div style={{ textAlign: "center" }}>
                <p
                  style={{
                    fontFamily: "var(--font-display)",
                    fontSize: "clamp(28px, 5vw, 48px)",
                    color: "var(--neutral-500)",
                    margin: 0,
                    lineHeight: 1,
                  }}
                >
                  2,500
                </p>
                <p
                  style={{
                    fontFamily: "var(--font-body)",
                    fontSize: "clamp(12px, 1.4vw, 14px)",
                    color: "var(--neutral-600)",
                    margin: "8px 0 0",
                  }}
                >
                  cold clicks
                </p>
              </div>
              <div
                style={{
                  width: 1,
                  height: 48,
                  backgroundColor: "var(--neutral-700)",
                }}
              />
              <div style={{ textAlign: "center" }}>
                <p
                  style={{
                    fontFamily: "var(--font-display)",
                    fontSize: "clamp(28px, 5vw, 48px)",
                    color: "var(--brand-cream)",
                    margin: 0,
                    lineHeight: 1,
                  }}
                >
                  8,300
                </p>
                <p
                  style={{
                    fontFamily: "var(--font-body)",
                    fontSize: "clamp(12px, 1.4vw, 14px)",
                    color: "var(--neutral-500)",
                    margin: "8px 0 0",
                  }}
                >
                  warm clicks
                </p>
              </div>
            </div>
            <p
              style={{
                fontFamily: "var(--font-body)",
                fontSize: "clamp(13px, 1.4vw, 15px)",
                color: "var(--neutral-600)",
                marginTop: "clamp(16px, 2vw, 24px)",
              }}
            >
              Based on $2,500/month Meta ad spend
            </p>
          </Statement>
          <Statement delay={0.3}>
            <p
              className="text-pretty"
              style={{
                fontFamily: "var(--font-narrative)",
                fontStyle: "italic",
                fontSize: "clamp(16px, 1.8vw, 20px)",
                lineHeight: 1.5,
                color: "var(--brand-pink)",
                margin: "clamp(12px, 2vw, 20px) auto 0",
                maxWidth: "38ch",
              }}
            >
              The only difference is people already knowing your name.
            </p>
          </Statement>
        </Screen>

        {/* ── Screen 9 — The real sell (Redaction) ── */}
        <Screen>
          <Redaction
            generic="We're a full-service creative agency passionate about telling your brand's story through innovative, best-in-class content solutions."
            honest={
              <>
                The best way to sell is to never look like you&rsquo;re trying
                <span style={{ color: "var(--brand-red)" }}>.</span>
              </>
            }
            honestSub={
              <p
                className="text-pretty"
                style={{
                  fontFamily: "var(--font-narrative)",
                  fontSize: "clamp(18px, 2vw, 26px)",
                  lineHeight: 1.5,
                  fontStyle: "italic",
                  color: "var(--brand-pink)",
                  margin: 0,
                }}
              >
                People love to buy. They hate being sold to. Most marketing
                gets that backwards.
              </p>
            }
          />
        </Screen>

        {/* ── Screen 10 — Deliverables ── */}
        <Screen surface={1} id="deliverables" dense>
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
                fontSize: "clamp(28px, 5vw, 48px)",
                lineHeight: 1.05,
                color: "var(--brand-cream)",
                textTransform: "uppercase",
                margin: "16px 0 0",
              }}
            >
              Everything from one shoot day.
            </h2>
          </Statement>
          <div
            ref={delRef}
            style={{ marginTop: "clamp(24px, 3vw, 40px)" }}
          >
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {DELIVERABLES.map((item, i) => (
                <motion.li
                  key={item}
                  initial={reduced ? false : { opacity: 0, x: -12 }}
                  animate={delInView ? { opacity: 1, x: 0 } : {}}
                  transition={
                    reduced
                      ? { duration: 0 }
                      : {
                          duration: 0.5,
                          ease: EASE,
                          delay: 0.15 + i * 0.08,
                        }
                  }
                  style={{
                    fontFamily: "var(--font-body)",
                    fontSize: "clamp(14px, 1.8vw, 16px)",
                    lineHeight: 1.5,
                    color: "var(--neutral-300)",
                    padding: "14px 0",
                    borderBottom: "1px solid var(--neutral-700)",
                    display: "flex",
                    alignItems: "baseline",
                    gap: 16,
                  }}
                >
                  <span
                    style={{
                      fontFamily: "var(--font-label)",
                      fontSize: 10,
                      color: "var(--brand-red)",
                      fontVariantNumeric: "tabular-nums",
                      minWidth: 20,
                    }}
                  >
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  {item}
                </motion.li>
              ))}
            </ul>
          </div>
        </Screen>

        {/* ── Screen 11 — CTA ── */}
        <Screen align="center" id="pricing">
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
            <p
              style={{
                fontFamily: "var(--font-narrative)",
                fontStyle: "italic",
                fontSize: "clamp(22px, 3vw, 32px)",
                lineHeight: 1.4,
                color: "var(--brand-cream)",
                margin: 0,
                textWrap: "balance",
              }}
            >
              Pilot engagements start from $5,997+GST.
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
              One pilot to prove the model. Then we scale what works.
            </p>
          </Statement>
          <Statement delay={0.22}>
            <div style={{ marginTop: "clamp(28px, 3vw, 44px)" }}>
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
                Get in touch.
              </h2>
              <InquiryForm />
            </div>
          </Statement>
        </Screen>
      </div>
    </main>
  );
}
