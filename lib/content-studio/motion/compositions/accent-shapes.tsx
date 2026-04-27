import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { evolvePath } from "@remotion/paths";

interface AccentLineProps {
  startFrame: number;
  width: number;
  height?: number;
  color: string;
  direction?: "left-to-right" | "right-to-left" | "center-out";
  style?: React.CSSProperties;
}

export const AccentLine: React.FC<AccentLineProps> = ({
  startFrame,
  width: lineWidth,
  height = 3,
  color,
  direction = "left-to-right",
  style,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const progress = spring({
    frame: frame - startFrame,
    fps,
    config: { mass: 1, stiffness: 200, damping: 20 },
  });

  if (direction === "center-out") {
    return (
      <div
        style={{
          width: lineWidth,
          height,
          borderRadius: height / 2,
          background: color,
          transform: `scaleX(${progress})`,
          transformOrigin: "center",
          opacity: interpolate(progress, [0, 0.15], [0, 1], {
            extrapolateRight: "clamp",
          }),
          ...style,
        }}
      />
    );
  }

  const pathD = `M 0 ${height / 2} L ${lineWidth} ${height / 2}`;
  const evolved = evolvePath(progress, pathD);

  return (
    <svg
      width={lineWidth}
      height={height}
      style={{
        overflow: "visible",
        display: "block",
        transform:
          direction === "right-to-left" ? "scaleX(-1)" : undefined,
        ...style,
      }}
    >
      <path
        d={pathD}
        stroke={color}
        strokeWidth={height}
        strokeLinecap="round"
        fill="none"
        strokeDasharray={evolved.strokeDasharray}
        strokeDashoffset={evolved.strokeDashoffset}
      />
    </svg>
  );
};

interface AccentDotProps {
  startFrame: number;
  radius?: number;
  color: string;
  x: number;
  y: number;
  opacity?: number;
}

export const AccentDot: React.FC<AccentDotProps> = ({
  startFrame,
  radius = 5,
  color,
  x,
  y,
  opacity: maxOpacity = 0.3,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const scale = spring({
    frame: frame - startFrame,
    fps,
    config: { mass: 0.4, stiffness: 400, damping: 14 },
  });

  return (
    <div
      style={{
        position: "absolute",
        left: x - radius,
        top: y - radius,
        width: radius * 2,
        height: radius * 2,
        borderRadius: "50%",
        backgroundColor: color,
        opacity: maxOpacity * interpolate(scale, [0, 1], [0, 1]),
        transform: `scale(${scale})`,
        pointerEvents: "none",
      }}
    />
  );
};

interface AccentRingProps {
  startFrame: number;
  radius: number;
  color: string;
  strokeWidth?: number;
  style?: React.CSSProperties;
}

export const AccentRing: React.FC<AccentRingProps> = ({
  startFrame,
  radius,
  color,
  strokeWidth = 2,
  style,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const progress = spring({
    frame: frame - startFrame,
    fps,
    config: { mass: 1, stiffness: 180, damping: 22 },
  });

  const size = radius * 2 + strokeWidth * 2;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - progress);

  return (
    <svg
      width={size}
      height={size}
      style={{ overflow: "visible", display: "block", ...style }}
    >
      <circle
        cx={cx}
        cy={cy}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={dashOffset}
        opacity={interpolate(progress, [0, 0.1], [0, 0.4], {
          extrapolateRight: "clamp",
        })}
        transform={`rotate(-90, ${cx}, ${cy})`}
      />
    </svg>
  );
};
