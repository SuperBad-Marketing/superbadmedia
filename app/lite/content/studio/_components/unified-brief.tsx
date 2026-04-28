"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { XIcon, ImageIcon, SparklesIcon, FilmIcon, TypeIcon, LayoutGridIcon, VideoIcon } from "lucide-react";
import { houseSpring } from "@/lib/design-tokens";
import {
  parseBrief,
  getFormatLabel,
  getFormatDescription,
  type ParsedBrief,
  type ContentFormat,
} from "@/lib/content-studio/brief-parser";
import type { ContentType } from "@/lib/db/schema/content-studio";

const CONTENT_TYPE_LABELS: Record<ContentType, string> = {
  announcement: "Announcement",
  anti_motivation: "Anti-Motivation",
  portfolio: "Portfolio",
  tips: "Tips & Value",
  testimonial: "Testimonial",
  behind_the_scenes: "Behind the Scenes",
};

const FORMAT_ICONS: Record<ContentFormat, typeof TypeIcon> = {
  static: LayoutGridIcon,
  animated: SparklesIcon,
  cinematic: FilmIcon,
  composite: VideoIcon,
};

interface DetectedChip {
  key: string;
  label: string;
  value: string;
  removable: boolean;
}

export interface UnifiedBriefResult {
  raw: string;
  parsed: ParsedBrief;
  referenceImages: File[];
  overrides: {
    format?: ContentFormat;
    contentType?: ContentType;
    clientName?: string | null;
  };
}

interface UnifiedBriefProps {
  knownClients: string[];
  onBriefChange: (result: UnifiedBriefResult | null) => void;
  onGenerate: (result: UnifiedBriefResult) => void;
  generating: boolean;
  initialValue?: string;
}

