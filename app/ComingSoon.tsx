"use client";

import { motion } from "framer-motion";

const fadeUp = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0 },
};

export default function ComingSoon() {
  return (
    <main
      className="relative flex flex-1 overflow-hidden"
      style={{ backgroundColor: "var(--neutral-900)" }}
    >
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(60% 50% at 18% 28%, rgba(242,140,82,0.10), transparent 70%), radial-gradient(50% 45% at 85% 85%, rgba(178,40,72,0.14), transparent 70%)",
        }}
        animate={{
          backgroundPosition: [
            "0% 0%, 100% 100%",
            "8% 6%, 92% 94%",
            "0% 0%, 100% 100%",
          ],
          opacity: [0.85, 1, 0.85],
        }}
        transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
      />

      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.035] mix-blend-overlay"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")",
        }}
      />

      <motion.div
        aria-hidden
        className="pointer-events-none absolute -left-[20%] top-[10%] h-[50vh] w-[50vh] rounded-full"
        style={{
          background:
            "radial-gradient(circle, rgba(242,140,82,0.18), transparent 65%)",
          filter: "blur(40px)",
        }}
        animate={{ x: [0, 80, -20, 0], y: [0, 40, -30, 0] }}
        transition={{ duration: 22, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        aria-hidden
        className="pointer-events-none absolute -right-[15%] bottom-[5%] h-[55vh] w-[55vh] rounded-full"
        style={{
          background:
            "radial-gradient(circle, rgba(178,40,72,0.20), transparent 65%)",
          filter: "blur(50px)",
        }}
        animate={{ x: [0, -60, 30, 0], y: [0, -40, 20, 0] }}
        transition={{ duration: 26, repeat: Infinity, ease: "easeInOut" }}
      />

      <motion.div
        className="relative z-10 flex flex-1 flex-col justify-between px-8 py-10 sm:px-16 sm:py-14"
        initial="hidden"
        animate="show"
        transition={{ staggerChildren: 0.18, delayChildren: 0.1 }}
      >
        <motion.header
          className="flex items-start justify-between"
          variants={fadeUp}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        >
          <p
            style={{
              fontFamily: "var(--font-label)",
              fontSize: "var(--text-micro)",
              letterSpacing: "0.28em",
              textTransform: "uppercase",
              color: "var(--neutral-300)",
            }}
          >
            SuperBad Marketing
            <span
              aria-hidden
              style={{
                display: "inline-block",
                margin: "0 10px",
                color: "var(--brand-orange)",
              }}
            >
              ·
            </span>
            Melbourne
          </p>
          <p
            style={{
              fontFamily: "var(--font-label)",
              fontSize: "var(--text-micro)",
              letterSpacing: "0.28em",
              textTransform: "uppercase",
              color: "var(--neutral-500)",
            }}
          >
            MMXXVI
          </p>
        </motion.header>

        <section className="flex max-w-5xl flex-col gap-8 py-16">
          <motion.p
            variants={fadeUp}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            style={{
              fontFamily: "var(--font-label)",
              fontSize: "var(--text-micro)",
              letterSpacing: "0.4em",
              textTransform: "uppercase",
              color: "var(--brand-pink)",
            }}
          >
            <motion.span
              aria-hidden
              animate={{ opacity: [1, 0.3, 1] }}
              transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
              style={{ display: "inline-block", marginRight: "0.5em" }}
            >
              —
            </motion.span>
            Coming, eventually
          </motion.p>

          <motion.h1
            variants={fadeUp}
            transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "clamp(96px, 18vw, 240px)",
              lineHeight: 0.88,
              color: "var(--neutral-100)",
              letterSpacing: "-0.02em",
              margin: 0,
            }}
          >
            Not
            <motion.span
              style={{ color: "var(--brand-red)", display: "inline-block" }}
              animate={{ opacity: [1, 0.2, 1] }}
              transition={{
                duration: 1.6,
                repeat: Infinity,
                ease: "easeInOut",
                delay: 1.2,
              }}
            >
              .
            </motion.span>
            <br />
            Yet
            <motion.span
              style={{ color: "var(--brand-orange)", display: "inline-block" }}
              animate={{ opacity: [1, 0.2, 1] }}
              transition={{
                duration: 1.6,
                repeat: Infinity,
                ease: "easeInOut",
                delay: 2,
              }}
            >
              .
            </motion.span>
          </motion.h1>

          <motion.p
            variants={fadeUp}
            transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
            style={{
              fontFamily: "var(--font-narrative)",
              fontStyle: "italic",
              fontSize: "var(--text-narrative)",
              lineHeight: "var(--text-narrative-lh)",
              color: "var(--neutral-300)",
              maxWidth: "38ch",
            }}
          >
            We&rsquo;re building something. It&rsquo;s not ready. You&rsquo;re
            early.
          </motion.p>
        </section>

        <motion.footer
          className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between"
          variants={fadeUp}
          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
        >
          <p
            style={{
              fontFamily: "var(--font-body)",
              fontStyle: "italic",
              fontSize: "var(--text-small)",
              color: "var(--brand-pink)",
              maxWidth: "42ch",
            }}
          >
            come back later. or don&rsquo;t. we&rsquo;ll be here either way.
          </p>
          <p
            style={{
              fontFamily: "var(--font-label)",
              fontSize: "var(--text-micro)",
              letterSpacing: "0.28em",
              textTransform: "uppercase",
              color: "var(--neutral-500)",
            }}
          >
            hello
            <span style={{ color: "var(--neutral-600)" }}>@</span>
            superbadmedia.com.au
          </p>
        </motion.footer>
      </motion.div>
    </main>
  );
}
