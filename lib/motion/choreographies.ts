/**
 * Tier 2 choreography registry — the 7 locked named moments.
 *
 * Per `docs/specs/design-system-baseline.md` §Motion. Anything not on this
 * list uses Tier 1 (`houseSpring`) — no new Tier 2 entries without explicit
 * Andy approval, treated with the same scarcity discipline as the sound
 * registry or the BHS closed list.
 *
 * Each entry ships `initial` / `animate` variants + a Framer transition.
 * Consumers render with `<motion.div variants={tier2.quoteAccepted} ...>`.
 *
 * Reduced-motion fallback values live alongside each entry. The
 * MotionProvider (via `MotionConfig`) swaps in the reduced variant when
 * the user's `motion_preference` is `reduced` or `off`.
 */

import type { Transition, Variants } from "framer-motion";

import { houseSpring, motion as motionTokens } from "@/lib/design-tokens";

/** Tier 2 ease curve — slow-out cubic for the morning-brief / quote-accept class of moment. */
const tier2SlowOut = [0.16, 1, 0.3, 1] as const;

/** Canonical list of Tier 2 moment keys — closed. */
export const TIER_2_KEYS = [
  "dashboard-first-load",
  "morning-brief-open",
  "quote-accepted",
  "subscription-activated",
  "wizard-complete",
  "portal-first-load",
  "inbox-zero",
] as const;

export type Tier2Key = (typeof TIER_2_KEYS)[number];

type ChoreographyEntry = {
  /** Human description — shown in the /lite/design reference. */
  description: string;
  /** Total wall-clock duration in ms. Informational; Framer drives the actual timing. */
  durationMs: number;
  /** Single-element variants for the primary reveal. Container orchestration lives in `container`. */
  variants: Variants;
  transition: Transition;
  /** Optional container-level orchestration (used for staggered reveals). */
  container?: { variants: Variants; transition: Transition };
  /** Reduced-motion substitute — instant appearance with a short fade. */
  reduced: { variants: Variants; transition: Transition };
};

/** 1. First dashboard load after login. Staggered sidebar + topbar + content. */
const dashboardFirstLoad: ChoreographyEntry = {
  description:
    "Sidebar, topbar, main content stagger in over ~400ms total. Once per session.",
  durationMs: 400,
  variants: {
    initial: { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0 },
  },
  transition: { duration: 0.32, ease: tier2SlowOut },
  container: {
    variants: {
      initial: {},
      animate: { transition: { staggerChildren: 0.08 } },
    },
    transition: { staggerChildren: 0.08 },
  },
  reduced: {
    variants: { initial: { opacity: 0 }, animate: { opacity: 1 } },
    transition: { duration: 0.18, ease: "linear" },
  },
};

/** 2. Morning brief opens. Single-block fade-in on a Playfair narrative paragraph. */
const morningBriefOpen: ChoreographyEntry = {
  description:
    "Narrative paragraph fades in as a single block over ~800ms with a custom slow-out curve. Once per day. Paired with `morning-brief` sound.",
  durationMs: 800,
  variants: {
    initial: { opacity: 0, y: 4 },
    animate: { opacity: 1, y: 0 },
  },
  transition: { duration: 0.8, ease: tier2SlowOut },
  reduced: {
    variants: { initial: { opacity: 0 }, animate: { opacity: 1 } },
    transition: { duration: 0.18, ease: "linear" },
  },
};

/** 3. Quote accepted (customer). Warm pulse + glow + Accept→Welcome transform. */
const quoteAccepted: ChoreographyEntry = {
  description:
    "Warm pulse across the surface, glow bloom, Accept button transforms into a 'Welcome aboard' state. ~1.2s total. Paired with `quote-accepted` sound.",
  durationMs: 1200,
  variants: {
    initial: { opacity: 0.7, scale: 0.98, boxShadow: "0 0 0 0 rgba(214, 51, 73, 0)" },
    animate: {
      opacity: 1,
      scale: 1,
      boxShadow: "0 0 80px 0 rgba(214, 51, 73, 0.35)",
    },
  },
  transition: {
    opacity: { duration: 0.4, ease: tier2SlowOut },
    scale: { ...houseSpring },
    boxShadow: { duration: 1.2, ease: tier2SlowOut },
  },
  reduced: {
    variants: { initial: { opacity: 0 }, animate: { opacity: 1 } },
    transition: { duration: 0.18, ease: "linear" },
  },
};

