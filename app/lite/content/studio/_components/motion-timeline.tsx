"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import type { PlayerRef } from "@remotion/player";

interface MotionTimelineProps {
  playerRef: React.RefObject<PlayerRef | null>;
  durationInFrames: number;
  fps: number;
}

export function MotionTimeline({
  playerRef,
  durationInFrames,
  fps,
}: MotionTimelineProps) {
  const [currentFrame, setCurrentFrame] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const trackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const player = playerRef.current;
    if (!player) return;

    const onFrame = () => {
      const frame = player.getCurrentFrame();
      setCurrentFrame(frame);
    };

    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);

    player.addEventListener("frameupdate", onFrame);
    player.addEventListener("play", onPlay);
    player.addEventListener("pause", onPause);
    return () => {
      player.removeEventListener("frameupdate", onFrame);
      player.removeEventListener("play", onPlay);
      player.removeEventListener("pause", onPause);
    };
  }, [playerRef]);

  const togglePlay = useCallback(() => {
    const player = playerRef.current;
    if (!player) return;
    if (isPlaying) {
      player.pause();
    } else {
      player.play();
    }
  }, [playerRef, isPlaying]);

  const handleScrub = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const track = trackRef.current;
      if (!track) return;
      const rect = track.getBoundingClientRect();
      const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
      const frame = Math.round((x / rect.width) * (durationInFrames - 1));
      playerRef.current?.seekTo(frame);
    },
    [playerRef, durationInFrames],
  );

  const handleDrag = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.buttons !== 1) return;
      handleScrub(e);
    },
    [handleScrub],
  );

  const progress = durationInFrames > 0 ? currentFrame / (durationInFrames - 1) : 0;
  const timeSeconds = (currentFrame / fps).toFixed(1);
  const totalSeconds = ((durationInFrames - 1) / fps).toFixed(1);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "10px 0",
      }}
    >
      <button
        onClick={togglePlay}
        style={{
          width: 32,
          height: 32,
          borderRadius: 6,
          border: "1px solid rgba(253,245,230,0.12)",
          background: "rgba(253,245,230,0.05)",
          color: "var(--color-brand-cream)",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 14,
          flexShrink: 0,
        }}
      >
        {isPlaying ? "⏸" : "▶"}
      </button>

      <div
        ref={trackRef}
        onClick={handleScrub}
        onMouseMove={handleDrag}
        style={{
          flex: 1,
          height: 6,
          borderRadius: 3,
          background: "rgba(253,245,230,0.08)",
          cursor: "pointer",
          position: "relative",
        }}
      >
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            height: "100%",
            width: `${progress * 100}%`,
            borderRadius: 3,
            background: "linear-gradient(90deg, var(--color-brand-red), var(--color-brand-orange))",
            pointerEvents: "none",
          }}
        />
        <div
          style={{
            position: "absolute",
            left: `${progress * 100}%`,
            top: "50%",
            transform: "translate(-50%, -50%)",
            width: 14,
            height: 14,
            borderRadius: "50%",
            background: "var(--color-brand-cream)",
            border: "2px solid var(--color-brand-red)",
            pointerEvents: "none",
          }}
        />
      </div>

      <div
        style={{
          fontFamily: "var(--font-label)",
          fontSize: 12,
          letterSpacing: 1,
          color: "rgba(253,245,230,0.5)",
          flexShrink: 0,
          minWidth: 70,
          textAlign: "right",
        }}
      >
        {timeSeconds}s / {totalSeconds}s
      </div>
    </div>
  );
}
