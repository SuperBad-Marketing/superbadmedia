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
    <main className="min-h-screen bg-[color:var(--color-neutral-950)]">
      <AnimatePresence mode="wait">
        {!showForm && (
          <motion.div
            key="hero"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0, y: -20 }}
            transition={houseSpring}
          >
            {/* Block 1 — Understated opener */}
            <section className="flex min-h-[60vh] flex-col items-center justify-center px-6 pt-24 pb-16 text-center">
              <h1 className="font-[family-name:var(--font-display)] text-[clamp(2.5rem,6vw,4rem)] leading-[1] text-[color:var(--color-brand-cream)]">
                Most marketing looks like marketing.
              </h1>
              <p className="mt-6 max-w-[540px] font-[family-name:var(--font-body)] text-[clamp(1rem,2vw,1.25rem)] leading-[1.5] text-[color:var(--color-neutral-300)]">
                We make the kind of content people actually stop for. Then we
                build a strategy around it.
              </p>
            </section>

            {/* Block 2 — Delight moment */}
            <section className="px-6 pb-20">
              <div className="mx-auto max-w-[900px] overflow-hidden rounded-lg">
                <div className="aspect-[16/9] bg-[color:var(--color-neutral-800)]" />
              </div>
              <p className="mx-auto mt-4 max-w-[900px] font-[family-name:var(--font-body)] text-[14px] italic text-[color:var(--color-brand-pink)]">
                She didn&rsquo;t know we were rolling. That&rsquo;s sort of the
                point.
              </p>
            </section>

            {/* Block 3 — Value drop */}
            <section className="mx-auto max-w-[600px] px-6 pb-20 text-center">
              <div className="space-y-3 font-[family-name:var(--font-body)] text-[clamp(1rem,2vw,1.125rem)] text-[color:var(--color-brand-cream)]">
                <p>1 short-form video</p>
                <p>10 edited photographs</p>
                <p>A bespoke 6-week marketing plan</p>
                <p>60 days of portal access</p>
              </div>
              <p className="mt-6 font-[family-name:var(--font-body)] text-[15px] text-[color:var(--color-neutral-300)]">
                That&rsquo;s what you walk away with. Whether you work with us
                after or not.
              </p>
            </section>

            {/* Block 4 — What happens */}
            <section className="mx-auto max-w-[600px] px-6 pb-20">
              <h2 className="mb-8 font-[family-name:var(--font-label)] text-[12px] uppercase tracking-[0.2em] text-[color:var(--color-neutral-500)]">
                WHAT HAPPENS
              </h2>
              <ol className="space-y-4 font-[family-name:var(--font-body)] text-[15px] leading-[1.6] text-[color:var(--color-neutral-300)]">
                <li>
                  <span className="mr-2 text-[color:var(--color-brand-cream)]">
                    1.
                  </span>
                  You tell us about your business. Takes two minutes.
                </li>
                <li>
                  <span className="mr-2 text-[color:var(--color-brand-cream)]">
                    2.
                  </span>
                  We do our homework — your competitors, your audience, your
                  neighbourhood.
                </li>
                <li>
                  <span className="mr-2 text-[color:var(--color-brand-cream)]">
                    3.
                  </span>
                  We come to you. Sixty minutes, on-site, no studio.
                </li>
                <li>
                  <span className="mr-2 text-[color:var(--color-brand-cream)]">
                    4.
                  </span>
                  You go back to work. We handle the rest.
                </li>
                <li>
                  <span className="mr-2 text-[color:var(--color-brand-cream)]">
                    5.
                  </span>
                  About a week later, everything lands in your portal — photos,
                  video, and a six-week marketing plan, all at once.
                </li>
              </ol>
            </section>

            {/* Block 5 — Recent work */}
            <section className="mx-auto max-w-[900px] px-6 pb-20">
              <h2 className="mb-8 font-[family-name:var(--font-label)] text-[12px] uppercase tracking-[0.2em] text-[color:var(--color-neutral-500)]">
                RECENT WORK
              </h2>
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
                {[
                  "A mortgage broker who hates talking about mortgages. We found something better.",
                  "The café that leads with cold brew. We ran with it.",
                  "Three partners, one story. It took us twenty minutes to find it.",
                ].map((caption, i) => (
                  <div key={i}>
                    <div className="aspect-[4/5] rounded-lg bg-[color:var(--color-neutral-800)]" />
                    <p className="mt-3 font-[family-name:var(--font-body)] text-[13px] italic text-[color:var(--color-brand-pink)]">
                      {caption}
                    </p>
                  </div>
                ))}
              </div>
            </section>

            {/* Block 6 — Quiet commitment */}
            <section className="mx-auto max-w-[600px] px-6 pb-20 text-center">
              <p className="font-[family-name:var(--font-body)] text-[15px] leading-[1.7] text-[color:var(--color-neutral-300)]">
                We take three shoots a week, max.
              </p>
              <p className="mt-2 font-[family-name:var(--font-body)] text-[15px] leading-[1.7] text-[color:var(--color-neutral-300)]">
                We ask for five business days&rsquo; notice — enough time to do
                the research that makes your shoot worth showing up for.
              </p>
            </section>

            {/* Block 7 — Price */}
            <section className="mx-auto max-w-[600px] px-6 pb-12 text-center">
              <p className="font-[family-name:var(--font-display)] text-[clamp(3rem,8vw,5rem)] leading-[1] text-[color:var(--color-brand-cream)]">
                $297
              </p>
              <p className="mt-3 font-[family-name:var(--font-body)] text-[15px] text-[color:var(--color-neutral-300)]">
                GST inclusive. That&rsquo;s the whole number.
              </p>
            </section>

            {/* Block 8 — CTA */}
            <section className="mx-auto max-w-[600px] px-6 pb-24 text-center">
              <p className="mb-4 font-[family-name:var(--font-body)] text-[14px] text-[color:var(--color-neutral-500)]">
                Takes about two minutes. No obligation after that.
              </p>
              <button
                type="button"
                onClick={handleCtaClick}
                className="rounded-lg bg-[color:var(--color-brand-red)] px-8 py-3.5 font-[family-name:var(--font-body)] text-[16px] font-medium text-[color:var(--color-brand-cream)] transition-all duration-200 hover:brightness-110 active:scale-[0.98]"
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
            className="mx-auto max-w-[520px] px-6 py-24"
          >
            <Section1Form onSuccess={handleFormSuccess} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Block 9 — Footer */}
      <footer className="px-6 pb-8 text-center font-[family-name:var(--font-body)] text-[12px] text-[color:var(--color-neutral-500)]">
        <p>© SuperBad Media Pty Ltd · Melbourne</p>
        <p className="mt-1">
          <a href="/lite/legal/privacy" className="underline hover:text-[color:var(--color-neutral-300)]">
            Privacy
          </a>
          {" · "}
          <a href="/lite/legal/terms" className="underline hover:text-[color:var(--color-neutral-300)]">
            Terms
          </a>
        </p>
      </footer>
    </main>
  );
}
