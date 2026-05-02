import { useCallback, useEffect, useRef } from 'react'
import { motion } from 'motion/react'
import { Play, Pause, SkipBack } from 'lucide-react'
import { useAppStore } from '../../stores/appStore'
import { playResolve, stopResolve, seekResolve, getResolvePlayhead } from '../../lib/api'

export default function TransportStrip() {
  const isPlaying = useAppStore((s) => s.isPlaying)
  const setIsPlaying = useAppStore((s) => s.setIsPlaying)
  const resolveConnected = useAppStore((s) => s.resolveConnected)
  const playheadTimecode = useAppStore((s) => s.playheadTimecode)
  const setPlayheadTimecode = useAppStore((s) => s.setPlayheadTimecode)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const togglePlayback = useCallback(async () => {
    if (!resolveConnected) return
    if (isPlaying) {
      await stopResolve()
      setIsPlaying(false)
    } else {
      await playResolve()
      setIsPlaying(true)
    }
  }, [isPlaying, resolveConnected, setIsPlaying])

  const goToStart = useCallback(async () => {
    if (!resolveConnected) return
    await seekResolve('00:00:00:00')
    setPlayheadTimecode('00:00:00:00')
    if (isPlaying) {
      await stopResolve()
      setIsPlaying(false)
    }
  }, [resolveConnected, isPlaying, setIsPlaying, setPlayheadTimecode])

  useEffect(() => {
    if (!resolveConnected) return

    const poll = async () => {
      const result = await getResolvePlayhead()
      if (result.timecode) {
        setPlayheadTimecode(result.timecode)
      }
    }

    pollRef.current = setInterval(poll, 500)
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [resolveConnected, setPlayheadTimecode])

  if (!resolveConnected) return null

  return (
    <motion.div
      initial={{ opacity: 0, width: 0 }}
      animate={{ opacity: 1, width: 'auto' }}
      exit={{ opacity: 0, width: 0 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      className="flex items-center gap-1.5 pr-2 mr-1.5 border-r border-white/[0.08]"
    >
      <button
        onClick={goToStart}
        className="size-7 rounded-lg flex items-center justify-center text-text-dim hover:text-text-muted hover:bg-surface-hover/50 transition-colors duration-200"
        aria-label="Go to start"
      >
        <SkipBack size={14} strokeWidth={1.5} />
      </button>

      <button
        onClick={togglePlayback}
        className="size-8 rounded-lg flex items-center justify-center bg-accent/20 text-accent hover:bg-accent/30 transition-colors duration-200"
        aria-label={isPlaying ? 'Pause' : 'Play'}
      >
        {isPlaying ? <Pause size={16} strokeWidth={1.5} /> : <Play size={16} strokeWidth={1.5} />}
      </button>

      <span className="text-[11px] font-mono text-text-dim tabular-nums min-w-[80px] text-center select-none">
        {playheadTimecode}
      </span>
    </motion.div>
  )
}
