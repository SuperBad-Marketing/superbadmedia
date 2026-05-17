"use client";

import { useRef, useState, useEffect } from "react";
import { motion, useInView, useReducedMotion } from "framer-motion";
import Link from "next/link";

const EASE = [0.22, 1, 0.36, 1] as const;

/* ── NavLink ── */
function NavLink({
  href,
  children,
  external,
  onClick,
}: {
  href: string;
  children: React.ReactNode;
  external?: boolean;
  onClick?: () => void;
}) {
  const style: React.CSSProperties = {
    fontFamily: "var(--font-label)",
    fontSize: "var(--text-micro)",
    letterSpacing: "0.28em",
    textTransform: "uppercase",
    color: "var(--neutral-500)",
    textDecoration: "none",
    transition: "color 0.2s",
  };

  const handlers = {
    onMouseEnter: (e: React.MouseEvent) => {
      (e.currentTarget as HTMLElement).style.color = "var(--neutral-300)";
    },
    onMouseLeave: (e: React.MouseEvent) => {
      (e.currentTarget as HTMLElement).style.color = "var(--neutral-500)";
    },
  };

  if (external) {
    return (
      <a href={href} style={style} {...handlers} onClick={onClick}>
        {children}
      </a>
    );
  }

  return (
    <Link href={href} style={style} {...handlers} onClick={onClick}>
      {children}
    </Link>
  );
}

/* ── Mobile menu button (three-line → X) ── */
function MenuToggle({
  open,
  onToggle,
}: {
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      aria-label={open ? "Close menu" : "Open menu"}
      onClick={onToggle}
      className="relative z-50 flex h-10 w-10 items-center justify-center sm:hidden"
      style={{ background: "none", border: "none", cursor: "pointer" }}
    >
      <div className="flex w-5 flex-col items-end gap-[5px]">
        <motion.span
          className="block h-[1.5px] rounded-full"
          style={{ backgroundColor: "var(--neutral-300)", originX: 0.5 }}
          animate={
            open
              ? { rotate: 45, y: 3.25, width: 20 }
              : { rotate: 0, y: 0, width: 20 }
          }
          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        />
        <motion.span
          className="block h-[1.5px] rounded-full"
          style={{ backgroundColor: "var(--neutral-300)" }}
          animate={open ? { opacity: 0, width: 0 } : { opacity: 1, width: 14 }}
          transition={{ duration: 0.2 }}
        />
        <motion.span
          className="block h-[1.5px] rounded-full"
          style={{ backgroundColor: "var(--neutral-300)", originX: 0.5 }}
          animate={
            open
              ? { rotate: -45, y: -3.25, width: 20 }
              : { rotate: 0, y: 0, width: 20 }
          }
          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        />
      </div>
    </button>
  );
}

/* ── Redaction, the "generic → honest" reveal ── */
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
            transition: "color 0.4s, background-size 0.8s cubic-bezier(0.22, 1, 0.36, 1)",
            backgroundImage: `linear-gradient(transparent 46%, var(--brand-red) 46%, var(--brand-red) 54%, transparent 54%)`,
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

      {/* Honest text */}
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

/* ── Screen, a single snap section ── */
function Screen({
  children,
  align = "left",
  surface = 0,
}: {
  children: React.ReactNode;
  align?: "left" | "center";
  surface?: 0 | 1 | "brand";
}) {
  const bg =
    surface === "brand"
      ? "var(--brand-red)"
      : surface === 1
        ? "var(--surface-1)"
        : "var(--neutral-900)";

  return (
    <section
      className="relative flex h-dvh snap-start flex-col justify-center overflow-hidden"
      style={{
        backgroundColor: bg,
        paddingTop: "88px",
        paddingBottom: "40px",
      }}
    >
      <div
        className={`w-full px-8 sm:px-16 md:px-24 ${
          align === "center" ? "text-center mx-auto" : ""
        }`}
        style={{ maxWidth: align === "center" ? "64ch" : undefined }}
      >
        {children}
      </div>
    </section>
  );
}

