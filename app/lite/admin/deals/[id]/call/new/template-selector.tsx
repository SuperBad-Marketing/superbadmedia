"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { getTemplatesForStage } from "@/lib/call-templates";
import type { CallTemplateType } from "@/lib/db/schema/call-logs";
import { createCallAction } from "../actions";
import { motion } from "framer-motion";

const HOUSE_SPRING = { type: "spring" as const, mass: 1, stiffness: 220, damping: 25 };

export function TemplateSelector({
  dealId,
  dealStage,
}: {
  dealId: string;
  dealStage: string;
}) {
  const router = useRouter();
  const templates = getTemplatesForStage(dealStage);
  const [pending, setPending] = React.useState(false);

  if (templates.length === 0) {
    return (
      <div className="rounded-xl border border-[color:var(--neutral-700)] bg-[color:var(--surface-1)] p-8 text-center">
        <p className="text-[color:var(--neutral-500)] text-[14px]">
          No call templates available for the <strong className="text-[color:var(--neutral-300)]">{dealStage.replace("_", " ")}</strong> stage.
        </p>
        <p className="text-[color:var(--neutral-500)] text-[13px] mt-2">
          Call templates are available for: Contacted, Conversation, Trial Shoot, Quoted, and Negotiating stages.
        </p>
      </div>
    );
  }

  async function selectTemplate(type: CallTemplateType) {
    if (pending) return;
    setPending(true);
    const result = await createCallAction(dealId, type);
    if (result.ok && result.data) {
      router.push(`/lite/admin/deals/${dealId}/call/${result.data.callId}`);
    } else {
      setPending(false);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-[14px] text-[color:var(--neutral-300)]">
        Choose a call structure:
      </p>
      {templates.map((t, i) => (
        <motion.button
          key={t.type}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...HOUSE_SPRING, delay: i * 0.06 }}
          onClick={() => selectTemplate(t.type)}
          disabled={pending}
          className="w-full text-left rounded-xl border border-[color:var(--neutral-700)] bg-[color:var(--surface-1)] p-6 transition-colors hover:border-[color:var(--brand-pink)] hover:bg-[color:var(--surface-2)] disabled:opacity-50 cursor-pointer"
          style={{ boxShadow: "var(--surface-highlight)" }}
        >
          <div className="flex items-center gap-3 mb-2">
            <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-[color:var(--brand-red)]/15 text-[color:var(--brand-pink)] text-[13px] font-semibold">
              {i + 1}
            </span>
            <h3 className="font-[family-name:var(--font-label)] text-[17px] text-[color:var(--neutral-100)]">
              {t.label}
            </h3>
          </div>
          <p className="text-[13px] text-[color:var(--neutral-500)] ml-11">
            {t.description}
          </p>
          <div className="mt-3 ml-11 text-[12px] text-[color:var(--neutral-500)]">
            {t.sections.length} sections &middot; {t.sections.reduce((sum, s) => sum + s.questions.length, 0)} questions
          </div>
        </motion.button>
      ))}
    </div>
  );
}
