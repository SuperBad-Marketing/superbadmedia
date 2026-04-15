"use client";

/**
 * SB-11 — cancel flow client dispatcher.
 *
 * Consumed by `app/lite/portal/subscription/page.tsx`. Renders the
 * motivational banner + branch-specific panels with houseSpring
 * AnimatePresence swaps. Subscriber-facing copy sourced from
 * `lib/portal/cancel-copy.ts` (COPY_OWED sentinels — no authoring here).
 */
import { useState, useTransition } from "react";
import { AnimatePresence, motion } from "framer-motion";

import { houseSpring } from "@/lib/design-tokens";
import type { CANCEL_COPY } from "@/lib/portal/cancel-copy";
import {
  cancelSaasSubscriptionAction,
  switchProductSoftStepAction,
  type CancelBranch,
} from "@/lib/saas-products/cancel-actions";

type Branch = "paused" | "pre_term" | "post_term";

type TierRef = { id: string; name: string; monthly_cents: number; monthly_label: string };
type AltProduct = {
  id: string;
  name: string;
  tier: { id: string; name: string; monthly_cents: number } | null;
};

export interface CancelClientProps {
  branch: Branch;
  dealId: string;
  productName: string;
  tierName: string;
  committedUntilDateMs: number | null;
  pauseUsedThisCommitment: boolean;
  math: {
    remaining_months: number;
    remainder_cents: number;
    buyout_cents: number;
    remainder_label: string;
    buyout_label: string;
  } | null;
  cardOnFile: boolean;
  alternativeProducts: AltProduct[];
  higherTiers: TierRef[];
  lowerTiers: TierRef[];
  copy: typeof CANCEL_COPY;
}

export function CancelClient(props: CancelClientProps) {
  const [panel, setPanel] = useState<"home" | "switch" | "confirm">("home");
  const [pendingBranch, setPendingBranch] = useState<CancelBranch | null>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<CancelBranch | null>(null);

  function runCancel(branch: CancelBranch) {
    setError(null);
    startTransition(async () => {
      const res = await cancelSaasSubscriptionAction(props.dealId, branch);
      if (!res.ok) {
        setError(res.error ?? "internal");
        return;
      }
      setDone(branch);
    });
  }

  if (done) {
    return (
      <Panel>
        <h1 className="font-serif text-3xl text-neutral-900">Done.</h1>
        <p className="mt-4 text-neutral-600">
          Your subscription has been cancelled. You&apos;ll get a confirmation by
          email.
        </p>
        <a
          href="/lite/portal"
          className="mt-8 inline-block rounded-full border border-neutral-300 px-5 py-2 text-sm text-neutral-700 hover:bg-neutral-100"
        >
          Back to portal
        </a>
      </Panel>
    );
  }

  return (
    <div>
      <MotivationalBanner copy={props.copy.motivationalRealityCheck} />

      {!props.cardOnFile && (
        <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {props.copy.cardNotOnFileNote}
        </div>
      )}

      <AnimatePresence mode="wait">
        {panel === "home" && (
          <Panel key="home">
            {props.branch === "paused" && (
              <PausedBranch
                copy={props.copy}
                productName={props.productName}
                tierName={props.tierName}
                onCancel={() => {
                  const canPostTerm =
                    props.committedUntilDateMs === null ||
                    props.committedUntilDateMs <= Date.now();
                  setPendingBranch(canPostTerm ? "post_term" : "paid_remainder");
                  setPanel("confirm");
                }}
              />
            )}
            {props.branch === "pre_term" && (
              <PreTermBranch
                math={props.math}
                cardOnFile={props.cardOnFile}
                pauseUsedThisCommitment={props.pauseUsedThisCommitment}
                onPick={(b) => {
                  setPendingBranch(b);
                  setPanel("confirm");
                }}
                onSwitch={
                  props.alternativeProducts.length > 0
                    ? () => setPanel("switch")
                    : null
                }
              />
            )}
            {props.branch === "post_term" && (
              <PostTermBranch
                copy={props.copy}
                productName={props.productName}
                tierName={props.tierName}
                higherTiers={props.higherTiers}
                lowerTiers={props.lowerTiers}
                onCancel={() => {
                  setPendingBranch("post_term");
                  setPanel("confirm");
                }}
              />
            )}
          </Panel>
        )}

        {panel === "switch" && (
          <Panel key="switch">
            <ProductSwitch
              copy={props.copy}
              dealId={props.dealId}
              alternatives={props.alternativeProducts}
              onBack={() => setPanel("home")}
            />
          </Panel>
        )}

        {panel === "confirm" && pendingBranch && (
          <Panel key="confirm">
            <ConfirmCancel
              branch={pendingBranch}
              math={props.math}
              productName={props.productName}
              tierName={props.tierName}
              copy={props.copy}
              isPending={isPending}
              error={error}
              onBack={() => {
                setPendingBranch(null);
                setError(null);
                setPanel("home");
              }}
              onConfirm={() => runCancel(pendingBranch)}
            />
          </Panel>
        )}
      </AnimatePresence>
    </div>
  );
}