export function UnifiedBrief({
  knownClients,
  onBriefChange,
  onGenerate,
  generating,
  initialValue = "",
}: UnifiedBriefProps) {
  const shouldReduceMotion = useReducedMotion();
  const [text, setText] = useState(initialValue);
  const [parsed, setParsed] = useState<ParsedBrief | null>(null);
  const [overrides, setOverrides] = useState<UnifiedBriefResult["overrides"]>({});
  const [referenceImages, setReferenceImages] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [showFormatPicker, setShowFormatPicker] = useState(false);
  const [showTypePicker, setShowTypePicker] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const mountedRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!text.trim()) {
      setParsed(null);
      if (mountedRef.current) onBriefChange(null);
      return;
    }

    debounceRef.current = setTimeout(() => {
      const result = parseBrief(text, knownClients);
      setParsed(result);
      onBriefChange({
        raw: text,
        parsed: result,
        referenceImages,
        overrides,
      });
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [text, knownClients, referenceImages, overrides, onBriefChange]);

  const effectiveFormat = overrides.format ?? parsed?.format ?? "static";
  const effectiveType = overrides.contentType ?? parsed?.contentType ?? null;
  const effectiveClient = overrides.clientName ?? parsed?.clientName ?? null;

  const chips: DetectedChip[] = [];

  if (parsed && text.trim()) {
    chips.push({
      key: "format",
      label: "Format",
      value: getFormatLabel(effectiveFormat),
      removable: false,
    });

    if (effectiveType) {
      chips.push({
        key: "type",
        label: "Type",
        value: CONTENT_TYPE_LABELS[effectiveType],
        removable: true,
      });
    }

    if (effectiveClient) {
      chips.push({
        key: "client",
        label: "Client",
        value: effectiveClient,
        removable: true,
      });
    }

    if (parsed.mood) {
      chips.push({
        key: "mood",
        label: "Mood",
        value: parsed.mood,
        removable: false,
      });
    }

    if (parsed.hasStat && parsed.statValue) {
      chips.push({
        key: "stat",
        label: "Stat",
        value: parsed.statValue,
        removable: false,
      });
    }

    if (parsed.wantsCarousel) {
      chips.push({
        key: "slides",
        label: "Slides",
        value: String(parsed.suggestedSlideCount),
        removable: false,
      });
    }
  }

  const handleImageAdd = useCallback((files: FileList | null) => {
    if (!files) return;
    const newFiles = Array.from(files).filter(
      (f) => f.type.startsWith("image/") && f.size < 20 * 1024 * 1024,
    );
    setReferenceImages((prev) => [...prev, ...newFiles].slice(0, 5));

    const previews = newFiles.map((f) => URL.createObjectURL(f));
    setImagePreviews((prev) => [...prev, ...previews].slice(0, 5));
  }, []);

  const handleImageRemove = useCallback((index: number) => {
    setReferenceImages((prev) => prev.filter((_, i) => i !== index));
    setImagePreviews((prev) => {
      const removed = prev[index];
      if (removed) URL.revokeObjectURL(removed);
      return prev.filter((_, i) => i !== index);
    });
  }, []);

  const handleChipClick = useCallback((key: string) => {
    if (key === "format") setShowFormatPicker((v) => !v);
    if (key === "type") setShowTypePicker((v) => !v);
  }, []);

  const handleChipRemove = useCallback((key: string) => {
    if (key === "type") setOverrides((prev) => ({ ...prev, contentType: undefined }));
    if (key === "client") setOverrides((prev) => ({ ...prev, clientName: null }));
  }, []);

  const handleFormatOverride = useCallback((format: ContentFormat) => {
    setOverrides((prev) => ({ ...prev, format }));
    setShowFormatPicker(false);
  }, []);

  const handleTypeOverride = useCallback((type: ContentType) => {
    setOverrides((prev) => ({ ...prev, contentType: type }));
    setShowTypePicker(false);
  }, []);

  const handleSubmit = useCallback(() => {
    if (!text.trim() || !parsed || generating) return;
    onGenerate({
      raw: text,
      parsed: { ...parsed, format: effectiveFormat, contentType: effectiveType },
      referenceImages,
      overrides,
    });
  }, [text, parsed, generating, onGenerate, effectiveFormat, effectiveType, referenceImages, overrides]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && e.metaKey) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit],
  );

  const needsReference = effectiveFormat === "cinematic" || effectiveFormat === "composite";
  const FormatIcon = FORMAT_ICONS[effectiveFormat];

  return (
    <div className="space-y-4">
      {/* Main input */}
      <div
        className="relative overflow-hidden rounded-xl border transition-colors"
        style={{
          backgroundColor: "var(--color-neutral-800)",
          borderColor: text.trim()
            ? "rgba(178, 40, 72, 0.3)"
            : "rgba(253, 245, 230, 0.08)",
        }}
      >
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="What do you want to make? e.g. &quot;Anti-motivation post about consistency&quot; or &quot;Cinematic reel of Glow Aesthetic clinic&quot;"
          rows={3}
          className="w-full resize-none bg-transparent px-5 pt-5 pb-3 font-[family-name:var(--font-body)] text-[15px] leading-[1.6] text-[color:var(--color-brand-cream)] placeholder:text-[color:var(--color-neutral-500)] focus:outline-none"
        />

        {/* Bottom bar with actions */}
        <div className="flex items-center justify-between border-t px-4 py-2.5" style={{ borderColor: "rgba(253, 245, 230, 0.04)" }}>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 transition-colors"
              style={{
                backgroundColor: referenceImages.length > 0
                  ? "rgba(178, 40, 72, 0.15)"
                  : "transparent",
                color: referenceImages.length > 0
                  ? "var(--color-brand-pink)"
                  : "var(--color-neutral-500)",
              }}
              aria-label="Add reference image"
            >
              <ImageIcon className="size-4" />
              <span className="font-[family-name:var(--font-label)] text-[10px] uppercase" style={{ letterSpacing: "1px" }}>
                {referenceImages.length > 0 ? `${referenceImages.length} ref` : "Reference"}
              </span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => handleImageAdd(e.target.files)}
            />

            {needsReference && referenceImages.length === 0 && (
              <span className="font-[family-name:var(--font-body)] text-[11px] text-[color:var(--color-brand-pink)]" style={{ opacity: 0.7 }}>
                Add a photo for image-to-video
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={generating || !text.trim()}
            className="flex items-center gap-2 rounded-lg px-4 py-2 font-[family-name:var(--font-body)] text-[14px] font-medium transition-opacity"
            style={{
              backgroundColor: "var(--color-brand-red)",
              color: "var(--color-brand-cream)",
              opacity: generating || !text.trim() ? 0.4 : 1,
            }}
          >
            {generating ? (
              "Generating..."
            ) : (
              <>
                <FormatIcon className="size-4" />
                Create
              </>
            )}
          </button>
        </div>
      </div>

      {/* Reference image previews */}
      <AnimatePresence>
        {imagePreviews.length > 0 && (
          <motion.div
            initial={shouldReduceMotion ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={shouldReduceMotion ? { duration: 0 } : houseSpring}
            className="flex gap-2"
          >
            {imagePreviews.map((src, i) => (
              <div key={src} className="group relative">
                <img
                  src={src}
                  alt={`Reference ${i + 1}`}
                  className="size-16 rounded-lg object-cover"
                  style={{ border: "1px solid rgba(253, 245, 230, 0.08)" }}
                />
                <button
                  type="button"
                  onClick={() => handleImageRemove(i)}
                  className="absolute -top-1.5 -right-1.5 flex size-5 items-center justify-center rounded-full opacity-0 transition-opacity group-hover:opacity-100"
                  style={{
                    backgroundColor: "var(--color-neutral-800)",
                    border: "1px solid rgba(253, 245, 230, 0.12)",
                  }}
                  aria-label={`Remove reference ${i + 1}`}
                >
                  <XIcon className="size-3" style={{ color: "var(--color-neutral-300)" }} />
                </button>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Detected signal chips */}
      <AnimatePresence>
        {chips.length > 0 && (
          <motion.div
            initial={shouldReduceMotion ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={shouldReduceMotion ? { duration: 0 } : houseSpring}
            className="flex flex-wrap items-center gap-2"
          >
            {chips.map((chip) => (
              <motion.button
                key={chip.key}
                type="button"
                onClick={() => handleChipClick(chip.key)}
                layout
                initial={shouldReduceMotion ? false : { opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.15 }}
                className="group flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition-colors"
                style={{
                  backgroundColor: "rgba(253, 245, 230, 0.06)",
                  border: "1px solid rgba(253, 245, 230, 0.08)",
                }}
              >
                <span
                  className="font-[family-name:var(--font-label)] text-[9px] uppercase"
                  style={{ letterSpacing: "1px", color: "var(--color-neutral-500)" }}
                >
                  {chip.label}
                </span>
                <span
                  className="font-[family-name:var(--font-body)] text-[12px]"
                  style={{ color: "var(--color-brand-cream)" }}
                >
                  {chip.value}
                </span>
                {chip.removable && (
                  <span
                    onClick={(e) => {
                      e.stopPropagation();
                      handleChipRemove(chip.key);
                    }}
                    className="ml-0.5 opacity-0 transition-opacity group-hover:opacity-60"
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => { if (e.key === "Enter") handleChipRemove(chip.key); }}
                    aria-label={`Remove ${chip.label}`}
                  >
                    <XIcon className="size-3" style={{ color: "var(--color-neutral-400)" }} />
                  </span>
                )}
              </motion.button>
            ))}

            <span
              className="font-[family-name:var(--font-body)] text-[11px]"
              style={{ color: "var(--color-neutral-500)", opacity: 0.6 }}
            >
              click to adjust
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Format picker dropdown */}
      <AnimatePresence>
        {showFormatPicker && (
          <motion.div
            initial={shouldReduceMotion ? false : { opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.15 }}
            className="grid grid-cols-2 gap-2 sm:grid-cols-4"
          >
            {(["static", "animated", "cinematic", "composite"] as ContentFormat[]).map((fmt) => {
              const Icon = FORMAT_ICONS[fmt];
              const active = effectiveFormat === fmt;
              return (
                <button
                  key={fmt}
                  type="button"
                  onClick={() => handleFormatOverride(fmt)}
                  className="rounded-xl p-3 text-left transition-all"
                  style={{
                    backgroundColor: active
                      ? "var(--color-brand-red)"
                      : "var(--color-neutral-800)",
                    border: active
                      ? "1px solid var(--color-brand-red)"
                      : "1px solid rgba(253, 245, 230, 0.08)",
                  }}
                >
                  <Icon
                    className="mb-1.5 size-4"
                    style={{ color: active ? "var(--color-brand-cream)" : "var(--color-neutral-500)" }}
                  />
                  <div
                    className="font-[family-name:var(--font-body)] text-[13px] font-medium"
                    style={{ color: "var(--color-brand-cream)" }}
                  >
                    {getFormatLabel(fmt)}
                  </div>
                  <div
                    className="mt-0.5 font-[family-name:var(--font-body)] text-[11px]"
                    style={{ color: active ? "rgba(253, 245, 230, 0.7)" : "var(--color-neutral-500)" }}
                  >
                    {getFormatDescription(fmt)}
                  </div>
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Content type picker dropdown */}
      <AnimatePresence>
        {showTypePicker && (
          <motion.div
            initial={shouldReduceMotion ? false : { opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.15 }}
            className="flex flex-wrap gap-2"
          >
            {(Object.entries(CONTENT_TYPE_LABELS) as [ContentType, string][]).map(([ct, label]) => {
              const active = effectiveType === ct;
              return (
                <button
                  key={ct}
                  type="button"
                  onClick={() => handleTypeOverride(ct)}
                  className="rounded-lg px-4 py-2 font-[family-name:var(--font-body)] text-[13px] transition-all"
                  style={{
                    backgroundColor: active
                      ? "var(--color-brand-red)"
                      : "var(--color-neutral-800)",
                    color: "var(--color-brand-cream)",
                    border: active
                      ? "1px solid var(--color-brand-red)"
                      : "1px solid rgba(253, 245, 230, 0.08)",
                  }}
                >
                  {label}
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
