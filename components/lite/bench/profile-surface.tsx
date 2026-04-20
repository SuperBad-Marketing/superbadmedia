"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  UserIcon,
  DollarSignIcon,
  LinkIcon,
  PencilIcon,
  ClockIcon,
  PlusIcon,
  XIcon,
} from "lucide-react";
import { brand, neutral, semantic, houseSpring } from "@/lib/design-tokens";
import { useSound } from "@/components/lite/sound-provider";
import {
  requestProfileEditAction,
  updatePortfolioUrlsAction,
} from "@/app/bench/(authenticated)/actions";

interface PendingEdit {
  id: string;
  field_name: string;
  new_value: string;
  status: string;
  created_at_ms: number;
}

interface ProfileSurfaceProps {
  name: string;
  email: string | null;
  hourlyRateAud: number | null;
  abn: string | null;
  legalName: string | null;
  portfolioUrls: string[];
  locationCity: string | null;
  pendingEdits: PendingEdit[];
}

const FIELD_LABELS: Record<string, string> = {
  hourly_rate_aud: "Hourly rate",
  abn: "ABN",
  legal_name: "Legal name",
  bank_details: "Bank details",
};

function InfoRow({
  label,
  value,
  fieldName,
  pendingEdits,
  onRequestEdit,
}: {
  label: string;
  value: string;
  fieldName?: string;
  pendingEdits: PendingEdit[];
  onRequestEdit?: (field: string) => void;
}) {
  const hasPending = fieldName
    ? pendingEdits.some((e) => e.field_name === fieldName)
    : false;

  return (
    <div className="flex items-center justify-between py-3 border-b last:border-b-0" style={{ borderColor: neutral[300] }}>
      <div>
        <p className="text-xs" style={{ color: neutral[500] }}>
          {label}
        </p>
        <p className="text-sm font-medium" style={{ color: neutral[900] }}>
          {value}
        </p>
        {hasPending && (
          <span className="mt-0.5 inline-flex items-center gap-1 text-xs" style={{ color: brand.orange }}>
            <ClockIcon size={10} />
            Change pending approval
          </span>
        )}
      </div>
      {fieldName && onRequestEdit && !hasPending && (
        <button
          onClick={() => onRequestEdit(fieldName)}
          className="rounded-lg p-2 transition-colors"
          style={{ color: neutral[500] }}
        >
          <PencilIcon size={14} />
        </button>
      )}
    </div>
  );
}