/** 4. Stripe subscription activated (admin Kanban). Card lift + drift + colour shift. */
const subscriptionActivated: ChoreographyEntry = {
  description:
    "Deal card lifts out of Negotiating, drifts across to Won, graduates into a client card with a warm colour shift. ~1s total. Paired with `subscription-activated` sound.",
  durationMs: 1000,
  variants: {
    initial: { y: 0, x: 0, scale: 1, filter: "brightness(1)" },
    animate: {
      y: [-6, -6, 0],
      x: [0, 120, 120],
      scale: [1, 1.02, 1],
      filter: ["brightness(1)", "brightness(1.08)", "brightness(1)"],
    },
  },
  transition: { duration: 1, ease: tier2SlowOut, times: [0, 0.6, 1] },
  reduced: {
    variants: { initial: { opacity: 0 }, animate: { opacity: 1 } },
    transition: { duration: 0.18, ease: "linear" },
  },
};

/** 5. Setup wizard completion. Warm pulse + short reward. Silent. */
const wizardComplete: ChoreographyEntry = {
  description:
    "Wizard panel warm-pulses, short reward choreography plays, panel resolves into user's previous context. Silent — sound registry is full.",
  durationMs: 900,
  variants: {
    initial: { scale: 0.98, opacity: 0.8 },
    animate: { scale: [0.98, 1.02, 1], opacity: 1 },
  },
  transition: { duration: 0.9, ease: tier2SlowOut, times: [0, 0.5, 1] },
  reduced: {
    variants: { initial: { opacity: 0 }, animate: { opacity: 1 } },
    transition: { duration: 0.18, ease: "linear" },
  },
};

/** 6. Portal first-ever load. Chrome fades in with user's name prominent. */
const portalFirstLoad: ChoreographyEntry = {
  description:
    "Chrome fades in with the user's name prominent. Tracked via `first_seen_at` on the relationship. Subsequent loads use Tier 1.",
  durationMs: 900,
  variants: {
    initial: { opacity: 0, y: 12 },
    animate: { opacity: 1, y: 0 },
  },
  transition: { duration: 0.9, ease: tier2SlowOut },
  container: {
    variants: {
      initial: {},
      animate: { transition: { staggerChildren: 0.12 } },
    },
    transition: { staggerChildren: 0.12 },
  },
  reduced: {
    variants: { initial: { opacity: 0 }, animate: { opacity: 1 } },
    transition: { duration: 0.18, ease: "linear" },
  },
};

/** 7. Inbox zero. Last message shrinks out, empty state fades in. Silent. */
const inboxZero: ChoreographyEntry = {
  description:
    "Inbox transitions from ≥1 message to 0 — last card shrinks out, empty state fades in with a dry SuperBad-voice line. ~600ms. Silent.",
  durationMs: 600,
  variants: {
    initial: { opacity: 0, scale: 0.96 },
    animate: { opacity: 1, scale: 1 },
  },
  transition: { duration: 0.6, ease: tier2SlowOut },
  reduced: {
    variants: { initial: { opacity: 0 }, animate: { opacity: 1 } },
    transition: { duration: 0.18, ease: "linear" },
  },
};

export const tier2: Record<Tier2Key, ChoreographyEntry> = {
  "dashboard-first-load": dashboardFirstLoad,
  "morning-brief-open": morningBriefOpen,
  "quote-accepted": quoteAccepted,
  "subscription-activated": subscriptionActivated,
  "wizard-complete": wizardComplete,
  "portal-first-load": portalFirstLoad,
  "inbox-zero": inboxZero,
};

/**
 * Tier 1 named moment — `pdf_render_overlay`.
 *
 * Per BUILD_PLAN A4: consumed by QB-3 (quote PDF), BI-2 (invoice PDF),
 * SWP-8 (six-week plan PDF). Not Tier 2 — it's a utility overlay that
 * appears while Puppeteer renders. Tier 1 = house spring.
 */
export const pdfRenderOverlay = {
  description:
    "Backdrop overlay that fades in while Puppeteer renders a PDF; fades out on completion.",
  variants: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
  } satisfies Variants,
  transition: { ...motionTokens.tier1Spring } as Transition,
  reduced: {
    variants: { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } },
    transition: { duration: 0.18, ease: "linear" } as Transition,
  },
} as const;
