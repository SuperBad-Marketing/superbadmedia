"use client";

import { motion, useReducedMotion, AnimatePresence } from "framer-motion";
import { useState, useCallback, useMemo, useTransition } from "react";
import { houseSpring } from "@/lib/design-tokens";
import type { GalleryItem, GalleryArchive } from "@/app/lite/portal/[token]/gallery/actions";
import { updateGalleryAssetStatus } from "@/app/lite/portal/[token]/gallery/actions";
import type { GalleryApprovalStatus } from "@/lib/db/schema/gallery-assets";

interface Props {
  items: GalleryItem[];
  archives: GalleryArchive[];
  hasMore: boolean;
}

type SortOrder = "newest" | "oldest";
type FilterStatus = "all" | GalleryApprovalStatus;

const FILTER_OPTIONS: { value: FilterStatus; label: string }[] = [
  { value: "all", label: "all" },
  { value: "new", label: "new" },
  { value: "approved", label: "approved" },
  { value: "revision_requested", label: "revision" },
];

const STATUS_COLORS: Record<GalleryApprovalStatus, string> = {
  new: "bg-[var(--color-brand-orange)]",
  approved: "bg-emerald-500",
  revision_requested: "bg-[var(--color-brand-red)]",
};

const STATUS_LABELS: Record<GalleryApprovalStatus, string> = {
  new: "new",
  approved: "approved",
  revision_requested: "revision requested",
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function GalleryEmpty() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <p className="text-center font-[family-name:var(--font-playfair-display)] text-[15px] italic text-[var(--color-neutral-500)]" data-ambient-slot="portal_gallery_empty">
        nothing here yet. when there is, you&rsquo;ll know.
      </p>
    </div>
  );
}

