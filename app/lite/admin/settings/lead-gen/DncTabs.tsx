"use client";

import * as React from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

import type { DncEmailSource } from "@/lib/db/schema/dnc";
import {
  addDncEmails,
  removeDncEmailById,
  addDncDomains,
  removeDncDomainById,
} from "./actions";

const HOUSE_SPRING = {
  type: "spring" as const,
  mass: 1,
  stiffness: 220,
  damping: 25,
};

// ── Prop types ──────────────────────────────────────────────────────────────

export type DncTabsProps = {
  companies: { id: string; name: string }[];
  emails: {
    id: string;
    email: string;
    source: DncEmailSource;
    reason: string | null;
    added_at_ms: number;
  }[];
  domains: {
    id: string;
    domain: string;
    reason: string | null;
    added_at_ms: number;
  }[];
};

type Tab = "companies" | "emails" | "domains";

// ── Relative time helper ─────────────────────────────────────────────────────

function formatAgo(ms: number): string {
  const diffSec = Math.floor((Date.now() - ms) / 1000);
  if (diffSec < 60) return "just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 30) return `${diffDay}d ago`;
  const diffMo = Math.floor(diffDay / 30);
  return `${diffMo}mo ago`;
}

// ── Source chip ──────────────────────────────────────────────────────────────

const SOURCE_LABEL: Record<DncEmailSource, string> = {
  manual: "manual",
  csv_import: "csv",
  unsubscribe_link: "unsub",
  complaint: "complaint",
};

function SourceChip({ source }: { source: DncEmailSource }) {
  return (
    <span
      className="inline-flex shrink-0 items-center rounded-full px-2 py-[3px] font-[family-name:var(--font-label)] text-[10px] uppercase leading-none text-[color:var(--color-neutral-400)]"
      style={{
        letterSpacing: "1.2px",
        background: "rgba(253,245,230,0.05)",
        border: "1px solid rgba(253,245,230,0.07)",
      }}
    >
      {SOURCE_LABEL[source]}
    </span>
  );
}

// ── Tab pill ──────────────────────────────────────────────────────────────────

function TabPill({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "relative flex cursor-pointer items-center gap-2 rounded-[8px] px-4 py-2 font-[family-name:var(--font-label)] text-[11px] uppercase transition-colors duration-[160ms] ease-[cubic-bezier(0.16,1,0.3,1)]",
        active
          ? "text-[color:var(--color-brand-cream)]"
          : "text-[color:var(--color-neutral-500)] hover:text-[color:var(--color-neutral-300)]",
      )}
      style={{ letterSpacing: "1.8px", background: "transparent", border: "none" }}
    >
      {active && (
        <motion.span
          layoutId="dnc-tab-active"
          className="absolute inset-0 rounded-[8px]"
          style={{
            background: "var(--color-surface-2)",
            boxShadow: "var(--surface-highlight)",
          }}
          transition={HOUSE_SPRING}
        />
      )}
      <span className="relative">{label}</span>
      <span
        className="relative font-[family-name:var(--font-body)] text-[10px] tabular-nums"
        style={{
          color: active
            ? "var(--color-brand-pink)"
            : "var(--color-neutral-600)",
        }}
      >
        {count}
      </span>
    </button>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={HOUSE_SPRING}
      className="flex flex-col items-start gap-2.5 rounded-[12px] px-8 py-10"
      style={{
        border: "1px dashed rgba(253,245,230,0.07)",
        background: "rgba(15,15,14,0.3)",
      }}
    >
      <div
        className="font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-brand-orange)]"
        style={{ letterSpacing: "2px" }}
      >
        Nothing here
      </div>
      <h4
        className="font-[family-name:var(--font-display)] text-[22px] leading-[1.1] text-[color:var(--color-brand-cream)]"
        style={{ letterSpacing: "-0.2px" }}
      >
        {title}
      </h4>
      <p className="max-w-[440px] font-[family-name:var(--font-body)] text-[14px] leading-[1.55] text-[color:var(--color-neutral-400)]">
        {body}
      </p>
    </motion.div>
  );
}

// ── Remove button ─────────────────────────────────────────────────────────────

function RemoveButton({
  onClick,
  disabled,
}: {
  onClick: () => void;
  disabled: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="rounded-[6px] px-2.5 py-1 font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-neutral-500)] transition-colors duration-[160ms] ease-[cubic-bezier(0.16,1,0.3,1)] hover:text-[color:var(--color-brand-cream)] disabled:opacity-40"
      style={{
        letterSpacing: "1.5px",
        background: "transparent",
        border: "1px solid rgba(253,245,230,0.07)",
      }}
    >
      Remove
    </button>
  );
}

// ── Add form (shared shape for emails and domains) ────────────────────────────

