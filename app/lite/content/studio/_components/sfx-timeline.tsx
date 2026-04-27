"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import type { PlayerRef } from "@remotion/player";
import type { SfxCueData, SfxSound } from "@/lib/content-studio/motion/types";
import { BUILTIN_SFX } from "@/lib/content-studio/motion/types";
import { getSfxLibraryAction } from "@/app/lite/admin/settings/sfx/actions";

interface SfxTimelineProps {
  cues: SfxCueData[];
  onChange: (cues: SfxCueData[]) => void;
  durationInFrames: number;
  fps: number;
  playerRef: React.RefObject<PlayerRef | null>;
}

export function SfxTimeline({
  cues,
  onChange,
  durationInFrames,
  fps,
  playerRef,
}: SfxTimelineProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [sounds, setSounds] = useState<SfxSound[]>(BUILTIN_SFX);
  const [activeSfxId, setActiveSfxId] = useState(BUILTIN_SFX[2].id);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);

  useEffect(() => {
    getSfxLibraryAction().then(({ sounds: all }) => {
      setSounds(all);
    });
  }, []);

  const activeSound = sounds.find((s) => s.id === activeSfxId) ?? sounds[0];

  const cueColor = useCallback(
    (cue: SfxCueData) => sounds.find((s) => s.id === cue.sfxId)?.color ?? "#9B51E0",
    [sounds],
  );

  const cueName = useCallback(
    (cue: SfxCueData) => sounds.find((s) => s.id === cue.sfxId)?.name ?? "?",
    [sounds],
  );

  const frameToPercent = useCallback(
    (frame: number) =>
      durationInFrames > 1 ? (frame / (durationInFrames - 1)) * 100 : 0,
    [durationInFrames],
  );

  const xToFrame = useCallback(
    (clientX: number) => {
      const track = trackRef.current;
      if (!track) return 0;
      const rect = track.getBoundingClientRect();
      const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
      return Math.round((x / rect.width) * (durationInFrames - 1));
    },
    [durationInFrames],
  );

  const handleTrackClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (draggingIndex !== null) return;
      const target = e.target as HTMLElement;
      if (target.dataset.cueIndex) return;

      const frame = xToFrame(e.clientX);
      const newCue: SfxCueData = {
        sfxId: activeSound.id,
        url: activeSound.fileUrl,
        startFrame: frame,
        volume: 0.5,
      };
      const next = [...cues, newCue];
      onChange(next);
      setSelectedIndex(next.length - 1);
      playerRef.current?.seekTo(frame);
    },
    [activeSound, cues, onChange, xToFrame, draggingIndex, playerRef],
  );

  const handleCueClick = useCallback(
    (e: React.MouseEvent, index: number) => {
      e.stopPropagation();
      setSelectedIndex(selectedIndex === index ? null : index);
      playerRef.current?.seekTo(cues[index].startFrame);
    },
    [selectedIndex, cues, playerRef],
  );

  const handleCueDragStart = useCallback(
    (e: React.MouseEvent, index: number) => {
      e.stopPropagation();
      e.preventDefault();
      setDraggingIndex(index);
      setSelectedIndex(index);

      const handleMove = (me: MouseEvent) => {
        const frame = xToFrame(me.clientX);
        onChange(
          cues.map((c, i) => (i === index ? { ...c, startFrame: frame } : c)),
        );
      };

      const handleUp = () => {
        setDraggingIndex(null);
        window.removeEventListener("mousemove", handleMove);
        window.removeEventListener("mouseup", handleUp);
      };

      window.addEventListener("mousemove", handleMove);
      window.addEventListener("mouseup", handleUp);
    },
    [cues, onChange, xToFrame],
  );

  const handleVolumeChange = useCallback(
    (volume: number) => {
      if (selectedIndex === null) return;
      onChange(
        cues.map((c, i) => (i === selectedIndex ? { ...c, volume } : c)),
      );
    },
    [cues, onChange, selectedIndex],
  );

  const handleDelete = useCallback(() => {
    if (selectedIndex === null) return;
    onChange(cues.filter((_, i) => i !== selectedIndex));
    setSelectedIndex(null);
  }, [cues, onChange, selectedIndex]);

  const handlePreview = useCallback((sound: SfxSound) => {
    try {
      const url = sound.fileUrl.startsWith("http")
        ? sound.fileUrl
        : `/${sound.fileUrl}`;
      const audio = new Audio(url);
      audio.volume = 0.5;
      audio.play();
    } catch {}
  }, []);

  const selectedCue = selectedIndex !== null ? cues[selectedIndex] : null;

  return (
    <div
      style={{
        marginTop: 16,
        padding: "14px 0",
        borderTop: "1px solid rgba(253,245,230,0.06)",
      }}
    >
      <div
        style={{
          fontFamily: "var(--font-label)",
          fontSize: 11,
          letterSpacing: 2,
          textTransform: "uppercase",
          color: "rgba(253,245,230,0.4)",
          marginBottom: 10,
        }}
      >
        Sound Effects
      </div>

      {/* SFX type buttons */}
      <div
        style={{
          display: "flex",
          gap: 6,
          marginBottom: 12,
          flexWrap: "wrap",
        }}
      >
        {sounds.map((sound) => (
          <button
            key={sound.id}
            onClick={() => {
              setActiveSfxId(sound.id);
              handlePreview(sound);
            }}
            style={{
              padding: "5px 12px",
              borderRadius: 6,
              border:
                activeSfxId === sound.id
                  ? `1px solid ${sound.color}`
                  : "1px solid rgba(253,245,230,0.1)",
              background:
                activeSfxId === sound.id
                  ? `${sound.color}18`
                  : "rgba(253,245,230,0.03)",
              color:
                activeSfxId === sound.id
                  ? sound.color
                  : "var(--color-brand-cream)",
              fontFamily: "var(--font-label)",
              fontSize: 11,
              letterSpacing: 1,
              cursor: "pointer",
              transition: "all 0.15s",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: sound.color,
                opacity: activeSfxId === sound.id ? 1 : 0.4,
                flexShrink: 0,
              }}
            />
            {sound.name}
          </button>
        ))}
      </div>

      {/* Timeline track */}
      <div
        ref={trackRef}
        onClick={handleTrackClick}
        style={{
          position: "relative",
          height: 36,
          borderRadius: 6,
          background: "rgba(253,245,230,0.03)",
          border: "1px solid rgba(253,245,230,0.06)",
          cursor: "crosshair",
          overflow: "visible",
        }}
      >
        {/* Frame ruler ticks */}
        {Array.from({
          length: Math.min(Math.floor(durationInFrames / fps), 10),
        }).map((_, i) => {
          const frame = (i + 1) * fps;
          const pct = frameToPercent(frame);
          if (pct > 99) return null;
          return (
            <div
              key={i}
              style={{
                position: "absolute",
                left: `${pct}%`,
                top: 0,
                bottom: 0,
                width: 1,
                background: "rgba(253,245,230,0.06)",
                pointerEvents: "none",
              }}
            />
          );
        })}

        {/* Cue markers */}
        {cues.map((cue, i) => {
          const pct = frameToPercent(cue.startFrame);
          const isSelected = selectedIndex === i;
          const color = cueColor(cue);

          return (
            <div
              key={i}
              data-cue-index={i}
              onMouseDown={(e) => handleCueDragStart(e, i)}
              onClick={(e) => handleCueClick(e, i)}
              style={{
                position: "absolute",
                left: `${pct}%`,
                top: "50%",
                transform: "translate(-50%, -50%)",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 2,
                cursor: "grab",
                zIndex: isSelected ? 10 : 1,
                userSelect: "none",
              }}
            >
              <div
                style={{
                  width: isSelected ? 14 : 10,
                  height: isSelected ? 14 : 10,
                  borderRadius: "50%",
                  background: color,
                  border: isSelected
                    ? "2px solid var(--color-brand-cream)"
                    : "none",
                  boxShadow: isSelected
                    ? `0 0 8px ${color}60`
                    : `0 0 4px ${color}30`,
                  transition: "all 0.1s",
                  pointerEvents: "none",
                }}
              />
              {isSelected && (
                <div
                  style={{
                    fontFamily: "var(--font-label)",
                    fontSize: 9,
                    letterSpacing: 0.5,
                    color,
                    whiteSpace: "nowrap",
                    pointerEvents: "none",
                    position: "absolute",
                    top: -14,
                  }}
                >
                  {cueName(cue)} · {(cue.startFrame / fps).toFixed(1)}s
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Time labels */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontFamily: "var(--font-label)",
          fontSize: 9,
          color: "rgba(253,245,230,0.25)",
          marginTop: 2,
          letterSpacing: 0.5,
        }}
      >
        <span>0.0s</span>
        <span>{((durationInFrames - 1) / fps).toFixed(1)}s</span>
      </div>

      {/* Selected cue controls */}
      {selectedCue && (
        <div
          style={{
            marginTop: 10,
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontFamily: "var(--font-label)",
              fontSize: 11,
              letterSpacing: 1,
              color: cueColor(selectedCue),
              flexShrink: 0,
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: cueColor(selectedCue),
              }}
            />
            {cueName(selectedCue)}
          </div>

          <div
            style={{
              fontFamily: "var(--font-label)",
              fontSize: 10,
              color: "rgba(253,245,230,0.35)",
              flexShrink: 0,
            }}
          >
            Vol
          </div>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={Math.round(selectedCue.volume * 100)}
            onChange={(e) => handleVolumeChange(Number(e.target.value) / 100)}
            style={{
              flex: 1,
              maxWidth: 120,
              accentColor: cueColor(selectedCue),
              cursor: "pointer",
            }}
          />
          <div
            style={{
              fontFamily: "var(--font-body)",
              fontSize: 11,
              color: "rgba(253,245,230,0.5)",
              minWidth: 32,
            }}
          >
            {Math.round(selectedCue.volume * 100)}%
          </div>

          <button
            onClick={handleDelete}
            style={{
              padding: "3px 10px",
              borderRadius: 4,
              border: "1px solid rgba(235,87,87,0.3)",
              background: "rgba(235,87,87,0.08)",
              color: "#EB5757",
              fontFamily: "var(--font-label)",
              fontSize: 10,
              letterSpacing: 0.5,
              cursor: "pointer",
              marginLeft: "auto",
              transition: "all 0.15s",
            }}
          >
            Remove
          </button>
        </div>
      )}

      {/* Hint */}
      {cues.length === 0 && (
        <div
          style={{
            fontFamily: "var(--font-body)",
            fontSize: 12,
            color: "rgba(253,245,230,0.25)",
            marginTop: 6,
            fontStyle: "italic",
          }}
        >
          Select a sound, then click the timeline to place it.
        </div>
      )}
    </div>
  );
}