function StatusBadge({ status }: { status: GalleryApprovalStatus }) {
  return (
    <span
      className={`absolute left-2 top-2 z-10 rounded-full px-2 py-0.5 text-[9px] font-medium uppercase tracking-wider text-white ${STATUS_COLORS[status]}`}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}

function GalleryLightbox({
  item,
  onClose,
  onStatusChange,
}: {
  item: GalleryItem;
  onClose: () => void;
  onStatusChange: (publicId: string, status: GalleryApprovalStatus) => void;
}) {
  const shouldReduceMotion = useReducedMotion();
  const [isPending, startTransition] = useTransition();

  const handleStatus = (status: GalleryApprovalStatus) => {
    startTransition(() => {
      onStatusChange(item.publicId, status);
    });
  };

  return (
    <motion.div
      initial={shouldReduceMotion ? {} : { opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={shouldReduceMotion ? {} : { opacity: 0 }}
      transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.2 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 md:p-8"
      onClick={onClose}
      role="dialog"
      aria-label="Image preview"
    >
      <motion.div
        initial={shouldReduceMotion ? {} : { scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={shouldReduceMotion ? {} : { scale: 0.95, opacity: 0 }}
        transition={shouldReduceMotion ? { duration: 0 } : houseSpring}
        className="relative max-h-[90vh] max-w-[90vw]"
        onClick={(e) => e.stopPropagation()}
      >
        {item.resourceType === "video" ? (
          <video
            src={item.fullUrl}
            controls
            autoPlay
            className="max-h-[80vh] max-w-[85vw] rounded-lg"
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.fullUrl}
            alt=""
            className="max-h-[80vh] max-w-[85vw] rounded-lg object-contain"
          />
        )}

        <div className="absolute -bottom-16 left-0 right-0 flex flex-wrap items-center justify-center gap-3">
          <a
            href={item.downloadUrl}
            download
            className="rounded-full bg-[var(--color-neutral-800)] px-4 py-2 text-xs text-[var(--color-brand-cream)] transition-colors hover:bg-[var(--color-neutral-700)]"
            onClick={(e) => e.stopPropagation()}
          >
            download
          </a>
          <button
            onClick={() => handleStatus("approved")}
            disabled={isPending || item.approvalStatus === "approved"}
            className="rounded-full bg-emerald-600 px-4 py-2 text-xs text-white transition-colors hover:bg-emerald-500 disabled:opacity-40"
          >
            approve
          </button>
          <button
            onClick={() => handleStatus("revision_requested")}
            disabled={isPending || item.approvalStatus === "revision_requested"}
            className="rounded-full bg-[var(--color-brand-red)] px-4 py-2 text-xs text-white transition-colors hover:bg-[var(--color-brand-red)]/80 disabled:opacity-40"
          >
            request revision
          </button>
          <span className="text-xs text-[var(--color-neutral-500)]">
            {formatBytes(item.bytes)} &middot; {item.format.toUpperCase()}
          </span>
          <button
            onClick={onClose}
            className="rounded-full bg-[var(--color-neutral-800)] px-4 py-2 text-xs text-[var(--color-brand-cream)] transition-colors hover:bg-[var(--color-neutral-700)]"
          >
            close
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function GalleryCard({
  item,
  index,
  onClick,
}: {
  item: GalleryItem;
  index: number;
  onClick: () => void;
}) {
  const shouldReduceMotion = useReducedMotion();
  const aspectRatio = item.width / item.height;

  return (
    <motion.button
      initial={shouldReduceMotion ? {} : { opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={
        shouldReduceMotion
          ? { duration: 0 }
          : { ...houseSpring, delay: Math.min(index * 0.04, 0.4) }
      }
      onClick={onClick}
      className="group relative w-full cursor-pointer overflow-hidden rounded-lg bg-[var(--color-neutral-800)]"
      style={{ aspectRatio }}
    >
      <StatusBadge status={item.approvalStatus} />

      {item.resourceType === "video" ? (
        <div className="relative h-full w-full">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={item.thumbUrl}
            alt=""
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
            loading="lazy"
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="rounded-full bg-black/50 p-3">
              <svg
                width="20"
                height="20"
                viewBox="0 0 20 20"
                fill="none"
                className="text-[var(--color-brand-cream)]"
              >
                <path d="M6 4L16 10L6 16V4Z" fill="currentColor" />
              </svg>
            </div>
          </div>
        </div>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={item.thumbUrl}
          alt=""
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          loading="lazy"
        />
      )}

      <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 transition-opacity duration-200 group-hover:opacity-100" />

      <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between p-3 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
        <span className="text-[10px] uppercase tracking-wider text-[var(--color-brand-cream)]/70">
          {item.format}
        </span>
        <a
          href={item.downloadUrl}
          download
          onClick={(e) => e.stopPropagation()}
          className="rounded-full bg-[var(--color-neutral-900)]/70 p-1.5 text-[var(--color-brand-cream)] transition-colors hover:bg-[var(--color-neutral-800)]"
          aria-label={`Download ${item.format} file`}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path
              d="M7 1v9M3.5 6.5L7 10l3.5-3.5M2 12h10"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </a>
      </div>
    </motion.button>
  );
}

export function PortalGallery({ items: initialItems, archives, hasMore }: Props) {
  const shouldReduceMotion = useReducedMotion();
  const [items, setItems] = useState(initialItems);
  const [lightboxItem, setLightboxItem] = useState<GalleryItem | null>(null);
  const [sortOrder, setSortOrder] = useState<SortOrder>("newest");
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("all");

  const closeLightbox = useCallback(() => setLightboxItem(null), []);

  const handleStatusChange = useCallback(
    async (publicId: string, status: GalleryApprovalStatus) => {
      const result = await updateGalleryAssetStatus(publicId, status);
      if (!result.ok) return;

      setItems((prev) =>
        prev.map((item) =>
          item.publicId === publicId ? { ...item, approvalStatus: status } : item,
        ),
      );
      setLightboxItem((prev) =>
        prev?.publicId === publicId ? { ...prev, approvalStatus: status } : prev,
      );
    },
    [],
  );

  const filteredAndSorted = useMemo(() => {
    let result = items;
    if (filterStatus !== "all") {
      result = result.filter((item) => item.approvalStatus === filterStatus);
    }
    return [...result].sort((a, b) => {
      const dateA = new Date(a.createdAt).getTime();
      const dateB = new Date(b.createdAt).getTime();
      return sortOrder === "newest" ? dateB - dateA : dateA - dateB;
    });
  }, [items, sortOrder, filterStatus]);

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-[780px] px-4 md:px-8">
        <motion.div
          initial={shouldReduceMotion ? {} : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={shouldReduceMotion ? { duration: 0 } : houseSpring}
          className="flex flex-col gap-2 border-b border-[rgba(253,245,230,0.06)] pb-7 pt-10 sm:flex-row sm:items-end sm:justify-between sm:gap-0"
        >
          <div>
            <span className="mb-2 block font-[family-name:var(--font-righteous)] text-[10px] uppercase tracking-[2px] text-[var(--color-brand-orange)]">
              your room
            </span>
            <h1 className="font-[family-name:var(--font-black-han-sans)] text-3xl leading-none text-[var(--color-brand-cream)] sm:text-4xl">
              Gallery
            </h1>
          </div>
          <span className="font-[family-name:var(--font-playfair-display)] text-[14px] italic text-[var(--color-neutral-500)] sm:text-[15px]">
            your photos and video.
          </span>
        </motion.div>

        <motion.div
          initial={shouldReduceMotion ? {} : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={
            shouldReduceMotion
              ? { duration: 0 }
              : { ...houseSpring, delay: 0.15 }
          }
        >
          <GalleryEmpty />
        </motion.div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1200px] px-4 md:px-8">
      <motion.div
        initial={shouldReduceMotion ? {} : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={shouldReduceMotion ? { duration: 0 } : houseSpring}
        className="flex flex-col gap-3 border-b border-[rgba(253,245,230,0.06)] pb-7 pt-10 sm:flex-row sm:items-end sm:justify-between sm:gap-0"
      >
        <div>
          <span className="mb-2 block font-[family-name:var(--font-righteous)] text-[10px] uppercase tracking-[2px] text-[var(--color-brand-orange)]">
            your room
          </span>
          <h1 className="font-[family-name:var(--font-black-han-sans)] text-3xl leading-none text-[var(--color-brand-cream)] sm:text-4xl">
            Gallery
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-[var(--color-neutral-500)]">
            {items.length} {items.length === 1 ? "file" : "files"}
            {hasMore && "+"}
          </span>
          {archives.map((archive) => (
            <a
              key={archive.label}
              href={archive.url}
              download
              className="rounded-full border border-[rgba(253,245,230,0.08)] bg-[var(--color-neutral-800)] px-4 py-2 text-xs text-[var(--color-brand-cream)] transition-colors hover:bg-[var(--color-neutral-700)]"
            >
              {archive.label}
            </a>
          ))}
        </div>
      </motion.div>

      {/* Sort + Filter controls */}
      <motion.div
        initial={shouldReduceMotion ? {} : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={
          shouldReduceMotion
            ? { duration: 0 }
            : { ...houseSpring, delay: 0.1 }
        }
        className="flex flex-wrap items-center gap-3 pb-2 pt-6"
      >
        <div className="flex items-center gap-1.5">
          {FILTER_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setFilterStatus(opt.value)}
              className={`rounded-full px-3 py-1.5 text-[11px] uppercase tracking-wider transition-colors ${
                filterStatus === opt.value
                  ? "bg-[var(--color-brand-red)] text-white"
                  : "bg-[var(--color-neutral-800)] text-[var(--color-neutral-400)] hover:text-[var(--color-brand-cream)]"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <div className="ml-auto">
          <button
            onClick={() =>
              setSortOrder((prev) =>
                prev === "newest" ? "oldest" : "newest",
              )
            }
            className="flex items-center gap-1.5 rounded-full bg-[var(--color-neutral-800)] px-3 py-1.5 text-[11px] uppercase tracking-wider text-[var(--color-neutral-400)] transition-colors hover:text-[var(--color-brand-cream)]"
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 12 12"
              fill="none"
              className={`transition-transform ${sortOrder === "oldest" ? "rotate-180" : ""}`}
            >
              <path
                d="M6 2v8M3 7l3 3 3-3"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            {sortOrder === "newest" ? "newest first" : "oldest first"}
          </button>
        </div>
      </motion.div>

      {filteredAndSorted.length === 0 ? (
        <div className="flex min-h-[30vh] items-center justify-center">
          <p className="font-[family-name:var(--font-playfair-display)] text-[14px] italic text-[var(--color-neutral-500)]">
            no {filterStatus === "all" ? "" : filterStatus.replace("_", " ")} files.
          </p>
        </div>
      ) : (
        <div className="columns-2 gap-3 pt-4 md:columns-3 lg:columns-4 [&>button]:mb-3">
          {filteredAndSorted.map((item, i) => (
            <GalleryCard
              key={item.publicId}
              item={item}
              index={i}
              onClick={() => setLightboxItem(item)}
            />
          ))}
        </div>
      )}

      {hasMore && (
        <div className="flex justify-center pb-10 pt-6">
          <p className="font-[family-name:var(--font-playfair-display)] text-[13px] italic text-[var(--color-neutral-500)]">
            showing first {items.length} files, more available on request.
          </p>
        </div>
      )}

      <AnimatePresence>
        {lightboxItem && (
          <GalleryLightbox
            item={lightboxItem}
            onClose={closeLightbox}
            onStatusChange={handleStatusChange}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
