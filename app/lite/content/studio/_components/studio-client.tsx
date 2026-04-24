"use client";

import { useState, useCallback } from "react";
import { toast } from "sonner";
import { CONTENT_TYPES, type ContentType, type AspectRatio } from "@/lib/db/schema/content-studio";
import {
  createPostAction,
  correctCopyAction,
  renderPostAction,
  changeTemplateAction,
  listPostsAction,
} from "../actions";
import { PostPreview } from "./post-preview";
import { PostHistory } from "./post-history";

const CONTENT_TYPE_LABELS: Record<ContentType, string> = {
  announcement: "Announcement",
  anti_motivation: "Anti-Motivation",
  portfolio: "Portfolio",
  tips: "Tips & Value",
  testimonial: "Testimonial",
  behind_the_scenes: "Behind the Scenes",
};

type StudioView = "create" | "preview" | "history";

interface ActivePost {
  id: string;
  templateId: string;
  copy: Record<string, string>;
  contentType: ContentType;
  brief: string;
}

export function StudioClient() {
  const [view, setView] = useState<StudioView>("create");
  const [brief, setBrief] = useState("");
  const [contentType, setContentType] = useState<ContentType>("announcement");
  const [generating, setGenerating] = useState(false);
  const [activePost, setActivePost] = useState<ActivePost | null>(null);

  const handleCreate = useCallback(async () => {
    if (!brief.trim()) {
      toast.error("Enter a brief first.");
      return;
    }
    setGenerating(true);
    const result = await createPostAction({ brief: brief.trim(), contentType });
    setGenerating(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setActivePost({
      id: result.postId,
      templateId: result.templateId,
      copy: result.copy,
      contentType,
      brief: brief.trim(),
    });
    setView("preview");
    toast.success("Copy generated.");
  }, [brief, contentType]);

  const handleCorrect = useCallback(
    async (correction: string) => {
      if (!activePost) return;
      const result = await correctCopyAction({
        postId: activePost.id,
        correction,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setActivePost((prev) => (prev ? { ...prev, copy: result.copy } : null));
      toast.success("Copy updated.");
    },
    [activePost],
  );

  const handleRender = useCallback(
    async (ratios: AspectRatio[], platforms: string) => {
      if (!activePost) return;
      const result = await renderPostAction({
        postId: activePost.id,
        ratios,
        platforms,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`${result.renders.length} render${result.renders.length === 1 ? "" : "s"} complete.`);
      return result.renders;
    },
    [activePost],
  );

  const handleChangeTemplate = useCallback(
    async (templateId: string) => {
      if (!activePost) return;
      const result = await changeTemplateAction({
        postId: activePost.id,
        templateId,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setActivePost((prev) => (prev ? { ...prev, templateId } : null));
      toast.success("Template changed.");
    },
    [activePost],
  );

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <header className="px-4 pt-6 pb-5">
        <div
          className="font-[family-name:var(--font-label)] text-[10px] uppercase leading-none text-[color:var(--color-neutral-500)]"
          style={{ letterSpacing: "2px" }}
        >
          Content{" "}
          <span className="text-[color:var(--color-neutral-600)]">·</span>{" "}
          <span className="text-[color:var(--color-brand-pink)]">
            Content Studio
          </span>
        </div>
        <h1
          className="mt-3 font-[family-name:var(--font-display)] text-[40px] leading-none text-[color:var(--color-brand-cream)]"
          style={{ letterSpacing: "-0.4px" }}
        >
          Content Studio
        </h1>
        <p className="mt-3 max-w-[640px] font-[family-name:var(--font-body)] text-[16px] leading-[1.55] text-[color:var(--color-neutral-300)]">
          Describe what you want, pick the vibe, hit generate.{" "}
          <em className="font-[family-name:var(--font-narrative)] text-[color:var(--color-brand-pink)]">
            brand-perfect every time.
          </em>
        </p>
      </header>

      <div className="mt-4 flex items-center gap-2 px-4">
        <button
          type="button"
          onClick={() => setView("create")}
          className="rounded-md px-3 py-1.5 font-[family-name:var(--font-label)] text-[10px] uppercase transition-colors"
          style={{
            letterSpacing: "1.5px",
            backgroundColor:
              view === "create"
                ? "var(--color-brand-red)"
                : "var(--color-neutral-800)",
            color: "var(--color-brand-cream)",
          }}
        >
          Create
        </button>
        {activePost && (
          <button
            type="button"
            onClick={() => setView("preview")}
            className="rounded-md px-3 py-1.5 font-[family-name:var(--font-label)] text-[10px] uppercase transition-colors"
            style={{
              letterSpacing: "1.5px",
              backgroundColor:
                view === "preview"
                  ? "var(--color-brand-red)"
                  : "var(--color-neutral-800)",
              color: "var(--color-brand-cream)",
            }}
          >
            Preview
          </button>
        )}
        <button
          type="button"
          onClick={() => setView("history")}
          className="rounded-md px-3 py-1.5 font-[family-name:var(--font-label)] text-[10px] uppercase transition-colors"
          style={{
            letterSpacing: "1.5px",
            backgroundColor:
              view === "history"
                ? "var(--color-brand-red)"
                : "var(--color-neutral-800)",
            color: "var(--color-brand-cream)",
          }}
        >
          History
        </button>
      </div>

      <div className="mt-6 px-4">
        {view === "create" && (
          <div className="space-y-6">
            <div>
              <label
                className="mb-2 block font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-neutral-500)]"
                style={{ letterSpacing: "1.5px" }}
              >
                Content type
              </label>
              <div className="flex flex-wrap gap-2">
                {CONTENT_TYPES.map((ct) => (
                  <button
                    key={ct}
                    type="button"
                    onClick={() => setContentType(ct)}
                    className="rounded-lg px-4 py-2 font-[family-name:var(--font-body)] text-[13px] transition-all"
                    style={{
                      backgroundColor:
                        contentType === ct
                          ? "var(--color-brand-red)"
                          : "var(--color-neutral-800)",
                      color: "var(--color-brand-cream)",
                      border:
                        contentType === ct
                          ? "1px solid var(--color-brand-red)"
                          : "1px solid rgba(253, 245, 230, 0.08)",
                    }}
                  >
                    {CONTENT_TYPE_LABELS[ct]}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label
                className="mb-2 block font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-neutral-500)]"
                style={{ letterSpacing: "1.5px" }}
              >
                Brief
              </label>
              <textarea
                value={brief}
                onChange={(e) => setBrief(e.target.value)}
                placeholder="e.g. Announce our new pricing tiers. Punchy, confident, a bit cheeky."
                rows={4}
                className="w-full resize-y rounded-lg border px-4 py-3 font-[family-name:var(--font-body)] text-[14px] leading-[1.6] placeholder:text-[color:var(--color-neutral-500)] focus:outline-none"
                style={{
                  backgroundColor: "var(--color-neutral-800)",
                  color: "var(--color-brand-cream)",
                  borderColor: "rgba(253, 245, 230, 0.08)",
                }}
              />
            </div>

            <button
              type="button"
              onClick={handleCreate}
              disabled={generating || !brief.trim()}
              className="rounded-lg px-6 py-2.5 font-[family-name:var(--font-body)] text-[14px] font-medium transition-opacity"
              style={{
                backgroundColor: "var(--color-brand-red)",
                color: "var(--color-brand-cream)",
                opacity: generating || !brief.trim() ? 0.5 : 1,
              }}
            >
              {generating ? "Generating…" : "Generate"}
            </button>
          </div>
        )}

        {view === "preview" && activePost && (
          <PostPreview
            post={activePost}
            onCorrect={handleCorrect}
            onRender={handleRender}
            onChangeTemplate={handleChangeTemplate}
            onNewPost={() => {
              setBrief("");
              setActivePost(null);
              setView("create");
            }}
          />
        )}

        {view === "history" && <PostHistory />}
      </div>
    </div>
  );
}
