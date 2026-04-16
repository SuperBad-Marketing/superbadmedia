"use client";

import * as React from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Paperclip, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { houseSpring } from "@/lib/design-tokens";

/**
 * Drag-drop + click-to-attach strip for outbound drafts (spec §4.3 UI-10
 * upgrade of UI-8's download-only stub). Keeps file refs client-side
 * only — the server action that owns the draft converts them to the
 * Graph upload payload at send/save time.
 *
 * Cap enforced here (3 MB per file) mirrors `lib/graph/upload-attachment.ts`
 * `SMALL_ATTACHMENT_CAP_BYTES`. Larger files surface the voice toast
 * "That file didn't want to go. Try again or drop a different one."
 * (spec §4.6). Large-file path deferred to PATCHES_OWED.
 */

const MAX_FILE_BYTES = 3 * 1024 * 1024;

export interface AttachmentUploadFile {
  file: File;
  id: string;
}

export function AttachmentUpload({
  files,
  onChange,
  onError,
  disabled,
}: {
  files: AttachmentUploadFile[];
  onChange: (next: AttachmentUploadFile[]) => void;
  onError?: (message: string) => void;
  disabled?: boolean;
}) {
  const reducedMotion = useReducedMotion();
  const [dragging, setDragging] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const addFiles = React.useCallback(
    (incoming: File[]) => {
      const next: AttachmentUploadFile[] = [...files];
      let rejected = 0;
      for (const f of incoming) {
        if (f.size > MAX_FILE_BYTES) {
          rejected += 1;
          continue;
        }
        next.push({
          file: f,
          id:
            typeof crypto !== "undefined" && "randomUUID" in crypto
              ? crypto.randomUUID()
              : `${f.name}-${f.size}-${Date.now()}`,
        });
      }
      if (rejected > 0) {
        onError?.(
          "That file didn't want to go. Try again or drop a different one.",
        );
      }
      onChange(next);
    },
    [files, onChange, onError],
  );

  const onDrop = React.useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setDragging(false);
      if (disabled) return;
      const dropped = Array.from(e.dataTransfer.files ?? []);
      if (dropped.length > 0) addFiles(dropped);
    },
    [addFiles, disabled],
  );

  const remove = React.useCallback(
    (id: string) => {
      onChange(files.filter((f) => f.id !== id));
    },
    [files, onChange],
  );

  return (
    <div className="flex flex-col gap-2">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={cn(
          "flex items-center justify-between gap-3 rounded-sm border border-dashed px-3 py-2",
          dragging
            ? "border-[color:var(--color-accent-cta)] bg-[color:var(--color-surface-2)]"
            : "border-[color:var(--color-neutral-700)] bg-transparent",
          disabled && "opacity-50",
        )}
      >
        <div className="flex items-center gap-2 font-[family-name:var(--font-dm-sans)] text-[length:var(--text-small)] text-[color:var(--color-neutral-500)]">
          <Paperclip size={12} strokeWidth={1.75} aria-hidden />
          <span>
            {dragging
              ? "Drop to attach."
              : files.length === 0
                ? "Drop files here, or"
                : `${files.length} attached · drop more, or`}
          </span>
          <button
            type="button"
            disabled={disabled}
            onClick={() => inputRef.current?.click()}
            className={cn(
              "rounded-sm px-1 underline decoration-dotted underline-offset-2",
              "text-[color:var(--color-neutral-100)]",
              "outline-none transition-colors hover:text-[color:var(--color-accent-cta)]",
              "disabled:cursor-not-allowed disabled:opacity-50",
            )}
          >
            browse
          </button>
        </div>
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => {
            const picked = Array.from(e.target.files ?? []);
            if (picked.length > 0) addFiles(picked);
            e.target.value = "";
          }}
        />
      </div>

      <AnimatePresence initial={false}>
        {files.length > 0 && (
          <motion.ul
            key="attached-list"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={reducedMotion ? { duration: 0.15 } : houseSpring}
            className="flex flex-col gap-1 overflow-hidden"
          >
            {files.map((f) => (
              <li
                key={f.id}
                className="flex items-center justify-between gap-2 rounded-sm bg-[color:var(--color-surface-2)] px-2 py-1"
              >
                <span className="truncate font-[family-name:var(--font-dm-sans)] text-[length:var(--text-small)] text-[color:var(--color-neutral-100)]">
                  {f.file.name}
                </span>
                <span className="font-[family-name:var(--font-dm-sans)] text-[length:var(--text-micro)] text-[color:var(--color-neutral-500)]">
                  {formatBytes(f.file.size)}
                </span>
                <button
                  type="button"
                  onClick={() => remove(f.id)}
                  title="Remove"
                  className="flex h-5 w-5 items-center justify-center rounded-sm text-[color:var(--color-neutral-500)] outline-none transition-colors hover:text-[color:var(--color-brand-red)]"
                >
                  <X size={12} strokeWidth={1.75} aria-hidden />
                </button>
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export { MAX_FILE_BYTES };
