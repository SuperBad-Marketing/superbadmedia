import { useMemo } from 'react'
import { motion } from 'motion/react'
import { CheckCircle, AlertTriangle, Clock, Volume2, Music, Layers, Type } from 'lucide-react'
import { useAppStore } from '../../stores/appStore'

interface CheckItem {
  label: string
  status: 'pass' | 'warn' | 'info'
  detail: string
  icon: typeof Clock
}

export default function FinalReviewView() {
  const storyboardClips = useAppStore((s) => s.storyboardClips)
  const sfxPlacements = useAppStore((s) => s.sfxPlacements)
  const editTransitions = useAppStore((s) => s.editTransitions)
  const selectedTrack = useAppStore((s) => s.selectedTrack)
  const clips = useAppStore((s) => s.clips)

  const totalDuration = useMemo(
    () => storyboardClips.reduce((sum, sc) => sum + (sc.endTime - sc.startTime), 0),
    [storyboardClips],
  )

  const checks = useMemo<CheckItem[]>(() => {
    const items: CheckItem[] = []

    items.push({
      label: 'Timeline',
      icon: Clock,
      status: storyboardClips.length > 0 ? 'pass' : 'warn',
      detail: storyboardClips.length > 0
        ? `${storyboardClips.length} clips, ${formatDuration(totalDuration)}`
        : 'No clips in storyboard',
    })

    items.push({
      label: 'Music',
      icon: Music,
      status: selectedTrack ? 'pass' : 'info',
      detail: selectedTrack ? `${selectedTrack.title} — ${selectedTrack.artist}` : 'No music track selected',
    })

    items.push({
      label: 'Sound effects',
      icon: Volume2,
      status: sfxPlacements.length > 0 ? 'pass' : 'info',
      detail: sfxPlacements.length > 0
        ? `${sfxPlacements.length} SFX placed`
        : 'No sound effects added',
    })

    items.push({
      label: 'Transitions',
      icon: Layers,
      status: editTransitions.length > 0 ? 'pass' : 'info',
      detail: editTransitions.length > 0
        ? `${editTransitions.length} transitions`
        : 'All hard cuts',
    })

    const shortClips = storyboardClips.filter((sc) => (sc.endTime - sc.startTime) < 0.5)
    if (shortClips.length > 0) {
      items.push({
        label: 'Short clips',
        icon: AlertTriangle,
        status: 'warn',
        detail: `${shortClips.length} clip${shortClips.length > 1 ? 's' : ''} under 0.5s — may flash`,
      })
    }

    const visionAnalyzed = clips.filter((c) => c.analysis?.visionAnalyzed).length
    if (visionAnalyzed < clips.length) {
      items.push({
        label: 'Vision analysis',
        icon: Type,
        status: 'info',
        detail: `${clips.length - visionAnalyzed} clip${clips.length - visionAnalyzed > 1 ? 's' : ''} not AI-analyzed`,
      })
    }

    return items
  }, [storyboardClips, sfxPlacements, editTransitions, selectedTrack, clips, totalDuration])

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
            <CheckCircle size={28} className="text-text-dim/40" />
          </div>
          <h2 className="font-display font-bold text-xl tracking-tight text-text mb-3">
            Final Review
          </h2>
          <p className="text-text-dim text-sm text-center text-pretty max-w-xs">
            Nothing to review yet. Build your edit first.
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
        <div>
          <h3 className="text-[10px] font-semibold text-text-muted uppercase tracking-wider mb-3">
            Pre-delivery checklist
          </h3>
          <div className="space-y-1.5">
            {checks.map((check) => {
              const Icon = check.icon
              return (
                <div
                  key={check.label}
                  className="flex items-center gap-3 p-3 rounded-xl bg-surface-active/30"
                >
                  <div className={`size-7 rounded-lg flex items-center justify-center shrink-0 ${
                    check.status === 'pass'
                      ? 'bg-green/10'
                      : check.status === 'warn'
                        ? 'bg-orange/10'
                        : 'bg-surface-active/50'
                  }`}>
                    <Icon size={13} className={
                      check.status === 'pass'
                        ? 'text-green'
                        : check.status === 'warn'
                          ? 'text-orange'
                          : 'text-text-dim'
                    } />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] text-text font-medium">{check.label}</p>
                    <p className="text-[10px] text-text-dim">{check.detail}</p>
                  </div>
                  {check.status === 'pass' && (
                    <CheckCircle size={14} className="text-green/60 shrink-0" />
                  )}
                  {check.status === 'warn' && (
                    <AlertTriangle size={14} className="text-orange/60 shrink-0" />
                  )}
                </div>
              )
            })}
          </div>
        </div>

        <div className="p-4 rounded-xl bg-surface-active/20 space-y-3">
          <h3 className="text-[10px] font-semibold text-text-muted uppercase tracking-wider">
            Edit Summary
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-[24px] font-display font-bold text-text tabular-nums">
                {storyboardClips.length}
              </p>
              <p className="text-[10px] text-text-dim">Clips</p>
            </div>
            <div>
              <p className="text-[24px] font-display font-bold text-text tabular-nums">
                {formatDuration(totalDuration)}
              </p>
              <p className="text-[10px] text-text-dim">Duration</p>
            </div>
            <div>
              <p className="text-[24px] font-display font-bold text-text tabular-nums">
                {editTransitions.length}
              </p>
              <p className="text-[10px] text-text-dim">Transitions</p>
            </div>
            <div>
              <p className="text-[24px] font-display font-bold text-text tabular-nums">
                {sfxPlacements.length}
              </p>
              <p className="text-[10px] text-text-dim">SFX</p>
            </div>
          </div>
        </div>

        <p className="text-[10px] text-text-dim text-center px-4">
          When you're happy with everything, hit Finalize & deliver below to move to export.
        </p>
      </div>
    </motion.div>
  )
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return m > 0 ? `${m}:${s.toString().padStart(2, '0')}` : `${s}s`
}
