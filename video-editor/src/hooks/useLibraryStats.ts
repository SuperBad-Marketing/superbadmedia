import { useState, useEffect, useCallback, useRef } from 'react'
import { getLibraryStats, getLibraryProgress } from '../lib/api'
import type { LibraryStats, LibraryProgress } from '../lib/api'

const POLL_INTERVAL = 4000

export function useLibraryStats() {
  const [stats, setStats] = useState<LibraryStats | null>(null)
  const [progress, setProgress] = useState<LibraryProgress | null>(null)
  const [error, setError] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const poll = useCallback(async () => {
    try {
      const s = await getLibraryStats()
      setStats(s)
      setError(false)

      // Only fetch progress if something is active
      if (s.isScanning || s.queueLength > 0) {
        try {
          const p = await getLibraryProgress()
          setProgress(p)
        } catch {
          setProgress(null)
        }
      } else {
        setProgress(null)
      }
    } catch {
      setError(true)
    }
  }, [])

  useEffect(() => {
    poll()
    intervalRef.current = setInterval(poll, POLL_INTERVAL)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [poll])

  const isActive = stats?.isScanning || (stats?.queueLength ?? 0) > 0
  const phase = progress?.phase ?? 'idle'

  return { stats, progress, error, isActive, phase }
}
