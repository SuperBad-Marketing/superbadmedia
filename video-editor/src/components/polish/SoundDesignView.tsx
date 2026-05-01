import { useMemo } from 'react'
import { motion } from 'motion/react'
import { Volume2, Music, Wand2 } from 'lucide-react'
import { useAppStore } from '../../stores/appStore'

export default function SoundDesignView() {
  const sfxPlacements = useAppStore((s) => s.sfxPlacements)
  const editTransitions = useAppStore((s) => s.editTransitions)
  const selectedTrack = useAppStore((s) => s.selectedTrack)
  const storyboardClips = useAppStore((s) => s.storyboardClips)

  const totalDuration = useMemo(
    () => storyboardClips.reduce((sum, sc) => sum + (sc.endTime - sc.startTime), 0),
    [storyboardClips],
  )

  const transitionsWithSfx = editTransitions.filter((t) => {
    const presetName = t.presetName.toLowerCase()
    return presetName.includes('impact') || presetName.includes('whoosh')
  })

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
            <Volume2 size={28} className="text-text-dim/40" />
          </div>
          <h2 className="font-display font-bold text-xl tracking-tight text-text mb-3">
            Sound Design
          </h2>
          <p className="text-text-dim text-sm text-center text-pretty max-w-xs">
            Build an assembly to review your sound design.
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
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
        {/* Music track */}
        <div className="space-y-2">
          <h3 className="text-[10px] font-semibold text-text-muted uppercase tracking-wider">
            Music
          </h3>
          {selectedTrack ? (
            <div className="flex items-center gap-3 p-3 rounded-xl bg-surface-active/30">
              {selectedTrack.coverUrl && (
                <img
                  src={selectedTrack.coverUrl}
                  alt=""
                  className="size-10 rounded-lg object-cover shrink-0"
                />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-[11px] text-text truncate">{selectedTrack.title}</p>
                <p className="text-[9px] text-text-dim truncate">{selectedTrack.artist}</p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-[10px] text-text-muted font-mono tabular-nums">
                  {selectedTrack.bpm} BPM
                </p>
                <p className="text-[9px] text-text-dim">
                  {selectedTrack.mood?.join(', ')}
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 p-3 rounded-xl border border-dashed border-border">
              <Music size={13} className="text-text-dim" />
              <span className="text-[11px] text-text-dim">
                No music selected. Use the Music dock panel to add a track.
              </span>
            </div>
          )}
        </div>

        {/* SFX placements */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-[10px] font-semibold text-text-muted uppercase tracking-wider">
              Sound Effects
            </h3>
            <span className="text-[9px] text-text-dim font-mono tabular-nums">
              {sfxPlacements.length} placed
            </span>
          </div>
          {sfxPlacements.length > 0 ? (
            <div className="space-y-1">
              {sfxPlacements.map((sfx) => (
                <div
                  key={sfx.id}
                  className="flex items-center gap-3 p-2.5 rounded-lg bg-surface-active/30 hover:bg-surface-active/50 transition-colors duration-150"
                >
                  <div className="size-7 rounded-md bg-surface-active flex items-center justify-center shrink-0">
                    <Wand2 size={11} className="text-text-dim" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] text-text truncate">
                      {sfx.epidemicTrack?.title || sfx.searchQuery || sfx.category}
                    </p>
                    <p className="text-[9px] text-text-dim">{sfx.reason}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-[10px] text-text-muted font-mono tabular-nums">
                      {sfx.timelineStart.toFixed(1)}s
                    </p>
                    <p className="text-[9px] text-text-dim">
                      vol {Math.round(sfx.volume * 100)}%
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center gap-2 p-3 rounded-xl border border-dashed border-border">
              <Volume2 size={13} className="text-text-dim" />
              <span className="text-[11px] text-text-dim">
                No sound effects placed. Use the Sound dock panel to add SFX.
              </span>
            </div>
          )}
        </div>

        {/* Transitions */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-[10px] font-semibold text-text-muted uppercase tracking-wider">
              Transitions
            </h3>
            <span className="text-[9px] text-text-dim font-mono tabular-nums">
              {editTransitions.length} placed
            </span>
          </div>
          {editTransitions.length > 0 ? (
            <div className="space-y-1">
              {editTransitions.map((t) => (
                <div
                  key={t.id}
                  className="flex items-center justify-between p-2.5 rounded-lg bg-surface-active/30"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] text-text">{t.presetName}</p>
                    <p className="text-[9px] text-text-dim">{t.reason}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-[10px] text-text-muted font-mono tabular-nums">
                      After clip {t.afterClipPosition + 1}
                    </p>
                    <p className="text-[9px] text-text-dim">{t.duration}s</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[11px] text-text-dim pl-1">
              All cuts. Use the Transitions dock panel to add transitions.
            </p>
          )}
        </div>

        {/* Summary */}
        <div className="p-3 rounded-xl bg-surface-active/20 space-y-1.5">
          <h3 className="text-[10px] font-semibold text-text-muted uppercase tracking-wider">
            Audio Summary
          </h3>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <p className="text-[18px] font-display font-bold text-text tabular-nums">
                {formatDuration(totalDuration)}
              </p>
              <p className="text-[9px] text-text-dim">Total length</p>
            </div>
            <div>
              <p className="text-[18px] font-display font-bold text-text tabular-nums">
                {sfxPlacements.length}
              </p>
              <p className="text-[9px] text-text-dim">Sound effects</p>
            </div>
            <div>
              <p className="text-[18px] font-display font-bold text-text tabular-nums">
                {editTransitions.length}
              </p>
              <p className="text-[9px] text-text-dim">Transitions</p>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return m > 0 ? `${m}:${s.toString().padStart(2, '0')}` : `${s}s`
}
