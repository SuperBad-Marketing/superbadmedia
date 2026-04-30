"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { ChevronDown, Music } from "lucide-react";
import { houseSpring } from "@/lib/design-tokens";

interface SpotifyEmbedProps {
  playlistId?: string;
}

type PlaylistItem = {
  id: string;
  name: string;
  imageUrl: string | null;
  trackCount: number;
};

const DEFAULT_PLAYLIST = "37i9dQZF1DXcBWIGoYBM5M";
const STORAGE_KEY = "superbad-cockpit-spotify-playlist";

export function SpotifyEmbed({ playlistId }: SpotifyEmbedProps) {
  const reducedMotion = useReducedMotion();
  const [selectedId, setSelectedId] = useState<string>(
    () => {
      if (playlistId) return playlistId;
      if (typeof window !== "undefined") {
        return localStorage.getItem(STORAGE_KEY) ?? DEFAULT_PLAYLIST;
      }
      return DEFAULT_PLAYLIST;
    },
  );
  const [playlists, setPlaylists] = useState<PlaylistItem[]>([]);
  const [connected, setConnected] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch("/api/lite/cockpit/spotify/playlists")
      .then((r) => r.json())
      .then((data) => {
        setConnected(data.connected ?? false);
        setPlaylists(data.playlists ?? []);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  const handleSelect = useCallback((id: string) => {
    setSelectedId(id);
    setPickerOpen(false);
    localStorage.setItem(STORAGE_KEY, id);
  }, []);

  const selectedName = playlists.find((p) => p.id === selectedId)?.name;

  return (
    <motion.div
      initial={reducedMotion ? undefined : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={reducedMotion ? { duration: 0 } : houseSpring}
      className="space-y-2"
    >
      {loaded && connected && playlists.length > 0 && (
        <div className="relative">
          <button
            type="button"
            onClick={() => setPickerOpen((p) => !p)}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left transition-colors hover:bg-white/[0.02]"
            style={{
              background: "var(--color-surface-2)",
              border: "1px solid rgba(253, 245, 230, 0.03)",
            }}
          >
            <Music
              size={14}
              strokeWidth={1.5}
              style={{ color: "var(--color-neutral-500)" }}
            />
            <span
              className="flex-1 truncate font-[family-name:var(--font-dm-sans)] text-[13px]"
              style={{ color: "var(--color-neutral-300)" }}
            >
              {selectedName ?? "Choose a playlist"}
            </span>
            <motion.span
              animate={{ rotate: pickerOpen ? 180 : 0 }}
              transition={houseSpring}
            >
              <ChevronDown
                size={14}
                style={{ color: "var(--color-neutral-500)" }}
              />
            </motion.span>
          </button>

          <AnimatePresence>
            {pickerOpen && (
              <motion.div
                initial={reducedMotion ? undefined : { opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={reducedMotion ? { duration: 0 } : { duration: 0.15 }}
                className="absolute z-10 mt-1 max-h-48 w-full overflow-y-auto rounded-xl py-1"
                style={{
                  background: "var(--color-surface-2)",
                  border: "1px solid rgba(253, 245, 230, 0.08)",
                  boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
                }}
              >
                {playlists.map((pl) => (
                  <button
                    key={pl.id}
                    type="button"
                    onClick={() => handleSelect(pl.id)}
                    className="flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors hover:bg-white/[0.04]"
                  >
                    {pl.imageUrl ? (
                      <img
                        src={pl.imageUrl}
                        alt=""
                        className="size-7 shrink-0 rounded"
                      />
                    ) : (
                      <span
                        className="flex size-7 shrink-0 items-center justify-center rounded"
                        style={{ background: "var(--color-surface-1)" }}
                      >
                        <Music
                          size={12}
                          style={{ color: "var(--color-neutral-500)" }}
                        />
                      </span>
                    )}
                    <span
                      className="flex-1 truncate font-[family-name:var(--font-dm-sans)] text-[13px]"
                      style={{
                        color:
                          pl.id === selectedId
                            ? "var(--color-neutral-100)"
                            : "var(--color-neutral-300)",
                      }}
                    >
                      {pl.name}
                    </span>
                    <span
                      className="shrink-0 font-[family-name:var(--font-dm-sans)] text-[11px] tabular-nums"
                      style={{ color: "var(--color-neutral-600)" }}
                    >
                      {pl.trackCount}
                    </span>
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      <div
        className="overflow-hidden rounded-xl"
        style={{
          border: "1px solid rgba(253, 245, 230, 0.03)",
        }}
      >
        <iframe
          src={`https://open.spotify.com/embed/playlist/${selectedId}?utm_source=generator&theme=0`}
          width="100%"
          height="152"
          allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
          loading="lazy"
          style={{
            border: 0,
            borderRadius: "12px",
            display: "block",
          }}
          title="Spotify"
        />
      </div>
    </motion.div>
  );
}
