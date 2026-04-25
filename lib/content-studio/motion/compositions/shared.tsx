import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

export function useFadeIn(startFrame: number, durationFrames: number = 15) {
  const frame = useCurrentFrame();
  return interpolate(frame, [startFrame, startFrame + durationFrames], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
}

export function useSlideUp(
  startFrame: number,
  distancePx: number = 40,
) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const progress = spring({
    frame: frame - startFrame,
    fps,
    config: { mass: 1, stiffness: 220, damping: 25 },
  });
  const translateY = interpolate(progress, [0, 1], [distancePx, 0]);
  const opacity = interpolate(progress, [0, 1], [0, 1]);
  return { translateY, opacity };
}

export function useScaleIn(startFrame: number) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const progress = spring({
    frame: frame - startFrame,
    fps,
    config: { mass: 1, stiffness: 300, damping: 30 },
  });
  return {
    scaleX: interpolate(progress, [0, 1], [0, 1]),
    opacity: interpolate(progress, [0, 1], [0, 1]),
  };
}

export function useGradientPulse() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pulse = Math.sin((frame / fps) * Math.PI * 0.8) * 0.04 + 0.12;
  return pulse;
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
