import { useEffect, useCallback, useState } from 'react'
import { Wifi, WifiOff, Loader2 } from 'lucide-react'
import { useAppStore } from '../../stores/appStore'
import { checkResolveConnection, connectResolve } from '../../lib/api'

export default function BottomBar() {
  const resolveConnected = useAppStore((s) => s.resolveConnected)
  const setResolveConnected = useAppStore((s) => s.setResolveConnected)
  const [resolveProject, setResolveProject] = useState<string | null>(null)
  const [connecting, setConnecting] = useState(false)

  const pollStatus = useCallback(async () => {
    const status = await checkResolveConnection()
    setResolveConnected(status.connected)
    setResolveProject(status.project ?? null)
  }, [setResolveConnected])

  useEffect(() => {
    pollStatus()
    const interval = setInterval(pollStatus, 10000)
    return () => clearInterval(interval)
  }, [pollStatus])

  const handleConnect = async () => {
    setConnecting(true)
    const result = await connectResolve()
    setResolveConnected(result.connected)
    setConnecting(false)
  }

  return (
    <div className="flex items-center justify-between h-7 px-4 bg-bg border-t border-border shrink-0 font-mono text-[10px] select-none">
      <div className="flex items-center gap-1.5">
        {connecting ? (
          <>
            <Loader2 size={10} className="text-text-dim animate-spin" />
            <span className="text-text-dim">Connecting...</span>
          </>
        ) : resolveConnected ? (
          <>
            <Wifi size={10} className="text-green" />
            <span className="text-text-dim">Resolve{resolveProject ? ` — ${resolveProject}` : ''}</span>
          </>
        ) : (
          <button onClick={handleConnect} className="flex items-center gap-1 text-text-dim hover:text-text-muted transition-colors duration-150">
            <WifiOff size={10} />
            <span>Connect Resolve</span>
          </button>
        )}
      </div>

      <span className="text-text-dim/50">v0.1</span>
    </div>
  )
}
