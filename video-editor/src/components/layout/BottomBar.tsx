import { HardDrive, Wifi, WifiOff } from 'lucide-react'
import { useAppStore } from '../../stores/appStore'

export default function BottomBar() {
  const resolveConnected = useAppStore((s) => s.resolveConnected)

  return (
    <div className="flex items-center justify-between h-8 px-4 bg-surface border-t border-border shrink-0 font-mono text-xs select-none">
      <div className="flex items-center gap-2">
        {resolveConnected ? (
          <>
            <Wifi size={12} className="text-green" />
            <span className="text-green">Connected</span>
          </>
        ) : (
          <>
            <WifiOff size={12} className="text-accent" />
            <span className="text-accent">Disconnected</span>
          </>
        )}
      </div>

      <div className="flex items-center gap-1.5 text-text-dim">
        <HardDrive size={12} />
        <span>SSD: --</span>
      </div>

      <span className="text-text-dim">SuperEdits v0.1.0</span>
    </div>
  )
}
