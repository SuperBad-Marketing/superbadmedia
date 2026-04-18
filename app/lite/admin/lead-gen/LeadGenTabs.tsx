"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { houseSpring } from "@/lib/design-tokens";
import { RunsTable } from "./RunsTable";
import type { RunForTable, CandidateForTable } from "./RunsTable";
import { QueueTab } from "./QueueTab";
import type { DraftForQueue, AutonomyStateForHeader, LatestRunStats } from "./QueueTab";

type TabId = "runs" | "queue";

const TABS: { id: TabId; label: string }[] = [
  { id: "runs", label: "Runs Log" },
  { id: "queue", label: "Approval Queue" },
];

type Props = {
  runs: RunForTable[];
  candidatesByRunId: Record<string, CandidateForTable[]>;
  pendingDrafts: DraftForQueue[];
  autonomyStates: AutonomyStateForHeader[];
  runStats: LatestRunStats;
  pendingCount: number;
};

export function LeadGenTabs({
  runs,
  candidatesByRunId,
  pendingDrafts,
  autonomyStates,
  runStats,
  pendingCount,
}: Props) {
  const [activeTab, setActiveTab] = useState<TabId>("runs");

  return (
    <div>
      {/* Tab bar */}
      <div
        className="mb-6 flex gap-0"
        style={{ borderBottom: "1px solid rgba(253,245,230,0.06)" }}
      >
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className="relative px-4 pb-3 font-[family-name:var(--font-label)] text-[11px] uppercase transition-colors"
            style={{
              letterSpacing: "1.8px",
              color:
                activeTab === tab.id
                  ? "var(--color-brand-cream)"
                  : "var(--color-neutral-500)",
            }}
          >
            {tab.label}
            {tab.id === "queue" && pendingCount > 0 && (
              <span
                className="ml-2 rounded-full px-1.5 py-0.5 font-[family-name:var(--font-label)] text-[9px]"
                style={{
                  background: "rgba(244,160,176,0.15)",
                  color: "var(--color-brand-pink)",
                }}
              >
                {pendingCount}
              </span>
            )}
            {activeTab === tab.id && (
              <motion.span
                layoutId="lead-gen-tab-active"
                className="absolute bottom-0 left-0 right-0 h-[2px] rounded-full"
                style={{ background: "var(--color-brand-pink)" }}
                transition={houseSpring}
              />
            )}
          </button>
        ))}
      </div>

      {/* Tab panels */}
      <AnimatePresence mode="wait">
        {activeTab === "runs" ? (
          <motion.div
            key="runs"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={houseSpring}
          >
            <RunsTable runs={runs} candidatesByRunId={candidatesByRunId} />
          </motion.div>
        ) : (
          <motion.div
            key="queue"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={houseSpring}
          >
            <QueueTab
              drafts={pendingDrafts}
              autonomyStates={autonomyStates}
              runStats={runStats}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
