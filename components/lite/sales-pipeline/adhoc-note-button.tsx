"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { addAdHocNoteAction } from "@/app/lite/admin/deals/[id]/call/actions";
import type { CallTemperature } from "@/lib/db/schema/call-logs";

const TEMP_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  hot: { label: "Hot", color: "var(--brand-red)", bg: "rgba(178, 40, 72, 0.15)" },
  warm: { label: "Warm", color: "var(--brand-orange)", bg: "rgba(242, 140, 82, 0.15)" },
  cool: { label: "Cool", color: "var(--neutral-300)", bg: "rgba(212, 210, 194, 0.1)" },
  cold: { label: "Cold", color: "var(--neutral-500)", bg: "rgba(128, 127, 115, 0.1)" },
};

export function AdHocNoteButton({ dealId }: { dealId: string }) {
  const [open, setOpen] = React.useState(false);
  const [text, setText] = React.useState("");
  const [temperature, setTemperature] = React.useState<CallTemperature | null>(null);
  const [followUpDate, setFollowUpDate] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const router = useRouter();

  async function handleSubmit() {
    if (!text.trim() || saving) return;
    setSaving(true);
    const result = await addAdHocNoteAction(dealId, {
      text: text.trim(),
      temperature,
      followUpDateMs: followUpDate ? new Date(followUpDate).getTime() : null,
    });
    setSaving(false);
    if (result.ok) {
      setText("");
      setTemperature(null);
      setFollowUpDate("");
      setOpen(false);
      router.refresh();
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-md px-3 py-1.5 text-[12px] font-medium cursor-pointer transition-colors"
        style={{
          background: "var(--surface-2)",
          color: "var(--neutral-300)",
          border: "1px solid var(--neutral-700)",
        }}
      >
        + Quick Note
      </button>
    );
  }

  return (
    <div
      className="rounded-xl border p-4 space-y-3"
      style={{
        background: "var(--surface-1)",
        borderColor: "var(--neutral-700)",
      }}
    >
      <textarea
        autoFocus
        value={text}
        onChange={e => setText(e.target.value)}
        placeholder="What happened? (e.g. they called back about pricing)"
        rows={2}
        className="w-full rounded-lg px-3 py-2 text-[13px] bg-[color:var(--surface-0)] text-[color:var(--neutral-100)] border border-[color:var(--neutral-700)] focus:border-[color:var(--brand-pink)] focus:outline-none resize-none placeholder:text-[color:var(--neutral-600)]"
      />

      <div className="flex items-center gap-4 flex-wrap">
        {/* Temperature pills */}
        <div className="flex gap-1.5">
          {(["hot", "warm", "cool", "cold"] as const).map(t => (
            <button
              key={t}
              onClick={() => setTemperature(temperature === t ? null : t)}
              className="rounded-md px-2 py-1 text-[11px] font-medium transition-all cursor-pointer border"
              style={{
                background: temperature === t ? TEMP_CONFIG[t].bg : "transparent",
                color: temperature === t ? TEMP_CONFIG[t].color : "var(--neutral-600)",
                borderColor: temperature === t ? TEMP_CONFIG[t].color : "var(--neutral-700)",
              }}
            >
              {TEMP_CONFIG[t].label}
            </button>
          ))}
        </div>

        {/* Follow-up date */}
        <input
          type="date"
          value={followUpDate}
          onChange={e => setFollowUpDate(e.target.value)}
          className="rounded-md px-2 py-1 text-[11px] bg-[color:var(--surface-0)] text-[color:var(--neutral-300)] border border-[color:var(--neutral-700)] focus:border-[color:var(--brand-pink)] focus:outline-none"
          placeholder="Follow-up"
        />
      </div>

      <div className="flex gap-2">
        <button
          onClick={handleSubmit}
          disabled={!text.trim() || saving}
          className="rounded-md px-3 py-1.5 text-[12px] font-medium cursor-pointer disabled:opacity-50 transition-all"
          style={{ background: "var(--accent-cta)", color: "var(--accent-cta-fg)" }}
        >
          {saving ? "Saving..." : "Save Note"}
        </button>
        <button
          onClick={() => { setOpen(false); setText(""); setTemperature(null); setFollowUpDate(""); }}
          className="rounded-md px-3 py-1.5 text-[12px] text-[color:var(--neutral-500)] hover:text-[color:var(--neutral-300)] cursor-pointer"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
