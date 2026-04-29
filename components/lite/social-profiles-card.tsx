"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { houseSpring } from "@/lib/design-tokens";
import {
  saveCandidateSocialProfiles,
  saveCompanySocialProfiles,
  type SocialProfileFields,
} from "@/app/lite/admin/actions/social-profiles";

interface SocialProfilesCardProps {
  candidateId?: string;
  companyId?: string;
  initialValues: SocialProfileFields;
  defaultOpen?: boolean;
}

const FIELDS: { key: keyof SocialProfileFields; label: string; placeholder: string }[] = [
  { key: "instagram_handle", label: "Instagram", placeholder: "handle (no @)" },
  { key: "youtube_url", label: "YouTube", placeholder: "https://youtube.com/..." },
  { key: "facebook_url", label: "Facebook", placeholder: "https://facebook.com/..." },
  { key: "linkedin_url", label: "LinkedIn", placeholder: "https://linkedin.com/company/..." },
  { key: "tiktok_url", label: "TikTok", placeholder: "https://tiktok.com/@..." },
];

export function SocialProfilesCard({
  candidateId,
  companyId,
  initialValues,
  defaultOpen = true,
}: SocialProfilesCardProps) {
  const [open, setOpen] = React.useState(defaultOpen);
  const [values, setValues] = React.useState<SocialProfileFields>(initialValues);
  const [saving, setSaving] = React.useState(false);
  const [result, setResult] = React.useState<string | null>(null);
  const dirty = React.useMemo(() => {
    return FIELDS.some(
      (f) => (values[f.key] ?? "") !== (initialValues[f.key] ?? ""),
    );
  }, [values, initialValues]);

  const handleSave = async () => {
    setSaving(true);
    setResult(null);
    const res = candidateId
      ? await saveCandidateSocialProfiles(candidateId, values)
      : companyId
        ? await saveCompanySocialProfiles(companyId, values)
        : null;

    if (!res) {
      setResult("No target.");
    } else if (res.ok) {
      setResult("Saved.");
    } else {
      setResult(res.error);
    }
    setSaving(false);
  };

  return (
    <section
      className="overflow-hidden rounded-[12px]"
      style={{
        background: "var(--color-surface-2)",
        boxShadow: "var(--surface-highlight)",
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full items-center justify-between px-5 py-3.5 cursor-pointer"
        style={{ borderBottom: "1px solid rgba(253, 245, 230, 0.05)" }}
      >
        <h2
          className="font-[family-name:var(--font-label)] text-[11px] uppercase text-[color:var(--color-neutral-300)]"
          style={{ letterSpacing: "1.8px" }}
        >
          Social Profiles
        </h2>
        <motion.span
          animate={{ rotate: open ? 180 : 0 }}
          transition={houseSpring}
          className="text-[color:var(--color-neutral-500)] text-[12px]"
          aria-hidden
        >
          &#9662;
        </motion.span>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={houseSpring}
            style={{ overflow: "hidden" }}
          >
            <div className="px-5 py-4 space-y-3">
              {FIELDS.map((f) => (
                <div key={f.key} className="flex items-center gap-3">
                  <label
                    className="w-[80px] shrink-0 font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-neutral-500)]"
                    style={{ letterSpacing: "1.2px" }}
                  >
                    {f.label}
                  </label>
                  <div className="flex flex-1 items-center gap-2">
                    <input
                      type="text"
                      value={values[f.key] ?? ""}
                      onChange={(e) =>
                        setValues((prev) => ({
                          ...prev,
                          [f.key]: e.target.value || null,
                        }))
                      }
                      placeholder={f.placeholder}
                      className="flex-1 rounded-lg px-3 py-2 font-[family-name:var(--font-body)] text-[13px] text-[color:var(--color-brand-cream)] placeholder:text-[color:var(--color-neutral-600)] outline-none focus:ring-1 focus:ring-[color:var(--color-brand-pink)]"
                      style={{
                        background: "rgba(15, 15, 14, 0.5)",
                        border: "1px solid rgba(253, 245, 230, 0.06)",
                      }}
                    />
                    {values[f.key] && (
                      <button
                        type="button"
                        onClick={() =>
                          setValues((prev) => ({ ...prev, [f.key]: null }))
                        }
                        className="shrink-0 rounded-full p-1 text-[color:var(--color-neutral-500)] hover:text-[color:var(--color-brand-red)] transition-colors cursor-pointer"
                        title="Clear"
                      >
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                          <path d="M4 4l6 6M10 4l-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              ))}

              <div className="flex items-center gap-3 pt-1">
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving || !dirty}
                  className="rounded-full px-4 py-1.5 font-[family-name:var(--font-label)] text-[10px] uppercase tracking-wider transition-colors disabled:opacity-40 cursor-pointer"
                  style={{
                    letterSpacing: "1.2px",
                    background: dirty
                      ? "rgba(178, 40, 72, 0.15)"
                      : "rgba(244, 160, 176, 0.10)",
                    border: dirty
                      ? "1px solid rgba(178, 40, 72, 0.3)"
                      : "1px solid rgba(244, 160, 176, 0.15)",
                    color: dirty
                      ? "var(--color-brand-red)"
                      : "var(--color-brand-pink)",
                  }}
                >
                  {saving ? "Saving..." : "Save"}
                </button>
                {result && (
                  <span
                    className={`text-[11px] ${
                      result === "Saved."
                        ? "text-[color:var(--color-success)]"
                        : "text-[color:var(--color-brand-red)]"
                    }`}
                  >
                    {result}
                  </span>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
