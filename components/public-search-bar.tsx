"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Search } from "lucide-react";

const houseSpring = { type: "spring" as const, stiffness: 300, damping: 30 };

export function PublicSearchBar() {
  const router = useRouter();
  const [query, setQuery] = React.useState("");
  const [hint, setHint] = React.useState<string | null>(null);
  const [checking, setChecking] = React.useState(false);
  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (!query.trim() || query.trim().length < 2) {
      setHint(null);
      setChecking(false);
      return;
    }

    setChecking(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/riddle-check?q=${encodeURIComponent(query.trim())}`,
        );
        if (res.ok) {
          const data = await res.json();
          if (data.match) {
            setHint(
              data.outcome === "correct" ? "you found something." : "not quite.",
            );
          } else {
            setHint(null);
          }
        }
      } catch {
        // non-critical
      } finally {
        setChecking(false);
      }
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    router.push(`/say/${encodeURIComponent(q)}`);
  }

  return (
    <form onSubmit={onSubmit} className="relative w-full max-w-[320px]">
      <div
        className="flex items-center gap-2 rounded-full px-4 py-2"
        style={{
          background: "rgba(253, 245, 230, 0.04)",
          border: "1px solid rgba(253, 245, 230, 0.08)",
        }}
      >
        <Search
          size={14}
          strokeWidth={1.5}
          className="shrink-0"
          style={{ color: "var(--neutral-500)" }}
          aria-hidden
        />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="say something"
          aria-label="Search"
          className="flex-1 bg-transparent text-[13px] placeholder:italic focus:outline-none"
          style={{
            fontFamily: "var(--font-body)",
            color: "var(--neutral-200)",
            caretColor: "var(--brand-pink)",
          }}
        />
      </div>

      <AnimatePresence>
        {hint && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={houseSpring}
            className="absolute left-0 right-0 top-full mt-2 rounded-lg px-4 py-2.5"
            style={{
              background: "var(--neutral-900, #0F0F0E)",
              border: "1px solid rgba(253, 245, 230, 0.08)",
              boxShadow: "0 8px 32px rgba(0, 0, 0, 0.4)",
            }}
          >
            <button
              type="submit"
              className="flex w-full items-center gap-2 text-left"
            >
              <span
                className="text-[13px] italic"
                style={{
                  fontFamily: "var(--font-narrative)",
                  color: "var(--brand-pink)",
                }}
              >
                {hint}
              </span>
              <span
                className="ml-auto text-[10px] uppercase"
                style={{
                  fontFamily: "var(--font-label)",
                  letterSpacing: "0.2em",
                  color: "var(--neutral-500)",
                }}
              >
                enter
              </span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </form>
  );
}
