"use client";

import * as React from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Star } from "lucide-react";

import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogHeader,
} from "@/components/ui/dialog";

import type { ContactRow } from "@/lib/db/schema/contacts";

import {
  createContactAction,
  updateContactAction,
  deleteContactAction,
  setPrimaryContactAction,
  type ContactInput,
} from "@/app/lite/admin/companies/[id]/actions";

const HOUSE_SPRING = {
  type: "spring" as const,
  mass: 1,
  stiffness: 220,
  damping: 25,
};

type ContactDraft = {
  id: string | null;
  name: string;
  role: string;
  email: string;
  phone: string;
};

const BLANK: ContactDraft = { id: null, name: "", role: "", email: "", phone: "" };

function relativeLabel(tsMs: number, nowMs: number): string {
  const diff = Math.max(0, nowMs - tsMs);
  const dayMs = 24 * 60 * 60 * 1000;
  if (diff < dayMs) return "today";
  const days = Math.floor(diff / dayMs);
  if (days < 30) return `${days} day${days === 1 ? "" : "s"} ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} mo ago`;
  const years = Math.floor(days / 365);
  return `${years} yr${years === 1 ? "" : "s"} ago`;
}

const TD_BASE: React.CSSProperties = {
  padding: "14px 20px",
  borderBottom: "1px solid rgba(253, 245, 230, 0.03)",
};

