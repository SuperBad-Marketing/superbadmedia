import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

export const SPRING_SNAPPY = { mass: 0.7, stiffness: 380, damping: 14 };
export const SPRING_SMOOTH = { mass: 1, stiffness: 220, damping: 22 };
export const SPRING_HEAVY = { mass: 1.4, stiffness: 160, damping: 16 };

export function useFadeIn(startFrame: number, durationFrames = 12) {
  const frame = useCurrentFrame();
  return interpolate(frame, [startFrame, startFrame + durationFrames], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
}

export function useSlideUp(startFrame: number, distancePx = 30) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const progress = spring({
    frame: frame - startFrame,
    fps,
    config: SPRING_SNAPPY,
  });
  return {
    translateY: interpolate(progress, [0, 1], [distancePx, 0]),
    opacity: interpolate(progress, [0, 1], [0, 1]),
  };
}

export function useScaleIn(startFrame: number) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const progress = spring({
    frame: frame - startFrame,
    fps,
    config: SPRING_SNAPPY,
  });
  return {
    scaleX: interpolate(progress, [0, 1], [0, 1]),
    opacity: interpolate(progress, [0, 1], [0, 1]),
  };
}

export function useSlamIn(startFrame: number) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const progress = spring({
    frame: frame - startFrame,
    fps,
    config: { mass: 0.5, stiffness: 500, damping: 12 },
  });
  return {
    scale: interpolate(progress, [0, 1], [0.85, 1]),
    opacity: interpolate(progress, [0, 0.4], [0, 1], {
      extrapolateRight: "clamp",
    }),
    y: interpolate(progress, [0, 1], [20, 0]),
  };
}

export function useSlideFromEdge(
  startFrame: number,
  direction: "left" | "right" = "left",
  distancePx = 50,
) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const progress = spring({
    frame: frame - startFrame,
    fps,
    config: SPRING_SNAPPY,
  });
  const sign = direction === "left" ? -1 : 1;
  return {
    translateX: interpolate(progress, [0, 1], [distancePx * sign, 0]),
    opacity: interpolate(progress, [0, 1], [0, 1]),
  };
}

export function useBlurReveal(
  startFrame: number,
  maxBlur = 12,
  durationFrames = 18,
) {
  const frame = useCurrentFrame();
  return {
    blur: interpolate(
      frame,
      [startFrame, startFrame + durationFrames],
      [maxBlur, 0],
      { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
    ),
    opacity: interpolate(
      frame,
      [startFrame, startFrame + durationFrames * 0.5],
      [0, 1],
      { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
    ),
  };
}

export function useGradientPulse() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return Math.sin((frame / fps) * Math.PI * 0.6) * 0.06 + 0.25;
}

export function useCountUp(
  startFrame: number,
  endFrame: number,
  targetValue: number,
) {
  const frame = useCurrentFrame();
  if (frame < startFrame) return 0;
  if (frame >= endFrame) return targetValue;
  const progress = (frame - startFrame) / (endFrame - startFrame);
  return Math.round(progress * targetValue);
}
