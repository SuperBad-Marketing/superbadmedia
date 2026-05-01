import { useMemo, useCallback } from 'react'
import { motion } from 'motion/react'
import { Clock, Minus, Plus, Timer } from 'lucide-react'
import { useAppStore } from '../../stores/appStore'
import { thumbUrl } from '../../lib/thumbUrl'

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = (seconds % 60).toFixed(1)
  return m > 0 ? `${m}m ${s}s` : `${s}s`
}

export default function TimingView() {
  const storyboardClips = useAppStore((s) => s.storyboardClips)
  const setStoryboardClips = useAppStore((s) => s.setStoryboardClips)

  const totalDuration = useMemo(
    () => storyboardClips.reduce((sum, sc) => sum + (sc.endTime - sc.startTime), 0),
    [storyboardClips],
  )

  const adjustTrim = useCallback(
    (clipId: string, edge: 'start' | 'end', delta: number) => {
      const updated = storyboardClips.map((sc) => {
        if (sc.id !== clipId) return sc
        if (edge === 'start') {
          const newStart = Math.max(0, sc.startTime + delta)
          if (newStart >= sc.endTime - 0.2) return sc
          return { ...sc, startTime: newStart }
        }
        const newEnd = Math.min(sc.clip.duration, sc.endTime + delta)
        if (newEnd <= sc.startTime + 0.2) return sc
        return { ...sc, endTime: newEnd }
      })
      setStoryboardClips(updated)
    },
    [storyboardClips, setStoryboardClips],
  )

  if (storyboardClips.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center select-none">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="flex flex-col items-center"
        >
          <div className="size-16 rounded-2xl bg-surface-active/40 flex items-center justify-center mb-8">
            <Timer size={28} className="text-text-dim/40" />
          </div>
          <h2 className="font-display font-bold text-xl tracking-tight text-text mb-3">
            Timing
          </h2>
          <p className="text-text-dim text-sm text-center text-pretty max-w-xs">
            No clips in your storyboard yet. Build an assembly first.
          </p>
        </motion.div>
      </div>
    )
  }

  return (
    <motion.div
      className="flex-1 flex flex-col min-h-0"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      <div className="px-6 pt-4 pb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock size={13} className="text-text-dim" />
          <span className="text-[11px] text-text-muted font-medium">
            Total: {formatDuration(totalDuration)}
          </span>
        </div>
        <span className="text-[10px] text-text-dim font-mono tabular-nums">
          {storyboardClips.length} clip{storyboardClips.length !== 1 ? 's' : ''}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto px-6 pb-4 space-y-1.5">
        {storyboardClips.map((sc, i) => {
          const clipDuration = sc.endTime - sc.startTime

          return (
            <div
              key={sc.id}
              className="flex items-center gap-3 p-2.5 rounded-xl bg-surface-active/30 hover:bg-surface-active/50 transition-colors duration-150"
            >
              <div className="size-12 rounded-lg overflow-hidden bg-surface-active shrink-0">
                {sc.clip.thumbnailPath ? (
                  <img
                    src={thumbUrl(sc.clip.thumbnailPath)}
                    alt=""
                    className="size-full object-cover"
                  />
                ) : (
                  <div className="size-full flex items-center justify-center text-[9px] text-text-dim font-mono">
                    {i + 1}
                  </div>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-[11px] text-text truncate">{sc.clip.fileName}</p>
                <p className="text-[9px] text-text-dim font-mono tabular-nums mt-0.5">
                  {sc.startTime.toFixed(1)}s — {sc.endTime.toFixed(1)}s
                  <span className="ml-2 text-text-muted">{formatDuration(clipDuration)}</span>
                </p>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <div className="flex flex-col items-center gap-0.5 mr-2">
                  <span className="text-[8px] text-text-dim uppercase tracking-wider">In</span>
                  <div className="flex items-center gap-0.5">
                    <button
                      onClick={() => adjustTrim(sc.id, 'start', 0.5)}
                      className="size-5 rounded flex items-center justify-center text-text-dim hover:text-text hover:bg-surface-hover transition-colors duration-150"
                      title="Trim in-point later"
                    >
                      <Plus size={9} />
                    </button>
                    <button
                      onClick={() => adjustTrim(sc.id, 'start', -0.5)}
                      className="size-5 rounded flex items-center justify-center text-text-dim hover:text-text hover:bg-surface-hover transition-colors duration-150"
                      title="Trim in-point earlier"
                    >
                      <Minus size={9} />
                    </button>
                  </div>
                </div>
                <div className="flex flex-col items-center gap-0.5">
                  <span className="text-[8px] text-text-dim uppercase tracking-wider">Out</span>
                  <div className="flex items-center gap-0.5">
                    <button
                      onClick={() => adjustTrim(sc.id, 'end', -0.5)}
                      className="size-5 rounded flex items-center justify-center text-text-dim hover:text-text hover:bg-surface-hover transition-colors duration-150"
                      title="Trim out-point earlier"
                    >
                      <Minus size={9} />
                    </button>
                    <button
                      onClick={() => adjustTrim(sc.id, 'end', 0.5)}
                      className="size-5 rounded flex items-center justify-center text-text-dim hover:text-text hover:bg-surface-hover transition-colors duration-150"
                      title="Trim out-point later"
                    >
                      <Plus size={9} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </motion.div>
  )
}
