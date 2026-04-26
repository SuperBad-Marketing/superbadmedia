"use client";

import { useRef, useState, useEffect } from "react";
import { motion, useInView } from "framer-motion";
import Link from "next/link";

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

/* ── Redaction — the "generic → honest" reveal ── */
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

/* ── Screen — a single snap section ── */
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

/* ── Statement — a plain confident statement with spring entrance ── */
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

export default function HomePage() {
  const [menuOpen, setMenuOpen] = useState(false);

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
          <NavLink href="/trial-shoot">Trial Shoot</NavLink>
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
          <NavLink href="/trial-shoot" onClick={() => setMenuOpen(false)}>
            Trial Shoot
          </NavLink>
        </motion.div>
        <motion.div
          animate={menuOpen ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ delay: menuOpen ? 0.18 : 0, duration: 0.3 }}
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
        {/* ── Screen 1 — Hero ── */}
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
        </Screen>

        {/* ── Screen 2 — Statement: entertainment platform ── */}
        <Screen surface={1}>
          <Statement>
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
              Social media is an entertainment platform
              <span style={{ color: "var(--brand-red)" }}>.</span>
            </p>
          </Statement>
          <Statement delay={0.15}>
            <p
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
            >
              Not a sales platform. Not a brochure with a comments section.
              People open Instagram for the same reason they turn on Netflix
              — to feel something.
            </p>
          </Statement>
        </Screen>

        {/* ── Screen 3 — Redaction #1 ── */}
        <Screen>
          <Redaction
            generic="We create data-driven content strategies that drive engagement and build brand awareness across all digital channels."
            honest={
              <>
                We make things people actually want to watch
                <span style={{ color: "var(--brand-red)" }}>.</span>
              </>
            }
          />
        </Screen>

        {/* ── Screen 4 — What we actually do ── */}
        <Screen>
          <Redaction
            generic="We're a full-service creative agency passionate about telling your brand's story through innovative, best-in-class content solutions."
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
                But mostly — we figure out what makes your audience care, and
                then we make that.
              </p>
            }
          />
        </Screen>

        {/* ── Screen 5 — Statement: emotion over features (brand red) ── */}
        <Screen surface="brand">
          <Statement>
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
              People don&rsquo;t buy what you sell
              <span style={{ color: "var(--neutral-900)" }}>.</span>
            </p>
          </Statement>
          <Statement delay={0.12}>
            <p
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
            >
              They buy how you make them feel.
            </p>
          </Statement>
          <Statement delay={0.22}>
            <p
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
            >
              Every purchase decision is emotional first. The logic comes after
              — to justify what they already wanted. Connection will always
              outsell a feature list.
            </p>
          </Statement>
        </Screen>

        {/* ── Screen 6 — Social proof ── */}
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
              &mdash; Marco, Melbourne
            </p>
          </Statement>
        </Screen>

        {/* ── Screen 7 — Redaction #2 ── */}
        <Screen>
          <Redaction
            generic="Our proven methodology delivers measurable ROI through strategic multi-channel campaigns and performance-driven creative."
            honest={
              <>
                The best way to sell is to never try
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
                People love to buy. They hate being sold to. There&rsquo;s a
                difference — and most marketing gets it backwards.
              </p>
            }
          />
        </Screen>

        {/* ── Screen 6 — Quiet screen (small text, huge space) ── */}
        <Screen align="center" surface={1}>
          <Statement>
            <div
              aria-hidden
              style={{
                width: "48px",
                height: "2px",
                backgroundColor: "var(--brand-red)",
                margin: "0 auto clamp(24px, 3vw, 40px)",
                opacity: 0.6,
              }}
            />
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

        {/* ── Screen 7 — Warm close ── */}
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
              A creative media and marketing company that thinks about this
              stuff all day.
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

        {/* ── Screen 9 — CTA ── */}
        <Screen>
          <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 sm:grid sm:grid-cols-5 sm:gap-8">
            <Statement className="sm:col-span-3">
              <Link
                href="/trial-shoot"
                className="block h-full"
                style={{ textDecoration: "none" }}
              >
                <div
                  data-slot="card"
                  style={{
                    backgroundColor: "var(--surface-2)",
                    borderRadius: "var(--radius-generous)",
                    padding: "clamp(28px, 4vw, 44px)",
                    display: "flex",
                    flexDirection: "column",
                    gap: "var(--space-3)",
                    height: "100%",
                    borderBottom: "3px solid var(--brand-orange)",
                    transition:
                      "transform 0.2s cubic-bezier(0.22, 1, 0.36, 1)",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = "translateY(-3px)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = "translateY(0)";
                  }}
                >
                  <p
                    style={{
                      fontFamily: "var(--font-label)",
                      fontSize: "var(--text-micro)",
                      letterSpacing: "0.4em",
                      textTransform: "uppercase",
                      color: "var(--brand-orange)",
                      margin: 0,
                    }}
                  >
                    Trial Shoot
                  </p>
                  <p
                    className="text-balance"
                    style={{
                      fontFamily: "var(--font-display)",
                      fontSize: "clamp(22px, 2.5vw, 32px)",
                      lineHeight: 1.1,
                      color: "var(--neutral-100)",
                      margin: 0,
                    }}
                  >
                    Find out if
                    <br />
                    we&rsquo;re any good
                  </p>
                  <p
                    className="text-pretty"
                    style={{
                      fontFamily: "var(--font-body)",
                      fontSize: "var(--text-small)",
                      lineHeight: "var(--text-small-lh)",
                      color: "var(--neutral-500)",
                      margin: 0,
                      maxWidth: "36ch",
                    }}
                  >
                    One shoot. Real deliverables. A six-week marketing plan
                    written for your business. No commitment required.
                  </p>
                  <p
                    style={{
                      fontFamily: "var(--font-label)",
                      fontSize: "var(--text-micro)",
                      letterSpacing: "0.2em",
                      textTransform: "uppercase",
                      color: "var(--neutral-300)",
                      margin: 0,
                      marginTop: "auto",
                    }}
                  >
                    From $397 &rarr;
                  </p>
                </div>
              </Link>
            </Statement>

            <Statement delay={0.08} className="sm:col-span-2">
              <a
                href="mailto:andy@superbadmedia.com.au"
                className="block h-full"
                style={{ textDecoration: "none" }}
              >
                <div
                  data-slot="card"
                  style={{
                    backgroundColor: "var(--surface-2)",
                    borderRadius: "var(--radius-generous)",
                    padding: "clamp(28px, 4vw, 44px)",
                    display: "flex",
                    flexDirection: "column",
                    gap: "var(--space-3)",
                    height: "100%",
                    transition:
                      "transform 0.2s cubic-bezier(0.22, 1, 0.36, 1)",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = "translateY(-3px)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = "translateY(0)";
                  }}
                >
                  <p
                    style={{
                      fontFamily: "var(--font-label)",
                      fontSize: "var(--text-micro)",
                      letterSpacing: "0.4em",
                      textTransform: "uppercase",
                      color: "var(--brand-pink)",
                      margin: 0,
                    }}
                  >
                    Get in Touch
                  </p>
                  <p
                    className="text-balance"
                    style={{
                      fontFamily: "var(--font-display)",
                      fontSize: "clamp(22px, 2.5vw, 32px)",
                      lineHeight: 1.1,
                      color: "var(--neutral-100)",
                      margin: 0,
                    }}
                  >
                    Already know what
                    <br />
                    you need?
                  </p>
                  <p
                    className="text-pretty"
                    style={{
                      fontFamily: "var(--font-body)",
                      fontSize: "var(--text-small)",
                      lineHeight: "var(--text-small-lh)",
                      color: "var(--neutral-500)",
                      margin: 0,
                    }}
                  >
                    Tell us what you&rsquo;re working on. We&rsquo;ll tell you
                    honestly whether we can help.
                  </p>
                  <p
                    style={{
                      fontFamily: "var(--font-body)",
                      fontSize: "var(--text-small)",
                      lineHeight: "var(--text-small-lh)",
                      color: "var(--neutral-500)",
                      margin: 0,
                      marginTop: "auto",
                    }}
                  >
                    andy@superbadmedia.com.au
                  </p>
                </div>
              </a>
            </Statement>
          </div>
        </Screen>
      </div>
    </main>
  );
}
