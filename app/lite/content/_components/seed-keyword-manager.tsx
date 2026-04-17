"use client";

/**
 * Seed keyword manager for the Topics tab (CE-10).
 *
 * Spec: docs/specs/content-engine.md §2.1 Stage 2.
 * Allows adding/removing seed keywords that feed the weekly
 * research pipeline.
 */
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  addSeedKeywordAction,
  removeSeedKeywordAction,
} from "../actions";

interface SeedKeywordManagerProps {
  companyId: string;
  initialKeywords: string[];
}

export function SeedKeywordManager({
  companyId,
  initialKeywords,
}: SeedKeywordManagerProps) {
  const [keywords, setKeywords] = useState<string[]>(initialKeywords);
  const [input, setInput] = useState("");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAdd() {
    const trimmed = input.trim();
    if (!trimmed) return;

    setAdding(true);
    setError(null);

    const result = await addSeedKeywordAction(companyId, trimmed);
    if (result.ok) {
      setKeywords((prev) => [...prev, trimmed.toLowerCase()]);
      setInput("");
    } else {
      setError(
        result.error === "already_exists"
          ? "That keyword already exists."
          : "Could not add keyword.",
      );
    }
    setAdding(false);
  }

  async function handleRemove(keyword: string) {
    const result = await removeSeedKeywordAction(companyId, keyword);
    if (result.ok) {
      setKeywords((prev) =>
        prev.filter((k) => k.toLowerCase() !== keyword.toLowerCase()),
      );
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAdd();
    }
  }

  return (
    <div>
      <div className="flex items-center gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="e.g. melbourne photography marketing"
          className="max-w-sm"
          disabled={adding}
        />
        <Button
          size="sm"
          onClick={handleAdd}
          disabled={adding || !input.trim()}
        >
          {adding ? "Adding..." : "Add"}
        </Button>
      </div>
      {error && (
        <p className="mt-1 text-xs text-destructive">{error}</p>
      )}

      {keywords.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {keywords.map((kw) => (
            <Badge
              key={kw}
              variant="secondary"
              className="gap-1.5 py-1 pl-3 pr-1.5"
            >
              {kw}
              <button
                type="button"
                onClick={() => handleRemove(kw)}
                className="ml-1 rounded-full p-0.5 hover:bg-foreground/10 transition-colors"
                aria-label={`Remove ${kw}`}
              >
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 12 12"
                  fill="none"
                  className="text-muted-foreground"
                >
                  <path
                    d="M3 3l6 6M9 3l-6 6"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </Badge>
          ))}
        </div>
      )}

      {keywords.length === 0 && (
        <p className="mt-3 text-xs text-muted-foreground">
          No seed keywords yet. Add some to start generating topic ideas.
        </p>
      )}
    </div>
  );
}
