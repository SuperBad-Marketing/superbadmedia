interface ProgressRingProps {
  progress?: number
  size?: number
  strokeWidth?: number
  showPercent?: boolean
  color?: string
  trackColor?: string
  label?: string
}

export default function ProgressRing({
  progress,
  size = 64,
  strokeWidth = 3,
  showPercent = true,
  color = 'var(--color-accent)',
  trackColor = 'rgba(255, 255, 255, 0.06)',
  label,
}: ProgressRingProps) {
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const indeterminate = progress === undefined || progress < 0

  if (indeterminate) {
    return (
      <div className="flex flex-col items-center gap-3">
        <svg
          width={size}
          height={size}
          className="progress-indeterminate"
        >
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={trackColor}
            strokeWidth={strokeWidth}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />
        </svg>
        {label && (
          <span className="text-[11px] text-text-dim">{label}</span>
        )}
      </div>
    )
  }

  const clamped = Math.max(0, Math.min(100, progress))
  const offset = circumference - (clamped / 100) * circumference

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          className="transform -rotate-90"
        >
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={trackColor}
            strokeWidth={strokeWidth}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className="transition-[stroke-dashoffset] duration-500 ease-out"
          />
        </svg>
        {showPercent && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="font-mono text-[11px] font-medium text-text tabular-nums">
              {Math.round(clamped)}
            </span>
          </div>
        )}
      </div>
      {label && (
        <span className="text-[11px] text-text-dim">{label}</span>
      )}
    </div>
  )
}