export function LinkedContactsPanel({
  companyId,
  initialContacts,
  nowMs,
}: {
  companyId: string;
  initialContacts: ContactRow[];
  nowMs: number;
}) {
  const [contacts, setContacts] = React.useState(initialContacts);
  const [draft, setDraft] = React.useState<ContactDraft | null>(null);
  const [isPending, startTransition] = React.useTransition();
  const reduced = useReducedMotion();
  const transition = reduced ? { duration: 0.02 } : HOUSE_SPRING;

  React.useEffect(() => setContacts(initialContacts), [initialContacts]);

  function openNew() {
    setDraft({ ...BLANK });
  }

  function openEdit(c: ContactRow) {
    setDraft({
      id: c.id,
      name: c.name,
      role: c.role ?? "",
      email: c.email ?? "",
      phone: c.phone ?? "",
    });
  }

  function closeDraft() {
    setDraft(null);
  }

  function onSave() {
    if (!draft) return;
    const input: ContactInput = {
      name: draft.name,
      role: draft.role || null,
      email: draft.email || null,
      phone: draft.phone || null,
    };
    startTransition(async () => {
      const res = draft.id
        ? await updateContactAction(companyId, draft.id, input)
        : await createContactAction(companyId, input);
      if (res.ok) {
        toast.success(draft.id ? "Contact updated." : "Contact added.");
        closeDraft();
      } else {
        toast.error(res.error);
      }
    });
  }

  function onDelete(c: ContactRow) {
    if (!confirm(`Delete ${c.name}?`)) return;
    startTransition(async () => {
      const res = await deleteContactAction(companyId, c.id);
      if (res.ok) toast.success("Contact deleted.");
      else toast.error(res.error);
    });
  }

  function onSetPrimary(c: ContactRow) {
    startTransition(async () => {
      const res = await setPrimaryContactAction(companyId, c.id);
      if (res.ok) toast.success(`${c.name} set as primary.`);
      else toast.error(res.error);
    });
  }

  return (
    <>
      <section
        aria-label="Contacts"
        className="overflow-hidden rounded-[12px]"
        style={{
          background: "var(--color-surface-2)",
          boxShadow: "var(--surface-highlight)",
        }}
      >
        <div
          className="flex items-center justify-between px-5 py-3"
          style={{ borderBottom: "1px solid rgba(253, 245, 230, 0.05)" }}
        >
          <div className="flex items-baseline gap-3">
            <h2
              className="font-[family-name:var(--font-label)] text-[11px] uppercase text-[color:var(--color-neutral-300)]"
              style={{ letterSpacing: "1.8px" }}
            >
              Contacts
            </h2>
            <span
              className="font-[family-name:var(--font-label)] text-[11px] tabular-nums text-[color:var(--color-neutral-500)]"
              style={{ letterSpacing: "1.5px" }}
            >
              {contacts.length}
            </span>
          </div>
          <button
            onClick={openNew}
            className="flex cursor-pointer items-center gap-1.5 rounded-[6px] border border-[color:rgba(253,245,230,0.08)] bg-transparent px-3 py-1.5 font-[family-name:var(--font-label)] text-[9px] uppercase text-[color:var(--color-neutral-400)] transition-all duration-[200ms] ease-[cubic-bezier(0.16,1,0.3,1)] hover:border-[color:var(--color-brand-pink)] hover:text-[color:var(--color-brand-pink)]"
            style={{ letterSpacing: "1.5px" }}
          >
            <Plus className="size-3" strokeWidth={1.5} />
            Add
          </button>
        </div>

        <div>
          {contacts.length === 0 ? (
            <div className="px-8 py-10 text-center">
              <p
                className="font-[family-name:var(--font-display)] leading-none text-[color:var(--color-brand-cream)]"
                style={{ fontSize: "24px", letterSpacing: "-0.2px" }}
              >
                No contacts yet.
              </p>
              <p className="mt-2 font-[family-name:var(--font-narrative)] text-[13px] italic text-[color:var(--color-brand-pink)]">
                orgs are made of people.
              </p>
            </div>
          ) : (
            <table className="w-full text-left">
              <thead>
                <tr>
                  {["Name", "Role", "Email", "Phone", "Last touch", ""].map(
                    (label) => (
                      <th
                        key={label || "__actions"}
                        className="font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-neutral-500)]"
                        style={{
                          letterSpacing: "2px",
                          padding: "12px 20px",
                          borderBottom: "1px solid rgba(253, 245, 230, 0.05)",
                          textAlign: "left",
                        }}
                      >
                        {label}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                <AnimatePresence mode="popLayout">
                  {contacts.map((c) => (
                    <motion.tr
                      key={c.id}
                      layout
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      transition={transition}
                    >
                      <td
                        style={{ ...TD_BASE, color: "var(--color-brand-cream)" }}
                        className="font-[family-name:var(--font-body)] text-[13px] font-medium"
                      >
                        <span className="inline-flex items-center gap-2">
                          {c.name}
                          {c.is_primary ? <PrimaryPill /> : null}
                        </span>
                      </td>
                      <td
                        style={{ ...TD_BASE, color: "var(--color-neutral-300)" }}
                        className="text-[12px]"
                      >
                        {c.role ?? (
                          <span className="italic text-[color:var(--color-neutral-500)]">
                            —
                          </span>
                        )}
                      </td>
                      <td
                        style={{ ...TD_BASE, color: "var(--color-neutral-300)" }}
                        className="text-[12px]"
                      >
                        {c.email ? (
                          <a
                            href={`mailto:${c.email}`}
                            className="transition-colors duration-[180ms] ease-[cubic-bezier(0.16,1,0.3,1)] hover:text-[color:var(--color-brand-cream)]"
                          >
                            {c.email}
                          </a>
                        ) : (
                          <span className="italic text-[color:var(--color-neutral-500)]">
                            —
                          </span>
                        )}
                      </td>
                      <td
                        style={{ ...TD_BASE, color: "var(--color-neutral-300)" }}
                        className="text-[12px]"
                      >
                        {c.phone ?? (
                          <span className="italic text-[color:var(--color-neutral-500)]">
                            —
                          </span>
                        )}
                      </td>
                      <td
                        style={{ ...TD_BASE, color: "var(--color-neutral-500)" }}
                        className="font-[family-name:var(--font-body)] text-[12px] italic"
                      >
                        {relativeLabel(c.updated_at_ms, nowMs)}
                      </td>
                      <td style={TD_BASE}>
                        <div className="flex items-center justify-end gap-1">
                          {!c.is_primary && (
                            <button
                              onClick={() => onSetPrimary(c)}
                              disabled={isPending}
                              title="Set as primary"
                              className="cursor-pointer rounded-[5px] border-none bg-transparent p-1.5 text-[color:var(--color-neutral-600)] transition-colors duration-[180ms] ease-[cubic-bezier(0.16,1,0.3,1)] hover:text-[color:var(--color-brand-pink)] disabled:opacity-40"
                            >
                              <Star className="size-3.5" strokeWidth={1.5} />
                            </button>
                          )}
                          <button
                            onClick={() => openEdit(c)}
                            disabled={isPending}
                            title="Edit contact"
                            className="cursor-pointer rounded-[5px] border-none bg-transparent p-1.5 text-[color:var(--color-neutral-600)] transition-colors duration-[180ms] ease-[cubic-bezier(0.16,1,0.3,1)] hover:text-[color:var(--color-brand-cream)] disabled:opacity-40"
                          >
                            <Pencil className="size-3.5" strokeWidth={1.5} />
                          </button>
                          <button
                            onClick={() => onDelete(c)}
                            disabled={isPending}
                            title="Delete contact"
                            className="cursor-pointer rounded-[5px] border-none bg-transparent p-1.5 text-[color:var(--color-neutral-600)] transition-colors duration-[180ms] ease-[cubic-bezier(0.16,1,0.3,1)] hover:text-[color:var(--color-brand-red)] disabled:opacity-40"
                          >
                            <Trash2 className="size-3.5" strokeWidth={1.5} />
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
              </tbody>
            </table>
          )}
        </div>
      </section>

      {/* Add / Edit dialog */}
      <Dialog open={draft !== null} onOpenChange={(open) => !open && closeDraft()}>
        <DialogContent
          style={{
            background: "var(--color-surface-2)",
            border: "1px solid rgba(253, 245, 230, 0.08)",
            borderRadius: "16px",
            boxShadow:
              "0 24px 48px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(253, 245, 230, 0.03)",
            maxWidth: "440px",
          }}
        >
          <DialogHeader>
            <DialogTitle
              className="font-[family-name:var(--font-display)] text-[20px] leading-none text-[color:var(--color-brand-cream)]"
              style={{ letterSpacing: "-0.2px" }}
            >
              {draft?.id ? "Edit contact" : "New contact"}
            </DialogTitle>
            <DialogDescription className="font-[family-name:var(--font-body)] text-[13px] text-[color:var(--color-neutral-400)]">
              {draft?.id
                ? "Update this contact's details."
                : "Add a new contact to this company."}
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 space-y-3">
            <div>
              <label
                className="mb-1.5 block font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-neutral-500)]"
                style={{ letterSpacing: "1.5px" }}
              >
                Name *
              </label>
              <Input
                value={draft?.name ?? ""}
                onChange={(e) =>
                  setDraft((d) => (d ? { ...d, name: e.target.value } : d))
                }
                placeholder="Jane Smith"
                autoFocus
              />
            </div>
            <div>
              <label
                className="mb-1.5 block font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-neutral-500)]"
                style={{ letterSpacing: "1.5px" }}
              >
                Role
              </label>
              <Input
                value={draft?.role ?? ""}
                onChange={(e) =>
                  setDraft((d) => (d ? { ...d, role: e.target.value } : d))
                }
                placeholder="Marketing Manager"
              />
            </div>
            <div>
              <label
                className="mb-1.5 block font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-neutral-500)]"
                style={{ letterSpacing: "1.5px" }}
              >
                Email
              </label>
              <Input
                type="email"
                value={draft?.email ?? ""}
                onChange={(e) =>
                  setDraft((d) => (d ? { ...d, email: e.target.value } : d))
                }
                placeholder="jane@example.com"
              />
            </div>
            <div>
              <label
                className="mb-1.5 block font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-neutral-500)]"
                style={{ letterSpacing: "1.5px" }}
              >
                Phone
              </label>
              <Input
                type="tel"
                value={draft?.phone ?? ""}
                onChange={(e) =>
                  setDraft((d) => (d ? { ...d, phone: e.target.value } : d))
                }
                placeholder="+61 4xx xxx xxx"
              />
            </div>
          </div>

          <DialogFooter className="mt-5">
            <button
              onClick={closeDraft}
              disabled={isPending}
              className="cursor-pointer rounded-[8px] border border-[color:rgba(253,245,230,0.08)] bg-transparent px-4 py-2 font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-neutral-400)] transition-colors duration-[200ms] ease-[cubic-bezier(0.16,1,0.3,1)] hover:text-[color:var(--color-brand-cream)] disabled:opacity-40"
              style={{ letterSpacing: "1.5px" }}
            >
              Cancel
            </button>
            <button
              onClick={onSave}
              disabled={isPending || !draft?.name.trim()}
              className="cursor-pointer rounded-[8px] border-none px-4 py-2 font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-brand-cream)] transition-all duration-[200ms] ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-px disabled:opacity-40"
              style={{
                letterSpacing: "1.5px",
                background: "var(--color-brand-red)",
                boxShadow:
                  "inset 0 1px 0 rgba(253, 245, 230, 0.04), 0 4px 12px rgba(178, 40, 72, 0.25)",
              }}
            >
              {isPending ? "Saving…" : draft?.id ? "Update" : "Add contact"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function PrimaryPill() {
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-[1px] font-[family-name:var(--font-label)] text-[9px] uppercase"
      style={{
        letterSpacing: "1.5px",
        background: "rgba(244, 160, 176, 0.10)",
        color: "var(--color-brand-pink)",
      }}
    >
      primary
    </span>
  );
}
