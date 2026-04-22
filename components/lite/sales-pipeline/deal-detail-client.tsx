"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import type { DealStage } from "@/lib/db/schema/deals";
import {
  updateDealAction,
  updateContactAction,
  updateCompanyAction,
  deleteDealAction,
  resendPortalLinkAction,
} from "@/app/lite/admin/pipeline/[id]/actions";

const STAGE_LABELS: Record<string, string> = {
  lead: "Lead",
  contacted: "Contacted",
  conversation: "Conversation",
  trial_shoot: "Trial Shoot",
  quoted: "Quoted",
  negotiating: "Negotiating",
  won: "Won",
  lost: "Lost",
};

export interface DealDetailData {
  id: string;
  title: string;
  stage: DealStage;
  value_cents: number | null;
  value_estimated: boolean;
  next_action_text: string | null;
  won_outcome: string | null;
  loss_reason: string | null;
  loss_notes: string | null;
  source: string | null;
  created_at_ms: number;
  company_id: string;
  company_name: string;
  contact_id: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  contact_role: string | null;
}

function formatCents(cents: number | null): string {
  if (cents == null) return "";
  return (cents / 100).toFixed(0);
}

function parseDollars(s: string): number | null {
  const n = parseFloat(s.replace(/[^0-9.-]/g, ""));
  if (isNaN(n)) return null;
  return Math.round(n * 100);
}

function EditableField({
  label,
  value,
  onSave,
  type = "text",
}: {
  label: string;
  value: string;
  onSave: (v: string) => Promise<void>;
  type?: "text" | "textarea";
}) {
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(value);
  const [saving, setSaving] = React.useState(false);

  const save = async () => {
    if (draft === value) {
      setEditing(false);
      return;
    }
    setSaving(true);
    await onSave(draft);
    setSaving(false);
    setEditing(false);
  };

  if (!editing) {
    return (
      <div className="group">
        <div
          className="font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-neutral-500)] mb-1"
          style={{ letterSpacing: "1.5px" }}
        >
          {label}
        </div>
        <button
          type="button"
          onClick={() => {
            setDraft(value);
            setEditing(true);
          }}
          className="w-full text-left rounded-lg px-3 py-2 text-[14px] text-[color:var(--color-neutral-200)] transition-colors hover:bg-[color:var(--color-surface-3)] cursor-pointer"
        >
          {value || <span className="italic text-[color:var(--color-neutral-600)]">Not set</span>}
        </button>
      </div>
    );
  }

  return (
    <div>
      <div
        className="font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-neutral-500)] mb-1"
        style={{ letterSpacing: "1.5px" }}
      >
        {label}
      </div>
      {type === "textarea" ? (
        <textarea
          autoFocus
          className="w-full rounded-lg px-3 py-2 text-[14px] bg-[color:var(--color-surface-3)] text-[color:var(--color-neutral-100)] border border-[color:var(--color-neutral-700)] focus:border-[color:var(--color-brand-pink)] focus:outline-none resize-none"
          rows={3}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") setEditing(false);
          }}
        />
      ) : (
        <input
          autoFocus
          type="text"
          className="w-full rounded-lg px-3 py-2 text-[14px] bg-[color:var(--color-surface-3)] text-[color:var(--color-neutral-100)] border border-[color:var(--color-neutral-700)] focus:border-[color:var(--color-brand-pink)] focus:outline-none"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") save();
            if (e.key === "Escape") setEditing(false);
          }}
        />
      )}
      <div className="mt-2 flex gap-2">
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="rounded-md px-3 py-1.5 text-[12px] font-medium bg-[color:var(--color-brand-pink)] text-white hover:opacity-90 disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save"}
        </button>
        <button
          type="button"
          onClick={() => setEditing(false)}
          className="rounded-md px-3 py-1.5 text-[12px] text-[color:var(--color-neutral-400)] hover:text-[color:var(--color-neutral-200)]"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

