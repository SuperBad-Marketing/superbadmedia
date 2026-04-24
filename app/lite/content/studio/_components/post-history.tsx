"use client";

import { useState, useEffect } from "react";
import { listPostsAction } from "../actions";
import type { ContentStudioPostRow, ContentStudioRenderRow } from "@/lib/db/schema/content-studio";
import { getTemplate } from "@/lib/content-studio/templates";

const STATUS_COLORS: Record<string, string> = {
  draft: "var(--color-neutral-500)",
  rendering: "var(--color-brand-orange)",
  rendered: "var(--color-brand-green, #4ade80)",
  failed: "var(--color-brand-red)",
};

type PostWithRenders = ContentStudioPostRow & { renders: ContentStudioRenderRow[] };

export function PostHistory() {
  const [posts, setPosts] = useState<PostWithRenders[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    listPostsAction().then((res) => {
      if (res.ok) setPosts(res.posts as PostWithRenders[]);
      setLoading(false);
    });
  }, []);

  const filtered = search.trim()
    ? posts.filter(
        (p) =>
          p.brief.toLowerCase().includes(search.toLowerCase()) ||
          p.content_type.toLowerCase().includes(search.toLowerCase()),
      )
    : posts;

  if (loading) {
    return (
      <div className="py-12 text-center font-[family-name:var(--font-body)] text-[14px] text-[color:var(--color-neutral-500)]">
        Loading…
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search posts…"
          className="w-full max-w-[320px] rounded-lg border px-4 py-2 font-[family-name:var(--font-body)] text-[14px] placeholder:text-[color:var(--color-neutral-500)] focus:outline-none"
          style={{
            backgroundColor: "var(--color-neutral-800)",
            color: "var(--color-brand-cream)",
            borderColor: "rgba(253, 245, 230, 0.08)",
          }}
        />
      </div>

      {filtered.length === 0 ? (
        <div className="py-12 text-center font-[family-name:var(--font-body)] text-[14px] text-[color:var(--color-neutral-500)]">
          {search ? "No posts match your search." : "No posts yet. Create your first one."}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((post) => {
            const template = getTemplate(post.template_id);
            const rawCopy = post.generated_copy_json;
            const firstSlide = Array.isArray(rawCopy)
              ? (rawCopy[0] as Record<string, string> | undefined) ?? {}
              : (rawCopy as Record<string, string>) ?? {};
            const headline = firstSlide.headline || firstSlide.detail || post.brief;
            const slideCount = post.slide_count ?? 1;
            const renderedCount = post.renders.filter(
              (r) => r.render_status === "rendered",
            ).length;

            return (
              <div
                key={post.id}
                className="flex items-start gap-4 rounded-lg p-4 transition-colors"
                style={{
                  backgroundColor: "var(--color-neutral-800)",
                  border: "1px solid rgba(253, 245, 230, 0.06)",
                }}
              >
                {/* Thumbnail — first rendered image if available */}
                {post.renders[0]?.cloudinary_url ? (
                  <img
                    src={post.renders[0].cloudinary_url}
                    alt=""
                    className="h-16 w-16 shrink-0 rounded object-cover"
                  />
                ) : (
                  <div
                    className="flex h-16 w-16 shrink-0 items-center justify-center rounded font-[family-name:var(--font-display)] text-[20px] text-[color:var(--color-neutral-600)]"
                    style={{ backgroundColor: "var(--color-neutral-700)" }}
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
                        color: STATUS_COLORS[post.status] ?? "var(--color-neutral-500)",
                        border: `1px solid ${STATUS_COLORS[post.status] ?? "var(--color-neutral-500)"}`,
                      }}
                    >
                      {post.status}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center gap-3 font-[family-name:var(--font-body)] text-[12px] text-[color:var(--color-neutral-500)]">
                    <span>{post.content_type.replace(/_/g, " ")}</span>
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
                    {renderedCount > 0 && (
                      <>
                        <span>·</span>
                        <span>
                          {renderedCount} render{renderedCount === 1 ? "" : "s"}
                        </span>
                      </>
                    )}
                    <span>·</span>
                    <span>
                      {new Date(post.created_at_ms).toLocaleDateString("en-AU", {
                        day: "numeric",
                        month: "short",
                      })}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
