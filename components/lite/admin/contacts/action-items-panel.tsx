"use client";

import * as React from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { houseSpring } from "@/lib/design-tokens";
import {
  completeActionItemAction,
  dismissActionItemAction,
  editActionItemAction,
  addActionItemAction,
} from "@/app/lite/admin/contacts/[id]/context-actions";

interface ActionItem {
  id: string;
  description: string;
  owner: "you" | "them";
  due_date_ms: number | null;
  source: "claude_extract" | "manual";
  status: "open" | "done" | "dismissed";
  created_at_ms: number;
  completed_at_ms: number | null;
}

interface ActionItemsPanelProps {
  contactId: string;
  items: ActionItem[];
}

export function ActionItemsPanel({ contactId, items }: ActionItemsPanelProps) {
  const reduced = useReducedMotion();
  const [localItems, setLocalItems] = React.useState(items);
  const [showPast, setShowPast] = React.useState(false);
  const [adding, setAdding] = React.useState(false);

  React.useEffect(() => { setLocalItems(items); }, [items]);

  const open = localItems.filter((i) => i.status === "open");
  const past = localItems.filter((i) => i.status !== "open");
  const youOwe = open.filter((i) => i.owner === "you").sort(sortByUrgency);
  const theyOwe = open.filter((i) => i.owner === "them").sort(sortByUrgency);

  if (open.length === 0 && past.length === 0 && !adding) return null;

  return (
    <section
      aria-label="Action items"
      className="overflow-hidden rounded-[12px]"
      style={{ background: "var(--color-surface-2)", boxShadow: "var(--surface-highlight)" }}
    >
      <div
        className="flex items-baseline justify-between px-5 py-3"
        style={{ borderBottom: "1px solid rgba(253, 245, 230, 0.05)" }}
      >
        <h2
          className="font-[family-name:var(--font-label)] text-[11px] uppercase text-[color:var(--color-neutral-300)]"
          style={{ letterSpacing: "1.8px" }}
        >
          Action items
        </h2>
        <span
          className="font-[family-name:var(--font-label)] text-[11px] tabular-nums text-[color:var(--color-neutral-500)]"
          style={{ letterSpacing: "1.5px" }}
        >
          {open.length} open
        </span>
      </div>

      <div className="divide-y divide-[rgba(253,245,230,0.03)]">
        {youOwe.length > 0 && (
          <div className="px-5 py-3">
            <GroupLabel>You owe</GroupLabel>
            <AnimatePresence>
              {youOwe.map((item, i) => (
                <ActionItemRow
                  key={item.id}
                  item={item}
                  contactId={contactId}
                  index={i}
                  reduced={reduced}
                  onStatusChange={(id, status) =>
                    setLocalItems((prev) =>
                      prev.map((p) =>
                        p.id === id
                          ? { ...p, status, completed_at_ms: status === "done" ? Date.now() : null }
                          : p,
                      ),
                    )
                  }
                />
              ))}
            </AnimatePresence>
          </div>
        )}

        {theyOwe.length > 0 && (
          <div className="px-5 py-3">
            <GroupLabel>They owe</GroupLabel>
            <AnimatePresence>
              {theyOwe.map((item, i) => (
                <ActionItemRow
                  key={item.id}
                  item={item}
                  contactId={contactId}
                  index={i}
                  reduced={reduced}
                  onStatusChange={(id, status) =>
                    setLocalItems((prev) =>
                      prev.map((p) =>
                        p.id === id
                          ? { ...p, status, completed_at_ms: status === "done" ? Date.now() : null }
                          : p,
                      ),
                    )
                  }
                />
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Add button + inline form */}
      <div className="px-5 py-3" style={{ borderTop: "1px solid rgba(253, 245, 230, 0.05)" }}>
        <AnimatePresence>
          {adding && (
            <AddActionItemForm
              contactId={contactId}
              reduced={reduced}
              onClose={() => setAdding(false)}
              onAdded={(newItem) => {
                setLocalItems((prev) => [...prev, newItem]);
                setAdding(false);
              }}
            />
          )}
        </AnimatePresence>
        {!adding && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-neutral-500)] transition-colors duration-[180ms] hover:text-[color:var(--color-brand-cream)]"
            style={{ letterSpacing: "1.5px" }}
          >
            + Add action item
          </button>
        )}
      </div>

      {/* Past items toggle */}
      {past.length > 0 && (
        <div className="px-5 py-2" style={{ borderTop: "1px solid rgba(253, 245, 230, 0.03)" }}>
          <button
            type="button"
            onClick={() => setShowPast((p) => !p)}
            className="font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-neutral-500)] transition-colors duration-[180ms] hover:text-[color:var(--color-brand-cream)]"
            style={{ letterSpacing: "1.5px" }}
          >
            {showPast ? "Hide" : "Show"} past items ({past.length})
          </button>
          <AnimatePresence>
            {showPast && (
              <motion.div
                initial={reduced ? {} : { height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={reduced ? {} : { height: 0, opacity: 0 }}
                transition={reduced ? { duration: 0.01 } : houseSpring}
                className="overflow-hidden"
              >
                <div className="mt-2 space-y-1">
                  {past.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center gap-2 py-1 text-[12px] text-[color:var(--color-neutral-500)] line-through"
                    >
                      <span className="flex-1 truncate">{item.description}</span>
                      <span className="shrink-0 font-[family-name:var(--font-label)] text-[9px] uppercase" style={{ letterSpacing: "1px" }}>
                        {item.status}
                      </span>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </section>
  );
}

function GroupLabel({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="mb-2 font-[family-name:var(--font-label)] text-[9px] uppercase text-[color:var(--color-neutral-500)]"
      style={{ letterSpacing: "1.5px" }}
    >
      {children}
    </p>
  );
}

function ActionItemRow({
  item,
  contactId,
  index,
  reduced,
  onStatusChange,
}: {
  item: ActionItem;
  contactId: string;
  index: number;
  reduced: boolean | null;
  onStatusChange: (id: string, status: "done" | "dismissed") => void;
}) {
  const [editing, setEditing] = React.useState(false);
  const [editDesc, setEditDesc] = React.useState(item.description);
  const [busy, setBusy] = React.useState(false);

  const isOverdue = item.due_date_ms ? item.due_date_ms < Date.now() : false;

  async function handleComplete() {
    setBusy(true);
    onStatusChange(item.id, "done");
    await completeActionItemAction(item.id, contactId);
    setBusy(false);
  }

  async function handleDismiss() {
    setBusy(true);
    onStatusChange(item.id, "dismissed");
    await dismissActionItemAction(item.id, contactId);
    setBusy(false);
  }

  async function handleSaveEdit() {
    if (!editDesc.trim()) return;
    setBusy(true);
    await editActionItemAction(item.id, contactId, editDesc.trim(), item.due_date_ms);
    setEditing(false);
    setBusy(false);
  }

  return (
    <motion.div
      layout
      initial={reduced ? {} : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={reduced ? {} : { opacity: 0, y: -4 }}
      transition={
        reduced
          ? { duration: 0.01 }
          : { ...houseSpring, delay: index * 0.04 }
      }
      className="group flex items-start gap-2 py-1.5"
    >
      {editing ? (
        <div className="flex flex-1 items-center gap-2">
          <input
            type="text"
            value={editDesc}
            onChange={(e) => setEditDesc(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSaveEdit();
              if (e.key === "Escape") setEditing(false);
            }}
            className="flex-1 rounded border border-[color:var(--color-neutral-600)] bg-[color:var(--color-surface-1)] px-2 py-1 text-[12px] text-[color:var(--color-brand-cream)] outline-none focus:border-[color:var(--color-brand-pink)]"
            autoFocus
            disabled={busy}
          />
          <button
            type="button"
            onClick={handleSaveEdit}
            disabled={busy}
            className="text-[10px] text-[color:var(--color-success)] hover:underline disabled:opacity-50"
          >
            Save
          </button>
          <button
            type="button"
            onClick={() => { setEditing(false); setEditDesc(item.description); }}
            className="text-[10px] text-[color:var(--color-neutral-500)] hover:underline"
          >
            Cancel
          </button>
        </div>
      ) : (
        <>
          <span
            className={`flex-1 text-[12px] leading-[1.5] ${
              isOverdue
                ? "text-[color:var(--color-brand-red)]"
                : "text-[color:var(--color-neutral-300)]"
            }`}
          >
            {item.description}
            {item.due_date_ms && (
              <span className="ml-2 text-[10px] text-[color:var(--color-neutral-500)]">
                {isOverdue ? "overdue · " : ""}
                {new Date(item.due_date_ms).toLocaleDateString("en-AU", {
                  day: "numeric",
                  month: "short",
                })}
              </span>
            )}
            {item.source === "claude_extract" && (
              <span className="ml-1.5 text-[9px] text-[color:var(--color-neutral-500)]" title="Auto-extracted">
                ⚡
              </span>
            )}
          </span>

          <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity duration-[180ms] group-hover:opacity-100">
            <InlineButton onClick={handleComplete} disabled={busy} title="Done" aria-label="Mark done">
              ✓
            </InlineButton>
            <InlineButton onClick={() => setEditing(true)} disabled={busy} title="Edit" aria-label="Edit">
              ✎
            </InlineButton>
            <InlineButton onClick={handleDismiss} disabled={busy} title="Dismiss" aria-label="Dismiss">
              ✕
            </InlineButton>
          </div>
        </>
      )}
    </motion.div>
  );
}

function InlineButton({
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className="flex h-5 w-5 items-center justify-center rounded text-[11px] text-[color:var(--color-neutral-500)] transition-colors duration-[180ms] hover:bg-[color:var(--color-surface-3)] hover:text-[color:var(--color-brand-cream)] disabled:opacity-50"
      {...props}
    >
      {children}
    </button>
  );
}

function AddActionItemForm({
  contactId,
  reduced,
  onClose,
  onAdded,
}: {
  contactId: string;
  reduced: boolean | null;
  onClose: () => void;
  onAdded: (item: ActionItem) => void;
}) {
  const [desc, setDesc] = React.useState("");
  const [owner, setOwner] = React.useState<"you" | "them">("you");
  const [busy, setBusy] = React.useState(false);

  async function handleSubmit() {
    if (!desc.trim() || busy) return;
    setBusy(true);
    const result = await addActionItemAction(contactId, desc.trim(), owner, null);
    if (result.ok) {
      onAdded({
        id: crypto.randomUUID(),
        description: desc.trim(),
        owner,
        due_date_ms: null,
        source: "manual",
        status: "open",
        created_at_ms: Date.now(),
        completed_at_ms: null,
      });
    }
    setBusy(false);
  }

  return (
    <motion.div
      initial={reduced ? {} : { height: 0, opacity: 0 }}
      animate={{ height: "auto", opacity: 1 }}
      exit={reduced ? {} : { height: 0, opacity: 0 }}
      transition={reduced ? { duration: 0.01 } : houseSpring}
      className="overflow-hidden"
    >
      <div className="flex flex-col gap-2 pb-2">
        <input
          type="text"
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSubmit();
            if (e.key === "Escape") onClose();
          }}
          placeholder="What needs doing?"
          className="w-full rounded border border-[color:var(--color-neutral-600)] bg-[color:var(--color-surface-1)] px-3 py-2 text-[13px] text-[color:var(--color-brand-cream)] placeholder:text-[color:var(--color-neutral-500)] outline-none focus:border-[color:var(--color-brand-pink)]"
          autoFocus
          disabled={busy}
        />
        <div className="flex items-center justify-between">
          <div className="flex gap-2">
            <OwnerToggle label="You owe" active={owner === "you"} onClick={() => setOwner("you")} />
            <OwnerToggle label="They owe" active={owner === "them"} onClick={() => setOwner("them")} />
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded px-2 py-1 text-[10px] uppercase text-[color:var(--color-neutral-500)] transition-colors hover:text-[color:var(--color-brand-cream)]"
              style={{ letterSpacing: "1px" }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!desc.trim() || busy}
              className="rounded bg-[color:var(--color-brand-pink)] px-3 py-1 text-[10px] uppercase text-[color:var(--color-brand-charcoal)] transition-opacity hover:opacity-90 disabled:opacity-40"
              style={{ letterSpacing: "1px" }}
            >
              Add
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function OwnerToggle({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-2.5 py-[2px] font-[family-name:var(--font-label)] text-[9px] uppercase transition-colors duration-[180ms] ${
        active
          ? "bg-[color:var(--color-brand-pink)] text-[color:var(--color-brand-charcoal)]"
          : "bg-[color:var(--color-surface-3)] text-[color:var(--color-neutral-500)] hover:text-[color:var(--color-neutral-300)]"
      }`}
      style={{ letterSpacing: "1.2px" }}
    >
      {label}
    </button>
  );
}

function sortByUrgency(a: ActionItem, b: ActionItem): number {
  const nowMs = Date.now();
  const aOverdue = a.due_date_ms ? a.due_date_ms < nowMs : false;
  const bOverdue = b.due_date_ms ? b.due_date_ms < nowMs : false;
  if (aOverdue !== bOverdue) return aOverdue ? -1 : 1;
  if (a.due_date_ms && b.due_date_ms) return a.due_date_ms - b.due_date_ms;
  if (a.due_date_ms) return -1;
  if (b.due_date_ms) return 1;
  return b.created_at_ms - a.created_at_ms;
}