function Panel({ children }: { children: React.ReactNode; key?: string }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={houseSpring}
    >
      {children}
    </motion.section>
  );
}

function MotivationalBanner({ copy }: { copy: string }) {
  return (
    <div className="mb-10 rounded-2xl border border-neutral-200 bg-cream-50 px-6 py-5 text-neutral-700">
      <p className="font-serif text-lg leading-relaxed text-neutral-800">
        {copy}
      </p>
    </div>
  );
}

function PausedBranch(props: {
  copy: typeof CANCEL_COPY;
  productName: string;
  tierName: string;
  onCancel: () => void;
}) {
  return (
    <div>
      <h1 className="font-serif text-3xl text-neutral-900">
        {props.copy.pausedHeading}
      </h1>
      <p className="mt-3 text-neutral-600">
        {props.productName} — {props.tierName}. You&apos;re currently paused.
      </p>
      <div className="mt-8 flex flex-col gap-3">
        <a
          href="/lite/portal"
          className="rounded-full bg-neutral-900 px-5 py-3 text-center text-sm text-white hover:bg-neutral-700"
        >
          Resume now
        </a>
        <button
          type="button"
          onClick={props.onCancel}
          className="rounded-full border border-neutral-300 px-5 py-3 text-sm text-neutral-700 hover:bg-neutral-100"
        >
          Cancel instead
        </button>
      </div>
    </div>
  );
}

function PreTermBranch(props: {
  math: CancelClientProps["math"];
  cardOnFile: boolean;
  pauseUsedThisCommitment: boolean;
  onPick: (b: CancelBranch) => void;
  onSwitch: (() => void) | null;
}) {
  const paidDisabled = !props.cardOnFile;
  return (
    <div>
      <h1 className="font-serif text-3xl text-neutral-900">
        You&apos;re still inside your commitment.
      </h1>
      {props.math && (
        <p className="mt-3 text-neutral-600">
          {props.math.remaining_months} month
          {props.math.remaining_months === 1 ? "" : "s"} remaining.
        </p>
      )}
      <div className="mt-8 grid gap-3">
        {props.onSwitch && (
          <button
            type="button"
            onClick={props.onSwitch}
            className="rounded-xl border border-neutral-300 px-5 py-4 text-left text-sm text-neutral-800 hover:bg-neutral-50"
          >
            <div className="font-medium">Switch product</div>
            <div className="mt-1 text-neutral-500">
              Try a different SuperBad product before you go.
            </div>
          </button>
        )}
        <button
          type="button"
          disabled={paidDisabled}
          onClick={() => props.onPick("paid_remainder")}
          className="rounded-xl border border-neutral-300 px-5 py-4 text-left text-sm text-neutral-800 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <div className="font-medium">
            Pay the remainder{" "}
            {props.math && (
              <span className="text-neutral-500">
                — {props.math.remainder_label}
              </span>
            )}
          </div>
          <div className="mt-1 text-neutral-500">
            We charge the remaining months and cancel at the end of your term.
          </div>
        </button>
        <button
          type="button"
          disabled={paidDisabled}
          onClick={() => props.onPick("buyout")}
          className="rounded-xl border border-neutral-300 px-5 py-4 text-left text-sm text-neutral-800 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <div className="font-medium">
            50% buyout{" "}
            {props.math && (
              <span className="text-neutral-500">
                — {props.math.buyout_label}
              </span>
            )}
          </div>
          <div className="mt-1 text-neutral-500">
            Half the remainder, cancel today.
          </div>
        </button>
        {!props.pauseUsedThisCommitment && (
          <a
            href="/lite/portal"
            className="rounded-xl border border-neutral-300 px-5 py-4 text-left text-sm text-neutral-800 hover:bg-neutral-50"
          >
            <div className="font-medium">Pause for one month</div>
            <div className="mt-1 text-neutral-500">
              One pause per commitment. Billing resumes after 30 days.
            </div>
          </a>
        )}
        <a
          href="/lite/portal"
          className="rounded-xl px-5 py-4 text-left text-sm text-neutral-500 hover:text-neutral-800"
        >
          Actually, I&apos;ll stay.
        </a>
      </div>
    </div>
  );
}

function PostTermBranch(props: {
  copy: typeof CANCEL_COPY;
  productName: string;
  tierName: string;
  higherTiers: TierRef[];
  lowerTiers: TierRef[];
  onCancel: () => void;
}) {
  return (
    <div>
      <h1 className="font-serif text-3xl text-neutral-900">
        You&apos;re free to go.
      </h1>
      <p className="mt-3 text-neutral-600">
        {props.productName} — {props.tierName}. Commitment&apos;s over. What
        next?
      </p>
      {props.higherTiers.length > 0 && (
        <TierList label="Step up" tiers={props.higherTiers} />
      )}
      {props.lowerTiers.length > 0 && (
        <TierList label="Step down" tiers={props.lowerTiers} />
      )}
      <div className="mt-8 flex flex-col gap-3">
        <a
          href="/lite/portal"
          className="rounded-full bg-neutral-900 px-5 py-3 text-center text-sm text-white hover:bg-neutral-700"
        >
          Stay on {props.tierName}
        </a>
        <button
          type="button"
          onClick={props.onCancel}
          className="rounded-full border border-neutral-300 px-5 py-3 text-sm text-neutral-600 hover:bg-neutral-100"
        >
          Cancel anyway
        </button>
      </div>
    </div>
  );
}

