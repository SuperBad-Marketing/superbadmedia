import { useState, useEffect, useCallback, useRef } from 'react'
import { HardDrive, CreditCard, FolderOpen, ArrowRight } from 'lucide-react'
import { useAppStore } from '../../stores/appStore'
import { selectFolder, startIngest, getIngestStatus } from '../../lib/api'
import ProgressRing from '../shared/ProgressRing'

type ViewState = 'landing' | 'form' | 'progress'

export default function IngestView() {
  const currentProject = useAppStore((s) => s.currentProject)
  const currentIngest = useAppStore((s) => s.currentIngest)
  const setCurrentIngest = useAppStore((s) => s.setCurrentIngest)
  const setCentreView = useAppStore((s) => s.setCentreView)
  const setClips = useAppStore((s) => s.setClips)
  const setCurrentProject = useAppStore((s) => s.setCurrentProject)

  const [viewState, setViewState] = useState<ViewState>(() => {
    if (currentIngest) return 'progress'
    return 'landing'
  })
  const [selectedPath, setSelectedPath] = useState('')
  const [clientName, setClientName] = useState('')
  const [shootNotes, setShootNotes] = useState('')
  const [isStarting, setIsStarting] = useState(false)

  const handleSelectFolder = useCallback(async () => {
    const path = await selectFolder()
    if (path) {
      setSelectedPath(path)
      setViewState('form')
    }
  }, [])

  const handleStart = useCallback(async () => {
    if (!selectedPath || !clientName.trim()) return
    setIsStarting(true)
    try {
      const job = await startIngest(selectedPath, clientName.trim(), 'folder')
      setCurrentIngest(job)
      setViewState('progress')
    } catch {
      setIsStarting(false)
    }
  }, [selectedPath, clientName, setCurrentIngest])

  const handleCancel = useCallback(() => {
    setSelectedPath('')
    setClientName('')
    setShootNotes('')
    setViewState('landing')
  }, [])

  const consecutiveErrors = useRef(0)
  const [pollingError, setPollingError] = useState<string | null>(null)

  useEffect(() => {
    if (!currentIngest || currentIngest.status === 'complete' || currentIngest.status === 'error') return

    consecutiveErrors.current = 0
    setPollingError(null)

    const interval = setInterval(async () => {
      try {
        const updated = await getIngestStatus(currentIngest.id)
        consecutiveErrors.current = 0
        setPollingError(null)
        setCurrentIngest(updated)

        if (updated.clips?.length) {
          const mapped = updated.clips.map((c: any) => ({
            id: c.id,
            projectId: updated.projectId,
            filePath: c.filePath,
            fileName: c.fileName,
            thumbnailPath: c.thumbnailPath ? `/thumbnails/${c.id}.jpg` : undefined,
            duration: c.duration,
            width: c.width,
            height: c.height,
            fps: c.fps,
            codec: c.codec,
            isLog: c.isLog,
            camera: c.camera,
            analysis: c.analysis,
          }))
          setClips(mapped)
        }

        if (updated.status === 'complete') {
          setCurrentProject({
            id: updated.projectId,
            name: clientName || 'Untitled',
            clientName: clientName || 'Unknown',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            status: 'ready',
          })
        }
      } catch (err) {
        consecutiveErrors.current += 1
        if (consecutiveErrors.current >= 3) {
          setPollingError(
            err instanceof Error ? err.message : 'Lost connection to import process'
          )
        }
      }
    }, 2000)

    return () => clearInterval(interval)
  }, [currentIngest, setCurrentIngest, setClips, setCurrentProject, clientName])

  if (currentProject && !currentIngest) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-text-dim text-[11px]">Project loaded. Switch to <span className="text-text-muted font-medium">Storyboard</span> to begin editing.</p>
      </div>
    )
  }

  if (viewState === 'progress' && currentIngest) {
    return <IngestProgress ingest={currentIngest} onOpenStoryboard={() => setCentreView('storyboard')} pollingError={pollingError} />
  }

  if (viewState === 'form') {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-sm space-y-6">
          <div>
            <h2 className="font-display font-semibold text-sm text-text tracking-tight">Set up import</h2>
            <p className="font-mono text-[10px] text-text-dim mt-1.5 truncate tabular-nums">{selectedPath}</p>
          </div>

          <div className="space-y-3">
            <input
              type="text"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              placeholder="Client name"
              className="w-full bg-surface border border-border rounded-lg px-3 py-2.5 text-xs text-text placeholder:text-text-dim focus:outline-none focus:border-border-active transition-colors duration-150"
              autoFocus
            />

            <textarea
              value={shootNotes}
              onChange={(e) => setShootNotes(e.target.value)}
              placeholder="Any notes from the shoot? (optional)"
              rows={3}
              className="w-full bg-surface border border-border rounded-lg px-3 py-2.5 text-xs text-text placeholder:text-text-dim focus:outline-none focus:border-border-active transition-colors duration-150 resize-none"
            />
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={handleStart}
              disabled={!clientName.trim() || isStarting}
              className="bg-accent rounded-lg py-2 px-4 text-[11px] font-semibold text-white hover:bg-accent-hover transition-colors duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isStarting ? 'Starting...' : 'Start Import'}
            </button>
            <button
              onClick={handleCancel}
              className="text-[10px] text-text-dim hover:text-text-muted transition-colors duration-150"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="flex flex-col items-center gap-8 max-w-md">
        {/* Header cluster */}
        <div className="flex flex-col items-center gap-3">
          <div className="size-12 rounded-xl bg-surface-active/40 flex items-center justify-center">
            <HardDrive size={20} className="text-text-dim" strokeWidth={1.5} />
          </div>
          <div className="flex flex-col items-center gap-1">
            <h1 className="font-display font-semibold text-sm text-text tracking-tight">Import Footage</h1>
            <p className="text-[11px] text-text-dim text-center">
              Plug in a card or choose a folder to get started.
            </p>
          </div>
        </div>

        {/* Source cards */}
        <div className="flex items-stretch gap-3 w-full">
          <button className="group flex-1 bg-surface border border-border rounded-xl px-5 py-5 text-left hover:bg-surface-hover hover:border-border-active transition-all duration-200">
            <div className="size-9 rounded-lg bg-pink-dim flex items-center justify-center mb-3.5 transition-colors duration-200 group-hover:bg-pink/15">
              <CreditCard size={18} className="text-text-dim transition-colors duration-200 group-hover:text-pink" strokeWidth={1.5} />
            </div>
            <p className="text-[11px] font-display font-semibold text-text leading-tight">From Card</p>
            <p className="text-[10px] text-text-dim mt-1 leading-snug">Auto-detect SD / CF Express</p>
          </button>

          <button
            onClick={handleSelectFolder}
            className="group flex-1 bg-surface border border-border rounded-xl px-5 py-5 text-left hover:bg-surface-hover hover:border-border-active transition-all duration-200"
          >
            <div className="size-9 rounded-lg bg-orange-dim flex items-center justify-center mb-3.5 transition-colors duration-200 group-hover:bg-orange/15">
              <FolderOpen size={18} className="text-text-dim transition-colors duration-200 group-hover:text-orange" strokeWidth={1.5} />
            </div>
            <p className="text-[11px] font-display font-semibold text-text leading-tight">From Folder</p>
            <p className="text-[10px] text-text-dim mt-1 leading-snug">Select footage on your SSD</p>
          </button>
        </div>
      </div>
    </div>
  )
}

