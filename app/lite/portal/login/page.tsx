"use client";

import { useState, useTransition } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { requestPortalLink } from "../recover/actions";

const houseSpring = {
  type: "spring" as const,
  stiffness: 220,
  damping: 25,
  mass: 1,
};

export default function PortalLoginPage() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      await requestPortalLink(email);
      setSubmitted(true);
    });
  }

  return (
    <main
      className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden px-6"
      style={{ backgroundColor: "#1A1A18" }}
    >
      {/* Ambient gradient */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 50% 40%, rgba(178,40,72,0.08) 0%, transparent 70%)",
        }}
      />

      <AnimatePresence mode="wait" initial={false}>
        {!submitted ? (
          <motion.div
            key="form"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={houseSpring}
            className="relative z-10 flex w-full max-w-sm flex-col items-center"
          >
            {/* Logo mark */}
            <div
              className="mb-10 font-[family-name:var(--font-display)] text-[28px] leading-none tracking-tight"
              style={{ color: "#FDF5E6" }}
            >
              SuperBad
            </div>

            <h1
              className="mb-2 text-center font-[family-name:var(--font-body)] text-[20px] font-semibold"
              style={{ color: "#FDF5E6" }}
            >
              Welcome back
            </h1>
            <p
              className="mb-8 text-center font-[family-name:var(--font-body)] text-[14px] leading-relaxed"
              style={{ color: "#807F73" }}
            >
              Enter your email and we&apos;ll send you a link to access your
              portal.
            </p>

            <form
              onSubmit={handleSubmit}
              className="flex w-full flex-col gap-3"
            >
              <input
                type="email"
                required
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isPending}
                className="w-full rounded-lg px-4 py-3 font-[family-name:var(--font-body)] text-[15px] outline-none transition-colors placeholder:opacity-40 focus:ring-1"
                style={{
                  backgroundColor: "#252320",
                  color: "#FDF5E6",
                  border: "1px solid rgba(253,245,230,0.08)",
                }}
                aria-label="Email address"
              />
              <motion.button
                type="submit"
                disabled={isPending || !email}
                whileTap={{ scale: 0.98 }}
                className="w-full rounded-lg px-4 py-3 font-[family-name:var(--font-body)] text-[15px] font-medium transition-opacity"
                style={{
                  backgroundColor: "#B22848",
                  color: "#FDF5E6",
                  opacity: isPending || !email ? 0.5 : 1,
                  cursor: isPending ? "wait" : "pointer",
                }}
              >
                {isPending ? "Sending…" : "Send me a link"}
              </motion.button>
            </form>

            <p
              className="mt-6 text-center font-[family-name:var(--font-body)] text-[12px]"
              style={{ color: "#807F73" }}
            >
              No password needed. We&apos;ll email you a secure link.
            </p>
          </motion.div>
        ) : (
          <motion.div
            key="success"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={houseSpring}
            className="relative z-10 flex w-full max-w-sm flex-col items-center text-center"
            role="status"
            aria-live="polite"
          >
            {/* Animated check mark */}
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ ...houseSpring, delay: 0.1 }}
              className="mb-6 flex h-14 w-14 items-center justify-center rounded-full"
              style={{ backgroundColor: "rgba(178,40,72,0.15)" }}
            >
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#B22848"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </motion.div>

            <h1
              className="mb-2 font-[family-name:var(--font-body)] text-[20px] font-semibold"
              style={{ color: "#FDF5E6" }}
            >
              Check your inbox
            </h1>
            <p
              className="font-[family-name:var(--font-body)] text-[14px] leading-relaxed"
              style={{ color: "#807F73" }}
            >
              If that email is on file, a secure portal link is on its way.
              <br />
              The link is valid for 7 days.
            </p>

            <button
              type="button"
              onClick={() => setSubmitted(false)}
              className="mt-6 font-[family-name:var(--font-body)] text-[13px] underline underline-offset-2 transition-opacity hover:opacity-70"
              style={{ color: "#807F73" }}
            >
              Try a different email
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Footer */}
      <div
        className="absolute bottom-6 font-[family-name:var(--font-body)] text-[11px]"
        style={{ color: "rgba(128,127,115,0.5)" }}
      >
        SuperBad Marketing · Melbourne
      </div>
    </main>
  );
}
