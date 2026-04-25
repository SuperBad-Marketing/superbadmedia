"use client";

import React, { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  addInspirationLink,
  listInspirationLibrary,
  deleteInspirationRef,
} from "@/lib/content-studio/inspiration";
import type { InspirationLibraryRow } from "@/lib/db/schema/inspiration-library";

interface InspirationRef {
  id: string;
  source_type: "link" | "upload";
  source_url: string;
  thumbnail_url: string | null;
  title: string | null;
  description: string | null;
}

interface InspirationPanelProps {
  attached: InspirationRef[];
  onAttach: (ref: InspirationRef) => void;
  onDetach: (id: string) => void;
  maxRefs?: number;
}

export function InspirationPanel({
  attached,
  onAttach,
  onDetach,
  maxRefs = 5,
}: InspirationPanelProps) {
  const [expanded, setExpanded] = useState(false);
  const [linkInput, setLinkInput] = useState("");
  const [adding, setAdding] = useState(false);
  const [showLibrary, setShowLibrary] = useState(false);
  const [library, setLibrary] = useState<InspirationLibraryRow[]>([]);
  const [loadingLibrary, setLoadingLibrary] = useState(false);

  const loadLibrary = useCallback(async () => {
    setLoadingLibrary(true);
    const result = await listInspirationLibrary();
    if (result.ok) {
      setLibrary(result.items);
    }
    setLoadingLibrary(false);
  }, []);

  useEffect(() => {
    if (showLibrary && library.length === 0) {
      loadLibrary();
    }
  }, [showLibrary, library.length, loadLibrary]);

  const handleAddLink = useCallback(async () => {
    if (!linkInput.trim()) return;
    if (attached.length >= maxRefs) {
      toast.error(`Maximum ${maxRefs} references.`);
      return;
    }

    setAdding(true);
    const result = await addInspirationLink(linkInput.trim());
    setAdding(false);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }

    onAttach(result.ref);
    setLinkInput("");
    toast.success("Reference added.");
  }, [linkInput, attached.length, maxRefs, onAttach]);

  const handleLibrarySelect = useCallback(
    (item: InspirationLibraryRow) => {
      if (attached.length >= maxRefs) {
        toast.error(`Maximum ${maxRefs} references.`);
        return;
      }
      if (attached.some((a) => a.id === item.id)) {
        toast.error("Already attached.");
        return;
      }
      onAttach({
        id: item.id,
        source_type: item.source_type as "link" | "upload",
        source_url: item.source_url,
        thumbnail_url: item.thumbnail_url,
        title: item.title,
        description: item.description,
      });
      setShowLibrary(false);
    },
    [attached, maxRefs, onAttach],
  );

  const handleDeleteFromLibrary = useCallback(
    async (id: string) => {
      await deleteInspirationRef(id);
      setLibrary((prev) => prev.filter((item) => item.id !== id));
      onDetach(id);
      toast.success("Removed.");
    },
    [onDetach],
  );

  return (
    <div>
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 font-[family-name:var(--font-label)] text-[10px] uppercase"
        style={{
          letterSpacing: "1.5px",
          color: "var(--color-neutral-500)",
          background: "none",
          border: "none",
          cursor: "pointer",
          padding: 0,
        }}
      >
        <span style={{ transform: expanded ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.15s", display: "inline-block" }}>
          ▶
        </span>
        Inspiration{attached.length > 0 ? ` (${attached.length})` : ""}
      </button>

      {expanded && (
        <div style={{ marginTop: 8 }}>
          {/* Attached references */}
          {attached.length > 0 && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
              {attached.map((ref) => (
                <div
                  key={ref.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "6px 10px",
                    borderRadius: 8,
                    background: "rgba(253,245,230,0.04)",
                    border: "1px solid rgba(253,245,230,0.08)",
                    maxWidth: 280,
                  }}
                >
                  {ref.thumbnail_url && (
                    <img
                      src={ref.thumbnail_url}
                      alt=""
                      style={{ width: 32, height: 32, borderRadius: 4, objectFit: "cover" }}
                    />
                  )}
                  <span
                    style={{
                      fontFamily: "var(--font-body)",
                      fontSize: 12,
                      color: "var(--color-brand-cream)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      flex: 1,
                    }}
                  >
                    {ref.title || ref.source_url}
                  </span>
                  <button
                    type="button"
                    onClick={() => onDetach(ref.id)}
                    style={{
                      background: "none",
                      border: "none",
                      color: "var(--color-neutral-500)",
                      cursor: "pointer",
                      fontSize: 14,
                      padding: 0,
                      lineHeight: 1,
                    }}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Paste link */}
          <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
            <input
              type="text"
              value={linkInput}
              onChange={(e) => setLinkInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddLink()}
              placeholder="Paste Instagram or any URL…"
              style={{
                flex: 1,
                padding: "6px 10px",
                borderRadius: 6,
                border: "1px solid rgba(253,245,230,0.1)",
                background: "rgba(253,245,230,0.03)",
                color: "var(--color-brand-cream)",
                fontFamily: "var(--font-body)",
                fontSize: 13,
                outline: "none",
              }}
            />
            <button
              type="button"
              onClick={handleAddLink}
              disabled={adding || !linkInput.trim()}
              style={{
                padding: "6px 14px",
                borderRadius: 6,
                border: "none",
                background: "var(--color-brand-red)",
                color: "var(--color-brand-cream)",
                fontFamily: "var(--font-label)",
                fontSize: 11,
                letterSpacing: 1,
                cursor: "pointer",
                opacity: adding || !linkInput.trim() ? 0.5 : 1,
              }}
            >
              {adding ? "…" : "Add"}
            </button>
          </div>

          {/* From library button */}
          <button
            type="button"
            onClick={() => setShowLibrary(!showLibrary)}
            style={{
              background: "none",
              border: "none",
              color: "var(--color-brand-pink)",
              fontFamily: "var(--font-body)",
              fontSize: 12,
              cursor: "pointer",
              padding: 0,
              textDecoration: "underline",
              textUnderlineOffset: 3,
            }}
          >
            {showLibrary ? "Hide library" : "From library"}
          </button>

          {/* Library browser */}
          {showLibrary && (
            <div
              style={{
                marginTop: 8,
                maxHeight: 200,
                overflow: "auto",
                borderRadius: 8,
                border: "1px solid rgba(253,245,230,0.08)",
                background: "rgba(253,245,230,0.02)",
              }}
            >
              {loadingLibrary ? (
                <div
                  style={{
                    padding: 16,
                    textAlign: "center",
                    fontFamily: "var(--font-body)",
                    fontSize: 12,
                    color: "var(--color-neutral-500)",
                  }}
                >
                  Loading…
                </div>
              ) : library.length === 0 ? (
                <div
                  style={{
                    padding: 16,
                    textAlign: "center",
                    fontFamily: "var(--font-body)",
                    fontSize: 12,
                    color: "var(--color-neutral-500)",
                  }}
                >
                  Library is empty. Add links above to save them.
                </div>
              ) : (
                library.map((item) => (
                  <div
                    key={item.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "8px 12px",
                      borderBottom: "1px solid rgba(253,245,230,0.04)",
                      cursor: "pointer",
                    }}
                    onClick={() => handleLibrarySelect(item)}
                  >
                    {item.thumbnail_url && (
                      <img
                        src={item.thumbnail_url}
                        alt=""
                        style={{ width: 28, height: 28, borderRadius: 4, objectFit: "cover" }}
                      />
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontFamily: "var(--font-body)",
                          fontSize: 12,
                          color: "var(--color-brand-cream)",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {item.title || item.source_url}
                      </div>
                      {item.description && (
                        <div
                          style={{
                            fontFamily: "var(--font-body)",
                            fontSize: 11,
                            color: "var(--color-neutral-500)",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {item.description}
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteFromLibrary(item.id);
                      }}
                      style={{
                        background: "none",
                        border: "none",
                        color: "var(--color-neutral-500)",
                        cursor: "pointer",
                        fontSize: 12,
                        padding: "2px 4px",
                      }}
                    >
                      ×
                    </button>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
