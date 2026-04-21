"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Building2,
  FileText,
  Search,
  User,
  Briefcase,
  FileCheck,
  Sparkles,
} from "lucide-react";

export interface GlobalSearchResult {
  id: string;
  type: "company" | "contact" | "deal" | "invoice" | "quote" | "riddle";
  label: string;
  sublabel: string | null;
}

const TYPE_ICONS: Record<GlobalSearchResult["type"], typeof Building2> = {
  company: Building2,
  contact: User,
  deal: Briefcase,
  invoice: FileText,
  quote: FileCheck,
  riddle: Sparkles,
};

const TYPE_LABELS: Record<GlobalSearchResult["type"], string> = {
  company: "Companies",
  contact: "People",
  deal: "Deals",
  invoice: "Invoices",
  quote: "Quotes",
  riddle: "???",
};

const TYPE_ROUTES: Record<GlobalSearchResult["type"], (id: string) => string> =
  {
    company: (id) => `/lite/admin/companies/${id}`,
    contact: (id) => `/lite/admin/contacts/${id}`,
    deal: (id) => `/lite/admin/pipeline?deal=${id}`,
    invoice: (id) => `/lite/admin/invoices?invoice=${id}`,
    quote: (id) => `/lite/quotes/${id}`,
    riddle: (answer) => `/say/${encodeURIComponent(answer)}`,
  };

export function GlobalSearchTrigger() {
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen(true);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Search everything"
        className="flex w-full items-center gap-3 rounded-sm px-4 py-2 font-[family-name:var(--font-dm-sans)] text-[color:var(--color-neutral-500)] transition-colors hover:bg-[color:var(--color-surface-2)] hover:text-[color:var(--color-neutral-300)]"
      >
        <Search size={20} strokeWidth={1.5} aria-hidden className="shrink-0" />
        <span className="flex-1 text-left text-[length:var(--text-body)]">
          Search
        </span>
        <kbd
          className="font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-neutral-600)]"
          style={{ letterSpacing: "1px" }}
        >
          ⌘K
        </kbd>
      </button>

      {open && <GlobalSearchModal onClose={() => setOpen(false)} />}
    </>
  );
}

function GlobalSearchModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<GlobalSearchResult[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [selectedIndex, setSelectedIndex] = React.useState(0);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    inputRef.current?.focus();
  }, []);

  React.useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/lite/search?q=${encodeURIComponent(query.trim())}`,
        );
        if (res.ok) {
          const data = await res.json();
          setResults(data.results ?? []);
        }
      } catch {
        // silently fail — search is non-critical
      } finally {
        setLoading(false);
      }
    }, 200);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  React.useEffect(() => {
    setSelectedIndex(0);
  }, [results]);

  function navigate(result: GlobalSearchResult) {
    const route = TYPE_ROUTES[result.type](result.id);
    router.push(route);
    onClose();
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && results.length > 0) {
      e.preventDefault();
      navigate(results[selectedIndex]);
    }
  }

  // Group results by type
  const grouped = React.useMemo(() => {
    const map = new Map<GlobalSearchResult["type"], GlobalSearchResult[]>();
    for (const r of results) {
      const list = map.get(r.type) ?? [];
      list.push(r);
      map.set(r.type, list);
    }
    return map;
  }, [results]);

  let flatIndex = 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onKeyDown={onKeyDown}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0"
        style={{ background: "rgba(15, 15, 14, 0.75)" }}
        aria-hidden
      />

      {/* Modal */}
      <div
        className="relative w-full max-w-[560px] overflow-hidden rounded-[12px]"
        style={{
          background: "var(--color-surface-1, #22221F)",
          border: "1px solid rgba(253, 245, 230, 0.08)",
          boxShadow:
            "0 24px 64px rgba(0,0,0,0.5), 0 0 0 1px rgba(253,245,230,0.03)",
        }}
        role="dialog"
        aria-modal="true"
        aria-label="Search"
      >
        {/* Input */}
        <div
          className="flex items-center gap-3 px-4"
          style={{
            borderBottom: "1px solid rgba(253, 245, 230, 0.05)",
          }}
        >
          <Search
            size={18}
            strokeWidth={1.5}
            className="shrink-0 text-[color:var(--color-neutral-500)]"
            aria-hidden
          />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search clients, invoices, quotes..."
            className="h-12 flex-1 bg-transparent font-[family-name:var(--font-body)] text-[15px] text-[color:var(--color-brand-cream)] placeholder:text-[color:var(--color-neutral-500)] focus:outline-none"
          />
          <kbd
            className="font-[family-name:var(--font-label)] text-[10px] text-[color:var(--color-neutral-600)]"
            style={{ letterSpacing: "1px" }}
          >
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div className="max-h-[360px] overflow-y-auto">
          {!query.trim() && (
            <div className="px-4 py-8 text-center font-[family-name:var(--font-body)] text-[13px] italic text-[color:var(--color-neutral-500)]">
              Start typing to search across everything.
            </div>
          )}

          {query.trim() && !loading && results.length === 0 && (
            <div className="px-4 py-8 text-center font-[family-name:var(--font-body)] text-[13px] italic text-[color:var(--color-neutral-500)]">
              Nothing found for &quot;{query}&quot;.
            </div>
          )}

          {query.trim() && loading && results.length === 0 && (
            <div className="px-4 py-8 text-center font-[family-name:var(--font-body)] text-[13px] text-[color:var(--color-neutral-500)]">
              Searching...
            </div>
          )}

          {results.length > 0 && (
            <div className="py-2">
              {(
                [
                  "riddle",
                  "company",
                  "contact",
                  "deal",
                  "invoice",
                  "quote",
                ] as const
              ).map((type) => {
                const items = grouped.get(type);
                if (!items || items.length === 0) return null;
                const Icon = TYPE_ICONS[type];
                return (
                  <div key={type}>
                    <div
                      className="px-4 py-1.5 font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-neutral-500)]"
                      style={{ letterSpacing: "1.5px" }}
                    >
                      {TYPE_LABELS[type]}
                    </div>
                    {items.map((r) => {
                      const thisIndex = flatIndex++;
                      const isSelected = thisIndex === selectedIndex;
                      return (
                        <button
                          key={r.id}
                          type="button"
                          onClick={() => navigate(r)}
                          onMouseEnter={() => setSelectedIndex(thisIndex)}
                          data-testid={`search-result-${r.type}-${r.id}`}
                          className="flex w-full items-center gap-3 px-4 py-2 text-left transition-colors"
                          style={{
                            background: isSelected
                              ? "var(--color-surface-2)"
                              : "transparent",
                          }}
                        >
                          <Icon
                            size={16}
                            strokeWidth={1.5}
                            className="shrink-0 text-[color:var(--color-neutral-500)]"
                            aria-hidden
                          />
                          <span className="flex-1 truncate">
                            <span className="font-[family-name:var(--font-body)] text-[14px] text-[color:var(--color-brand-cream)]">
                              {r.label}
                            </span>
                            {r.sublabel && (
                              <span className="ml-2 font-[family-name:var(--font-body)] text-[12px] text-[color:var(--color-neutral-500)]">
                                {r.sublabel}
                              </span>
                            )}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