function TierList({ label, tiers }: { label: string; tiers: TierRef[] }) {
  return (
    <div className="mt-8">
      <h2 className="text-xs font-medium uppercase tracking-wide text-neutral-500">
        {label}
      </h2>
      <div className="mt-3 grid gap-2">
        {tiers.map((t) => (
          <div
            key={t.id}
            className="rounded-xl border border-neutral-200 px-4 py-3 text-sm text-neutral-700"
          >
            <div className="font-medium text-neutral-900">{t.name}</div>
            <div className="text-neutral-500">{t.monthly_label} / month</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ProductSwitch(props: {
  copy: typeof CANCEL_COPY;
  dealId: string;
  alternatives: AltProduct[];
  onBack: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  function pick(alt: AltProduct) {
    if (!alt.tier) return;
    setError(null);
    startTransition(async () => {
      const res = await switchProductSoftStepAction({
        dealId: props.dealId,
        newProductId: alt.id,
        newTierId: alt.tier!.id,
      });
      if (!res.ok) {
        setError(res.error ?? "internal");
        return;
      }
      setDone(true);
    });
  }

  if (done) {
    return (
      <div>
        <h1 className="font-serif text-3xl text-neutral-900">Switched.</h1>
        <p className="mt-3 text-neutral-600">
          Your product has been switched. You&apos;ll see the change in your
          portal.
        </p>
        <a
          href="/lite/portal"
          className="mt-8 inline-block rounded-full border border-neutral-300 px-5 py-2 text-sm text-neutral-700 hover:bg-neutral-100"
        >
          Back to portal
        </a>
      </div>
    );
  }

  return (
    <div>
      <h1 className="font-serif text-3xl text-neutral-900">
        {props.copy.productSwitchHeading}
      </h1>
      <div className="mt-8 grid gap-3">
        {props.alternatives.map((alt) => (
          <button
            key={alt.id}
            type="button"
            disabled={!alt.tier || isPending}
            onClick={() => pick(alt)}
            className="rounded-xl border border-neutral-300 px-5 py-4 text-left text-sm text-neutral-800 hover:bg-neutral-50 disabled:opacity-50"
          >
            <div className="font-medium">{alt.name}</div>
            {alt.tier && (
              <div className="mt-1 text-neutral-500">
                Start on {alt.tier.name}.
              </div>
            )}
          </button>
        ))}
      </div>
      {error && (
        <p className="mt-4 text-sm text-red-700">
          Something went wrong ({error}). {props.copy.talkToUsLabel.toLowerCase()}.
        </p>
      )}
      <button
        type="button"
        onClick={props.onBack}
        className="mt-6 text-sm text-neutral-500 hover:text-neutral-800"
      >
        ← Back
      </button>
    </div>
  );
}

function ConfirmCancel(props: {
  branch: CancelBranch;
  math: CancelClientProps["math"];
  productName: string;
  tierName: string;
  copy: typeof CANCEL_COPY;
  isPending: boolean;
  error: string | null;
  onBack: () => void;
  onConfirm: () => void;
}) {
  const amount =
    props.branch === "paid_remainder"
      ? props.math?.remainder_label
      : props.branch === "buyout"
        ? props.math?.buyout_label
        : null;

  return (
    <div>
      <h1 className="font-serif text-3xl text-neutral-900">
        {props.copy.postTermCancelConfirmHeading}
      </h1>
      <p className="mt-3 text-neutral-600">
        {props.productName} — {props.tierName}.
      </p>
      {amount && (
        <p className="mt-3 text-neutral-700">
          We&apos;ll charge <span className="font-medium">{amount}</span> to your
          card on file.
        </p>
      )}
      {props.error && (
        <p className="mt-4 text-sm text-red-700">
          Couldn&apos;t finish ({props.error}).
        </p>
      )}
      <div className="mt-8 flex flex-col gap-3">
        <button
          type="button"
          onClick={props.onBack}
          className="rounded-full bg-neutral-900 px-5 py-3 text-sm text-white hover:bg-neutral-700"
        >
          Actually, I&apos;ll stay
        </button>
        <button
          type="button"
          disabled={props.isPending}
          onClick={props.onConfirm}
          className="rounded-full border border-neutral-300 px-5 py-3 text-sm text-neutral-600 hover:bg-neutral-100 disabled:opacity-50"
        >
          {props.isPending ? "Cancelling…" : "Cancel anyway"}
        </button>
      </div>
    </div>
  );
}
