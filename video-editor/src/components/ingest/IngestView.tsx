import { useState, useEffect, useCallback } from 'react'
import { HardDrive, CreditCard, FolderOpen, CheckCircle2, AlertCircle, ArrowRight } from 'lucide-react'
import { useAppStore } from '../../stores/appStore'
import { selectFolder, startIngest, getIngestStatus } from '../../lib/api'

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

  useEffect(() => {
    if (!currentIngest || currentIngest.status === 'complete' || currentIngest.status === 'error') return

    const interval = setInterval(async () => {
      try {
        const updated = await getIngestStatus(currentIngest.id)
        setCurrentIngest(updated)

        if (updated.status === 'complete' && updated.clips?.length) {
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
          setCurrentProject({
            id: updated.projectId,
            name: clientName || 'Untitled',
            clientName: clientName || 'Unknown',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            status: 'ready',
          })
        }
      } catch {
        // silent
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
    return <IngestProgress ingest={currentIngest} onOpenStoryboard={() => setCentreView('storyboard')} />
  }

  if (viewState === 'form') {
    return (
      <div className="flex-1 flex items-center justify-center p-10">
        <div className="w-full max-w-md space-y-8">
          <div>
            <h2 className="font-display font-semibold text-sm text-text">Set up import</h2>
            <p className="font-mono text-[10px] text-text-dim mt-2 truncate tabular-nums">{selectedPath}</p>
          </div>

          <div className="space-y-4">
            <input
              type="text"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              placeholder="Client name"
              className="w-full bg-surface-active/50 rounded-lg px-4 py-3 text-sm text-text placeholder:text-text-dim focus:outline-none focus:ring-1 focus:ring-border-active transition-colors duration-150"
              autoFocus
            />

            <textarea
              value={shootNotes}
              onChange={(e) => setShootNotes(e.target.value)}
              placeholder="Any notes from the shoot? (optional)"
              rows={3}
              className="w-full bg-surface-active/50 rounded-lg px-4 py-3 text-sm text-text placeholder:text-text-dim focus:outline-none focus:ring-1 focus:ring-border-active transition-colors duration-150 resize-none"
            />
          </div>

          <div className="flex items-center gap-5">
            <button
              onClick={handleStart}
              disabled={!clientName.trim() || isStarting}
              className="bg-accent rounded-lg py-2 px-4 text-xs font-semibold text-white hover:bg-accent-hover transition-colors duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isStarting ? 'Starting...' : 'Start Import'}
            </button>
            <button
              onClick={handleCancel}
              className="text-[11px] text-text-dim hover:text-text-muted transition-colors duration-150"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex items-center justify-center p-10">
      <div className="flex flex-col items-center gap-10 max-w-lg">
        <div className="flex flex-col items-center gap-4">
          <div className="size-16 rounded-xl bg-surface-active/60 flex items-center justify-center">
            <HardDrive size={28} className="text-text-dim" />
          </div>
          <h1 className="font-display font-semibold text-sm text-text">Import Footage</h1>
          <p className="text-[11px] text-text-dim text-center text-pretty">
            Plug in a card or choose a folder to get started
          </p>
        </div>

        <div className="flex items-stretch gap-3">
          <button className="group w-[200px] bg-surface rounded-xl p-6 text-left hover:bg-surface-hover transition-colors duration-150">
            <CreditCard size={22} className="text-text-dim group-hover:text-pink transition-colors duration-150 mb-4" />
            <p className="text-xs font-display font-semibold text-text">From Card</p>
            <p className="text-[11px] text-text-dim mt-1.5">Auto-detect SD / CF Express</p>
          </button>

          <button
            onClick={handleSelectFolder}
            className="group w-[200px] bg-surface rounded-xl p-6 text-left hover:bg-surface-hover transition-colors duration-150"
          >
            <FolderOpen size={22} className="text-text-dim group-hover:text-orange transition-colors duration-150 mb-4" />
            <p className="text-xs font-display font-semibold text-text">From Folder</p>
            <p className="text-[11px] text-text-dim mt-1.5">Select footage on your SSD</p>
          </button>
        </div>
      </div>
    </div>
  )
}

function IngestProgress({
  ingest,
  onOpenStoryboard,
}: {
  ingest: NonNullable<ReturnType<typeof useAppStore.getState>['currentIngest']>
  onOpenStoryboard: () => void
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

  return (
    <div className="flex-1 flex items-center justify-center p-10">
      <div className="w-full max-w-md space-y-6">
        <div className="flex flex-col items-center gap-3">
          {isComplete && <CheckCircle2 size={32} className="text-green" />}
          {isError && <AlertCircle size={32} className="text-accent" />}

          <h2 className="font-display font-semibold text-sm text-text">
            {statusText[ingest.status] || 'Processing...'}
          </h2>
        </div>

        {!isComplete && !isError && (
          <div className="space-y-3">
            <div className="w-full h-1 bg-surface-active rounded-full overflow-hidden">
              <div
                className="h-full bg-orange rounded-full transition-all duration-500 ease-out"
                style={{ width: `${progressPercent}%` }}
              />
            </div>

            <p className="font-mono text-[10px] text-text-dim text-center tabular-nums">
              {ingest.processedFiles} / {ingest.totalFiles} files processed
            </p>
          </div>
        )}

        {isComplete && (
          <div className="flex flex-col items-center gap-4">
            <p className="font-mono text-[10px] text-text-dim tabular-nums">
              {ingest.totalFiles} files imported
            </p>
            <button
              onClick={onOpenStoryboard}
              className="flex items-center gap-2 bg-accent rounded-lg px-4 py-2 text-xs font-semibold text-white hover:bg-accent-hover transition-colors duration-150"
            >
              Open in Storyboard
              <ArrowRight size={14} />
            </button>
          </div>
        )}

        {isError && ingest.errors.length > 0 && (
          <div className="bg-surface-active/50 rounded-lg p-4 space-y-2">
            {ingest.errors.map((err, i) => (
              <p key={i} className="text-[10px] text-accent font-mono">
                {err}
              </p>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
