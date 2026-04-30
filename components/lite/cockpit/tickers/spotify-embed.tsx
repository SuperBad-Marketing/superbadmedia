"use client";

import { motion, useReducedMotion } from "framer-motion";
import { houseSpring } from "@/lib/design-tokens";

interface SpotifyEmbedProps {
  playlistId?: string;
}

const DEFAULT_PLAYLIST = "37i9dQZF1DXcBWIGoYBM5M";

export function SpotifyEmbed({ playlistId }: SpotifyEmbedProps) {
  const reducedMotion = useReducedMotion();
  const id = playlistId ?? DEFAULT_PLAYLIST;

  return (
    <motion.div
      initial={reducedMotion ? undefined : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={reducedMotion ? { duration: 0 } : houseSpring}
      className="overflow-hidden rounded-xl"
      style={{
        border: "1px solid rgba(253, 245, 230, 0.03)",
      }}
    >
      <iframe
        src={`https://open.spotify.com/embed/playlist/${id}?utm_source=generator&theme=0`}
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
    </motion.div>
  );
}
