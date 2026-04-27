"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import type { SearchVerticalRow } from "@/lib/db/schema/search-verticals";
import {
  listVerticalsAction,
  createVerticalAction,
  updateVerticalAction,
  toggleVerticalAction,
  deleteVerticalAction,
} from "./actions";

const COUNTRIES = [
  { code: "AU", name: "Australia" },
  { code: "US", name: "United States" },
  { code: "GB", name: "United Kingdom" },
  { code: "CA", name: "Canada" },
  { code: "NZ", name: "New Zealand" },
  { code: "IE", name: "Ireland" },
  { code: "SG", name: "Singapore" },
  { code: "AE", name: "United Arab Emirates" },
  { code: "DE", name: "Germany" },
  { code: "FR", name: "France" },
  { code: "NL", name: "Netherlands" },
  { code: "JP", name: "Japan" },
  { code: "KR", name: "South Korea" },
  { code: "IN", name: "India" },
  { code: "ZA", name: "South Africa" },
];

const inputClass =
  "w-full rounded-md border px-3 py-2 text-[14px] font-[family-name:var(--font-body)] bg-[color:var(--color-neutral-800)] text-[color:var(--color-brand-cream)] border-[color:var(--color-neutral-600)] placeholder:text-[color:var(--color-neutral-500)] focus:outline-none focus:border-[color:var(--color-brand-pink)]";

const textareaClass =
  "w-full rounded-md border px-3 py-2 text-[14px] font-[family-name:var(--font-body)] bg-[color:var(--color-neutral-800)] text-[color:var(--color-brand-cream)] border-[color:var(--color-neutral-600)] placeholder:text-[color:var(--color-neutral-500)] focus:outline-none focus:border-[color:var(--color-brand-pink)] resize-y min-h-[60px]";

const numberClass =
  "w-full rounded-md border px-3 py-2 text-[14px] font-[family-name:var(--font-body)] font-mono bg-[color:var(--color-neutral-800)] text-[color:var(--color-brand-cream)] border-[color:var(--color-neutral-600)] focus:outline-none focus:border-[color:var(--color-brand-pink)]";

const selectClass =
  "w-full rounded-md border px-3 py-2 text-[14px] font-[family-name:var(--font-body)] bg-[color:var(--color-neutral-800)] text-[color:var(--color-brand-cream)] border-[color:var(--color-neutral-600)] focus:outline-none focus:border-[color:var(--color-brand-pink)]";

const btnPrimary =
  "rounded-lg px-4 py-2 font-[family-name:var(--font-label)] text-[10px] uppercase tracking-[1.5px] border border-[color:var(--color-brand-pink)] bg-[color:var(--color-brand-pink)]/10 text-[color:var(--color-brand-pink)] hover:bg-[color:var(--color-brand-pink)]/20 transition-all disabled:opacity-50";

const btnSecondary =
  "rounded-lg px-4 py-2 font-[family-name:var(--font-label)] text-[10px] uppercase tracking-[1.5px] border border-[color:var(--color-neutral-600)] bg-transparent text-[color:var(--color-neutral-400)] hover:border-[color:var(--color-neutral-500)] hover:text-[color:var(--color-neutral-300)] transition-all disabled:opacity-50";

interface VerticalFormState {
  name: string;
  category: string;
  location: string;
  location_lat: number;
  location_lng: number;
  radius_km: number;
  country_code: string;
  standing_brief: string;
  weight: number;
}

const EMPTY_FORM: VerticalFormState = {
  name: "",
  category: "",
  location: "Melbourne, Australia",
  location_lat: -37.8136,
  location_lng: 144.9631,
  radius_km: 25,
  country_code: "AU",
  standing_brief: "",
  weight: 5,
};