function AddForm({
  label,
  placeholder,
  bulkPlaceholder,
  onAdd,
  isPending,
}: {
  label: string;
  placeholder: string;
  bulkPlaceholder: string;
  onAdd: (values: string[]) => Promise<void>;
  isPending: boolean;
}) {
  const [single, setSingle] = React.useState("");
  const [bulk, setBulk] = React.useState("");
  const [showBulk, setShowBulk] = React.useState(false);

  async function handleSingle(e: React.FormEvent) {
    e.preventDefault();
    const v = single.trim();
    if (!v) return;
    await onAdd([v]);
    setSingle("");
  }

  async function handleBulk(e: React.FormEvent) {
    e.preventDefault();
    const lines = bulk
      .split(/[\n,]+/)
      .map((l) => l.trim())
      .filter(Boolean);
    if (!lines.length) return;
    await onAdd(lines);
    setBulk("");
    setShowBulk(false);
  }

  return (
    <div
      className="rounded-[10px] px-4 py-3"
      style={{
        background: "var(--color-surface-2)",
        boxShadow: "var(--surface-highlight)",
      }}
    >
      <div
        className="mb-2 font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-neutral-500)]"
        style={{ letterSpacing: "1.5px" }}
      >
        Add {label}
      </div>
      <form onSubmit={handleSingle} className="flex gap-2">
        <Input
          value={single}
          onChange={(e) => setSingle(e.target.value)}
          placeholder={placeholder}
          className="flex-1 text-[13px]"
          disabled={isPending}
        />
        <button
          type="submit"
          disabled={isPending || !single.trim()}
          className="rounded-[8px] px-4 py-2 font-[family-name:var(--font-label)] text-[11px] uppercase text-[color:var(--color-brand-cream)] transition-transform duration-[200ms] ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-px disabled:opacity-40"
          style={{
            letterSpacing: "1.8px",
            background: "var(--color-brand-red)",
            boxShadow:
              "inset 0 1px 0 rgba(253,245,230,0.04), 0 4px 12px rgba(178,40,72,0.25)",
            border: "none",
          }}
        >
          Add
        </button>
      </form>
      <div className="mt-2">
        <button
          type="button"
          onClick={() => setShowBulk((v) => !v)}
          className="font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-neutral-600)] transition-colors duration-[160ms] hover:text-[color:var(--color-neutral-400)]"
          style={{ letterSpacing: "1.2px", background: "none", border: "none" }}
        >
          {showBulk ? "− hide bulk add" : "+ bulk add"}
        </button>
        <AnimatePresence>
          {showBulk && (
            <motion.form
              key="bulk"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={HOUSE_SPRING}
              onSubmit={handleBulk}
              className="mt-2 flex flex-col gap-2 overflow-hidden"
            >
              <Textarea
                value={bulk}
                onChange={(e) => setBulk(e.target.value)}
                placeholder={bulkPlaceholder}
                rows={4}
                className="text-[13px]"
                disabled={isPending}
              />
              <button
                type="submit"
                disabled={isPending || !bulk.trim()}
                className="self-start rounded-[8px] px-4 py-2 font-[family-name:var(--font-label)] text-[11px] uppercase text-[color:var(--color-brand-cream)] transition-transform duration-[200ms] ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-px disabled:opacity-40"
                style={{
                  letterSpacing: "1.8px",
                  background: "var(--color-brand-red)",
                  boxShadow:
                    "inset 0 1px 0 rgba(253,245,230,0.04), 0 4px 12px rgba(178,40,72,0.25)",
                  border: "none",
                }}
              >
                Add all
              </button>
            </motion.form>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ── Row table wrapper ────────────────────────────────────────────────────────

function ListTable({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="overflow-hidden rounded-[12px]"
      style={{
        background: "var(--color-surface-2)",
        boxShadow: "var(--surface-highlight)",
      }}
    >
      <table className="w-full text-left">{children}</table>
    </div>
  );
}

function Th({ children, right }: { children?: React.ReactNode; right?: boolean }) {
  return (
    <th
      className="font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-neutral-500)]"
      style={{
        letterSpacing: "2px",
        padding: "12px 14px",
        borderBottom: "1px solid rgba(253,245,230,0.05)",
        textAlign: right ? "right" : "left",
        fontWeight: "normal",
      }}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  right,
  muted,
}: {
  children: React.ReactNode;
  right?: boolean;
  muted?: boolean;
}) {
  return (
    <td
      className={cn(
        "font-[family-name:var(--font-body)] text-[13px]",
        muted
          ? "text-[color:var(--color-neutral-500)]"
          : "text-[color:var(--color-brand-cream)]",
      )}
      style={{
        padding: "13px 14px",
        borderBottom: "1px solid rgba(253,245,230,0.03)",
        textAlign: right ? "right" : "left",
      }}
    >
      {children}
    </td>
  );
}

// ── Companies tab (read-only) ─────────────────────────────────────────────────

function CompaniesTab({
  companies,
}: {
  companies: DncTabsProps["companies"];
}) {
  const [search, setSearch] = React.useState("");
  const reduced = useReducedMotion();
  const listTransition = reduced ? { duration: 0.02 } : HOUSE_SPRING;

  const filtered = companies.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="flex flex-col gap-4">
      <div
        className="flex items-center gap-3 rounded-[10px] px-3 py-2.5"
        style={{
          background: "var(--color-surface-2)",
          boxShadow: "var(--surface-highlight)",
        }}
      >
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search companies…"
          className="border-0 bg-transparent text-[13px] shadow-none focus-visible:ring-0"
        />
        <div
          className="shrink-0 font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-neutral-600)]"
          style={{ letterSpacing: "1.5px" }}
        >
          {companies.length} blocked
        </div>
      </div>

      <AnimatePresence mode="wait">
        {filtered.length === 0 ? (
          <EmptyState
            key="empty"
            title="No blocked companies."
            body="Companies marked Do Not Contact on their profile appear here. Unblock from the company profile — deliberate action only."
          />
        ) : (
          <ListTable key="table">
            <thead>
              <tr>
                <Th>Company</Th>
                <Th>Note</Th>
              </tr>
            </thead>
            <tbody>
              <AnimatePresence initial={false}>
                {filtered.map((c) => (
                  <motion.tr
                    key={c.id}
                    layout="position"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={listTransition}
                  >
                    <Td>{c.name}</Td>
                    <Td muted>Unblock via Company profile</Td>
                  </motion.tr>
                ))}
              </AnimatePresence>
            </tbody>
          </ListTable>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Emails tab ────────────────────────────────────────────────────────────────

function EmailsTab({ emails }: { emails: DncTabsProps["emails"] }) {
  const router = useRouter();
  const [search, setSearch] = React.useState("");
  const [localEmails, setLocalEmails] = React.useState(emails);
  const [isPending, startTransition] = React.useTransition();
  const reduced = useReducedMotion();
  const listTransition = reduced ? { duration: 0.02 } : HOUSE_SPRING;

  React.useEffect(() => setLocalEmails(emails), [emails]);

  const filtered = localEmails.filter((e) =>
    e.email.toLowerCase().includes(search.toLowerCase()),
  );

  async function handleAdd(values: string[]) {
    startTransition(async () => {
      const res = await addDncEmails(values);
      if (!res.ok) {
        toast.error("Not authorised.");
        return;
      }
      const parts: string[] = [];
      if (res.added > 0) parts.push(`${res.added} added`);
      if (res.skipped > 0) parts.push(`${res.skipped} already blocked`);
      if (res.errors.length > 0) {
        res.errors.forEach((e) => toast.error(e));
      }
      if (parts.length) toast.success(parts.join(" · "));
      router.refresh();
    });
  }

  async function handleRemove(id: string) {
    startTransition(async () => {
      const res = await removeDncEmailById(id);
      if (res.ok) {
        setLocalEmails((prev) => prev.filter((e) => e.id !== id));
        toast.success("Removed.");
        router.refresh();
      } else {
        toast.error("Could not remove.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div
        className="flex items-center gap-3 rounded-[10px] px-3 py-2.5"
        style={{
          background: "var(--color-surface-2)",
          boxShadow: "var(--surface-highlight)",
        }}
      >
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search emails…"
          className="border-0 bg-transparent text-[13px] shadow-none focus-visible:ring-0"
        />
        <div
          className="shrink-0 font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-neutral-600)]"
          style={{ letterSpacing: "1.5px" }}
        >
          {localEmails.length} blocked
        </div>
      </div>

      <AddForm
        label="email"
        placeholder="name@example.com"
        bulkPlaceholder={"name@example.com\nanother@company.com"}
        onAdd={handleAdd}
        isPending={isPending}
      />

      <AnimatePresence mode="wait">
        {filtered.length === 0 ? (
          <EmptyState
            key="empty"
            title="No blocked emails."
            body="Add individual addresses or paste a list to block them from outreach."
          />
        ) : (
          <ListTable key="table">
            <thead>
              <tr>
                <Th>Email</Th>
                <Th>Source</Th>
                <Th>Added</Th>
                <Th right />
              </tr>
            </thead>
            <tbody>
              <AnimatePresence initial={false}>
                {filtered.map((e) => (
                  <motion.tr
                    key={e.id}
                    layout="position"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={listTransition}
                  >
                    <Td>
                      <span className="font-mono text-[12px]">{e.email}</span>
                    </Td>
                    <Td>
                      <SourceChip source={e.source} />
                    </Td>
                    <Td muted>{formatAgo(e.added_at_ms)}</Td>
                    <Td right>
                      <RemoveButton
                        onClick={() => handleRemove(e.id)}
                        disabled={isPending}
                      />
                    </Td>
                  </motion.tr>
                ))}
              </AnimatePresence>
            </tbody>
          </ListTable>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Domains tab ───────────────────────────────────────────────────────────────

function DomainsTab({ domains }: { domains: DncTabsProps["domains"] }) {
  const router = useRouter();
  const [search, setSearch] = React.useState("");
  const [localDomains, setLocalDomains] = React.useState(domains);
  const [isPending, startTransition] = React.useTransition();
  const reduced = useReducedMotion();
  const listTransition = reduced ? { duration: 0.02 } : HOUSE_SPRING;

  React.useEffect(() => setLocalDomains(domains), [domains]);

  const filtered = localDomains.filter((d) =>
    d.domain.toLowerCase().includes(search.toLowerCase()),
  );

  async function handleAdd(values: string[]) {
    startTransition(async () => {
      const res = await addDncDomains(values);
      if (!res.ok) {
        toast.error("Not authorised.");
        return;
      }
      const parts: string[] = [];
      if (res.added > 0) parts.push(`${res.added} added`);
      if (res.skipped > 0) parts.push(`${res.skipped} already blocked`);
      if (res.errors.length > 0) {
        res.errors.forEach((e) => toast.error(e));
      }
      if (parts.length) toast.success(parts.join(" · "));
      router.refresh();
    });
  }

  async function handleRemove(id: string) {
    startTransition(async () => {
      const res = await removeDncDomainById(id);
      if (res.ok) {
        setLocalDomains((prev) => prev.filter((d) => d.id !== id));
        toast.success("Removed.");
        router.refresh();
      } else {
        toast.error("Could not remove.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div
        className="flex items-center gap-3 rounded-[10px] px-3 py-2.5"
        style={{
          background: "var(--color-surface-2)",
          boxShadow: "var(--surface-highlight)",
        }}
      >
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search domains…"
          className="border-0 bg-transparent text-[13px] shadow-none focus-visible:ring-0"
        />
        <div
          className="shrink-0 font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-neutral-600)]"
          style={{ letterSpacing: "1.5px" }}
        >
          {localDomains.length} blocked
        </div>
      </div>

      <AddForm
        label="domain"
        placeholder="example.com"
        bulkPlaceholder={"example.com\nanother.com.au"}
        onAdd={handleAdd}
        isPending={isPending}
      />

      <AnimatePresence mode="wait">
        {filtered.length === 0 ? (
          <EmptyState
            key="empty"
            title="No blocked domains."
            body="Block entire domains to prevent outreach to any address at that company."
          />
        ) : (
          <ListTable key="table">
            <thead>
              <tr>
                <Th>Domain</Th>
                <Th>Added</Th>
                <Th right />
              </tr>
            </thead>
            <tbody>
              <AnimatePresence initial={false}>
                {filtered.map((d) => (
                  <motion.tr
                    key={d.id}
                    layout="position"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={listTransition}
                  >
                    <Td>
                      <span className="font-mono text-[12px]">{d.domain}</span>
                    </Td>
                    <Td muted>{formatAgo(d.added_at_ms)}</Td>
                    <Td right>
                      <RemoveButton
                        onClick={() => handleRemove(d.id)}
                        disabled={isPending}
                      />
                    </Td>
                  </motion.tr>
                ))}
              </AnimatePresence>
            </tbody>
          </ListTable>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Root component ────────────────────────────────────────────────────────────

export function DncTabs({ companies, emails, domains }: DncTabsProps) {
  const [activeTab, setActiveTab] = React.useState<Tab>("companies");

  const tabs: { id: Tab; label: string; count: number }[] = [
    { id: "companies", label: "Companies", count: companies.length },
    { id: "emails", label: "Emails", count: emails.length },
    { id: "domains", label: "Domains", count: domains.length },
  ];

  return (
    <div className="flex flex-col gap-5">
      {/* Tab bar */}
      <div className="flex items-center gap-1">
        {tabs.map((t) => (
          <TabPill
            key={t.id}
            label={t.label}
            count={t.count}
            active={activeTab === t.id}
            onClick={() => setActiveTab(t.id)}
          />
        ))}
      </div>

      {/* Tab content */}
      <AnimatePresence mode="wait">
        {activeTab === "companies" && (
          <motion.div
            key="companies"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={HOUSE_SPRING}
          >
            <CompaniesTab companies={companies} />
          </motion.div>
        )}
        {activeTab === "emails" && (
          <motion.div
            key="emails"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={HOUSE_SPRING}
          >
            <EmailsTab emails={emails} />
          </motion.div>
        )}
        {activeTab === "domains" && (
          <motion.div
            key="domains"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={HOUSE_SPRING}
          >
            <DomainsTab domains={domains} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
