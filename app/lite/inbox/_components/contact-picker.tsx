"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";

export type ContactSuggestion = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  companyId: string | null;
  companyName: string | null;
};

/**
 * Contact picker for the compose modal. SQLite LIKE search on
 * `contacts.name` + `contacts.email` (first 20 results, good-enough
 * for v1, brief §12.11). Arrow keys + Enter; typing a string not in
 * the list surfaces a "Use [typed]" fallback.
 *
 * The search function is injected so tests can stub it and the
 * compose modal stays thin.
 */
export function ContactPicker({
  onPick,
  search,
  initialQuery = "",
  mode = "email",
}: {
  onPick: (picked: {
    contactId: string | null;
    companyId: string | null;
    email: string;
    phone: string | null;
    name: string | null;
  }) => void;
  search: (q: string) => Promise<ContactSuggestion[]>;
  initialQuery?: string;
  mode?: "email" | "sms";
}) {
  const [query, setQuery] = React.useState(initialQuery);
  const [results, setResults] = React.useState<ContactSuggestion[]>([]);
  const [focused, setFocused] = React.useState(false);
  const [highlight, setHighlight] = React.useState(0);

  React.useEffect(() => {
    let cancelled = false;
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    search(query).then((rows) => {
      if (!cancelled) setResults(rows);
    });
    return () => {
      cancelled = true;
    };
  }, [query, search]);

  const fallbackEmail = mode === "email" && query.includes("@") ? query.trim() : null;
  const filteredResults = mode === "sms"
    ? results.filter((r) => r.phone)
    : results;

  function commit(index: number) {
    if (index < filteredResults.length) {
      const hit = filteredResults[index];
      onPick({
        contactId: hit.id,
        companyId: hit.companyId,
        email: hit.email ?? "",
        phone: hit.phone,
        name: hit.name,
      });
    } else if (fallbackEmail) {
      onPick({ contactId: null, companyId: null, email: fallbackEmail, phone: null, name: null });
    }
    setQuery("");
    setResults([]);
    setFocused(false);
  }

  function handleKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, filteredResults.length));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      commit(highlight);
    }
  }

  return (
    <div className="relative">
      <input
        type="text"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setHighlight(0);
        }}
        onFocus={() => setFocused(true)}
        onBlur={() => setTimeout(() => setFocused(false), 150)}
        onKeyDown={handleKey}
        placeholder={mode === "sms" ? "To: name or phone…" : "To: name or email…"}
        className={cn(
          "w-full rounded-sm border border-[color:var(--color-neutral-700)] bg-[color:var(--color-background)] px-3 py-2",
          "font-[family-name:var(--font-dm-sans)] text-[length:var(--text-body)] text-[color:var(--color-neutral-100)]",
          "outline-none focus-visible:border-[color:var(--color-accent-cta)]",
        )}
      />
      <AnimatePresence>
        {focused && (filteredResults.length > 0 || fallbackEmail) && (
          <motion.ul
            role="listbox"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className={cn(
              "absolute left-0 right-0 top-full z-10 mt-1 max-h-60 overflow-y-auto",
              "rounded-sm border border-[color:var(--color-neutral-700)] bg-[color:var(--color-surface-1)] py-1 shadow-lg",
            )}
          >
            {filteredResults.map((r, idx) => (
              <li
                key={r.id}
                role="option"
                aria-selected={idx === highlight}
                onMouseDown={(e) => {
                  e.preventDefault();
                  commit(idx);
                }}
                className={cn(
                  "cursor-pointer px-3 py-1.5 font-[family-name:var(--font-dm-sans)] text-[length:var(--text-small)]",
                  idx === highlight
                    ? "bg-[color:var(--color-surface-2)] text-[color:var(--color-neutral-100)]"
                    : "text-[color:var(--color-neutral-300)]",
                )}
              >
                <span className="block">{r.name}</span>
                <span className="block text-[length:var(--text-micro)] text-[color:var(--color-neutral-500)]">
                  {mode === "sms"
                    ? `${r.phone ?? "no phone"} · ${r.companyName ?? "-"}`
                    : `${r.email ?? "no email on record"} · ${r.companyName ?? "-"}`}
                </span>
              </li>
            ))}
            {fallbackEmail && (
              <li
                role="option"
                aria-selected={highlight === filteredResults.length}
                onMouseDown={(e) => {
                  e.preventDefault();
                  commit(filteredResults.length);
                }}
                className={cn(
                  "cursor-pointer border-t border-[color:var(--color-neutral-700)] px-3 py-1.5 font-[family-name:var(--font-dm-sans)] text-[length:var(--text-small)]",
                  highlight === filteredResults.length
                    ? "bg-[color:var(--color-surface-2)] text-[color:var(--color-neutral-100)]"
                    : "text-[color:var(--color-neutral-300)]",
                )}
              >
                Use <strong>{fallbackEmail}</strong> as new recipient
              </li>
            )}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}