function IngestProgress({
  ingest,
  onOpenStoryboard,
  pollingError,
}: {
  ingest: NonNullable<ReturnType<typeof useAppStore.getState>['currentIngest']>
  onOpenStoryboard: () => void
  pollingError: string | null
}) {
  const statusText: Record<string, string> = {
    pending: 'Preparing...',
    copying: 'Copying files...',
    analyzing: 'Analyzing clips...',
    'creating-project': 'Setting up Resolve project...',
    complete: 'Import complete',
    error: 'Import failed',
  }

  const isComplete = ingest.status === 'complete'
  const isError = ingest.status === 'error'
  const progressPercent = Math.round(ingest.progress)

  // Stall detection: warn if progress hasn't changed in 60 seconds
  const lastProgressRef = useRef({ value: progressPercent, time: Date.now() })
  const [isStalled, setIsStalled] = useState(false)

  useEffect(() => {
    if (isComplete || isError) return

    if (lastProgressRef.current.value !== progressPercent) {
      lastProgressRef.current = { value: progressPercent, time: Date.now() }
      setIsStalled(false)
    }

    const timer = setInterval(() => {
      if (Date.now() - lastProgressRef.current.time >= 60_000) {
        setIsStalled(true)
      }
    }, 5_000)

    return () => clearInterval(timer)
  }, [progressPercent, isComplete, isError])

  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="w-full max-w-sm flex flex-col items-center gap-5">
        {/* Progress ring for all states */}
        {isComplete && (
          <ProgressRing
            progress={100}
            size={80}
            color="var(--color-green)"
            label={statusText[ingest.status]}
          />
        )}
        {isError && (
          <ProgressRing
            progress={100}
            size={80}
            color="var(--color-accent)"
            label={statusText[ingest.status]}
          />
        )}
        {!isComplete && !isError && (
          <ProgressRing
            progress={progressPercent}
            size={80}
            color="var(--color-orange)"
            label={statusText[ingest.status] || 'Processing...'}
          />
        )}

        {/* File counter */}
        {!isComplete && !isError && (
          <p className="font-mono text-[10px] text-text-dim text-center tabular-nums">
            {ingest.processedFiles} / {ingest.totalFiles} files processed
          </p>
        )}

        {/* Stall warning */}
        {isStalled && !isComplete && !isError && (
          <p className="text-[10px] text-orange text-center">
            Import may be stalled — check Resolve
          </p>
        )}

        {/* Polling error */}
        {pollingError && !isComplete && !isError && (
          <p className="text-[10px] text-accent text-center">{pollingError}</p>
        )}

        {/* Complete state */}
        {isComplete && (
          <div className="flex flex-col items-center gap-3.5">
            <p className="font-mono text-[10px] text-text-dim tabular-nums">
              {ingest.totalFiles} files imported
            </p>
            <button
              onClick={onOpenStoryboard}
              className="flex items-center gap-2 bg-accent rounded-lg px-4 py-2 text-[11px] font-semibold text-white hover:bg-accent-hover transition-colors duration-150"
            >
              Open in Storyboard
              <ArrowRight size={13} strokeWidth={2} />
            </button>
          </div>
        )}

        {/* Error details */}
        {isError && ingest.errors.length > 0 && (
          <div className="bg-surface border border-border rounded-lg p-3.5 space-y-1.5">
            {ingest.errors.map((err, i) => (
              <p key={i} className="text-[10px] text-accent font-mono leading-relaxed">
                {err}
              </p>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
