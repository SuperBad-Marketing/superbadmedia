"use client";

import { motion, useReducedMotion, AnimatePresence } from "framer-motion";
import { useState, useCallback } from "react";
import { houseSpring } from "@/lib/design-tokens";
import type { GalleryItem } from "@/app/lite/portal/[token]/gallery/actions";

interface Props {
  items: GalleryItem[];
  archiveUrl: string | null;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function GalleryEmpty() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <p className="text-center font-[family-name:var(--font-playfair-display)] text-[15px] italic text-[var(--color-neutral-500)]">
        nothing here yet. when there is, you&rsquo;ll know.
      </p>
    </div>
  );
}

function GalleryLightbox({
  item,
  onClose,
}: {
  item: GalleryItem;
  onClose: () => void;
}) {
  const shouldReduceMotion = useReducedMotion();

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
            className="max-h-[85vh] max-w-[85vw] rounded-lg"
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.fullUrl}
            alt=""
            className="max-h-[85vh] max-w-[85vw] rounded-lg object-contain"
          />
        )}

        <div className="absolute -bottom-14 left-0 right-0 flex items-center justify-center gap-4">
          <a
            href={item.downloadUrl}
            download
            className="rounded-full bg-[var(--color-neutral-800)] px-4 py-2 text-xs text-[var(--color-brand-cream)] transition-colors hover:bg-[var(--color-neutral-700)]"
            onClick={(e) => e.stopPropagation()}
          >
            download
          </a>
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

export function PortalGallery({ items, archiveUrl }: Props) {
  const shouldReduceMotion = useReducedMotion();
  const [lightboxItem, setLightboxItem] = useState<GalleryItem | null>(null);

  const closeLightbox = useCallback(() => setLightboxItem(null), []);

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-[780px] px-4 md:px-8">
        <motion.div
          initial={shouldReduceMotion ? {} : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={shouldReduceMotion ? { duration: 0 } : houseSpring}
          className="flex items-end justify-between border-b border-[rgba(253,245,230,0.06)] pb-7 pt-10"
        >
          <div>
            <span className="mb-2 block font-[family-name:var(--font-righteous)] text-[10px] uppercase tracking-[2px] text-[var(--color-brand-orange)]">
              your room
            </span>
            <h1 className="font-[family-name:var(--font-black-han-sans)] text-4xl leading-none text-[var(--color-brand-cream)]">
              Gallery
            </h1>
          </div>
          <span className="font-[family-name:var(--font-playfair-display)] text-[15px] italic text-[var(--color-neutral-500)]">
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
        className="flex items-end justify-between border-b border-[rgba(253,245,230,0.06)] pb-7 pt-10"
      >
        <div>
          <span className="mb-2 block font-[family-name:var(--font-righteous)] text-[10px] uppercase tracking-[2px] text-[var(--color-brand-orange)]">
            your room
          </span>
          <h1 className="font-[family-name:var(--font-black-han-sans)] text-4xl leading-none text-[var(--color-brand-cream)]">
            Gallery
          </h1>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-xs text-[var(--color-neutral-500)]">
            {items.length} {items.length === 1 ? "file" : "files"}
          </span>
          {archiveUrl && (
            <a
              href={archiveUrl}
              download
              className="rounded-full border border-[rgba(253,245,230,0.08)] bg-[var(--color-neutral-800)] px-4 py-2 text-xs text-[var(--color-brand-cream)] transition-colors hover:bg-[var(--color-neutral-700)]"
            >
              download all
            </a>
          )}
        </div>
      </motion.div>

      <div className="columns-2 gap-3 pt-8 md:columns-3 lg:columns-4 [&>button]:mb-3">
        {items.map((item, i) => (
          <GalleryCard
            key={item.publicId}
            item={item}
            index={i}
            onClick={() => setLightboxItem(item)}
          />
        ))}
      </div>

      <AnimatePresence>
        {lightboxItem && (
          <GalleryLightbox item={lightboxItem} onClose={closeLightbox} />
        )}
      </AnimatePresence>
    </div>
  );
}
