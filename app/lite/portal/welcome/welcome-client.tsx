"use client";

/**
 * Welcome screen client component.
 *
 * Retainer: name + dry line + "what we already know" summary + step preview + CTA.
 * SaaS: name + dry line + step preview + CTA (no pre-populated summary).
 *
 * Premium feel: full-bleed, minimal UI, name and text as hero.
 * Hidden egg suppression: no hidden eggs on this surface.
 *
 * Owner: OS-1.
 */
import { useRouter } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { markWelcomeSeen } from "./actions";

interface WelcomeClientProps {
  firstName: string;
  companyName: string;
  audience: "retainer" | "saas";
  dealContext: string | null;
}

export function WelcomeClient({
  firstName,
  companyName,
  audience,
  dealContext,
}: WelcomeClientProps) {
  const router = useRouter();
  const shouldReduceMotion = useReducedMotion();

  const fadeUp = shouldReduceMotion
    ? {}
    : {
        initial: { opacity: 0, y: 20 },
        animate: { opacity: 1, y: 0 },
        transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] as const },
      };

  const stagger = (i: number) =>
    shouldReduceMotion
      ? {}
      : { transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] as const, delay: i * 0.15 } };

  async function handleStart() {
    await markWelcomeSeen();
    router.push("/lite/portal");
  }

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6 py-16">
      <div className="mx-auto flex max-w-lg flex-col gap-8 text-center">
        {/* Name — large, prominent */}
        <motion.h1
          {...fadeUp}
          className="font-[family-name:var(--font-playfair-display)] text-4xl font-medium tracking-tight text-[var(--color-foreground)] md:text-5xl"
        >
          {firstName}.
        </motion.h1>

        {/* Dry welcome line */}
        <motion.p
          {...fadeUp}
          {...stagger(1)}
          className="font-[family-name:var(--font-righteous)] text-sm uppercase tracking-widest text-[var(--color-foreground)]/60"
        >
          {audience === "retainer"
            ? "good to have you."
            : "welcome aboard."}
        </motion.p>

        {/* "What we already know" — retainer only */}
        {audience === "retainer" && dealContext && (
          <motion.div
            {...fadeUp}
            {...stagger(2)}
            className="rounded-[var(--radius-generous)] bg-[var(--color-surface-raised)] px-6 py-5 text-left"
          >
            <p className="mb-2 font-[family-name:var(--font-righteous)] text-xs uppercase tracking-widest text-[var(--color-foreground)]/40">
              What we already know
            </p>
            <p className="text-sm leading-relaxed text-[var(--color-foreground)]/80">
              {dealContext}
            </p>
          </motion.div>
        )}

        {/* Step preview */}
        <motion.div
          {...fadeUp}
          {...stagger(audience === "retainer" && dealContext ? 3 : 2)}
          className="flex flex-col gap-3 text-left"
        >
          <p className="font-[family-name:var(--font-righteous)] text-xs uppercase tracking-widest text-[var(--color-foreground)]/40">
            Here&apos;s what&apos;s about to happen
          </p>
          <ol className="flex flex-col gap-2 text-sm text-[var(--color-foreground)]/70">
            <li className="flex items-start gap-2">
              <span className="mt-0.5 h-5 w-5 shrink-0 rounded-full bg-[var(--color-brand-pink)]/10 text-center text-xs leading-5 text-[var(--color-brand-pink)]">
                1
              </span>
              <span>
                Getting to know you properly. This is the good part.{" "}
                <span className="text-[var(--color-foreground)]/40">(~30 min)</span>
              </span>
            </li>
            {audience === "saas" ? (
              <>
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 h-5 w-5 shrink-0 rounded-full bg-[var(--color-brand-pink)]/10 text-center text-xs leading-5 text-[var(--color-brand-pink)]">
                    2
                  </span>
                  <span>
                    Five quick questions about where your business is.{" "}
                    <span className="text-[var(--color-foreground)]/40">(~2 min)</span>
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 h-5 w-5 shrink-0 rounded-full bg-[var(--color-brand-pink)]/10 text-center text-xs leading-5 text-[var(--color-brand-pink)]">
                    3
                  </span>
                  <span>
                    A quick product setup.{" "}
                    <span className="text-[var(--color-foreground)]/40">(~3 min)</span>
                  </span>
                </li>
              </>
            ) : (
              <li className="flex items-start gap-2">
                <span className="mt-0.5 h-5 w-5 shrink-0 rounded-full bg-[var(--color-brand-pink)]/10 text-center text-xs leading-5 text-[var(--color-brand-pink)]">
                  2
                </span>
                <span>
                  A bit of practical admin you can do whenever.{" "}
                  <span className="text-[var(--color-foreground)]/40">(~10 min)</span>
                </span>
              </li>
            )}
          </ol>
        </motion.div>

        {/* CTA */}
        <motion.div
          {...fadeUp}
          {...stagger(audience === "retainer" && dealContext ? 4 : 3)}
        >
          <Button
            size="lg"
            onClick={handleStart}
            className="w-full"
          >
            Let&apos;s get started
          </Button>
        </motion.div>
      </div>
    </main>
  );
}