export function VerticalsManager({
  initial,
}: {
  initial: SearchVerticalRow[];
}) {
  const [verticals, setVerticals] = useState(initial);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<VerticalFormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  function openCreate() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  }

  function openEdit(v: SearchVerticalRow) {
    setEditingId(v.id);
    setForm({
      name: v.name,
      category: v.category,
      location: v.location,
      location_lat: v.location_lat,
      location_lng: v.location_lng,
      radius_km: v.radius_km,
      country_code: v.country_code,
      standing_brief: v.standing_brief ?? "",
      weight: v.weight,
    });
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
  }

  async function handleSave() {
    setSaving(true);
    if (editingId) {
      const res = await updateVerticalAction(editingId, {
        ...form,
        standing_brief: form.standing_brief || null,
      });
      if (!res.ok) {
        toast.error(res.error);
        setSaving(false);
        return;
      }
      toast.success("Vertical updated.");
    } else {
      const res = await createVerticalAction({
        ...form,
        standing_brief: form.standing_brief || null,
      });
      if (!res.ok) {
        toast.error(res.error);
        setSaving(false);
        return;
      }
      toast.success("Vertical created.");
    }
    const refreshed = await listVerticalsAction();
    setVerticals(refreshed);
    setSaving(false);
    closeForm();
  }

  async function handleToggle(id: string, active: boolean) {
    const res = await toggleVerticalAction(id, active);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    const refreshed = await listVerticalsAction();
    setVerticals(refreshed);
    toast.success(active ? "Vertical activated." : "Vertical paused.");
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    const res = await deleteVerticalAction(id);
    if (!res.ok) {
      toast.error(res.error);
      setDeletingId(null);
      return;
    }
    const refreshed = await listVerticalsAction();
    setVerticals(refreshed);
    setDeletingId(null);
    toast.success("Vertical deleted.");
  }

  function formatLastSearched(v: SearchVerticalRow): string {
    if (!v.last_searched_at) return "Never";
    const d = new Date(v.last_searched_at);
    const now = Date.now();
    const hoursAgo = Math.floor((now - d.getTime()) / (1000 * 60 * 60));
    if (hoursAgo < 1) return "< 1 hour ago";
    if (hoursAgo < 24) return `${hoursAgo}h ago`;
    const daysAgo = Math.floor(hoursAgo / 24);
    return `${daysAgo}d ago`;
  }

  const activeCount = verticals.filter((v) => v.is_active).length;

  return (
    <div>
      {/* Summary + add button */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <span className="font-[family-name:var(--font-label)] text-[10px] uppercase tracking-[1.5px] text-[color:var(--color-neutral-500)]">
            {verticals.length} vertical{verticals.length === 1 ? "" : "s"}
          </span>
          <span className="font-[family-name:var(--font-label)] text-[10px] uppercase tracking-[1.5px] text-[color:var(--color-neutral-500)]">
            {activeCount} active
          </span>
        </div>
        <button onClick={openCreate} className={btnPrimary}>
          Add vertical
        </button>
      </div>

      {/* Vertical form (create / edit) */}
      {showForm && (
        <div
          className="mb-6 rounded-xl border p-5"
          style={{
            borderColor: "var(--color-neutral-700)",
            backgroundColor: "var(--color-neutral-900)",
          }}
        >
          <div className="mb-4 flex items-center justify-between">
            <span
              className="font-[family-name:var(--font-label)] text-[11px] uppercase tracking-[1.5px] text-[color:var(--color-brand-cream)]"
            >
              {editingId ? "Edit vertical" : "New vertical"}
            </span>
            <button
              onClick={closeForm}
              className="font-[family-name:var(--font-label)] text-[10px] uppercase tracking-[1.5px] text-[color:var(--color-neutral-500)] hover:text-[color:var(--color-neutral-300)]"
            >
              Cancel
            </button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block font-[family-name:var(--font-body)] text-[13px] text-[color:var(--color-neutral-400)]">
                Name
              </label>
              <input
                className={inputClass}
                placeholder="e.g. Melbourne Cafes"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>

            <div>
              <label className="mb-1 block font-[family-name:var(--font-body)] text-[13px] text-[color:var(--color-neutral-400)]">
                Category
              </label>
              <input
                className={inputClass}
                placeholder="e.g. cafes, dental clinics, gyms"
                value={form.category}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
              />
            </div>

            <div>
              <label className="mb-1 block font-[family-name:var(--font-body)] text-[13px] text-[color:var(--color-neutral-400)]">
                Location
              </label>
              <input
                className={inputClass}
                placeholder="e.g. Melbourne, Australia"
                value={form.location}
                onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
              />
            </div>

            <div>
              <label className="mb-1 block font-[family-name:var(--font-body)] text-[13px] text-[color:var(--color-neutral-400)]">
                Country
              </label>
              <select
                className={selectClass}
                value={form.country_code}
                onChange={(e) => setForm((f) => ({ ...f, country_code: e.target.value }))}
              >
                {COUNTRIES.map((c) => (
                  <option key={c.code} value={c.code}>{c.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block font-[family-name:var(--font-body)] text-[13px] text-[color:var(--color-neutral-400)]">
                Latitude
              </label>
              <input
                className={numberClass}
                type="number"
                step="0.0001"
                value={form.location_lat}
                onChange={(e) => setForm((f) => ({ ...f, location_lat: parseFloat(e.target.value) || 0 }))}
              />
            </div>

            <div>
              <label className="mb-1 block font-[family-name:var(--font-body)] text-[13px] text-[color:var(--color-neutral-400)]">
                Longitude
              </label>
              <input
                className={numberClass}
                type="number"
                step="0.0001"
                value={form.location_lng}
                onChange={(e) => setForm((f) => ({ ...f, location_lng: parseFloat(e.target.value) || 0 }))}
              />
            </div>

            <div>
              <label className="mb-1 block font-[family-name:var(--font-body)] text-[13px] text-[color:var(--color-neutral-400)]">
                Radius (km)
              </label>
              <input
                className={numberClass}
                type="number"
                min={1}
                max={500}
                value={form.radius_km}
                onChange={(e) => setForm((f) => ({ ...f, radius_km: parseInt(e.target.value) || 25 }))}
              />
            </div>

            <div>
              <label className="mb-1 block font-[family-name:var(--font-body)] text-[13px] text-[color:var(--color-neutral-400)]">
                Weight (1–10)
              </label>
              <input
                className={numberClass}
                type="number"
                min={1}
                max={10}
                value={form.weight}
                onChange={(e) => setForm((f) => ({ ...f, weight: parseInt(e.target.value) || 5 }))}
              />
              <span className="mt-1 block font-[family-name:var(--font-body)] text-[11px] text-[color:var(--color-neutral-600)]">
                Higher weight = searched more often
              </span>
            </div>
          </div>

          <div className="mt-4">
            <label className="mb-1 block font-[family-name:var(--font-body)] text-[13px] text-[color:var(--color-neutral-400)]">
              Standing brief (optional — overrides global brief for this vertical)
            </label>
            <textarea
              className={textareaClass}
              placeholder="e.g. Looking for established cafes with 20+ Google reviews that don't currently run ads..."
              value={form.standing_brief}
              onChange={(e) => setForm((f) => ({ ...f, standing_brief: e.target.value }))}
              rows={3}
            />
          </div>

          <div className="mt-5 flex justify-end gap-2">
            <button onClick={closeForm} className={btnSecondary}>
              Cancel
            </button>
            <button onClick={handleSave} disabled={saving} className={btnPrimary}>
              {saving ? "Saving…" : editingId ? "Update" : "Create"}
            </button>
          </div>
        </div>
      )}

      {/* Verticals list */}
      {verticals.length === 0 ? (
        <div className="py-16 text-center">
          <p className="font-[family-name:var(--font-body)] text-[16px] text-[color:var(--color-neutral-400)]">
            No verticals yet.
          </p>
          <p className="mt-2 font-[family-name:var(--font-narrative)] text-[14px] text-[color:var(--color-neutral-600)]">
            Without verticals, daily search uses the global settings category.
            Add a few to rotate automatically.
          </p>
        </div>
      ) : (
        <div className="grid gap-2">
          {verticals.map((v) => (
            <div
              key={v.id}
              className="flex items-center justify-between gap-4 rounded-xl border px-4 py-3"
              style={{
                borderColor: v.is_active
                  ? "var(--color-neutral-700)"
                  : "var(--color-neutral-800)",
                backgroundColor: v.is_active
                  ? "var(--color-neutral-900)"
                  : "rgba(0, 0, 0, 0.3)",
                opacity: v.is_active ? 1 : 0.6,
              }}
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-[family-name:var(--font-label)] text-[12px] uppercase tracking-[1.5px] text-[color:var(--color-brand-cream)]">
                    {v.name}
                  </span>
                  <span
                    className="inline-block size-1.5 rounded-full"
                    style={{
                      backgroundColor: v.is_active
                        ? "var(--color-brand-pink)"
                        : "var(--color-neutral-600)",
                    }}
                  />
                  {!v.is_active && (
                    <span className="font-[family-name:var(--font-label)] text-[9px] uppercase tracking-[1.5px] text-[color:var(--color-neutral-600)]">
                      Paused
                    </span>
                  )}
                </div>
                <p className="mt-0.5 font-[family-name:var(--font-body)] text-[13px] text-[color:var(--color-neutral-400)]">
                  {v.category} · {v.location} · {v.radius_km}km
                </p>
                <div className="mt-1 flex items-center gap-3">
                  <span className="font-[family-name:var(--font-body)] text-[11px] text-[color:var(--color-neutral-600)]">
                    Weight {v.weight}
                  </span>
                  <span className="font-[family-name:var(--font-body)] text-[11px] text-[color:var(--color-neutral-600)]">
                    Searched {v.search_count}×
                  </span>
                  <span className="font-[family-name:var(--font-body)] text-[11px] text-[color:var(--color-neutral-600)]">
                    Last: {formatLastSearched(v)}
                  </span>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  onClick={() => handleToggle(v.id, !v.is_active)}
                  className={btnSecondary}
                >
                  {v.is_active ? "Pause" : "Activate"}
                </button>
                <button onClick={() => openEdit(v)} className={btnSecondary}>
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(v.id)}
                  disabled={deletingId === v.id}
                  className="rounded-lg px-4 py-2 font-[family-name:var(--font-label)] text-[10px] uppercase tracking-[1.5px] border border-red-900/40 text-red-400/70 hover:border-red-800/60 hover:text-red-400 transition-all disabled:opacity-50"
                >
                  {deletingId === v.id ? "…" : "Delete"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