export function DealDetailClient({ deal }: { deal: DealDetailData }) {
  const router = useRouter();
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  const [stage, setStage] = React.useState(deal.stage);
  const [sendingLink, setSendingLink] = React.useState(false);
  const [linkStatus, setLinkStatus] = React.useState<string | null>(null);

  const handleDelete = async () => {
    setDeleting(true);
    const result = await deleteDealAction(deal.id);
    if (result.ok) {
      router.push("/lite/admin/pipeline");
    } else {
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Deal section */}
      <section
        className="rounded-[12px] p-6"
        style={{
          background: "var(--color-surface-2)",
          boxShadow: "var(--surface-highlight), 0 2px 8px rgba(0,0,0,0.2)",
          border: "1px solid rgba(253,245,230,0.06)",
        }}
      >
        <div
          className="font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-brand-orange)] mb-5"
          style={{ letterSpacing: "2.5px" }}
        >
          Deal
        </div>
        <div className="space-y-4">
          <EditableField
            label="Title"
            value={deal.title}
            onSave={async (v) => {
              await updateDealAction(deal.id, { title: v });
            }}
          />

          <div>
            <div
              className="font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-neutral-500)] mb-1"
              style={{ letterSpacing: "1.5px" }}
            >
              Stage
            </div>
            <select
              value={stage}
              onChange={async (e) => {
                const newStage = e.target.value as DealStage;
                setStage(newStage);
                await updateDealAction(deal.id, { stage: newStage });
              }}
              className="rounded-lg px-3 py-2 text-[14px] bg-[color:var(--color-surface-3)] text-[color:var(--color-neutral-100)] border border-[color:var(--color-neutral-700)] focus:border-[color:var(--color-brand-pink)] focus:outline-none cursor-pointer"
            >
              {Object.entries(STAGE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <EditableField
            label="Value ($)"
            value={formatCents(deal.value_cents)}
            onSave={async (v) => {
              const cents = parseDollars(v);
              await updateDealAction(deal.id, { value_cents: cents });
            }}
          />

          <EditableField
            label="Next action"
            value={deal.next_action_text ?? ""}
            onSave={async (v) => {
              await updateDealAction(deal.id, { next_action_text: v || null });
            }}
            type="textarea"
          />

          {deal.won_outcome && (
            <div>
              <div
                className="font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-neutral-500)] mb-1"
                style={{ letterSpacing: "1.5px" }}
              >
                Won outcome
              </div>
              <div className="px-3 py-2 text-[14px] text-[color:var(--color-neutral-200)] capitalize">
                {deal.won_outcome}
              </div>
            </div>
          )}

          {deal.loss_reason && (
            <div>
              <div
                className="font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-neutral-500)] mb-1"
                style={{ letterSpacing: "1.5px" }}
              >
                Loss reason
              </div>
              <div className="px-3 py-2 text-[14px] text-[color:var(--color-neutral-200)]">
                {deal.loss_reason.replace(/_/g, " ")}
                {deal.loss_notes && (
                  <span className="block mt-1 text-[13px] text-[color:var(--color-neutral-400)]">
                    {deal.loss_notes}
                  </span>
                )}
              </div>
            </div>
          )}

          {deal.source && (
            <div>
              <div
                className="font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-neutral-500)] mb-1"
                style={{ letterSpacing: "1.5px" }}
              >
                Source
              </div>
              <div className="px-3 py-2 text-[14px] text-[color:var(--color-neutral-400)]">
                {deal.source.replace(/_/g, " ")}
              </div>
            </div>
          )}

          <div>
            <div
              className="font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-neutral-500)] mb-1"
              style={{ letterSpacing: "1.5px" }}
            >
              Created
            </div>
            <div className="px-3 py-2 text-[14px] text-[color:var(--color-neutral-400)]">
              {new Date(deal.created_at_ms).toLocaleDateString("en-AU", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            </div>
          </div>
        </div>
      </section>

      {/* Company section */}
      <section
        className="rounded-[12px] p-6"
        style={{
          background: "var(--color-surface-2)",
          boxShadow: "var(--surface-highlight), 0 2px 8px rgba(0,0,0,0.2)",
          border: "1px solid rgba(253,245,230,0.06)",
        }}
      >
        <div
          className="font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-brand-orange)] mb-5"
          style={{ letterSpacing: "2.5px" }}
        >
          Company
        </div>
        <EditableField
          label="Name"
          value={deal.company_name}
          onSave={async (v) => {
            await updateCompanyAction(deal.company_id, { name: v });
          }}
        />
      </section>

      {/* Contact section */}
      {deal.contact_id && (
        <section
          className="rounded-[12px] p-6"
          style={{
            background: "var(--color-surface-2)",
            boxShadow: "var(--surface-highlight), 0 2px 8px rgba(0,0,0,0.2)",
            border: "1px solid rgba(253,245,230,0.06)",
          }}
        >
          <div
            className="font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-brand-orange)] mb-5"
            style={{ letterSpacing: "2.5px" }}
          >
            Contact
          </div>
          <div className="space-y-4">
            <EditableField
              label="Name"
              value={deal.contact_name ?? ""}
              onSave={async (v) => {
                await updateContactAction(deal.contact_id!, { name: v });
              }}
            />
            <EditableField
              label="Email"
              value={deal.contact_email ?? ""}
              onSave={async (v) => {
                await updateContactAction(deal.contact_id!, { email: v || null });
              }}
            />
            <EditableField
              label="Phone"
              value={deal.contact_phone ?? ""}
              onSave={async (v) => {
                await updateContactAction(deal.contact_id!, { phone: v || null });
              }}
            />
            <EditableField
              label="Role"
              value={deal.contact_role ?? ""}
              onSave={async (v) => {
                await updateContactAction(deal.contact_id!, { role: v || null });
              }}
            />

            {deal.contact_email && (
              <div className="pt-2">
                <button
                  type="button"
                  disabled={sendingLink}
                  onClick={async () => {
                    setSendingLink(true);
                    setLinkStatus(null);
                    const result = await resendPortalLinkAction(deal.contact_id!, deal.company_id);
                    setSendingLink(false);
                    setLinkStatus(result.ok ? "Sent!" : ("error" in result ? result.error : "Failed."));
                  }}
                  className="rounded-md px-4 py-2 text-[13px] font-medium text-[color:var(--color-brand-cream)] border border-[color:var(--color-neutral-600)] hover:border-[color:var(--color-neutral-400)] transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {sendingLink ? "Sending..." : "Send portal link"}
                </button>
                {linkStatus && (
                  <p className={`mt-2 text-[12px] ${linkStatus === "Sent!" ? "text-[color:var(--color-success)]" : "text-[color:var(--color-brand-red)]"}`}>
                    {linkStatus}
                  </p>
                )}
              </div>
            )}
          </div>
        </section>
      )}

      {/* Delete zone */}
      <section
        className="rounded-[12px] p-6"
        style={{
          background: "rgba(200,49,43,0.06)",
          border: "1px solid rgba(200,49,43,0.15)",
        }}
      >
        <div
          className="font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-brand-red)] mb-3"
          style={{ letterSpacing: "2.5px" }}
        >
          Danger zone
        </div>
        {!confirmDelete ? (
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            className="rounded-md px-4 py-2 text-[13px] font-medium text-[color:var(--color-brand-red)] border border-[color:rgba(200,49,43,0.3)] hover:bg-[color:rgba(200,49,43,0.1)] transition-colors cursor-pointer"
          >
            Delete this deal
          </button>
        ) : (
          <div className="flex items-center gap-3">
            <span className="text-[13px] text-[color:var(--color-neutral-300)]">
              This can&apos;t be undone.
            </span>
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className="rounded-md px-4 py-2 text-[13px] font-medium bg-[color:var(--color-brand-red)] text-white hover:opacity-90 disabled:opacity-50 cursor-pointer"
            >
              {deleting ? "Deleting..." : "Yes, delete"}
            </button>
            <button
              type="button"
              onClick={() => setConfirmDelete(false)}
              className="rounded-md px-4 py-2 text-[13px] text-[color:var(--color-neutral-400)] hover:text-[color:var(--color-neutral-200)] cursor-pointer"
            >
              Cancel
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
