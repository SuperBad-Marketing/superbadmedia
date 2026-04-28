"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  updateCandidateDetailsAction,
  generateCandidateSummaryAction,
  generateDraftEmailAction,
  approveAndSendManualDraftAction,
} from "../../actions";

interface CandidateContactEditProps {
  candidateId: string;
  contactEmail: string | null;
  contactName: string | null;
  contactRole: string | null;
  emailConfidence: string | null;
  notes: string | null;
  aiSummary: string | null;
}

const inputClass =
  "w-full rounded-lg px-3 py-2 font-[family-name:var(--font-body)] text-[13px] text-[color:var(--color-brand-cream)] placeholder:text-[color:var(--color-neutral-600)] outline-none";
const inputStyle: React.CSSProperties = {
  backgroundColor: "rgba(253, 245, 230, 0.04)",
  border: "1px solid rgba(253, 245, 230, 0.08)",
};
const labelClass =
  "font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-neutral-500)]";
const labelStyle: React.CSSProperties = { letterSpacing: "1.2px" };
const btnClass =
  "rounded-lg px-4 py-2 font-[family-name:var(--font-label)] text-[10px] uppercase transition-colors hover:brightness-110";
const btnStyle: React.CSSProperties = { letterSpacing: "1.2px" };

export function CandidateContactEdit({
  candidateId,
  contactEmail,
  contactName,
  contactRole,
  emailConfidence,
  notes: initialNotes,
  aiSummary: initialSummary,
}: CandidateContactEditProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [email, setEmail] = useState(contactEmail ?? "");
  const [name, setName] = useState(contactName ?? "");
  const [role, setRole] = useState(contactRole ?? "");
  const [notes, setNotes] = useState(initialNotes ?? "");

  const [aiSummary, setAiSummary] = useState(initialSummary);
  const [summaryPending, setSummaryPending] = useState(false);

  const [draftEmail, setDraftEmail] = useState<{ subject: string; body: string } | null>(null);
  const [draftPending, setDraftPending] = useState(false);
  const [sendConfirm, setSendConfirm] = useState(false);
  const [sendPending, setSendPending] = useState(false);
  const [sent, setSent] = useState(false);

  function handleSave() {
    startTransition(async () => {
      setError(null);
      const res = await updateCandidateDetailsAction(candidateId, {
        contact_email: email || null,
        contact_name: name || null,
        contact_role: role || null,
        notes: notes || null,
      });
      if (!res.ok) setError(res.error);
      else {
        setEditing(false);
        router.refresh();
      }
    });
  }

  function handleGenerateSummary() {
    setSummaryPending(true);
    setError(null);
    startTransition(async () => {
      const res = await generateCandidateSummaryAction(candidateId);
      setSummaryPending(false);
      if (!res.ok) setError(res.error);
      else setAiSummary(res.summary);
    });
  }

  function handleDraftEmail() {
    setDraftPending(true);
    setError(null);
    setSent(false);
    setSendConfirm(false);
    startTransition(async () => {
      const res = await generateDraftEmailAction(candidateId);
      setDraftPending(false);
      if (!res.ok) setError(res.error);
      else setDraftEmail({ subject: res.subject, body: res.body });
    });
  }

  function handleApproveAndSend() {
    if (!draftEmail) return;
    if (!sendConfirm) {
      setSendConfirm(true);
      return;
    }
    setSendPending(true);
    setError(null);
    startTransition(async () => {
      const res = await approveAndSendManualDraftAction(
        candidateId,
        draftEmail.subject,
        draftEmail.body,
      );
      setSendPending(false);
      setSendConfirm(false);
      if (!res.ok) setError(res.error);
      else {
        setSent(true);
        router.refresh();
      }
    });
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Contact info — view or edit mode */}
      <div
        className="rounded-xl p-4"
        style={{
          backgroundColor: "var(--color-surface-2)",
          boxShadow: "var(--surface-highlight)",
          border: "1px solid rgba(253, 245, 230, 0.03)",
        }}
      >
        <div className="flex items-center justify-between mb-3">
          <div className={labelClass} style={{ ...labelStyle, letterSpacing: "1.5px" }}>
            Contact info
          </div>
          {!editing && (
            <button
              onClick={() => setEditing(true)}
              className={btnClass}
              style={{
                ...btnStyle,
                backgroundColor: "rgba(253, 245, 230, 0.06)",
                color: "var(--color-brand-cream)",
              }}
            >
              Edit
            </button>
          )}
        </div>

        {editing ? (
          <div className="flex flex-col gap-3">
            <div>
              <div className={labelClass} style={{ ...labelStyle, marginBottom: 4 }}>Email</div>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="contact@example.com"
                className={inputClass}
                style={inputStyle}
              />
            </div>
            <div>
              <div className={labelClass} style={{ ...labelStyle, marginBottom: 4 }}>Name</div>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Contact name"
                className={inputClass}
                style={inputStyle}
              />
            </div>
            <div>
              <div className={labelClass} style={{ ...labelStyle, marginBottom: 4 }}>Role</div>
              <input
                type="text"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                placeholder="Owner, Manager, etc."
                className={inputClass}
                style={inputStyle}
              />
            </div>
            <div>
              <div className={labelClass} style={{ ...labelStyle, marginBottom: 4 }}>Notes</div>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Internal notes about this candidate..."
                rows={3}
                className={inputClass}
                style={{ ...inputStyle, resize: "vertical" }}
              />
            </div>
            <div className="flex items-center gap-2 mt-1">
              <button
                disabled={pending}
                onClick={handleSave}
                className={btnClass}
                style={{
                  ...btnStyle,
                  backgroundColor: "rgba(244, 160, 176, 0.15)",
                  color: "var(--color-brand-pink)",
                }}
              >
                {pending ? "Saving..." : "Save"}
              </button>
              <button
                onClick={() => {
                  setEditing(false);
                  setEmail(contactEmail ?? "");
                  setName(contactName ?? "");
                  setRole(contactRole ?? "");
                  setNotes(initialNotes ?? "");
                }}
                className="font-[family-name:var(--font-body)] text-[12px] text-[color:var(--color-neutral-500)] hover:text-[color:var(--color-neutral-300)]"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            <ContactRow label="Email" value={email || null} />
            <ContactRow label="Name" value={name || null} />
            <ContactRow label="Role" value={role || null} />
            <ContactRow label="Confidence" value={emailConfidence} />
            {notes && (
              <div className="mt-2 pt-2" style={{ borderTop: "1px solid rgba(253, 245, 230, 0.04)" }}>
                <div className={labelClass} style={{ ...labelStyle, marginBottom: 4 }}>Notes</div>
                <p className="font-[family-name:var(--font-body)] text-[13px] text-[color:var(--color-neutral-300)] whitespace-pre-wrap">
                  {notes}
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* AI Summary */}
      <div
        className="rounded-xl p-4"
        style={{
          backgroundColor: "var(--color-surface-2)",
          boxShadow: "var(--surface-highlight)",
          border: "1px solid rgba(253, 245, 230, 0.03)",
        }}
      >
        <div className="flex items-center justify-between mb-3">
          <div className={labelClass} style={{ ...labelStyle, letterSpacing: "1.5px" }}>
            AI Summary
          </div>
          <button
            disabled={summaryPending || pending}
            onClick={handleGenerateSummary}
            className={btnClass}
            style={{
              ...btnStyle,
              backgroundColor: "rgba(242, 140, 82, 0.12)",
              color: "#F28C52",
            }}
          >
            {summaryPending ? "Generating..." : aiSummary ? "Regenerate" : "Generate"}
          </button>
        </div>
        {aiSummary ? (
          <p className="font-[family-name:var(--font-body)] text-[14px] leading-relaxed text-[color:var(--color-brand-cream)]" style={{ opacity: 0.9 }}>
            {aiSummary}
          </p>
        ) : (
          <p className="font-[family-name:var(--font-body)] text-[13px] text-[color:var(--color-neutral-500)]">
            No summary yet. Hit Generate to create one from enrichment data.
          </p>
        )}
      </div>

      {/* Draft Email */}
      <div
        className="rounded-xl p-4"
        style={{
          backgroundColor: "var(--color-surface-2)",
          boxShadow: "var(--surface-highlight)",
          border: "1px solid rgba(253, 245, 230, 0.03)",
        }}
      >
        <div className="flex items-center justify-between mb-3">
          <div className={labelClass} style={{ ...labelStyle, letterSpacing: "1.5px" }}>
            Outreach Draft
          </div>
          <button
            disabled={draftPending || pending}
            onClick={handleDraftEmail}
            className={btnClass}
            style={{
              ...btnStyle,
              backgroundColor: "rgba(244, 160, 176, 0.12)",
              color: "var(--color-brand-pink)",
            }}
          >
            {draftPending ? "Drafting..." : draftEmail ? "Redraft" : "Draft Email"}
          </button>
        </div>
        {draftEmail ? (
          <div className="flex flex-col gap-3">
            <div>
              <div className={labelClass} style={{ ...labelStyle, marginBottom: 4 }}>Subject</div>
              <p className="font-[family-name:var(--font-body)] text-[14px] text-[color:var(--color-brand-cream)] font-medium">
                {draftEmail.subject}
              </p>
            </div>
            <div>
              <div className={labelClass} style={{ ...labelStyle, marginBottom: 4 }}>Body</div>
              <div
                className="rounded-lg p-3 font-[family-name:var(--font-body)] text-[13px] leading-relaxed text-[color:var(--color-brand-cream)] whitespace-pre-wrap"
                style={{
                  backgroundColor: "rgba(253, 245, 230, 0.03)",
                  border: "1px solid rgba(253, 245, 230, 0.06)",
                  opacity: 0.9,
                }}
              >
                {draftEmail.body}
              </div>
            </div>
            {sent ? (
              <div
                className="flex items-center gap-2 rounded-lg px-4 py-2.5 font-[family-name:var(--font-label)] text-[11px] uppercase"
                style={{
                  letterSpacing: "1.2px",
                  backgroundColor: "rgba(74, 222, 128, 0.1)",
                  color: "#4ade80",
                  border: "1px solid rgba(74, 222, 128, 0.15)",
                }}
              >
                Sent
              </div>
            ) : (
              <button
                disabled={sendPending || pending}
                onClick={handleApproveAndSend}
                className={`${btnClass} w-full py-2.5 transition-all`}
                style={{
                  ...btnStyle,
                  fontSize: "11px",
                  backgroundColor: sendConfirm
                    ? "rgba(239, 68, 68, 0.2)"
                    : "rgba(74, 222, 128, 0.12)",
                  color: sendConfirm ? "#fca5a5" : "#4ade80",
                  border: sendConfirm
                    ? "1px solid rgba(239, 68, 68, 0.25)"
                    : "1px solid rgba(74, 222, 128, 0.15)",
                }}
                onBlur={() => setSendConfirm(false)}
              >
                {sendPending
                  ? "Sending..."
                  : sendConfirm
                    ? "Confirm — this will send the email"
                    : "Approve & Send"}
              </button>
            )}
          </div>
        ) : (
          <p className="font-[family-name:var(--font-body)] text-[13px] text-[color:var(--color-neutral-500)]">
            Generate a personalised outreach email for this candidate.
          </p>
        )}
      </div>

      {error && (
        <div className="font-[family-name:var(--font-body)] text-[13px] text-[color:var(--color-brand-red)]">
          {error}
        </div>
      )}
    </div>
  );
}

function ContactRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="font-[family-name:var(--font-body)] text-[13px] text-[color:var(--color-neutral-400)]">
        {label}
      </span>
      <span className="font-[family-name:var(--font-body)] text-[13px] text-[color:var(--color-brand-cream)] text-right">
        {value ?? <span className="text-[color:var(--color-neutral-600)]">&mdash;</span>}
      </span>
    </div>
  );
}
