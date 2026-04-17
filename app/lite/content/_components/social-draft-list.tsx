"use client";

/**
 * Social draft cards — client component for Publish/Download/Preview
 * interactions (CE-8).
 *
 * v1 "Publish" = copy text to clipboard + open platform compose URL.
 * Marks draft as published in DB via server action.
 */
import { useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { publishSocialDraftAction } from "../actions";

// ── Types ────────────────────────────────────────────────────────────────────

interface CarouselSlide {
  headline: string;
  body: string;
  slideNumber: number;
}

interface SocialDraft {
  id: string;
  blog_post_id: string;
  platform: "instagram" | "linkedin" | "x" | "facebook";
  text: string;
  format: "single" | "carousel" | "video";
  visual_asset_urls: unknown;
  carousel_slides: unknown;
  status: "generating" | "ready" | "published";
  published_at_ms: number | null;
  created_at_ms: number;
}

interface SocialDraftListProps {
  drafts: SocialDraft[];
}

// ── Platform metadata ────────────────────────────────────────────────────────

const PLATFORM_META: Record<
  SocialDraft["platform"],
  { label: string; composeUrl: string; color: string }
> = {
  instagram: {
    label: "Instagram",
    composeUrl: "https://www.instagram.com/",
    color: "bg-pink-500/10 text-pink-700 border-pink-500/20",
  },
  linkedin: {
    label: "LinkedIn",
    composeUrl: "https://www.linkedin.com/feed/?shareActive=true",
    color: "bg-blue-500/10 text-blue-700 border-blue-500/20",
  },
  x: {
    label: "X",
    composeUrl: "https://x.com/intent/post?text=",
    color: "bg-neutral-500/10 text-neutral-700 border-neutral-500/20",
  },
  facebook: {
    label: "Facebook",
    composeUrl: "https://www.facebook.com/",
    color: "bg-blue-600/10 text-blue-800 border-blue-600/20",
  },
};

const STATUS_STYLES: Record<SocialDraft["status"], string> = {
  generating: "bg-amber-500/10 text-amber-700 border-amber-500/20",
  ready: "bg-brand-pink/10 text-brand-pink border-brand-pink/20",
  published: "bg-success/10 text-success border-success/20",
};

// ── Component ────────────────────────────────────────────────────────────────

export function SocialDraftList({ drafts }: SocialDraftListProps) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {drafts.map((draft) => (
        <SocialDraftCard key={draft.id} draft={draft} />
      ))}
    </div>
  );
}

function SocialDraftCard({ draft }: { draft: SocialDraft }) {
  const [isPending, startTransition] = useTransition();
  const [published, setPublished] = useState(draft.status === "published");
  const [copied, setCopied] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  const platformMeta = PLATFORM_META[draft.platform];
  const assetUrls = parseAssetUrls(draft.visual_asset_urls);
  const slides = parseCarouselSlides(draft.carousel_slides);
  const isCarousel = draft.format === "carousel" && slides.length > 0;

  function handlePublish() {
    // Copy text to clipboard
    navigator.clipboard.writeText(draft.text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });

    // Open platform compose screen
    const url =
      draft.platform === "x"
        ? `${platformMeta.composeUrl}${encodeURIComponent(draft.text)}`
        : platformMeta.composeUrl;
    window.open(url, "_blank", "noopener,noreferrer");

    // Mark as published in DB
    startTransition(async () => {
      const result = await publishSocialDraftAction(draft.id);
      if (result.ok) setPublished(true);
    });
  }

  const currentStatus = published ? "published" : draft.status;

  return (
    <div className="rounded-lg border border-border bg-background p-4">
      {/* Header: platform badge + status */}
      <div className="mb-3 flex items-center justify-between">
        <Badge variant="outline" className={platformMeta.color}>
          {platformMeta.label}
        </Badge>
        <Badge variant="outline" className={STATUS_STYLES[currentStatus]}>
          {currentStatus === "generating"
            ? "Generating"
            : currentStatus === "ready"
              ? "Ready"
              : "Published"}
        </Badge>
      </div>

      {/* Draft text preview */}
      <p className="mb-3 text-sm text-foreground line-clamp-4 whitespace-pre-wrap">
        {draft.text}
      </p>

      {/* Visual asset thumbnail(s) */}
      {assetUrls.length > 0 && (
        <div className="mb-3">
          {isCarousel ? (
            <>
              <button
                onClick={() => setPreviewOpen(!previewOpen)}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors mb-2"
              >
                {previewOpen ? "Hide" : "Preview"} carousel ({slides.length}{" "}
                slides)
              </button>
              {previewOpen && (
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {assetUrls.map((url, i) => (
                    <img
                      key={i}
                      src={url}
                      alt={`Slide ${i + 1}${slides[i] ? `: ${slides[i].headline}` : ""}`}
                      className="h-32 w-32 shrink-0 rounded border border-border object-cover"
                    />
                  ))}
                </div>
              )}
            </>
          ) : (
            <img
              src={assetUrls[0]}
              alt={`${platformMeta.label} visual`}
              className="h-40 w-full rounded border border-border object-cover"
            />
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2">
        {currentStatus === "ready" && (
          <Button
            size="sm"
            onClick={handlePublish}
            disabled={isPending}
          >
            {isPending ? "Publishing..." : copied ? "Copied!" : "Publish"}
          </Button>
        )}

        {currentStatus === "published" && draft.published_at_ms && (
          <span className="text-xs text-muted-foreground">
            Published{" "}
            {new Date(draft.published_at_ms).toLocaleDateString("en-AU")}
          </span>
        )}

        {assetUrls.length > 0 && (
          <a
            href={assetUrls[0]}
            download
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Download
          </a>
        )}
      </div>
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function parseAssetUrls(raw: unknown): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.filter((u): u is string => typeof u === "string");
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.filter((u): u is string => typeof u === "string");
    } catch {
      return [];
    }
  }
  return [];
}

function parseCarouselSlides(raw: unknown): CarouselSlide[] {
  if (!raw) return [];
  let arr: unknown[];
  if (Array.isArray(raw)) {
    arr = raw;
  } else if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      arr = parsed;
    } catch {
      return [];
    }
  } else {
    return [];
  }
  return arr
    .filter((s): s is Record<string, unknown> => typeof s === "object" && s !== null)
    .map((s, i) => ({
      headline: String(s.headline ?? ""),
      body: String(s.body ?? ""),
      slideNumber: typeof s.slideNumber === "number" ? s.slideNumber : i + 1,
    }));
}
