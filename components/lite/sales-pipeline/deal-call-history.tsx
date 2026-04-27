"use client";

import * as React from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import type { CallLogRow } from "@/lib/db/schema/call-logs";
import { getCallTemplate } from "@/lib/call-templates";

const HOUSE_SPRING = { type: "spring" as const, mass: 1, stiffness: 220, damping: 25 };

const TEMP_STYLES: Record<string, { color: string; bg: string }> = {
  hot: { color: "var(--brand-red)", bg: "rgba(178, 40, 72, 0.15)" },
  warm: { color: "var(--brand-orange)", bg: "rgba(242, 140, 82, 0.15)" },
  cool: { color: "var(--neutral-300)", bg: "rgba(212, 210, 194, 0.1)" },
  cold: { color: "var(--neutral-500)", bg: "rgba(128, 127, 115, 0.1)" },
};

interface DealCallHistoryProps {
  dealId: string;
  dealStage: string;
  calls: CallLogRow[];
}

export function DealCallHistory({ dealId, dealStage, calls }: DealCallHistoryProps) {
  const [expandedId, setExpandedId] = React.useState<string | null>(null);
  const hasTemplates = ["contacted", "conversation", "trial_shoot", "quoted", "negotiating"].includes(dealStage);

  return (
    <section
      className="rounded-[12px] p-6"
      style={{
        background: "var(--color-surface-2)",
        boxShadow: "var(--surface-highlight), 0 2px 8px rgba(0,0,0,0.2)",
        border: "1px solid rgba(253,245,230,0.06)",
      }}
    >
      <div className="flex items-center justify-between mb-5">
        <div
          className="font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-brand-orange)]"
          style={{ letterSpacing: "2.5px" }}
        >
          Call Notes
        </div>
        {hasTemplates && (
          <Link
            href={`/lite/admin/deals/${dealId}/call/new`}
            className="rounded-md px-3 py-1.5 text-[12px] font-medium cursor-pointer transition-colors"
            style={{
              background: "rgba(244, 160, 176, 0.1)",
              color: "var(--brand-pink)",
              border: "1px solid rgba(244, 160, 176, 0.2)",
            }}
          >
            Start Call
          </Link>
        )}
      </div>

      {/* Temperature trend */}
      {calls.filter(c => c.temperature).length >= 2 && (
        <div className="mb-4 flex items-center gap-1.5">
          <span className="text-[11px] text-[color:var(--neutral-500)] mr-2">Trend</span>
          {calls.filter(c => c.temperature).slice(0, 5).reverse().map((c, i) => {
            const style = TEMP_STYLES[c.temperature!];
            return (
              <span
                key={i}
                className="w-3 h-3 rounded-full"
                style={{ background: style?.color ?? "var(--neutral-600)" }}
                title={`${c.temperature} — ${new Date(c.created_at_ms).toLocaleDateString("en-AU")}`}
              />
            );
          })}
        </div>
      )}

      {calls.length === 0 ? (
        <p className="text-[13px] text-[color:var(--neutral-500)] italic">
          No calls recorded yet.{hasTemplates ? " Start one to build your call history." : ""}
        </p>
      ) : (
        <div className="space-y-2">
          {calls.map((call, i) => {
            const template = getCallTemplate(call.template_type);
            const synthesis = call.llm_synthesis as { summary?: string } | null;
            const isExpanded = expandedId === call.id;
            const tempStyle = call.temperature ? TEMP_STYLES[call.temperature] : null;

            return (
              <motion.div
                key={call.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ ...HOUSE_SPRING, delay: i * 0.04 }}
                className="rounded-lg border border-[color:var(--neutral-700)] overflow-hidden"
                style={{ background: "var(--surface-1)" }}
              >
                <button
                  onClick={() => setExpandedId(isExpanded ? null : call.id)}
                  className="w-full flex items-center justify-between p-3 text-left cursor-pointer transition-colors hover:bg-[color:var(--surface-2)]"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-[12px] text-[color:var(--neutral-500)] tabular-nums min-w-[70px]">
                      {new Date(call.created_at_ms).toLocaleDateString("en-AU", { day: "numeric", month: "short" })}
                    </span>
                    <span className="text-[13px] text-[color:var(--neutral-200)]">
                      {template.label}
                    </span>
                    {tempStyle && (
                      <span
                        className="rounded-full px-2 py-0.5 text-[10px] font-medium"
                        style={{ background: tempStyle.bg, color: tempStyle.color }}
                      >
                        {call.temperature}
                      </span>
                    )}
                    {call.status !== "complete" && (
                      <span className="rounded-full px-2 py-0.5 text-[10px] font-medium bg-[color:var(--surface-3)] text-[color:var(--neutral-500)]">
                        {call.status}
                      </span>
                    )}
                  </div>
                  <motion.span
                    className="text-[color:var(--neutral-500)] text-[11px]"
                    animate={{ rotate: isExpanded ? 90 : 0 }}
                    transition={{ duration: 0.15 }}
                  >
                    &#9654;
                  </motion.span>
                </button>

                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="px-3 pb-3 border-t border-[color:var(--neutral-700)]">
                        {synthesis?.summary && (
                          <p className="mt-3 text-[13px] text-[color:var(--neutral-300)] leading-relaxed">
                            {synthesis.summary}
                          </p>
                        )}
                        {call.agreed_next_step && (
                          <div className="mt-2">
                            <span className="text-[11px] text-[color:var(--neutral-500)]">Next step: </span>
                            <span className="text-[13px] text-[color:var(--neutral-200)]">{call.agreed_next_step}</span>
                          </div>
                        )}
                        <div className="mt-3">
                          <Link
                            href={`/lite/admin/deals/${dealId}/call/${call.id}`}
                            className="text-[12px] text-[color:var(--brand-pink)] hover:underline"
                          >
                            View full call notes &rarr;
                          </Link>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      )}
    </section>
  );
}