export function ProfileSurface({
  name,
  email,
  hourlyRateAud,
  abn,
  legalName,
  portfolioUrls,
  locationCity,
  pendingEdits,
}: ProfileSurfaceProps) {
  const router = useRouter();
  const { play } = useSound();
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const [urls, setUrls] = useState(portfolioUrls);
  const [newUrl, setNewUrl] = useState("");
  const [savingUrls, setSavingUrls] = useState(false);
  const [urlsSaved, setUrlsSaved] = useState(false);

  function startEdit(field: string) {
    setEditingField(field);
    setError("");
    if (field === "hourly_rate_aud") {
      setEditValue(String(hourlyRateAud ?? ""));
    } else if (field === "abn") {
      setEditValue(abn ?? "");
    } else if (field === "legal_name") {
      setEditValue(legalName ?? "");
    } else {
      setEditValue("");
    }
  }

  async function handleSubmitEdit() {
    if (!editingField) return;
    setSubmitting(true);
    setError("");

    const result = await requestProfileEditAction(editingField, editValue);
    if (result.ok) {
      play("kanban-drop");
      setEditingField(null);
      setEditValue("");
      router.refresh();
    } else {
      setError(result.error);
    }
    setSubmitting(false);
  }

  function addUrl() {
    const trimmed = newUrl.trim();
    if (!trimmed) return;
    setUrls([...urls, trimmed]);
    setNewUrl("");
  }

  function removeUrl(index: number) {
    setUrls(urls.filter((_, i) => i !== index));
  }

  async function saveUrls() {
    setSavingUrls(true);
    setUrlsSaved(false);
    const result = await updatePortfolioUrlsAction(urls);
    if (result.ok) {
      play("kanban-drop");
      setUrlsSaved(true);
      setTimeout(() => setUrlsSaved(false), 2000);
      router.refresh();
    }
    setSavingUrls(false);
  }

  const urlsChanged =
    JSON.stringify(urls) !== JSON.stringify(portfolioUrls);

  return (
    <div className="space-y-6">
      <motion.h1
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={houseSpring}
        className="text-xl font-semibold tracking-tight"
        style={{ color: neutral[900] }}
      >
        Profile
      </motion.h1>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...houseSpring, delay: 0.05 }}
        className="rounded-xl border p-4"
        style={{ borderColor: neutral[300] }}
      >
        <div className="mb-3 flex items-center gap-3">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-full"
            style={{ backgroundColor: `${brand.orange}20` }}
          >
            <UserIcon size={20} style={{ color: brand.orange }} />
          </div>
          <div>
            <p
              className="text-sm font-semibold"
              style={{ color: neutral[900] }}
            >
              {name}
            </p>
            {email && (
              <p className="text-xs" style={{ color: neutral[500] }}>
                {email}
              </p>
            )}
            {locationCity && (
              <p className="text-xs" style={{ color: neutral[500] }}>
                {locationCity}
              </p>
            )}
          </div>
        </div>

        <InfoRow
          label="Hourly rate"
          value={hourlyRateAud ? `$${hourlyRateAud}/hr` : "Not set"}
          fieldName="hourly_rate_aud"
          pendingEdits={pendingEdits}
          onRequestEdit={startEdit}
        />
        <InfoRow
          label="ABN"
          value={abn ?? "Not set"}
          fieldName="abn"
          pendingEdits={pendingEdits}
          onRequestEdit={startEdit}
        />
        <InfoRow
          label="Legal name"
          value={legalName ?? "Not set"}
          fieldName="legal_name"
          pendingEdits={pendingEdits}
          onRequestEdit={startEdit}
        />
        <InfoRow
          label="Bank details"
          value="••••••"
          fieldName="bank_details"
          pendingEdits={pendingEdits}
          onRequestEdit={startEdit}
        />
      </motion.div>

      <AnimatePresence>
        {editingField && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={houseSpring}
            className="rounded-xl border p-4 space-y-3"
            style={{ borderColor: brand.orange }}
          >
            <p
              className="text-sm font-medium"
              style={{ color: neutral[900] }}
            >
              Request change: {FIELD_LABELS[editingField] ?? editingField}
            </p>
            <p className="text-xs" style={{ color: neutral[500] }}>
              Changes require Andy's approval before they take effect.
            </p>
            <input
              type={editingField === "hourly_rate_aud" ? "number" : "text"}
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              placeholder={`New ${FIELD_LABELS[editingField] ?? editingField}`}
              className="w-full rounded-lg border px-3 py-2 text-sm outline-none"
              style={{
                borderColor: neutral[300],
                color: neutral[900],
                backgroundColor: "var(--color-surface-0)",
              }}
            />
            {error && (
              <p className="text-xs" style={{ color: semantic.error }}>
                {error}
              </p>
            )}
            <div className="flex gap-2">
              <button
                onClick={handleSubmitEdit}
                disabled={submitting}
                className="rounded-lg px-3 py-1.5 text-xs font-medium transition-opacity disabled:opacity-50"
                style={{ backgroundColor: brand.orange, color: "#fff" }}
              >
                {submitting ? "Requesting…" : "Request change"}
              </button>
              <button
                onClick={() => {
                  setEditingField(null);
                  setError("");
                }}
                className="rounded-lg px-3 py-1.5 text-xs font-medium"
                style={{ color: neutral[500] }}
              >
                Cancel
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...houseSpring, delay: 0.1 }}
        className="rounded-xl border p-4 space-y-3"
        style={{ borderColor: neutral[300] }}
      >
        <div className="flex items-center justify-between">
          <div>
            <p
              className="text-sm font-medium"
              style={{ color: neutral[900] }}
            >
              Portfolio
            </p>
            <p className="text-xs" style={{ color: neutral[500] }}>
              URLs are re-ingested when updated.
            </p>
          </div>
          <LinkIcon size={16} style={{ color: neutral[500] }} />
        </div>

        {urls.length === 0 ? (
          <p className="text-xs" style={{ color: neutral[500] }}>
            No portfolio URLs added yet.
          </p>
        ) : (
          <div className="space-y-2">
            {urls.map((url, i) => (
              <div
                key={i}
                className="flex items-center justify-between rounded-lg border px-3 py-2"
                style={{ borderColor: neutral[300] }}
              >
                <span
                  className="truncate text-xs"
                  style={{ color: neutral[900] }}
                >
                  {url}
                </span>
                <button
                  onClick={() => removeUrl(i)}
                  className="ml-2 flex-shrink-0"
                  style={{ color: neutral[500] }}
                >
                  <XIcon size={14} />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-2">
          <input
            type="url"
            value={newUrl}
            onChange={(e) => setNewUrl(e.target.value)}
            placeholder="Add portfolio URL"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addUrl();
              }
            }}
            className="flex-1 rounded-lg border px-3 py-2 text-xs outline-none"
            style={{
              borderColor: neutral[300],
              color: neutral[900],
              backgroundColor: "var(--color-surface-0)",
            }}
          />
          <button
            onClick={addUrl}
            className="rounded-lg p-2"
            style={{ color: brand.orange }}
          >
            <PlusIcon size={16} />
          </button>
        </div>

        {urlsChanged && (
          <button
            onClick={saveUrls}
            disabled={savingUrls}
            className="rounded-lg px-3 py-1.5 text-xs font-medium transition-opacity disabled:opacity-50"
            style={{ backgroundColor: brand.orange, color: "#fff" }}
          >
            {urlsSaved ? "Saved" : savingUrls ? "Saving…" : "Save portfolio"}
          </button>
        )}
      </motion.div>
    </div>
  );
}