/* ── Statement, a plain confident statement with spring entrance ── */
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

/* ── Services Marquee, kinetic "what we do" ── */
function ServicesMarquee({ reduced }: { reduced: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const entranceInView = useInView(ref, { once: true, amount: 0.3 });
  const scrollInView = useInView(ref, { amount: 0.3 });

  const row1 = [
    "Media Production",
    "Content Creation",
    "Brand Strategy",
    "Ad Campaigns",
    "Performance Marketing",
    "Creative Direction",
  ];

  const row2 = [
    "Short-Form Video",
    "Long-Form Series",
    "Photography",
    "Social Content",
    "Paid Social",
    "Retargeting",
  ];

  const maskStyle: React.CSSProperties = {
    overflow: "hidden",
    maskImage:
      "linear-gradient(to right, transparent, black 8%, black 92%, transparent)",
    WebkitMaskImage:
      "linear-gradient(to right, transparent, black 8%, black 92%, transparent)",
  };

  return (
    <section
      ref={ref}
      className="relative flex h-dvh snap-start flex-col justify-center overflow-hidden"
      style={{
        backgroundColor: "var(--surface-1)",
        paddingTop: "88px",
        paddingBottom: "40px",
      }}
    >
      <motion.p
        style={{
          fontFamily: "var(--font-label)",
          fontSize: "var(--text-micro)",
          letterSpacing: "0.35em",
          textTransform: "uppercase",
          color: "var(--brand-pink)",
          margin: 0,
          marginBottom: "clamp(28px, 3.5vw, 48px)",
          paddingLeft: "clamp(32px, 5vw, 96px)",
        }}
        initial={reduced ? false : { opacity: 0, y: 8 }}
        animate={entranceInView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.5, ease: EASE }}
      >
        What we do
      </motion.p>

      <div style={maskStyle}>
        <div
          style={{
            display: "flex",
            whiteSpace: "nowrap",
            animation: !reduced
              ? "marquee-left 18s linear infinite"
              : "none",
            animationPlayState: scrollInView ? "running" : "paused",
          }}
        >
          {[0, 1].map((copy) =>
            row1.map((item, i) => (
              <span
                key={`r1-${copy}-${i}`}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  flexShrink: 0,
                  fontFamily: "var(--font-display)",
                  fontSize: "clamp(36px, 6vw, 80px)",
                  lineHeight: 1,
                  color: "var(--neutral-100)",
                }}
              >
                {item}
                <span
                  style={{
                    color: "var(--brand-red)",
                    margin: "0 clamp(20px, 3vw, 40px)",
                    fontSize: "0.4em",
                  }}
                >
                  ●
                </span>
              </span>
            ))
          )}
        </div>
      </div>

      <div style={{ ...maskStyle, marginTop: "clamp(12px, 1.5vw, 24px)" }}>
        <div
          style={{
            display: "flex",
            whiteSpace: "nowrap",
            animation: !reduced
              ? "marquee-right 15s linear infinite"
              : "none",
            animationPlayState: scrollInView ? "running" : "paused",
          }}
        >
          {[0, 1].map((copy) =>
            row2.map((item, i) => (
              <span
                key={`r2-${copy}-${i}`}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  flexShrink: 0,
                  fontFamily: "var(--font-display)",
                  fontSize: "clamp(28px, 4.5vw, 60px)",
                  lineHeight: 1,
                  color: "var(--neutral-300)",
                }}
              >
                {item}
                <span
                  style={{
                    color: "var(--brand-pink)",
                    margin: "0 clamp(16px, 2.5vw, 36px)",
                    fontSize: "0.4em",
                  }}
                >
                  ●
                </span>
              </span>
            ))
          )}
        </div>
      </div>

      <motion.p
        style={{
          fontFamily: "var(--font-narrative)",
          fontSize: "clamp(16px, 1.8vw, 22px)",
          lineHeight: 1.5,
          fontStyle: "italic",
          color: "var(--brand-pink)",
          margin: 0,
          marginTop: "clamp(28px, 3.5vw, 48px)",
          paddingLeft: "clamp(32px, 5vw, 96px)",
        }}
        initial={reduced ? false : { opacity: 0 }}
        animate={entranceInView ? { opacity: 0.7 } : { opacity: 0 }}
        transition={{ duration: 0.6, delay: 0.4, ease: EASE }}
      >
        No departments. No hand-offs. Just the work.
      </motion.p>
    </section>
  );
}

