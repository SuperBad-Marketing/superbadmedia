"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { DownloadIcon, ExternalLinkIcon, ChevronDownIcon, ImageIcon } from "lucide-react";
import { toast } from "sonner";
import { houseSpring } from "@/lib/design-tokens";
import { DownloadProgress, type DownloadStage } from "./render-progress";
import { listPostsAction } from "../actions";
import type {
  ContentStudioPostRow,
  ContentStudioRenderRow,
  AspectRatio,
} from "@/lib/db/schema/content-studio";
import { getTemplate } from "@/lib/content-studio/templates";

const STATUS_COLORS: Record<string, string> = {
  draft: "var(--color-neutral-500)",
  rendering: "var(--color-brand-orange)",
  rendered: "#7BAE7E",
  failed: "var(--color-brand-red)",
};

const RATIO_LABELS: Record<string, string> = {
  portrait: "9:16",
  square: "1:1",
  landscape: "2:1",
  portrait_3x4: "3:4",
  portrait_4x5: "4:5",
  landscape_16x9: "16:9",
};

type PostWithRenders = ContentStudioPostRow & {
  renders: ContentStudioRenderRow[];
};

type Filter = "all" | "exported";

export function PostHistory() {
  const shouldReduceMotion = useReducedMotion();
  const [posts, setPosts] = useState<PostWithRenders[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    listPostsAction().then((res) => {
      if (res.ok) setPosts(res.posts as PostWithRenders[]);
      setLoading(false);
    });
  }, []);

  const filtered = posts.filter((p) => {
    if (filter === "exported") {
      const hasRenders = p.renders.some(
        (r) => r.render_status === "rendered" && r.cloudinary_url,
      );
      if (!hasRenders) return false;
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        p.brief.toLowerCase().includes(q) ||
        p.content_type.toLowerCase().includes(q) ||
        (p.project_name ?? "").toLowerCase().includes(q)
      );
    }
    return true;
  });

  const exportedCount = posts.filter((p) =>
    p.renders.some((r) => r.render_status === "rendered" && r.cloudinary_url),
  ).length;

  if (loading) {
    return (
      <div className="py-12 text-center font-[family-name:var(--font-body)] text-[14px] text-[color:var(--color-neutral-500)]">
        Loading...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search + filter */}
      <div className="flex items-center gap-3">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search posts..."
          className="w-full max-w-[320px] rounded-lg border px-4 py-2 font-[family-name:var(--font-body)] text-[14px] placeholder:text-[color:var(--color-neutral-500)] focus:outline-none"
          style={{
            backgroundColor: "var(--color-neutral-800)",
            color: "var(--color-brand-cream)",
            borderColor: "rgba(253, 245, 230, 0.08)",
          }}
        />
        <button
          type="button"
          onClick={() => setFilter(filter === "all" ? "exported" : "all")}
          className="flex items-center gap-1.5 rounded-md px-3 py-1.5 font-[family-name:var(--font-label)] text-[10px] uppercase transition-colors"
          style={{
            letterSpacing: "1.5px",
            backgroundColor:
              filter === "exported"
                ? "rgba(123, 174, 126, 0.15)"
                : "var(--color-neutral-800)",
            color:
              filter === "exported" ? "#7BAE7E" : "var(--color-neutral-500)",
            border:
              filter === "exported"
                ? "1px solid rgba(123, 174, 126, 0.3)"
                : "1px solid rgba(253, 245, 230, 0.06)",
          }}
        >
          <ImageIcon className="size-3" />
          Exported ({exportedCount})
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="py-12 text-center font-[family-name:var(--font-body)] text-[14px] text-[color:var(--color-neutral-500)]">
          {search || filter === "exported"
            ? "No posts match."
            : "No posts yet. Create your first one."}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((post, i) => {
            const template = getTemplate(post.template_id);
            const rawCopy = post.generated_copy_json;
            const firstSlide = Array.isArray(rawCopy)
              ? ((rawCopy[0] as Record<string, string> | undefined) ?? {})
              : ((rawCopy as Record<string, string>) ?? {});
            const headline =
              post.project_name ||
              firstSlide.headline ||
              firstSlide.detail ||
              post.brief.slice(0, 60);
            const slideCount = post.slide_count ?? 1;
            const successRenders = post.renders.filter(
              (r) => r.render_status === "rendered" && r.cloudinary_url,
            );
            const isExpanded = expandedId === post.id;

            return (
              <motion.div
                key={post.id}
                initial={shouldReduceMotion ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={
                  shouldReduceMotion
                    ? { duration: 0 }
                    : { ...houseSpring, delay: i * 0.02 }
                }
              >
                <div
                  className="overflow-hidden rounded-xl"
                  style={{
                    backgroundColor: "var(--color-neutral-800)",
                    border: "1px solid rgba(253, 245, 230, 0.06)",
                  }}
                >
                  {/* Post row */}
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedId(isExpanded ? null : post.id)
                    }
                    className="flex w-full items-start gap-4 p-4 text-left"
                  >
                    {successRenders[0]?.cloudinary_url ? (
                      <img
                        src={successRenders[0].cloudinary_url}
                        alt=""
                        className="size-14 shrink-0 rounded-lg object-cover"
                      />
                    ) : (
                      <div
                        className="flex size-14 shrink-0 items-center justify-center rounded-lg font-[family-name:var(--font-display)] text-[18px]"
                        style={{
                          backgroundColor: "var(--color-neutral-700)",
                          color: "var(--color-neutral-600)",
                        }}
                      >
                        CS
                      </div>
                    )}

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-[family-name:var(--font-body)] text-[14px] text-[color:var(--color-brand-cream)]">
                          {headline}
                        </span>
                        <span
                          className="shrink-0 rounded-full px-2 py-0.5 font-[family-name:var(--font-label)] text-[9px] uppercase"
                          style={{
                            letterSpacing: "1px",
                            color:
                              STATUS_COLORS[post.status] ??
                              "var(--color-neutral-500)",
                            border: `1px solid ${STATUS_COLORS[post.status] ?? "var(--color-neutral-500)"}`,
                          }}
                        >
                          {post.status}
                        </span>
                      </div>
                      <div className="mt-1 flex items-center gap-3 font-[family-name:var(--font-body)] text-[12px] text-[color:var(--color-neutral-500)]">
                        <span>
                          {post.content_type.replace(/_/g, " ")}
                        </span>
                        {slideCount > 1 && (
                          <>
                            <span>·</span>
                            <span>{slideCount} slides</span>
                          </>
                        )}
                        {template && (
                          <>
                            <span>·</span>
                            <span>{template.name}</span>
                          </>
                        )}
                        {successRenders.length > 0 && (
                          <>
                            <span>·</span>
                            <span>
                              {successRenders.length} export
                              {successRenders.length === 1 ? "" : "s"}
                            </span>
                          </>
                        )}
                        <span>·</span>
                        <span>
                          {new Date(post.created_at_ms).toLocaleDateString(
                            "en-AU",
                            { day: "numeric", month: "short" },
                          )}
                        </span>
                      </div>
                    </div>

                    {successRenders.length > 0 && (
                      <ChevronDownIcon
                        className="mt-1 size-4 shrink-0 transition-transform"
                        style={{
                          color: "var(--color-neutral-500)",
                          transform: isExpanded
                            ? "rotate(180deg)"
                            : "rotate(0deg)",
                        }}
                      />
                    )}
                  </button>

                  {/* Expanded renders */}
                  <AnimatePresence>
                    {isExpanded && successRenders.length > 0 && (
                      <motion.div
                        initial={
                          shouldReduceMotion
                            ? false
                            : { height: 0, opacity: 0 }
                        }
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={
                          shouldReduceMotion ? { duration: 0 } : houseSpring
                        }
                        style={{ overflow: "hidden" }}
                      >
                        <div
                          className="border-t px-4 pb-4 pt-3"
                          style={{
                            borderColor: "rgba(253, 245, 230, 0.06)",
                          }}
                        >
                          <span
                            className="mb-2 block font-[family-name:var(--font-label)] text-[10px] uppercase"
                            style={{
                              letterSpacing: "1.5px",
                              color: "var(--color-neutral-500)",
                            }}
                          >
                            Exports
                          </span>
                          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                            {successRenders.map((r) => (
                              <ExportCard key={r.id} render={r} />
                            ))}
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ExportCard({ render }: { render: ContentStudioRenderRow }) {
  const [dlStage, setDlStage] = useState<DownloadStage>("fetching");
  const [dlPercent, setDlPercent] = useState(0);
  const [dlVisible, setDlVisible] = useState(false);
  const url = render.cloudinary_url!;
  const isVideo = render.render_type === "motion";
  const ratioLabel =
    RATIO_LABELS[render.aspect_ratio] ?? render.aspect_ratio;

  async function handleDownload() {
    setDlStage("fetching");
    setDlPercent(0);
    setDlVisible(true);

    try {
      const resp = await fetch(url);
      const contentLength = Number(resp.headers.get("content-length") || 0);
      const reader = resp.body?.getReader();
      const ext = isVideo ? "mp4" : "png";
      const filename = `superbad-${render.aspect_ratio}-${render.id.slice(0, 8)}.${ext}`;

      if (!reader) {
        const blob = await resp.blob();
        setDlPercent(100);
        setDlStage("saving");
        triggerSave(blob, filename);
        setDlStage("complete");
        setTimeout(() => setDlVisible(false), 1200);
        return;
      }

      const chunks: Uint8Array[] = [];
      let received = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        received += value.length;
        if (contentLength > 0) {
          setDlPercent(Math.round((received / contentLength) * 90));
        } else {
          setDlPercent(Math.min(85, Math.round(received / 1024)));
        }
      }

      setDlPercent(95);
      setDlStage("saving");
      const blob = new Blob(chunks as BlobPart[]);
      triggerSave(blob, filename);
      setDlPercent(100);
      setDlStage("complete");
      setTimeout(() => setDlVisible(false), 1200);
    } catch {
      setDlStage("failed");
      toast.error("Download failed.");
      setTimeout(() => setDlVisible(false), 2000);
    }
  }

  return (
    <div
      className="overflow-hidden rounded-lg"
      style={{ border: "1px solid rgba(253, 245, 230, 0.06)" }}
    >
      {isVideo ? (
        <video src={url} controls className="w-full" style={{ maxHeight: 200 }} />
      ) : (
        <img src={url} alt={`${ratioLabel} render`} className="w-full" />
      )}
      <div
        className="space-y-1.5 px-3 py-2"
        style={{ backgroundColor: "rgba(253, 245, 230, 0.02)" }}
      >
        <div className="flex items-center justify-between">
          <span
            className="font-[family-name:var(--font-label)] text-[10px] uppercase tabular-nums"
            style={{
              letterSpacing: "1px",
              color: "var(--color-neutral-500)",
            }}
          >
            {ratioLabel}
            {render.format ? ` · ${render.format}` : ""}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDownload}
              disabled={dlVisible}
              className="flex items-center gap-1 rounded-md px-2 py-1 font-[family-name:var(--font-label)] text-[10px] uppercase transition-opacity disabled:opacity-40"
              style={{
                letterSpacing: "1px",
                backgroundColor: "rgba(253, 245, 230, 0.06)",
                color: "var(--color-brand-cream)",
              }}
              aria-label="Download"
            >
              <DownloadIcon className="size-3" />
              {dlVisible ? "..." : "Download"}
            </button>
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 rounded-md px-2 py-1 font-[family-name:var(--font-label)] text-[10px] uppercase transition-opacity"
              style={{
                letterSpacing: "1px",
                color: "var(--color-brand-pink)",
              }}
              aria-label="Open in new tab"
            >
              <ExternalLinkIcon className="size-3" />
              Open
            </a>
          </div>
        </div>
        <DownloadProgress stage={dlStage} percent={dlPercent} visible={dlVisible} />
      </div>
    </div>
  );
}

function triggerSave(blob: Blob, filename: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(a.href);
}
