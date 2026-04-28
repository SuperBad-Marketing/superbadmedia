"use client";

import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { MusicIcon, PlayIcon, PauseIcon, CheckIcon } from "lucide-react";
import { houseSpring } from "@/lib/design-tokens";
import type { MusicMood } from "@/lib/db/schema/music-library";

export interface MusicTrack {
  id: string;
  name: string;
  artist: string | null;
  fileUrl: string;
  durationSec: number | null;
  bpm: number | null;
  mood: MusicMood | null;
}

interface MusicPickerProps {
  tracks: MusicTrack[];
  selectedId: string | null;
  onSelect: (track: MusicTrack) => void;
  loading: boolean;
}

const MOOD_LABELS: Record<MusicMood, string> = {
  warm: "Warm",
  bold: "Bold",
  minimal: "Minimal",
  dark: "Dark",
  upbeat: "Upbeat",
  cinematic: "Cinematic",
  ambient: "Ambient",
};

export function MusicPicker({
  tracks,
  selectedId,
  onSelect,
  loading,
}: MusicPickerProps) {
  const shouldReduceMotion = useReducedMotion();
  const [filterMood, setFilterMood] = useState<MusicMood | "all">("all");
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [audioRef, setAudioRef] = useState<HTMLAudioElement | null>(null);

  const filtered =
    filterMood === "all"
      ? tracks
      : tracks.filter((t) => t.mood === filterMood);

  function togglePlay(track: MusicTrack) {
    if (playingId === track.id) {
      audioRef?.pause();
      setPlayingId(null);
      return;
    }

    audioRef?.pause();
    const audio = new Audio(track.fileUrl);
    audio.volume = 0.5;
    audio.play();
    audio.onended = () => setPlayingId(null);
    setAudioRef(audio);
    setPlayingId(track.id);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <MusicIcon
          className="size-3.5"
          style={{ color: "var(--color-brand-pink)" }}
        />
        <span
          className="font-[family-name:var(--font-label)] text-[10px] uppercase"
          style={{ letterSpacing: "1.5px", color: "var(--color-neutral-500)" }}
        >
          Music
        </span>
      </div>

      {/* Mood filters */}
      <div className="flex flex-wrap gap-1">
        {(["all", ...Object.keys(MOOD_LABELS)] as const).map((mood) => (
          <button
            key={mood}
            type="button"
            onClick={() => setFilterMood(mood as MusicMood | "all")}
            className="rounded-md px-2 py-1 font-[family-name:var(--font-body)] text-[10px] uppercase transition-colors"
            style={{
              letterSpacing: "0.5px",
              backgroundColor:
                filterMood === mood
                  ? "rgba(178, 40, 72, 0.15)"
                  : "rgba(253, 245, 230, 0.04)",
              color:
                filterMood === mood
                  ? "var(--color-brand-pink)"
                  : "var(--color-neutral-500)",
            }}
          >
            {mood === "all" ? "All" : MOOD_LABELS[mood as MusicMood]}
          </button>
        ))}
      </div>

      {/* Track list */}
      {loading ? (
        <div
          className="py-4 text-center font-[family-name:var(--font-body)] text-[12px]"
          style={{ color: "var(--color-neutral-500)" }}
        >
          Loading tracks...
        </div>
      ) : filtered.length === 0 ? (
        <div
          className="py-4 text-center font-[family-name:var(--font-body)] text-[12px]"
          style={{ color: "var(--color-neutral-500)" }}
        >
          {tracks.length === 0
            ? "No tracks yet. Upload music via Settings."
            : "No tracks match this mood."}
        </div>
      ) : (
        <div className="space-y-1">
          {filtered.map((track, i) => {
            const isSelected = selectedId === track.id;
            const isPlaying = playingId === track.id;

            return (
              <motion.div
                key={track.id}
                initial={shouldReduceMotion ? false : { opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={
                  shouldReduceMotion
                    ? { duration: 0 }
                    : { ...houseSpring, delay: i * 0.02 }
                }
                className="flex items-center gap-2 rounded-lg p-2 transition-colors"
                style={{
                  backgroundColor: isSelected
                    ? "rgba(178, 40, 72, 0.1)"
                    : "transparent",
                }}
              >
                <button
                  type="button"
                  onClick={() => togglePlay(track)}
                  className="flex size-7 shrink-0 items-center justify-center rounded-full transition-colors"
                  style={{
                    backgroundColor: "rgba(253, 245, 230, 0.06)",
                  }}
                  aria-label={isPlaying ? "Pause" : "Preview track"}
                >
                  {isPlaying ? (
                    <PauseIcon
                      className="size-3"
                      style={{ color: "var(--color-brand-orange)" }}
                    />
                  ) : (
                    <PlayIcon
                      className="size-3"
                      style={{ color: "var(--color-neutral-400)" }}
                    />
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => onSelect(track)}
                  className="flex min-w-0 flex-1 flex-col text-left"
                >
                  <span
                    className="truncate font-[family-name:var(--font-body)] text-[12px] font-medium"
                    style={{ color: "var(--color-brand-cream)" }}
                  >
                    {track.name}
                  </span>
                  <span
                    className="truncate font-[family-name:var(--font-body)] text-[10px]"
                    style={{ color: "var(--color-neutral-500)" }}
                  >
                    {[
                      track.artist,
                      track.durationSec
                        ? `${Math.floor(track.durationSec / 60)}:${String(track.durationSec % 60).padStart(2, "0")}`
                        : null,
                      track.bpm ? `${track.bpm} BPM` : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </button>

                {isSelected && (
                  <CheckIcon
                    className="size-3.5 shrink-0"
                    style={{ color: "var(--color-brand-pink)" }}
                  />
                )}
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
