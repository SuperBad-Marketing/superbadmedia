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
      } catch {
        // silent
      }
    }, 2000)

    return () => clearInterval(interval)
  }, [currentIngest, setCurrentIngest])

  if (currentProject && !currentIngest) {
    return (
      <div className="flex-1 flex items-center justify-center text-text-dim text-sm">
        Project loaded. Switch to Storyboard to begin editing.
      </div>
    )
  }

  if (viewState === 'progress' && currentIngest) {
    return <IngestProgress ingest={currentIngest} onOpenStoryboard={() => setCentreView('storyboard')} />
  }

  if (viewState === 'form') {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md space-y-6">
          <div>
            <h2 className="text-xl font-semibold text-text">Set up import</h2>
            <p className="font-mono text-sm text-text-muted mt-2 truncate">{selectedPath}</p>
          </div>

          <div className="space-y-4">
            <input
              type="text"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              placeholder="Client name"
              className="w-full bg-bg border border-border rounded-lg px-4 py-2.5 text-sm text-text placeholder:text-text-dim focus:outline-none focus:border-border-active transition-colors"
              autoFocus
            />

            <textarea
              value={shootNotes}
              onChange={(e) => setShootNotes(e.target.value)}
              placeholder="Any notes from the shoot? (optional)"
              rows={3}
              className="w-full bg-bg border border-border rounded-lg px-4 py-2.5 text-sm text-text placeholder:text-text-dim focus:outline-none focus:border-border-active transition-colors resize-none"
            />
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={handleStart}
              disabled={!clientName.trim() || isStarting}
              className="bg-accent rounded-lg py-2 px-6 font-semibold text-sm text-white hover:bg-accent-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isStarting ? 'Starting...' : 'Start Import'}
            </button>
            <button
              onClick={handleCancel}
              className="text-sm text-text-muted hover:text-text transition-colors"
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
      <div className="flex flex-col items-center gap-8 max-w-lg">
        <div className="flex flex-col items-center gap-3">
          <HardDrive size={48} className="text-text-dim" />
          <h1 className="text-2xl font-semibold text-text">Import Footage</h1>
          <p className="text-text-muted text-sm text-center">
            Plug in a card or choose a folder to get started
          </p>
        </div>

        <div className="flex items-stretch gap-4">
          <button className="group w-[200px] bg-surface border border-border rounded-xl p-6 text-left hover:border-accent cursor-pointer transition-all duration-200">
            <CreditCard size={28} className="text-text-dim group-hover:text-accent transition-colors mb-3" />
            <p className="text-sm font-medium text-text">From Card</p>
            <p className="text-xs text-text-muted mt-1">Auto-detect SD / CF Express</p>
          </button>

          <button
            onClick={handleSelectFolder}
            className="group w-[200px] bg-surface border border-border rounded-xl p-6 text-left hover:border-accent cursor-pointer transition-all duration-200"
          >
            <FolderOpen size={28} className="text-text-dim group-hover:text-accent transition-colors mb-3" />
            <p className="text-sm font-medium text-text">From Folder</p>
            <p className="text-xs text-text-muted mt-1">Select footage on your SSD</p>
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
  const progressPercent = Math.round(ingest.progress * 100)

  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="w-full max-w-md space-y-6">
        <div className="flex flex-col items-center gap-3">
          {isComplete && <CheckCircle2 size={40} className="text-green" />}
          {isError && <AlertCircle size={40} className="text-accent" />}

          <h2 className="text-xl font-semibold text-text">
            {statusText[ingest.status] || 'Processing...'}
          </h2>
        </div>

        {!isComplete && !isError && (
          <div className="space-y-3">
            <div className="w-full h-2 bg-surface rounded-full overflow-hidden">
              <div
                className="h-full bg-accent rounded-full transition-all duration-500 ease-out"
                style={{ width: `${progressPercent}%` }}
              />
            </div>

            <p className="font-mono text-sm text-text-muted text-center">
              {ingest.processedFiles} / {ingest.totalFiles} files processed
            </p>
          </div>
        )}

        {isComplete && (
          <div className="flex flex-col items-center gap-4">
            <p className="font-mono text-sm text-text-muted">
              {ingest.totalFiles} files imported
            </p>
            <button
              onClick={onOpenStoryboard}
              className="flex items-center gap-2 bg-accent rounded-lg py-2 px-6 font-semibold text-sm text-white hover:bg-accent-hover transition-colors"
            >
              Open in Storyboard
              <ArrowRight size={16} />
            </button>
          </div>
        )}

        {isError && ingest.errors.length > 0 && (
          <div className="bg-surface rounded-lg border border-border p-4 space-y-2">
            {ingest.errors.map((err, i) => (
              <p key={i} className="text-xs text-accent font-mono">
                {err}
              </p>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