export default function HomePage() {
  const [menuOpen, setMenuOpen] = useState(false);
  const reduced = useReducedMotion();

  const entertainRef = useRef<HTMLDivElement>(null);
  const entertainInView = useInView(entertainRef, { once: true, amount: 0.4 });

  const alignRef = useRef<HTMLDivElement>(null);
  const alignInView = useInView(alignRef, { once: true, amount: 0.4 });

  const emotionRef = useRef<HTMLDivElement>(null);
  const emotionInView = useInView(emotionRef, { once: true, amount: 0.4 });

  const patienceRef = useRef<HTMLDivElement>(null);
  const patienceInView = useInView(patienceRef, { once: true, amount: 0.4 });

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

      {/* ── Fixed nav ── */}
      <motion.nav
        className="fixed left-0 right-0 top-0 z-50 flex items-center justify-between px-8 py-3 sm:px-16 sm:py-4"
        style={{
          backgroundColor: "var(--neutral-900)",
          borderBottom: "1px solid rgba(253, 245, 230, 0.06)",
        }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      >
        <p
          style={{
            fontFamily: "var(--font-logo)",
            fontSize: "clamp(20px, 2.5vw, 26px)",
            color: "var(--neutral-100)",
            margin: 0,
          }}
        >
          SuperBad
        </p>

        {/* Desktop links */}
        <div className="hidden items-center gap-6 sm:flex">
          <NavLink href="/production">Production</NavLink>
          <NavLink href="/trial-shoot">Trial Shoot</NavLink>
          <NavLink href="/rundown">Brand DNA</NavLink>
          <NavLink href="/workshop">Workshop</NavLink>
          <NavLink href="mailto:andy@superbadmedia.com.au" external>
            Get in Touch
          </NavLink>
        </div>

        {/* Mobile hamburger */}
        <MenuToggle open={menuOpen} onToggle={() => setMenuOpen((o) => !o)} />
      </motion.nav>

      {/* ── Mobile menu overlay ── */}
      <motion.div
        className="fixed inset-0 z-40 flex flex-col items-center justify-center gap-10 sm:hidden"
        style={{ backgroundColor: "var(--neutral-900)" }}
        initial={false}
        animate={menuOpen ? { opacity: 1, pointerEvents: "auto" as const } : { opacity: 0, pointerEvents: "none" as const }}
        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      >
        <motion.div
          animate={menuOpen ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ delay: menuOpen ? 0.1 : 0, duration: 0.3 }}
        >
          <NavLink href="/production" onClick={() => setMenuOpen(false)}>
            Production
          </NavLink>
        </motion.div>
        <motion.div
          animate={menuOpen ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ delay: menuOpen ? 0.18 : 0, duration: 0.3 }}
        >
          <NavLink href="/trial-shoot" onClick={() => setMenuOpen(false)}>
            Trial Shoot
          </NavLink>
        </motion.div>
        <motion.div
          animate={menuOpen ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ delay: menuOpen ? 0.26 : 0, duration: 0.3 }}
        >
          <NavLink href="/rundown" onClick={() => setMenuOpen(false)}>
            Brand DNA
          </NavLink>
        </motion.div>
        <motion.div
          animate={menuOpen ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ delay: menuOpen ? 0.34 : 0, duration: 0.3 }}
        >
          <NavLink href="/workshop" onClick={() => setMenuOpen(false)}>
            Workshop
          </NavLink>
        </motion.div>
        <motion.div
          animate={menuOpen ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ delay: menuOpen ? 0.42 : 0, duration: 0.3 }}
        >
          <NavLink
            href="mailto:andy@superbadmedia.com.au"
            external
            onClick={() => setMenuOpen(false)}
          >
            Get in Touch
          </NavLink>
        </motion.div>
      </motion.div>

      {/* ── Scroll-snap container ── */}
      <div className="relative z-10 h-dvh snap-y snap-mandatory overflow-y-scroll">
        {/* ── Screen 1, Hero ── */}
        <Screen>
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
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              style={{
                fontFamily: "var(--font-label)",
                fontSize: "var(--text-micro)",
                letterSpacing: "0.35em",
                textTransform: "uppercase",
                color: "var(--neutral-500)",
                marginBottom: "clamp(16px, 2vw, 28px)",
              }}
            >
              Creative media &amp; marketing &middot; Melbourne
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
              Marketing that people actually feel
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
              }}
            >
              Built around audience behaviour, emotion, and psychology.
              Not&nbsp;vanity&nbsp;metrics.
            </motion.p>
          </motion.div>

            {/* Decorative concentric circles */}
            <div
              className="pointer-events-none absolute inset-0 hidden items-center justify-end overflow-hidden sm:flex"
              aria-hidden
              style={{ paddingRight: "8%" }}
            >
              <div
                className="relative"
                style={{
                  width: "clamp(260px, 30vw, 420px)",
                  height: "clamp(260px, 30vw, 420px)",
                }}
              >
                <motion.div
                  className="absolute inset-0"
                  style={{
                    borderRadius: "50%",
                    border: "1px solid rgba(178, 40, 72, 0.1)",
                  }}
                  animate={reduced ? undefined : { rotate: 360 }}
                  transition={
                    reduced
                      ? undefined
                      : { duration: 80, repeat: Infinity, ease: "linear" }
                  }
                />
                <motion.div
                  className="absolute"
                  style={{
                    inset: "15%",
                    borderRadius: "50%",
                    border: "1px solid rgba(244, 160, 176, 0.07)",
                  }}
                  animate={reduced ? undefined : { rotate: -360 }}
                  transition={
                    reduced
                      ? undefined
                      : { duration: 120, repeat: Infinity, ease: "linear" }
                  }
                />
                <div
                  className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    backgroundColor: "var(--brand-red)",
                    opacity: 0.25,
                  }}
                />
              </div>
            </div>
        </Screen>

        {/* ── Screen 2, Statement: entertainment platform ── */}
        <Screen surface={1}>
          <div ref={entertainRef}>
            <p
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "clamp(32px, 5.5vw, 72px)",
                lineHeight: 1,
                color: "var(--neutral-100)",
                margin: 0,
                maxWidth: "20ch",
              }}
              className="text-balance"
            >
              {revealWords("Social media is an entertainment platform", entertainInView)}
              <motion.span
                style={{ display: "inline-block", color: "var(--brand-red)" }}
                initial={reduced ? false : { opacity: 0, y: 30, filter: "blur(6px)" }}
                animate={entertainInView ? { opacity: 1, y: 0, filter: "blur(0px)" } : {}}
                transition={{ duration: 0.5, delay: 6 * 0.07, ease: EASE }}
              >
                .
              </motion.span>
            </p>
            <motion.p
              className="text-pretty"
              style={{
                fontFamily: "var(--font-body)",
                fontSize: "clamp(16px, 1.8vw, 22px)",
                lineHeight: 1.6,
                color: "var(--neutral-500)",
                margin: 0,
                marginTop: "clamp(20px, 3vw, 40px)",
                maxWidth: "44ch",
              }}
              initial={reduced ? false : { opacity: 0, y: 16 }}
              animate={entertainInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.6, delay: 0.8, ease: EASE }}
            >
              Not a sales platform. Not a brochure with a comments section.
              People open Instagram for the same reason they turn on Netflix
             , to relate to something, or to be entertained. Not to be sold
              something.
            </motion.p>
          </div>
        </Screen>

        {/* ── Screen 3, Redaction #1 ── */}
        <Screen>
          <Redaction
            generic="We create data-driven content strategies that drive engagement and build brand awareness across all digital channels."
            honest={
              <>
                We make things people actually want to watch
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
                And when they do watch? We capture that attention and turn
                it into revenue.
              </p>
            }
          />
        </Screen>

        {/* ── Screen 4, Emotion over features (brand red) ── */}
        <Screen surface="brand">
          <div ref={emotionRef}>
            <p
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "clamp(32px, 5.5vw, 72px)",
                lineHeight: 1,
                color: "var(--neutral-100)",
                margin: 0,
                maxWidth: "20ch",
              }}
              className="text-balance"
            >
              {revealWords("People don’t buy what you sell", emotionInView)}
              <motion.span
                style={{ display: "inline-block", color: "var(--neutral-900)" }}
                initial={reduced ? false : { opacity: 0, y: 30, filter: "blur(6px)" }}
                animate={emotionInView ? { opacity: 1, y: 0, filter: "blur(0px)" } : {}}
                transition={{ duration: 0.5, delay: 6 * 0.07, ease: EASE }}
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
                maxWidth: "22ch",
              }}
              initial={reduced ? false : { opacity: 0, y: 16 }}
              animate={emotionInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.6, delay: 0.7, ease: EASE }}
            >
              They buy how you make them feel.
            </motion.p>
            <motion.p
              className="text-pretty"
              style={{
                fontFamily: "var(--font-body)",
                fontSize: "clamp(16px, 1.8vw, 22px)",
                lineHeight: 1.6,
                color: "rgba(253, 245, 230, 0.55)",
                margin: 0,
                marginTop: "clamp(20px, 3vw, 36px)",
                maxWidth: "44ch",
              }}
              initial={reduced ? false : { opacity: 0, y: 16 }}
              animate={emotionInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.6, delay: 1.0, ease: EASE }}
            >
              Every purchase decision is emotional first. The logic comes after
             , to justify what they already wanted.
            </motion.p>
          </div>
        </Screen>

        {/* ── Screen 5, The anti-sell ── */}
        <Screen>
          <Redaction
            generic="Our proven methodology delivers measurable ROI through strategic multi-channel campaigns and performance-driven creative."
            honest={
              <>
                The best way to sell is to never try selling
                <span style={{ color: "var(--brand-red)" }}>.</span>
              </>
            }
            honestSub={
              <>
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
                  Make people want to buy instead.
                </p>
                <p
                  className="text-pretty"
                  style={{
                    fontFamily: "var(--font-body)",
                    fontSize: "clamp(16px, 1.8vw, 22px)",
                    lineHeight: 1.6,
                    color: "var(--neutral-500)",
                    margin: 0,
                    marginTop: "clamp(12px, 1.5vw, 20px)",
                  }}
                >
                  They love to buy. They just hate being sold to.
                </p>
              </>
            }
          />
        </Screen>

        {/* ── Screen 6, Patience (eight touchpoints) ── */}
        <Screen align="center" surface={1}>
          <div
            ref={patienceRef}
            style={{
              display: "flex",
              gap: "clamp(8px, 1.2vw, 14px)",
              justifyContent: "center",
              marginBottom: "clamp(24px, 3vw, 40px)",
            }}
            aria-hidden
          >
            {Array.from({ length: 8 }).map((_, i) => (
              <motion.div
                key={i}
                style={{
                  width: "clamp(6px, 0.8vw, 10px)",
                  height: "clamp(6px, 0.8vw, 10px)",
                  borderRadius: "50%",
                  backgroundColor:
                    i < 2 ? "var(--brand-red)" : "var(--brand-pink)",
                }}
                initial={
                  reduced ? { opacity: 0.15 } : { opacity: 0.15, scale: 0.5 }
                }
                animate={
                  patienceInView
                    ? { opacity: i < 2 ? 0.9 : 0.4, scale: 1 }
                    : {}
                }
                transition={{
                  delay: i < 2 ? 0.2 + i * 0.15 : 0.7 + (i - 2) * 0.15,
                  type: "spring",
                  damping: 15,
                  stiffness: 200,
                }}
              />
            ))}
          </div>
          <Statement>
            <p
              style={{
                fontFamily: "var(--font-body)",
                fontSize: "clamp(17px, 1.8vw, 22px)",
                lineHeight: 1.8,
                color: "var(--neutral-400)",
                margin: "0 auto",
                maxWidth: "38ch",
              }}
              className="text-pretty"
            >
              Most give up after two touchpoints. It takes about eight.
            </p>
          </Statement>
          <Statement delay={0.15}>
            <p
              style={{
                fontFamily: "var(--font-narrative)",
                fontSize: "clamp(22px, 2.8vw, 32px)",
                lineHeight: 1.4,
                fontStyle: "italic",
                color: "var(--neutral-100)",
                margin: "0 auto",
                marginTop: "clamp(20px, 3vw, 36px)",
                maxWidth: "28ch",
              }}
              className="text-balance"
            >
              That&rsquo;s not a stat. That&rsquo;s patience.
            </p>
          </Statement>
        </Screen>

        {/* ── Bridge, consistency requires alignment ── */}
        <Screen align="center">
          <Statement>
            <p
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "clamp(28px, 4.5vw, 56px)",
                lineHeight: 1.1,
                color: "var(--neutral-100)",
                margin: "0 auto",
                maxWidth: "18ch",
              }}
              className="text-balance"
            >
              Eight touchpoints. Same voice, same feeling, same story. Every time
              <span style={{ color: "var(--brand-red)" }}>.</span>
            </p>
          </Statement>
          <Statement delay={0.15}>
            <p
              style={{
                fontFamily: "var(--font-body)",
                fontSize: "clamp(16px, 1.8vw, 22px)",
                lineHeight: 1.6,
                color: "var(--neutral-500)",
                margin: "0 auto",
                marginTop: "clamp(20px, 3vw, 36px)",
                maxWidth: "36ch",
              }}
              className="text-pretty"
            >
              That only works when everything comes from the same place.
            </p>
          </Statement>
        </Screen>

        {/* ── Screen 7, Four agencies ── */}
        <Screen surface={1}>
          <div ref={alignRef}>
            <p
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "clamp(32px, 5.5vw, 72px)",
                lineHeight: 1,
                color: "var(--neutral-100)",
                margin: 0,
                maxWidth: "20ch",
              }}
              className="text-balance"
            >
              {revealWords("Four agencies. None of them have met", alignInView)}
              <motion.span
                style={{ display: "inline-block", color: "var(--brand-red)" }}
                initial={reduced ? false : { opacity: 0, y: 30, filter: "blur(6px)" }}
                animate={alignInView ? { opacity: 1, y: 0, filter: "blur(0px)" } : {}}
                transition={{ duration: 0.5, delay: 7 * 0.07, ease: EASE }}
              >
                .
              </motion.span>
            </p>
            <motion.p
              className="text-pretty"
              style={{
                fontFamily: "var(--font-body)",
                fontSize: "clamp(16px, 1.8vw, 22px)",
                lineHeight: 1.6,
                color: "var(--neutral-500)",
                margin: 0,
                marginTop: "clamp(20px, 3vw, 40px)",
                maxWidth: "44ch",
              }}
              initial={reduced ? false : { opacity: 0, y: 16 }}
              animate={alignInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.6, delay: 0.8, ease: EASE }}
            >
              Your ad strategist works at one agency. Your creative director
              at another. Your content creator at a third. Your brand
              strategist at a fourth. Four different businesses, none of
              which have met, all producing work that pulls in different
              directions. The messaging doesn&rsquo;t align. The trust
              doesn&rsquo;t build. And the results don&rsquo;t compound.
            </motion.p>
            <motion.p
              className="text-pretty"
              style={{
                fontFamily: "var(--font-narrative)",
                fontSize: "clamp(18px, 2.2vw, 26px)",
                lineHeight: 1.5,
                fontStyle: "italic",
                color: "var(--brand-pink)",
                margin: 0,
                marginTop: "clamp(16px, 2vw, 28px)",
                maxWidth: "36ch",
              }}
              initial={reduced ? false : { opacity: 0, y: 16 }}
              animate={alignInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.6, delay: 1.1, ease: EASE }}
            >
              Everything your audience sees, hears, and feels is your brand.
              When all of it comes from the same place, it starts to align.
              Trust builds. And people only buy from people they trust.
            </motion.p>
          </div>
        </Screen>

        {/* ── Bridge, the answer ── */}
        <Screen align="center">
          <Statement>
            <p
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "clamp(36px, 6vw, 80px)",
                lineHeight: 1,
                color: "var(--neutral-100)",
                margin: "0 auto",
              }}
            >
              So we do all of it
              <span style={{ color: "var(--brand-red)" }}>.</span>
            </p>
          </Statement>
        </Screen>

        {/* ── Screen 8, What we actually do ── */}
        <Screen>
          <Redaction
            generic="We’re a full-service creative agency passionate about telling your brand’s story through innovative, best-in-class content solutions."
            honest={
              <span>
                We make short-form and long-form content. Take photographs.
                Write strategies. Build campaigns. Run your ads
                <span style={{ color: "var(--brand-red)" }}>.</span>
              </span>
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
                But mostly, we figure out what makes your audience care, and
                then we make that.
              </p>
            }
          />
        </Screen>

        {/* ── Services Marquee ── */}
        <ServicesMarquee reduced={!!reduced} />

        {/* ── Screen 9, Social proof ── */}
        <Screen align="center">
          <Statement>
            <p
              className="text-balance"
              style={{
                fontFamily: "var(--font-narrative)",
                fontSize: "clamp(22px, 3vw, 36px)",
                lineHeight: 1.4,
                fontStyle: "italic",
                color: "var(--neutral-100)",
                margin: 0,
                maxWidth: "24ch",
              }}
            >
              &ldquo;It showed what we are authentically. Our personalities were
              embedded.&rdquo;
            </p>
          </Statement>
          <Statement delay={0.15}>
            <p
              style={{
                fontFamily: "var(--font-label)",
                fontSize: "var(--text-micro)",
                letterSpacing: "0.35em",
                textTransform: "uppercase",
                color: "var(--brand-pink)",
                margin: 0,
                marginTop: "clamp(16px, 2vw, 24px)",
              }}
            >
              Marco, Melbourne
            </p>
          </Statement>
        </Screen>

        {/* ── Screen 7, Warm close ── */}
        <Screen align="center" surface={1}>
          <Statement>
            <p
              style={{
                fontFamily: "var(--font-label)",
                fontSize: "var(--text-micro)",
                letterSpacing: "0.35em",
                textTransform: "uppercase",
                color: "var(--brand-pink)",
                margin: "0 0 clamp(12px, 2vw, 20px)",
              }}
            >
              Melbourne
            </p>
            <p
              style={{
                fontFamily: "var(--font-logo)",
                fontSize: "clamp(48px, 8vw, 100px)",
                lineHeight: 1.1,
                color: "var(--neutral-100)",
                margin: 0,
              }}
            >
              We&rsquo;re SuperBad.
            </p>
          </Statement>
          <Statement delay={0.15}>
            <p
              className="text-pretty"
              style={{
                fontFamily: "var(--font-narrative)",
                fontSize: "clamp(18px, 2.2vw, 26px)",
                lineHeight: 1.5,
                fontStyle: "italic",
                color: "var(--neutral-400)",
                margin: "0 auto",
                marginTop: "clamp(16px, 2vw, 28px)",
                maxWidth: "36ch",
              }}
            >
              A creative media and marketing company that thinks about what
              makes people feel something. All&nbsp;day.
            </p>
          </Statement>
          <Statement delay={0.25}>
            <p
              style={{
                fontFamily: "var(--font-body)",
                fontSize: "clamp(14px, 1.4vw, 17px)",
                lineHeight: 1.8,
                color: "var(--neutral-500)",
                margin: "0 auto",
                marginTop: "clamp(28px, 3vw, 44px)",
                maxWidth: "46ch",
              }}
              className="text-pretty"
            >
              LSKD. A pilates studio in Truganina. Melbourne Storm. A deli in
              Brighton. Thetford Australia. A psychologist in Coburg. Gyms in
              Hoppers Crossing and Ferntree Gully. Interior designers in
              Richmond. Migration agents in the CBD.
            </p>
          </Statement>
        </Screen>

        {/* ── Screen 9, CTA ── */}
        <Screen>
          <Statement>
            <p
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "clamp(44px, 8vw, 100px)",
                lineHeight: 0.95,
                color: "var(--neutral-100)",
                margin: 0,
                maxWidth: "14ch",
              }}
              className="text-balance"
            >
              See if we&rsquo;re any good
              <span style={{ color: "var(--brand-red)" }}>.</span>
            </p>
          </Statement>
          <Statement delay={0.12}>
            <p
              className="text-pretty"
              style={{
                fontFamily: "var(--font-body)",
                fontSize: "clamp(16px, 1.8vw, 22px)",
                lineHeight: 1.6,
                color: "var(--neutral-500)",
                margin: 0,
                marginTop: "clamp(20px, 3vw, 36px)",
                maxWidth: "44ch",
              }}
            >
              One shoot. Real deliverables. A six-week marketing plan
              written for your business. No commitment required.
            </p>
          </Statement>
          <Statement delay={0.2}>
            <div
              className="flex flex-col gap-5 sm:flex-row sm:items-center sm:gap-10"
              style={{ marginTop: "clamp(32px, 4vw, 56px)" }}
            >
              <Link
                href="/trial-shoot"
                style={{
                  fontFamily: "var(--font-label)",
                  fontSize: "var(--text-micro)",
                  letterSpacing: "0.35em",
                  textTransform: "uppercase",
                  color: "var(--neutral-900)",
                  backgroundColor: "var(--neutral-100)",
                  padding: "14px 32px",
                  textDecoration: "none",
                  transition: "opacity 0.2s",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.opacity = "0.85";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.opacity = "1";
                }}
              >
                Trial shoot · from $397
              </Link>
              <a
                href="mailto:andy@superbadmedia.com.au"
                style={{
                  fontFamily: "var(--font-label)",
                  fontSize: "var(--text-micro)",
                  letterSpacing: "0.35em",
                  textTransform: "uppercase",
                  color: "var(--neutral-500)",
                  textDecoration: "none",
                  transition: "color 0.2s",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.color = "var(--neutral-300)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.color = "var(--neutral-500)";
                }}
              >
                Get in touch
              </a>
            </div>
          </Statement>
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.6, duration: 0.5 }}
            style={{
              fontFamily: "var(--font-body)",
              fontSize: "12px",
              color: "var(--neutral-600)",
              margin: 0,
              position: "absolute",
              bottom: "clamp(20px, 3vw, 40px)",
              left: "clamp(32px, 5vw, 64px)",
            }}
          >
            no tricks
          </motion.p>
        </Screen>
      </div>
    </main>
  );
}
