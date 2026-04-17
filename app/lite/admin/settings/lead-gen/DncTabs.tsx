"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { houseSpring } from "@/lib/design-tokens";
import {
  addDncEmails,
  removeDncEmailById,
  addDncDomains,
  removeDncDomainById,
  type BulkAddResult,
} from "./actions";

export type DncCompany = { id: string; name: string };
export type DncEmail = {
  id: string;
  email: string;
  source: string;
  added_at_ms: number | null;
};
export type DncDomain = {
  id: string;
  domain: string;
  added_at_ms: number | null;
};

type Tab = "companies" | "emails" | "domains";

const TABS: { id: Tab; label: string }[] = [
  { id: "companies", label: "Companies" },
  { id: "emails", label: "Emails" },
  { id: "domains", label: "Domains" },
];

function relativeTime(ms: number | null): string {
  if (ms == null) return "—";
  const diff = Date.now() - ms;
  const mins = Math.floor(diff / 60_000);
  if (mins < 2) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return "yesterday";
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

function SourceChip({ source }: { source: string }) {
  const labels: Record<string, string> = {
    manual: "manual",
    csv_import: "csv",
    unsubscribe_link: "unsub",
    complaint: "complaint",
  };
  return (
    <span
      className="inline-flex items-center rounded px-2 py-0.5 font-[family-name:var(--font-label)] text-[10px] uppercase"
      style={{
        letterSpacing: "1.5px",
        background: "rgba(244, 160, 176, 0.1)",
        color: "var(--color-brand-pink)",
      }}
    >
      {labels[source] ?? source}
    </span>
  );
}

function FeedbackBar({
  result,
  onDismiss,
}: {
  result: BulkAddResult | null;
  onDismiss: () => void;
}) {
  if (!result) return null;
  const hasErrors = result.errors.length > 0;
  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={houseSpring}
      className="flex items-start justify-between gap-3 rounded-lg px-4 py-3 text-[13px]"
      style={{
        background: hasErrors
          ? "rgba(178, 40, 72, 0.12)"
          : "rgba(123, 174, 126, 0.12)",
        border: `1px solid ${hasErrors ? "rgba(178,40,72,0.3)" : "rgba(123,174,126,0.3)"}`,
        color: hasErrors
          ? "var(--color-brand-pink)"
          : "var(--color-success, #7BAE7E)",
      }}
    >
      <div className="flex flex-col gap-1">
        <span>
          {result.added > 0 && `Added ${result.added}. `}
          {result.skipped > 0 && `${result.skipped} already blocked. `}
        </span>
        {hasErrors && (
          <ul className="mt-1 space-y-0.5 text-[12px] opacity-80">
            {result.errors.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        )}
      </div>
      <button
        onClick={onDismiss}
        className="shrink-0 opacity-60 transition-opacity hover:opacity-100"
        aria-label="Dismiss"
      >
        ✕
      </button>
    </motion.div>
  );
}

function CompaniesTab({ companies }: { companies: DncCompany[] }) {
  return (
    <div className="flex flex-col gap-4">
      <div
        className="font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-neutral-500)]"
        style={{ letterSpacing: "2px" }}
      >
        {companies.length} blocked{" "}
        {companies.length === 1 ? "company" : "companies"}
      </div>

      <AnimatePresence mode="wait" initial={false}>
        {companies.length === 0 ? (
          <motion.div
            key="empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={houseSpring}
            className="rounded-xl px-8 py-10"
            style={{
              border: "1px dashed rgba(253, 245, 230, 0.07)",
              background: "rgba(15, 15, 14, 0.3)",
            }}
          >
            <div
              className="font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-brand-orange)]"
              style={{ letterSpacing: "2px" }}
            >
              Companies · all clear
            </div>
            <h4 className="mt-2 font-[family-name:var(--font-display)] text-[26px] leading-[1.1] text-[color:var(--color-brand-cream)]">
              No blocked companies.
            </h4>
            <p className="mt-2 max-w-[440px] font-[family-name:var(--font-body)] text-[14px] leading-[1.55] text-[color:var(--color-neutral-400)]">
              When a company has &ldquo;Do Not Contact&rdquo; switched on, it shows here.
            </p>
            <p className="mt-3 font-[family-name:var(--font-narrative)] text-[12px] italic text-[color:var(--color-brand-pink)]">
              to unblock, visit the Company profile.
            </p>
          </motion.div>
        ) : (
          <motion.div
            key="list"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={houseSpring}
          >
            <table className="w-full text-left">
              <thead>
                <tr>
                  <th
                    className="pb-3 font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-neutral-500)]"
                    style={{
                      letterSpacing: "2px",
                      borderBottom: "1px solid rgba(253,245,230,0.05)",
                    }}
                  >
                    Company
                  </th>
                  <th
                    className="pb-3 font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-neutral-500)]"
                    style={{
                      letterSpacing: "2px",
                      borderBottom: "1px solid rgba(253,245,230,0.05)",
                    }}
                  >
                    How to unblock
                  </th>
                </tr>
              </thead>
              <tbody>
                {companies.map((c) => (
                  <tr
                    key={c.id}
                    className="transition-colors duration-[160ms] ease-[cubic-bezier(0.16,1,0.3,1)] hover:bg-[rgba(253,245,230,0.025)]"
                  >
                    <td
                      className="py-3 pr-4 font-[family-name:var(--font-body)] text-[14px] font-medium text-[color:var(--color-brand-cream)]"
                      style={{ borderBottom: "1px solid rgba(253,245,230,0.03)" }}
                    >
                      {c.name}
                    </td>
                    <td
                      className="py-3 font-[family-name:var(--font-body)] text-[13px] italic text-[color:var(--color-neutral-500)]"
                      style={{ borderBottom: "1px solid rgba(253,245,230,0.03)" }}
                    >
                      Unblock via Company profile
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function EmailsTab({ emails }: { emails: DncEmail[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [singleInput, setSingleInput] = useState("");
  const [bulkInput, setBulkInput] = useState("");
  const [feedback, setFeedback] = useState<BulkAddResult | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  function handleSingleAdd() {
    const email = singleInput.trim();
    if (!email) return;
    startTransition(async () => {
      const result = await addDncEmails([email]);
      setFeedback(result);
      if (result.added > 0) setSingleInput("");
      router.refresh();
    });
  }

  function handleBulkAdd() {
    const list = bulkInput
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    if (list.length === 0) return;
    startTransition(async () => {
      const result = await addDncEmails(list);
      setFeedback(result);
      if (result.added > 0) setBulkInput("");
      router.refresh();
    });
  }

  function handleRemove(id: string) {
    setRemovingId(id);
    startTransition(async () => {
      await removeDncEmailById(id);
      setRemovingId(null);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <div
        className="font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-neutral-500)]"
        style={{ letterSpacing: "2px" }}
      >
        {emails.length} blocked {emails.length === 1 ? "email" : "emails"}
      </div>

      {/* Add controls */}
      <div className="flex flex-col gap-4">
        <div className="flex gap-3">
          <input
            type="email"
            value={singleInput}
            onChange={(e) => setSingleInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSingleAdd()}
            placeholder="email@domain.com"
            className="flex-1 rounded-lg px-3 py-2.5 font-[family-name:var(--font-body)] text-[14px] text-[color:var(--color-brand-cream)] placeholder:text-[color:var(--color-neutral-600)] outline-none transition-all duration-[180ms]"
            style={{
              background: "rgba(15, 15, 14, 0.5)",
              border: "1px solid rgba(253,245,230,0.08)",
            }}
            disabled={isPending}
          />
          <button
            onClick={handleSingleAdd}
            disabled={isPending || !singleInput.trim()}
            className="rounded-lg px-4 py-2.5 font-[family-name:var(--font-label)] text-[11px] uppercase text-[color:var(--color-brand-cream)] transition-all duration-[180ms] hover:-translate-y-px disabled:opacity-40"
            style={{
              letterSpacing: "2px",
              background: "var(--color-surface-2)",
              boxShadow: "var(--surface-highlight)",
            }}
          >
            Add
          </button>
        </div>

        <div className="flex gap-3">
          <textarea
            value={bulkInput}
            onChange={(e) => setBulkInput(e.target.value)}
            placeholder={"Paste emails, one per line\nexample@domain.com\nanother@domain.com"}
            rows={4}
            className="flex-1 resize-none rounded-lg px-3 py-2.5 font-[family-name:var(--font-body)] text-[13px] leading-[1.6] text-[color:var(--color-brand-cream)] placeholder:text-[color:var(--color-neutral-600)] outline-none transition-all duration-[180ms]"
            style={{
              background: "rgba(15, 15, 14, 0.5)",
              border: "1px solid rgba(253,245,230,0.08)",
            }}
            disabled={isPending}
          />
          <div className="flex flex-col justify-end">
            <button
              onClick={handleBulkAdd}
              disabled={isPending || !bulkInput.trim()}
              className="rounded-lg px-4 py-2.5 font-[family-name:var(--font-label)] text-[11px] uppercase text-[color:var(--color-brand-cream)] transition-all duration-[180ms] hover:-translate-y-px disabled:opacity-40"
              style={{
                letterSpacing: "2px",
                background: "var(--color-surface-2)",
                boxShadow: "var(--surface-highlight)",
              }}
            >
              Add all
            </button>
          </div>
        </div>
      </div>

      {/* Feedback */}
      <AnimatePresence>
        {feedback && (
          <FeedbackBar result={feedback} onDismiss={() => setFeedback(null)} />
        )}
      </AnimatePresence>

      {/* List */}
      <AnimatePresence mode="wait" initial={false}>
        {emails.length === 0 ? (
          <motion.div
            key="empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={houseSpring}
            className="rounded-xl px-8 py-10"
            style={{
              border: "1px dashed rgba(253, 245, 230, 0.07)",
              background: "rgba(15, 15, 14, 0.3)",
            }}
          >
            <div
              className="font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-brand-orange)]"
              style={{ letterSpacing: "2px" }}
            >
              Emails · all clear
            </div>
            <h4 className="mt-2 font-[family-name:var(--font-display)] text-[26px] leading-[1.1] text-[color:var(--color-brand-cream)]">
              No blocked emails.
            </h4>
            <p className="mt-2 max-w-[440px] font-[family-name:var(--font-body)] text-[14px] leading-[1.55] text-[color:var(--color-neutral-400)]">
              Add an address above to stop it appearing in lead runs.
            </p>
            <p className="mt-3 font-[family-name:var(--font-narrative)] text-[12px] italic text-[color:var(--color-brand-pink)]">
              unsubscribe links auto-populate this list too.
            </p>
          </motion.div>
        ) : (
          <motion.div
            key="list"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={houseSpring}
          >
            <table className="w-full text-left">
              <thead>
                <tr>
                  <th
                    className="pb-3 font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-neutral-500)]"
                    style={{
                      letterSpacing: "2px",
                      borderBottom: "1px solid rgba(253,245,230,0.05)",
                    }}
                  >
                    Email
                  </th>
                  <th
                    className="pb-3 font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-neutral-500)]"
                    style={{
                      letterSpacing: "2px",
                      borderBottom: "1px solid rgba(253,245,230,0.05)",
                    }}
                  >
                    Source
                  </th>
                  <th
                    className="pb-3 font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-neutral-500)]"
                    style={{
                      letterSpacing: "2px",
                      borderBottom: "1px solid rgba(253,245,230,0.05)",
                    }}
                  >
                    Added
                  </th>
                  <th
                    className="pb-3"
                    style={{ borderBottom: "1px solid rgba(253,245,230,0.05)" }}
                  />
                </tr>
              </thead>
              <tbody>
                {emails.map((e) => (
                  <tr
                    key={e.id}
                    className="transition-colors duration-[160ms] ease-[cubic-bezier(0.16,1,0.3,1)] hover:bg-[rgba(253,245,230,0.025)]"
                  >
                    <td
                      className="py-3 pr-4 font-[family-name:var(--font-body)] text-[14px] font-medium text-[color:var(--color-brand-cream)]"
                      style={{ borderBottom: "1px solid rgba(253,245,230,0.03)" }}
                    >
                      {e.email}
                    </td>
                    <td
                      className="py-3 pr-4"
                      style={{ borderBottom: "1px solid rgba(253,245,230,0.03)" }}
                    >
                      <SourceChip source={e.source} />
                    </td>
                    <td
                      className="py-3 pr-4 font-[family-name:var(--font-body)] text-[13px] italic text-[color:var(--color-neutral-500)]"
                      style={{ borderBottom: "1px solid rgba(253,245,230,0.03)" }}
                    >
                      {relativeTime(e.added_at_ms)}
                    </td>
                    <td
                      className="py-3 text-right"
                      style={{ borderBottom: "1px solid rgba(253,245,230,0.03)" }}
                    >
                      <button
                        onClick={() => handleRemove(e.id)}
                        disabled={isPending && removingId === e.id}
                        className="font-[family-name:var(--font-label)] text-[11px] uppercase text-[color:var(--color-neutral-500)] transition-colors duration-[160ms] hover:text-[color:var(--color-brand-pink)] disabled:opacity-40"
                        style={{ letterSpacing: "1.5px" }}
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function DomainsTab({ domains }: { domains: DncDomain[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [singleInput, setSingleInput] = useState("");
  const [bulkInput, setBulkInput] = useState("");
  const [feedback, setFeedback] = useState<BulkAddResult | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  function handleSingleAdd() {
    const domain = singleInput.trim();
    if (!domain) return;
    startTransition(async () => {
      const result = await addDncDomains([domain]);
      setFeedback(result);
      if (result.added > 0) setSingleInput("");
      router.refresh();
    });
  }

  function handleBulkAdd() {
    const list = bulkInput
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    if (list.length === 0) return;
    startTransition(async () => {
      const result = await addDncDomains(list);
      setFeedback(result);
      if (result.added > 0) setBulkInput("");
      router.refresh();
    });
  }

  function handleRemove(id: string) {
    setRemovingId(id);
    startTransition(async () => {
      await removeDncDomainById(id);
      setRemovingId(null);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <div
        className="font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-neutral-500)]"
        style={{ letterSpacing: "2px" }}
      >
        {domains.length} blocked {domains.length === 1 ? "domain" : "domains"}
      </div>

      {/* Add controls */}
      <div className="flex flex-col gap-4">
        <div className="flex gap-3">
          <input
            type="text"
            value={singleInput}
            onChange={(e) => setSingleInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSingleAdd()}
            placeholder="competitor.com"
            className="flex-1 rounded-lg px-3 py-2.5 font-[family-name:var(--font-body)] text-[14px] text-[color:var(--color-brand-cream)] placeholder:text-[color:var(--color-neutral-600)] outline-none transition-all duration-[180ms]"
            style={{
              background: "rgba(15, 15, 14, 0.5)",
              border: "1px solid rgba(253,245,230,0.08)",
            }}
            disabled={isPending}
          />
          <button
            onClick={handleSingleAdd}
            disabled={isPending || !singleInput.trim()}
            className="rounded-lg px-4 py-2.5 font-[family-name:var(--font-label)] text-[11px] uppercase text-[color:var(--color-brand-cream)] transition-all duration-[180ms] hover:-translate-y-px disabled:opacity-40"
            style={{
              letterSpacing: "2px",
              background: "var(--color-surface-2)",
              boxShadow: "var(--surface-highlight)",
            }}
          >
            Add
          </button>
        </div>

        <div className="flex gap-3">
          <textarea
            value={bulkInput}
            onChange={(e) => setBulkInput(e.target.value)}
            placeholder={"Paste domains, one per line\ncompetitor.com\nanother.com"}
            rows={4}
            className="flex-1 resize-none rounded-lg px-3 py-2.5 font-[family-name:var(--font-body)] text-[13px] leading-[1.6] text-[color:var(--color-brand-cream)] placeholder:text-[color:var(--color-neutral-600)] outline-none transition-all duration-[180ms]"
            style={{
              background: "rgba(15, 15, 14, 0.5)",
              border: "1px solid rgba(253,245,230,0.08)",
            }}
            disabled={isPending}
          />
          <div className="flex flex-col justify-end">
            <button
              onClick={handleBulkAdd}
              disabled={isPending || !bulkInput.trim()}
              className="rounded-lg px-4 py-2.5 font-[family-name:var(--font-label)] text-[11px] uppercase text-[color:var(--color-brand-cream)] transition-all duration-[180ms] hover:-translate-y-px disabled:opacity-40"
              style={{
                letterSpacing: "2px",
                background: "var(--color-surface-2)",
                boxShadow: "var(--surface-highlight)",
              }}
            >
              Add all
            </button>
          </div>
        </div>
      </div>

      {/* Feedback */}
      <AnimatePresence>
        {feedback && (
          <FeedbackBar result={feedback} onDismiss={() => setFeedback(null)} />
        )}
      </AnimatePresence>

      {/* List */}
      <AnimatePresence mode="wait" initial={false}>
        {domains.length === 0 ? (
          <motion.div
            key="empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={houseSpring}
            className="rounded-xl px-8 py-10"
            style={{
              border: "1px dashed rgba(253, 245, 230, 0.07)",
              background: "rgba(15, 15, 14, 0.3)",
            }}
          >
            <div
              className="font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-brand-orange)]"
              style={{ letterSpacing: "2px" }}
            >
              Domains · all clear
            </div>
            <h4 className="mt-2 font-[family-name:var(--font-display)] text-[26px] leading-[1.1] text-[color:var(--color-brand-cream)]">
              No blocked domains.
            </h4>
            <p className="mt-2 max-w-[440px] font-[family-name:var(--font-body)] text-[14px] leading-[1.55] text-[color:var(--color-neutral-400)]">
              Block an entire domain to stop all leads from that company.
            </p>
            <p className="mt-3 font-[family-name:var(--font-narrative)] text-[12px] italic text-[color:var(--color-brand-pink)]">
              one domain, many emails — good for ex-clients.
            </p>
          </motion.div>
        ) : (
          <motion.div
            key="list"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={houseSpring}
          >
            <table className="w-full text-left">
              <thead>
                <tr>
                  <th
                    className="pb-3 font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-neutral-500)]"
                    style={{
                      letterSpacing: "2px",
                      borderBottom: "1px solid rgba(253,245,230,0.05)",
                    }}
                  >
                    Domain
                  </th>
                  <th
                    className="pb-3 font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-neutral-500)]"
                    style={{
                      letterSpacing: "2px",
                      borderBottom: "1px solid rgba(253,245,230,0.05)",
                    }}
                  >
                    Added
                  </th>
                  <th
                    className="pb-3"
                    style={{ borderBottom: "1px solid rgba(253,245,230,0.05)" }}
                  />
                </tr>
              </thead>
              <tbody>
                {domains.map((d) => (
                  <tr
                    key={d.id}
                    className="transition-colors duration-[160ms] ease-[cubic-bezier(0.16,1,0.3,1)] hover:bg-[rgba(253,245,230,0.025)]"
                  >
                    <td
                      className="py-3 pr-4 font-[family-name:var(--font-body)] text-[14px] font-medium text-[color:var(--color-brand-cream)]"
                      style={{ borderBottom: "1px solid rgba(253,245,230,0.03)" }}
                    >
                      {d.domain}
                    </td>
                    <td
                      className="py-3 pr-4 font-[family-name:var(--font-body)] text-[13px] italic text-[color:var(--color-neutral-500)]"
                      style={{ borderBottom: "1px solid rgba(253,245,230,0.03)" }}
                    >
                      {relativeTime(d.added_at_ms)}
                    </td>
                    <td
                      className="py-3 text-right"
                      style={{ borderBottom: "1px solid rgba(253,245,230,0.03)" }}
                    >
                      <button
                        onClick={() => handleRemove(d.id)}
                        disabled={isPending && removingId === d.id}
                        className="font-[family-name:var(--font-label)] text-[11px] uppercase text-[color:var(--color-neutral-500)] transition-colors duration-[160ms] hover:text-[color:var(--color-brand-pink)] disabled:opacity-40"
                        style={{ letterSpacing: "1.5px" }}
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function DncTabs({
  companies,
  emails,
  domains,
}: {
  companies: DncCompany[];
  emails: DncEmail[];
  domains: DncDomain[];
}) {
  const [activeTab, setActiveTab] = useState<Tab>("companies");

  return (
    <div className="flex flex-col gap-6">
      {/* Tab bar */}
      <div
        role="tablist"
        aria-label="DNC sections"
        className="inline-flex items-center gap-1 self-start rounded-[10px] p-1"
        style={{
          background: "rgba(15, 15, 14, 0.45)",
          boxShadow: "var(--surface-highlight)",
        }}
      >
        {TABS.map((t) => {
          const active = t.id === activeTab;
          return (
            <button
              key={t.id}
              role="tab"
              aria-selected={active}
              onClick={() => setActiveTab(t.id)}
              className="relative rounded-md px-3 py-1.5 font-[family-name:var(--font-label)] text-[10px] uppercase leading-none transition-colors duration-[180ms] ease-[cubic-bezier(0.16,1,0.3,1)]"
              style={{
                letterSpacing: "1.5px",
                color: active
                  ? "var(--color-brand-cream)"
                  : "var(--color-neutral-500)",
              }}
            >
              {active && (
                <motion.span
                  layoutId="dnc-tab-active"
                  className="absolute inset-0 rounded-md"
                  style={{
                    background: "var(--color-surface-2)",
                    boxShadow: "var(--surface-highlight)",
                  }}
                  transition={houseSpring}
                />
              )}
              <span className="relative">{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab panel */}
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={houseSpring}
        >
          {activeTab === "companies" && (
            <CompaniesTab companies={companies} />
          )}
          {activeTab === "emails" && <EmailsTab emails={emails} />}
          {activeTab === "domains" && <DomainsTab domains={domains} />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
