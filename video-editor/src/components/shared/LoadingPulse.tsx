import { motion } from 'motion/react'

const DOT_COUNT = 3
const DURATION = 1.6
const STAGGER = 0.15

function Dots({ size = 'md' }: { size?: 'sm' | 'md' }) {
  const dotSize = size === 'sm' ? 'size-1' : 'size-1.5'
  return (
    <span className="inline-flex items-center gap-1.5">
      {Array.from({ length: DOT_COUNT }, (_, i) => (
        <motion.span
          key={i}
          className={`${dotSize} rounded-full bg-text-dim`}
          animate={{ opacity: [0.2, 0.7, 0.2] }}
          transition={{
            duration: DURATION,
            repeat: Infinity,
            delay: i * STAGGER,
            ease: 'easeInOut',
          }}
        />
      ))}
    </span>
  )
}

export function ViewLoader({ message }: { message?: string }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center select-none">
      <motion.div
        className="flex flex-col items-center gap-5"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4, delay: 0.1 }}
      >
        <motion.div
          className="size-10 rounded-xl bg-surface-active/60 flex items-center justify-center"
          animate={{ scale: [1, 1.04, 1] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
        >
          <Dots />
        </motion.div>
        {message && (
          <motion.p
            className="text-text-dim text-xs"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6, duration: 0.4 }}
          >
            {message}
          </motion.p>
        )}
      </motion.div>
    </div>
  )
}

export function PanelLoader() {
  return (
    <motion.div
      className="flex items-center justify-center h-32"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3, delay: 0.1 }}
    >
      <Dots />
    </motion.div>
  )
}

export function InlineLoader() {
  return <Dots size="sm" />
}

export function ProgressLoader({
  progress,
  status,
}: {
  progress: number
  status: string
}) {
  const clamped = Math.max(0, Math.min(100, progress))

  return (
    <div className="flex-1 flex flex-col items-center justify-center select-none">
      <motion.div
        className="flex flex-col items-center gap-6"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="relative size-20">
          <svg width={80} height={80} className="transform -rotate-90">
            <circle
              cx={40}
              cy={40}
              r={36}
              fill="none"
              stroke="rgba(255, 255, 255, 0.04)"
              strokeWidth={2.5}
            />
            <motion.circle
              cx={40}
              cy={40}
              r={36}
              fill="none"
              stroke="var(--color-accent)"
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeDasharray={226}
              animate={{ strokeDashoffset: 226 - (clamped / 100) * 226 }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="font-mono text-sm font-medium text-text tabular-nums">
              {Math.round(clamped)}
            </span>
          </div>
        </div>

        <motion.p
          className="text-text-muted text-sm"
          key={status}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          {status}
        </motion.p>
      </motion.div>
    </div>
  )
}
