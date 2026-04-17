"use client";

/**
 * History import wizard — client component.
 *
 * Three phases, auto-advancing:
 *   1. Import: progress bar, polling, non-blocking
 *   2. Contact routing review: summary + expandable list
 *   3. Noise cleanup: one-click purge or skip
 *
 * Voice: dry, observational, in-character per brief §6.
 *
 * Owner: UI-12.
 */
import { useEffect, useState, useTransition, useCallback } from "react";
import { motion, AnimatePresence, useReducedMotion, type Transition } from "framer-motion";
import { houseSpring } from "@/lib/design-tokens";
import type { ImportProgress } from "@/lib/graph/history-import";
import {
  getHistoryImportStatus,
  startHistoryImport,
  getImportedContactsSummary,
  rerouteContact,
  cleanupOldNoise,
  type ContactSummary,
} from "./actions";

type Phase = "import" | "review" | "cleanup" | "done";

type Props = {
  initialState: {
    id: string;
    integrationConnectionId: string;
    status: string;
  } | null;
  initialProgress: ImportProgress | null;
};

const POLL_INTERVAL_MS = 3000;

export function HistoryImportClient({ initialState, initialProgress }: Props) {
  const reduceMotion = useReducedMotion();
  const transition = reduceMotion
    ? ({ duration: 0.15, ease: "linear" } as const)
    : houseSpring;

  const [phase, setPhase] = useState<Phase>(() => {
    if (!initialState) return "import";
    if (initialState.status === "complete") return "review";
    return "import";
  });

  const [progress, setProgress] = useState<ImportProgress | null>(
    initialProgress,
  );
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Contact routing review state
  const [contactSummaries, setContactSummaries] = useState<ContactSummary[]>(
    [],
  );
  const [contactTotals, setContactTotals] = useState<Record<string, number>>(
    {},
  );
  const [expandedContact, setExpandedContact] = useState<string | null>(null);

  // Noise cleanup state
  const [purgedCount, setPurgedCount] = useState<number | null>(null);

  // -----------------------------------------------------------------------
  // Phase 1: Import
  // -----------------------------------------------------------------------
  const handleStartImport = useCallback(() => {
    startTransition(async () => {
      setError(null);
      const result = await startHistoryImport();
      if (!result.ok) {
        setError(result.error);
      }
    });
  }, []);

  // Poll for progress when import is in progress
  useEffect(() => {
    if (phase !== "import") return;

    // Only poll if import has started
    const state = initialState;
    if (
      !state ||
      (state.status === "not_started" && !progress)
    ) {
      return;
    }

    const interval = setInterval(async () => {
      const result = await getHistoryImportStatus();
      if (result.ok && result.progress) {
        setProgress(result.progress);
        if (result.progress.status === "complete") {
          setPhase("review");
        }
      }
    }, POLL_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [phase, progress, initialState]);

  // -----------------------------------------------------------------------
  // Phase 2: Contact routing review
  // -----------------------------------------------------------------------
  useEffect(() => {
    if (phase !== "review") return;
    let cancelled = false;

    (async () => {
      const result = await getImportedContactsSummary();
      if (cancelled) return;
      if (result.ok) {
        setContactSummaries(result.contacts);
        setContactTotals(result.totals);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [phase]);

  const handleReroute = useCallback(
    (contactId: string, newType: string) => {
      startTransition(async () => {
        const result = await rerouteContact({
          contactId,
          newRelationshipType: newType as
            | "lead"
            | "client"
            | "past_client"
            | "non_client"
            | "supplier"
            | "personal",
        });
        if (result.ok) {
          setContactSummaries((prev) =>
            prev.map((c) =>
              c.id === contactId
                ? { ...c, relationshipType: newType }
                : c,
            ),
          );
        }
      });
    },
    [],
  );

  // -----------------------------------------------------------------------
  // Phase 3: Noise cleanup
  // -----------------------------------------------------------------------
  const handleCleanupNoise = useCallback(() => {
    startTransition(async () => {
      const result = await cleanupOldNoise();
      if (result.ok) {
        setPurgedCount(result.purged);
        setPhase("done");
      } else {
        setError(result.error);
      }
    });
  }, []);

  const handleSkipCleanup = useCallback(() => {
    setPhase("done");
  }, []);

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  if (!initialState) {
    return (
      <div className="mx-auto max-w-xl px-6 py-16">
        <p
          className="font-[family-name:var(--font-righteous)] text-[10px] uppercase tracking-[0.2em]"
          style={{ color: "var(--color-neutral-500)" }}
        >
          History import
        </p>
        <h1
          className="mt-2 font-[family-name:var(--font-playfair)] text-[length:var(--text-2xl)]"
          style={{ color: "var(--color-neutral-900)" }}
        >
          No Microsoft connection found.
        </h1>
        <p
          className="mt-2 text-[length:var(--text-sm)]"
          style={{ color: "var(--color-neutral-500)" }}
        >
          Complete the Graph API wizard first, then come back.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl px-6 py-16">
      <p
        className="font-[family-name:var(--font-righteous)] text-[10px] uppercase tracking-[0.2em]"
        style={{ color: "var(--color-neutral-500)" }}
      >
        Inbox setup
      </p>

      <AnimatePresence mode="wait">
        {phase === "import" && (
          <motion.div
            key="import"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={transition}
          >
            <ImportPhase
              progress={progress}
              onStart={handleStartImport}
              isPending={isPending}
              error={error}
              transition={transition}
            />
          </motion.div>
        )}

        {phase === "review" && (
          <motion.div
            key="review"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={transition}
          >
            <ReviewPhase
              contacts={contactSummaries}
              totals={contactTotals}
              expanded={expandedContact}
              onToggle={setExpandedContact}
              onReroute={handleReroute}
              onContinue={() => setPhase("cleanup")}
              isPending={isPending}
              transition={transition}
            />
          </motion.div>
        )}

        {phase === "cleanup" && (
          <motion.div
            key="cleanup"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={transition}
          >
            <CleanupPhase
              noiseCount={progress?.noise ?? 0}
              onCleanup={handleCleanupNoise}
              onSkip={handleSkipCleanup}
              isPending={isPending}
              error={error}
            />
          </motion.div>
        )}

        {phase === "done" && (
          <motion.div
            key="done"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={transition}
          >
            <DonePhase purgedCount={purgedCount} progress={progress} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function ImportPhase({
  progress,
  onStart,
  isPending,
  error,
  transition,
}: {
  progress: ImportProgress | null;
  onStart: () => void;
  isPending: boolean;
  error: string | null;
  transition: Transition;
}) {
  const hasStarted = progress !== null;
  const pct =
    hasStarted && progress.estimatedTotal
      ? Math.min(
          100,
          Math.round((progress.imported / progress.estimatedTotal) * 100),
        )
      : 0;

  return (
    <>
      <h1
        className="mt-2 font-[family-name:var(--font-playfair)] text-[length:var(--text-2xl)]"
        style={{ color: "var(--color-neutral-900)" }}
      >
        {hasStarted ? "Importing your email history." : "Import your email history."}
      </h1>
      <p
        className="mt-2 text-[length:var(--text-sm)]"
        style={{ color: "var(--color-neutral-500)" }}
      >
        {hasStarted
          ? `Imported ${progress.imported.toLocaleString()} of ~${(progress.estimatedTotal ?? 0).toLocaleString()} messages\u2026`
          : "This pulls the last 12 months and sorts everything for you. Runs in the background \u2014 you can leave and come back."}
      </p>

      {hasStarted && (
        <div className="mt-6">
          <div
            className="h-2 overflow-hidden rounded-full"
            style={{ background: "var(--color-neutral-200)" }}
          >
            <motion.div
              className="h-full rounded-full"
              style={{ background: "var(--color-brand-pink)" }}
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={transition}
            />
          </div>
          <p
            className="mt-2 text-[length:var(--text-xs)]"
            style={{ color: "var(--color-neutral-400)" }}
          >
            {pct}% \u00b7 {progress.signal.toLocaleString()} signal \u00b7{" "}
            {progress.noise.toLocaleString()} noise \u00b7{" "}
            {progress.spam.toLocaleString()} spam
          </p>
        </div>
      )}

      {!hasStarted && (
        <button
          onClick={onStart}
          disabled={isPending}
          className="mt-6 rounded-[var(--radius-md)] px-6 py-2.5 text-[length:var(--text-sm)] font-medium transition-colors"
          style={{
            background: "var(--color-neutral-900)",
            color: "var(--color-neutral-50)",
          }}
        >
          {isPending ? "Starting\u2026" : "Start import"}
        </button>
      )}

      {error && (
        <p
          className="mt-3 text-[length:var(--text-sm)]"
          style={{ color: "var(--color-brand-red)" }}
        >
          {error}
        </p>
      )}
    </>
  );
}

function ReviewPhase({
  contacts,
  totals,
  expanded,
  onToggle,
  onReroute,
  onContinue,
  isPending,
  transition,
}: {
  contacts: ContactSummary[];
  totals: Record<string, number>;
  expanded: string | null;
  onToggle: (id: string | null) => void;
  onReroute: (contactId: string, newType: string) => void;
  onContinue: () => void;
  isPending: boolean;
  transition: Transition;
}) {
  const totalContacts = contacts.length;

  const totalSummary = Object.entries(totals)
    .map(([type, count]) => `${count} ${type}`)
    .join(", ");

  return (
    <>
      <h1
        className="mt-2 font-[family-name:var(--font-playfair)] text-[length:var(--text-2xl)]"
        style={{ color: "var(--color-neutral-900)" }}
      >
        Contact routing review.
      </h1>
      <p
        className="mt-2 text-[length:var(--text-sm)]"
        style={{ color: "var(--color-neutral-500)" }}
      >
        {totalContacts > 0
          ? `Matched messages to ${totalContacts} contacts: ${totalSummary}. Review any before we move on?`
          : "No contacts were created during import. Moving on."}
      </p>

      {contacts.length > 0 && (
        <div className="mt-6 space-y-1">
          {contacts.slice(0, 50).map((contact) => (
            <motion.div
              key={contact.id}
              layout
              transition={transition}
              className="rounded-[var(--radius-sm)] border px-4 py-3"
              style={{
                borderColor: "var(--color-neutral-200)",
                background: "var(--color-surface-primary)",
              }}
            >
              <button
                className="flex w-full items-center justify-between text-left"
                onClick={() =>
                  onToggle(expanded === contact.id ? null : contact.id)
                }
              >
                <div>
                  <span
                    className="text-[length:var(--text-sm)] font-medium"
                    style={{ color: "var(--color-neutral-900)" }}
                  >
                    {contact.name || contact.email}
                  </span>
                  <span
                    className="ml-2 text-[length:var(--text-xs)]"
                    style={{ color: "var(--color-neutral-400)" }}
                  >
                    {contact.messageCount} messages \u00b7{" "}
                    {contact.relationshipType ?? "unknown"}
                  </span>
                </div>
                <span
                  className="text-[length:var(--text-xs)]"
                  style={{ color: "var(--color-neutral-400)" }}
                >
                  {expanded === contact.id ? "\u25B2" : "\u25BC"}
                </span>
              </button>

              <AnimatePresence>
                {expanded === contact.id && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={transition}
                    className="overflow-hidden"
                  >
                    <div className="mt-3 flex flex-wrap gap-2">
                      {(
                        [
                          "lead",
                          "client",
                          "supplier",
                          "personal",
                          "non_client",
                        ] as const
                      ).map((type) => (
                        <button
                          key={type}
                          disabled={
                            isPending ||
                            contact.relationshipType === type
                          }
                          onClick={() => onReroute(contact.id, type)}
                          className="rounded-full px-3 py-1 text-[length:var(--text-xs)] transition-colors disabled:opacity-40"
                          style={{
                            background:
                              contact.relationshipType === type
                                ? "var(--color-neutral-900)"
                                : "var(--color-neutral-100)",
                            color:
                              contact.relationshipType === type
                                ? "var(--color-neutral-50)"
                                : "var(--color-neutral-700)",
                          }}
                        >
                          {type.replace("_", " ")}
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>
      )}

      <button
        onClick={onContinue}
        className="mt-6 rounded-[var(--radius-md)] px-6 py-2.5 text-[length:var(--text-sm)] font-medium transition-colors"
        style={{
          background: "var(--color-neutral-900)",
          color: "var(--color-neutral-50)",
        }}
      >
        {contacts.length > 0 ? "Looks good \u2014 continue" : "Continue"}
      </button>
    </>
  );
}

function CleanupPhase({
  noiseCount,
  onCleanup,
  onSkip,
  isPending,
  error,
}: {
  noiseCount: number;
  onCleanup: () => void;
  onSkip: () => void;
  isPending: boolean;
  error: string | null;
}) {
  return (
    <>
      <h1
        className="mt-2 font-[family-name:var(--font-playfair)] text-[length:var(--text-2xl)]"
        style={{ color: "var(--color-neutral-900)" }}
      >
        Noise cleanup.
      </h1>
      <p
        className="mt-2 text-[length:var(--text-sm)]"
        style={{ color: "var(--color-neutral-500)" }}
      >
        {noiseCount > 0
          ? `About ${noiseCount.toLocaleString()} imported messages are noise older than 30 days. Auto-purge them now to start fresh, or keep them for reference?`
          : "No old noise to clean up. You're starting clean."}
      </p>

      <div className="mt-6 flex gap-3">
        {noiseCount > 0 && (
          <button
            onClick={onCleanup}
            disabled={isPending}
            className="rounded-[var(--radius-md)] px-6 py-2.5 text-[length:var(--text-sm)] font-medium transition-colors"
            style={{
              background: "var(--color-neutral-900)",
              color: "var(--color-neutral-50)",
            }}
          >
            {isPending ? "Purging\u2026" : "Purge old noise"}
          </button>
        )}
        <button
          onClick={onSkip}
          disabled={isPending}
          className="rounded-[var(--radius-md)] px-6 py-2.5 text-[length:var(--text-sm)] font-medium transition-colors"
          style={{
            background: "var(--color-neutral-100)",
            color: "var(--color-neutral-700)",
          }}
        >
          {noiseCount > 0 ? "Keep them" : "Continue"}
        </button>
      </div>

      {error && (
        <p
          className="mt-3 text-[length:var(--text-sm)]"
          style={{ color: "var(--color-brand-red)" }}
        >
          {error}
        </p>
      )}
    </>
  );
}

function DonePhase({
  purgedCount,
  progress,
}: {
  purgedCount: number | null;
  progress: ImportProgress | null;
}) {
  const imported = progress?.imported ?? 0;
  const signal = progress?.signal ?? 0;
  const noise = progress?.noise ?? 0;
  const spam = progress?.spam ?? 0;

  return (
    <>
      <h1
        className="mt-2 font-[family-name:var(--font-playfair)] text-[length:var(--text-2xl)]"
        style={{ color: "var(--color-neutral-900)" }}
      >
        History imported.
      </h1>
      <p
        className="mt-2 text-[length:var(--text-sm)]"
        style={{ color: "var(--color-neutral-500)" }}
      >
        {imported.toLocaleString()} messages. {signal.toLocaleString()} signal,{" "}
        {noise.toLocaleString()} noise, {spam.toLocaleString()} spam.
        {purgedCount != null && purgedCount > 0
          ? ` ${purgedCount.toLocaleString()} old noise purged.`
          : ""}
      </p>
      <p
        className="mt-4 text-[length:var(--text-sm)]"
        style={{ color: "var(--color-neutral-400)" }}
      >
        Your inbox is ready. Morning digest arrives at 8am.
      </p>
    </>
  );
}
