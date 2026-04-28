"use client";

import { useRef, useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";

interface HeroVideoLoopProps {
  src: string;
  posterUrl?: string;
  overlayOpacity?: number;
  className?: string;
}

export function HeroVideoLoop({
  src,
  posterUrl,
  overlayOpacity = 0.55,
  className,
}: HeroVideoLoopProps) {
  const shouldReduceMotion = useReducedMotion();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || shouldReduceMotion) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          video.play().catch(() => {});
        } else {
          video.pause();
        }
      },
      { threshold: 0.25 },
    );
    observer.observe(video);
    return () => observer.disconnect();
  }, [shouldReduceMotion]);

  if (shouldReduceMotion && posterUrl) {
    return (
      <div
        className={className}
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: `url(${posterUrl})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundColor: `rgba(26, 26, 24, ${overlayOpacity})`,
          }}
        />
      </div>
    );
  }

  return (
    <div className={className} style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
      <motion.video
        ref={videoRef}
        initial={{ opacity: 0 }}
        animate={{ opacity: loaded ? 1 : 0 }}
        transition={{ duration: 1.2, ease: "easeOut" }}
        src={src}
        poster={posterUrl}
        muted
        loop
        playsInline
        preload="auto"
        onCanPlayThrough={() => setLoaded(true)}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundColor: `rgba(26, 26, 24, ${overlayOpacity})`,
        }}
      />
    </div>
  );
}
