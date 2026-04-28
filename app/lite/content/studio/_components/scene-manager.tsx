"use client";

import { motion, Reorder, useReducedMotion } from "framer-motion";
import { PlusIcon, GripVerticalIcon, TrashIcon, FilmIcon } from "lucide-react";
import { houseSpring } from "@/lib/design-tokens";

export interface Scene {
  id: string;
  prompt: string;
  durationSec: number;
  status: "pending" | "generating" | "ready" | "failed";
  thumbnailUrl?: string;
  outputUrl?: string;
}

interface SceneManagerProps {
  scenes: Scene[];
  onReorder: (scenes: Scene[]) => void;
  onAdd: () => void;
  onRemove: (id: string) => void;
  onUpdatePrompt: (id: string, prompt: string) => void;
  onUpdateDuration: (id: string, sec: number) => void;
  maxScenes?: number;
}

export function SceneManager({
  scenes,
  onReorder,
  onAdd,
  onRemove,
  onUpdatePrompt,
  onUpdateDuration,
  maxScenes = 6,
}: SceneManagerProps) {
  const shouldReduceMotion = useReducedMotion();
  const totalDuration = scenes.reduce((sum, s) => sum + s.durationSec, 0);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className="font-[family-name:var(--font-label)] text-[10px] uppercase"
            style={{ letterSpacing: "1.5px", color: "var(--color-neutral-500)" }}
          >
            Scenes
          </span>
          <span
            className="font-[family-name:var(--font-body)] text-[10px] tabular-nums"
            style={{ color: "var(--color-neutral-500)" }}
          >
            {scenes.length} scene{scenes.length !== 1 ? "s" : ""} · {totalDuration}s
          </span>
        </div>
        {scenes.length < maxScenes && (
          <button
            type="button"
            onClick={onAdd}
            className="flex items-center gap-1 rounded-md px-2 py-1 font-[family-name:var(--font-body)] text-[11px] transition-colors"
            style={{
              backgroundColor: "rgba(253, 245, 230, 0.06)",
              color: "var(--color-neutral-400)",
            }}
          >
            <PlusIcon className="size-3" />
            Add scene
          </button>
        )}
      </div>

      <Reorder.Group
        axis="y"
        values={scenes}
        onReorder={onReorder}
        className="space-y-2"
      >
        {scenes.map((scene, i) => (
          <Reorder.Item
            key={scene.id}
            value={scene}
            initial={shouldReduceMotion ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={
              shouldReduceMotion
                ? { duration: 0 }
                : { ...houseSpring, delay: i * 0.03 }
            }
          >
            <div
              className="flex items-start gap-2 rounded-xl p-3"
              style={{
                backgroundColor: "var(--color-neutral-800)",
                border: "1px solid rgba(253, 245, 230, 0.06)",
              }}
            >
              {/* Drag handle */}
              <div
                className="mt-1.5 cursor-grab active:cursor-grabbing"
                style={{ color: "var(--color-neutral-600)" }}
              >
                <GripVerticalIcon className="size-3.5" />
              </div>

              {/* Thumbnail / placeholder */}
              <div
                className="flex size-12 shrink-0 items-center justify-center rounded-lg"
                style={{
                  backgroundColor: "rgba(253, 245, 230, 0.04)",
                  overflow: "hidden",
                }}
              >
                {scene.thumbnailUrl ? (
                  <img
                    src={scene.thumbnailUrl}
                    alt=""
                    className="size-full object-cover"
                  />
                ) : (
                  <FilmIcon
                    className="size-4"
                    style={{ color: "var(--color-neutral-500)" }}
                  />
                )}
              </div>

              {/* Scene content */}
              <div className="min-w-0 flex-1 space-y-1.5">
                <div className="flex items-center gap-2">
                  <span
                    className="font-[family-name:var(--font-label)] text-[9px] uppercase"
                    style={{
                      letterSpacing: "1px",
                      color: "var(--color-neutral-500)",
                    }}
                  >
                    Scene {i + 1}
                  </span>
                  <span
                    className="rounded px-1.5 py-0.5 font-[family-name:var(--font-body)] text-[9px]"
                    style={{
                      backgroundColor:
                        scene.status === "ready"
                          ? "rgba(123, 174, 126, 0.15)"
                          : scene.status === "generating"
                            ? "rgba(242, 140, 82, 0.15)"
                            : scene.status === "failed"
                              ? "rgba(178, 40, 72, 0.15)"
                              : "rgba(253, 245, 230, 0.04)",
                      color:
                        scene.status === "ready"
                          ? "#7BAE7E"
                          : scene.status === "generating"
                            ? "var(--color-brand-orange)"
                            : scene.status === "failed"
                              ? "var(--color-brand-red)"
                              : "var(--color-neutral-500)",
                    }}
                  >
                    {scene.status}
                  </span>
                </div>

                <textarea
                  value={scene.prompt}
                  onChange={(e) => onUpdatePrompt(scene.id, e.target.value)}
                  placeholder="Describe this scene..."
                  rows={2}
                  className="w-full resize-none rounded-lg px-2.5 py-1.5 font-[family-name:var(--font-body)] text-[12px] outline-none"
                  style={{
                    backgroundColor: "rgba(253, 245, 230, 0.03)",
                    color: "var(--color-brand-cream)",
                    border: "1px solid rgba(253, 245, 230, 0.06)",
                  }}
                />

                <div className="flex items-center gap-2">
                  <label
                    className="font-[family-name:var(--font-body)] text-[10px]"
                    style={{ color: "var(--color-neutral-500)" }}
                  >
                    Duration
                  </label>
                  <input
                    type="number"
                    min={2}
                    max={15}
                    value={scene.durationSec}
                    onChange={(e) =>
                      onUpdateDuration(scene.id, Number(e.target.value))
                    }
                    className="w-14 rounded px-2 py-1 font-[family-name:var(--font-body)] text-[11px] tabular-nums outline-none"
                    style={{
                      backgroundColor: "rgba(253, 245, 230, 0.03)",
                      color: "var(--color-brand-cream)",
                      border: "1px solid rgba(253, 245, 230, 0.06)",
                    }}
                  />
                  <span
                    className="font-[family-name:var(--font-body)] text-[10px]"
                    style={{ color: "var(--color-neutral-500)" }}
                  >
                    sec
                  </span>
                </div>
              </div>

              {/* Remove button */}
              {scenes.length > 1 && (
                <button
                  type="button"
                  onClick={() => onRemove(scene.id)}
                  className="mt-1 rounded-md p-1.5 transition-colors"
                  style={{ color: "var(--color-neutral-600)" }}
                  aria-label="Remove scene"
                >
                  <TrashIcon className="size-3.5" />
                </button>
              )}
            </div>
          </Reorder.Item>
        ))}
      </Reorder.Group>

      {/* Timeline bar */}
      <div
        className="flex h-2 overflow-hidden rounded-full"
        style={{ backgroundColor: "rgba(253, 245, 230, 0.04)" }}
      >
        {scenes.map((scene, i) => (
          <div
            key={scene.id}
            className="h-full"
            style={{
              width: `${(scene.durationSec / totalDuration) * 100}%`,
              backgroundColor:
                scene.status === "ready"
                  ? "#7BAE7E"
                  : scene.status === "generating"
                    ? "var(--color-brand-orange)"
                    : i % 2 === 0
                      ? "var(--color-brand-red)"
                      : "var(--color-brand-pink)",
              borderRight:
                i < scenes.length - 1
                  ? "1px solid var(--color-neutral-900)"
                  : "none",
            }}
          />
        ))}
      </div>
    </div>
  );
}
