import { useEffect, useCallback, useState } from 'react'
import { Wifi, WifiOff } from 'lucide-react'
import { useAppStore } from '../../stores/appStore'
import { checkResolveConnection, connectResolve } from '../../lib/api'

export default function BottomBar() {
  const resolveConnected = useAppStore((s) => s.resolveConnected)
  const setResolveConnected = useAppStore((s) => s.setResolveConnected)
  const [resolveProject, setResolveProject] = useState<string | null>(null)
  const [connecting, setConnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const pollStatus = useCallback(async () => {
    try {
      const status = await checkResolveConnection()
      setResolveConnected(status.connected)
      setResolveProject(status.project ?? null)
      if (status.connected) setError(null)
    } catch {
      setResolveConnected(false)
    }
  }, [setResolveConnected])

  useEffect(() => {
    pollStatus()
    const interval = setInterval(pollStatus, 10000)
    return () => clearInterval(interval)
  }, [pollStatus])

  const handleConnect = async () => {
    setConnecting(true)
    setError(null)
    try {
      const result = await connectResolve()
      setResolveConnected(result.connected)
      setResolveProject(result.project ?? null)
      if (!result.connected) {
        setError(result.error || 'Could not connect')
      }
    } catch {
      setError('Connection failed')
    } finally {
      setConnecting(false)
    }
  }

  return (
    <div className="flex items-center justify-between h-7 px-4 bg-bg/80 backdrop-blur-sm shrink-0 select-none">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5">
          {connecting ? (
            <>
              <div className="size-1.5 rounded-full bg-amber animate-pulse" />
              <span className="text-[10px] text-text-dim">Connecting...</span>
            </>
          ) : resolveConnected ? (
            <>
              <div className="size-1.5 rounded-full bg-green" />
              <span className="text-[10px] text-text-dim">
                Resolve{resolveProject ? ` — ${resolveProject}` : ''}
              </span>
            </>
          ) : (
            <button
              onClick={handleConnect}
              className="flex items-center gap-1.5 text-[10px] text-text-dim hover:text-text-muted transition-colors duration-150"
            >
              <div className="size-1.5 rounded-full bg-text-dim/40" />
              Connect Resolve
            </button>
          )}
        </div>
        {error && (
          <span className="text-[9px] text-accent">{error}</span>
        )}
      </div>

      <span className="text-[9px] text-text-dim/30 font-mono tabular-nums">v0.1</span>
    </div>
  )
}
