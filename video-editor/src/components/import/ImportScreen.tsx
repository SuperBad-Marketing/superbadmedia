import { useState, useCallback, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { HardDrive, CreditCard, ArrowLeft, AlertCircle, Film, Loader2, Check } from 'lucide-react'
import { useAppStore } from '../../stores/appStore'
import { startIngest, getIngestStatus, selectFolder, sendToResolve, checkResolveConnection, getLibraryFolders, importFromLibrary } from '../../lib/api'
import type { LibraryFolder } from '../../lib/api'
import { ProgressLoader } from '../shared/LoadingPulse'

const LOAD_STEPS = [
  { at: 0, text: 'Pulling clips from the library.' },
  { at: 15, text: 'Reading analysis data.' },
  { at: 40, text: 'Matching vision tags.' },
  { at: 65, text: 'Building the clip index.' },
  { at: 85, text: 'Nearly there.' },
  { at: 100, text: 'Ready.' },
]

export default function ImportScreen() {
  const setWorkflowPhase = useAppStore((s) => s.setWorkflowPhase)
  const setClips = useAppStore((s) => s.setClips)
  const setCurrentProject = useAppStore((s) => s.setCurrentProject)
  const setCurrentIngest = useAppStore((s) => s.setCurrentIngest)

  const [folders, setFolders] = useState<LibraryFolder[]>([])
  const [loadingFolders, setLoadingFolders] = useState(true)
  const [importing, setImporting] = useState(false)
  const [libraryLoading, setLibraryLoading] = useState(false)
  const [libraryProgress, setLibraryProgress] = useState(0)
  const [libraryStatus, setLibraryStatus] = useState('')
  const [libraryClipCount, setLibraryClipCount] = useState(0)
  const [progress, setProgress] = useState(0)
  const [statusText, setStatusText] = useState('')
  const [errorText, setErrorText] = useState('')
  const progressTimer = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    getLibraryFolders()
      .then(setFolders)
      .catch(() => setFolders([]))
      .finally(() => setLoadingFolders(false))
  }, [])

  useEffect(() => {
    return () => {
      if (progressTimer.current) clearInterval(progressTimer.current)
    }
  }, [])

  const handleLibraryImport = useCallback(async (folder: LibraryFolder) => {
    if (libraryLoading) return
    setLibraryLoading(true)
    setLibraryProgress(0)
    setLibraryStatus(LOAD_STEPS[0].text)
    setLibraryClipCount(folder.clipCount)
    setErrorText('')

    let currentProgress = 0
    progressTimer.current = setInterval(() => {
      currentProgress = Math.min(currentProgress + 3, 80)
      setLibraryProgress(currentProgress)
      const step = [...LOAD_STEPS].reverse().find(s => s.at <= currentProgress)
      if (step) setLibraryStatus(step.text)
    }, 120)

    try {
      const clips = await importFromLibrary(folder.folder)

      if (progressTimer.current) clearInterval(progressTimer.current)

      if (!clips.length) {
        setLibraryLoading(false)
        setErrorText('No clips found in that folder.')
        return
      }

      setLibraryProgress(90)
      setLibraryStatus(`Loaded ${clips.length} clips. Setting up the project.`)

      setClips(clips)
      setCurrentProject({
        id: crypto.randomUUID(),
        name: folder.label,
        clientName: folder.clientName,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        status: 'ready',
      })

      setLibraryProgress(95)
      setLibraryStatus('Checking Resolve connection.')

      const conn = await checkResolveConnection().catch(() => ({ connected: false }))
      if (conn.connected) {
        setLibraryStatus('Sending media to Resolve.')
        const paths = [...new Set(clips.map((c: any) => c.filePath))]
        sendToResolve('import_media', { file_paths: paths }).catch(() => {})
      }

      setLibraryProgress(100)
      setLibraryStatus('Ready.')

      await new Promise(r => setTimeout(r, 400))
      setWorkflowPhase('brief')
    } catch {
      if (progressTimer.current) clearInterval(progressTimer.current)
      setLibraryLoading(false)
      setErrorText('Failed to import from library. Try again.')
    }
  }, [libraryLoading, setClips, setCurrentProject, setWorkflowPhase])

  const handleImport = useCallback(async (sourceType: 'card' | 'folder') => {
    const folderPath = await selectFolder()
    if (!folderPath) return

    setImporting(true)
    setProgress(0)
    setStatusText('Kicking things off.')
    setErrorText('')

    try {
      const job = await startIngest(folderPath, 'New Project', sourceType)
      setCurrentIngest(job)

      let lastProgress = -1
      let staleTicks = 0

      const poll = setInterval(async () => {
        try {
          const status = await getIngestStatus(job.id)
          setProgress(status.progress)

          if (status.progress === lastProgress) {
            staleTicks++
          } else {
            staleTicks = 0
            lastProgress = status.progress
          }

          if (status.status === 'copying') {
            setStatusText(`Grabbing your files. ${status.processedFiles} of ${status.totalFiles}.`)
          } else if (status.status === 'analyzing') {
            setStatusText(`Watching everything. ${status.processedFiles} of ${status.totalFiles} clips reviewed.`)
          } else if (status.status === 'cleaning-audio') {
            setStatusText('Cleaning up the audio. Making things sound decent.')
          } else if (status.status === 'creating-project') {
            setStatusText('Nearly there. Wiring it all together.')
          }

          if (status.status === 'complete') {
            clearInterval(poll)
            if (status.clips) setClips(status.clips)
            setCurrentProject({
              id: status.projectId,
              name: 'New Project',
              clientName: 'New Project',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              status: 'ready',
            })

            if (status.clips?.length) {
              checkResolveConnection().then((conn) => {
                if (conn.connected) {
                  const paths = [...new Set(status.clips!.map((c: any) => c.filePath))]
                  sendToResolve('import_media', { file_paths: paths }).catch(() => {})
                }
              }).catch(() => {})
            }

            setWorkflowPhase('brief')
          } else if (status.status === 'error') {
            clearInterval(poll)
            setImporting(false)
            setErrorText(status.errors?.length ? status.errors[0] : 'Something went wrong. Try again.')
          } else if (staleTicks > 120) {
            clearInterval(poll)
            setImporting(false)
            setErrorText('Import stalled. Check the folder has media files and try again.')
          }
        } catch {
          clearInterval(poll)
          setImporting(false)
          setErrorText('Lost connection to the server. Make sure the backend is running.')
        }
      }, 1000)
    } catch {
      setImporting(false)
      setErrorText('Server not reachable. Start the backend with npm run dev:server.')
    }
  }, [setClips, setCurrentIngest, setCurrentProject, setWorkflowPhase])

  if (importing) {
    return <ProgressLoader progress={progress} status={statusText} />
  }

  if (libraryLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center select-none">
        <motion.div
          className="flex flex-col items-center gap-8"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="relative size-24">
            <svg width={96} height={96} className="transform -rotate-90">
              <circle
                cx={48} cy={48} r={42}
                fill="none"
                stroke="rgba(255, 255, 255, 0.04)"
                strokeWidth={3}
              />
              <motion.circle
                cx={48} cy={48} r={42}
                fill="none"
                stroke="var(--color-accent)"
                strokeWidth={3}
                strokeLinecap="round"
                strokeDasharray={264}
                animate={{ strokeDashoffset: 264 - (libraryProgress / 100) * 264 }}
                transition={{ duration: 0.4, ease: 'easeOut' }}
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <motion.span
                className="font-mono text-lg font-medium text-text tabular-nums"
                key={Math.round(libraryProgress)}
              >
                {Math.round(libraryProgress)}
              </motion.span>
            </div>
          </div>

          <div className="flex flex-col items-center gap-3">
            <AnimatePresence mode="wait">
              <motion.p
                className="text-text-muted text-sm"
                key={libraryStatus}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.25 }}
              >
                {libraryStatus}
              </motion.p>
            </AnimatePresence>

            <p className="text-text-dim text-xs tabular-nums">
              {libraryClipCount} clips
            </p>
          </div>
        </motion.div>
      </div>
    )
  }

  const hasLibrary = folders.length > 0

  return (
    <div className="flex-1 flex flex-col items-center justify-center select-none">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="flex flex-col items-center max-w-2xl w-full px-6"
      >
        <h1 className="font-display font-bold text-4xl tracking-tight text-text">
          {hasLibrary ? 'Pick your footage' : "Where's your footage?"}
        </h1>
        <p className="text-text-dim text-base mt-6">
          {hasLibrary
            ? 'Pre-analyzed shoots ready to go. Or bring in something new.'
            : 'Point us at the files. We\'ll handle the rest.'}
        </p>

        <AnimatePresence>
          {errorText && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              className="mt-8 flex items-center gap-3 px-5 py-3.5 rounded-xl bg-red-500/10 border border-red-500/20 w-full max-w-md"
            >
              <AlertCircle size={16} className="text-red-400 shrink-0" />
              <p className="text-sm text-red-300">{errorText}</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Library folders — primary option */}
        {loadingFolders ? (
          <div className="mt-16 flex items-center gap-3 text-text-dim text-sm">
            <Loader2 size={16} className="animate-spin" />
            Checking your library...
          </div>
        ) : hasLibrary ? (
          <div className="mt-12 w-full flex flex-col gap-3">
            {folders.map((folder, i) => (
              <motion.button
                key={folder.folder}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + i * 0.06, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                onClick={() => handleLibraryImport(folder)}
                className="group w-full cursor-pointer"
              >
                <div className="w-full rounded-2xl border border-border hover:border-border-active bg-surface hover:bg-surface-hover flex items-center gap-5 px-6 py-5 transition-all duration-300">
                  <div className="size-12 rounded-xl bg-accent-dim flex items-center justify-center group-hover:bg-accent/15 transition-colors duration-300 shrink-0">
                    <Film size={20} className="text-accent" strokeWidth={1.5} />
                  </div>
                  <div className="flex-1 text-left min-w-0">
                    <p className="text-sm font-medium text-text truncate">{folder.label}</p>
                    <p className="text-xs text-text-dim mt-1 truncate">{folder.clientName}</p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-medium text-text-muted tabular-nums">{folder.clipCount}</span>
                      <span className="text-[10px] text-text-dim">clips</span>
                    </div>
                    {folder.analyzedCount === folder.clipCount ? (
                      <div className="size-5 rounded-md bg-green/10 flex items-center justify-center">
                        <Check size={10} className="text-green" />
                      </div>
                    ) : (
                      <span className="text-[10px] text-text-dim">{folder.analyzedCount}/{folder.clipCount} analyzed</span>
                    )}
                  </div>
                </div>
              </motion.button>
            ))}
          </div>
        ) : null}

        {/* Drive / Card fallbacks */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: hasLibrary ? 0.3 : 0.15, duration: 0.4 }}
          className={`flex gap-4 ${hasLibrary ? 'mt-8' : 'mt-20'}`}
        >
          <button
            onClick={() => handleImport('folder')}
            className="group cursor-pointer"
          >
            <div className={`rounded-2xl border border-border hover:border-border-active bg-surface hover:bg-surface-hover flex flex-col items-center justify-center gap-4 transition-all duration-300 ${
              hasLibrary ? 'w-44 py-8' : 'w-56 py-14 gap-6'
            }`}>
              <div className={`rounded-xl bg-surface-active/50 flex items-center justify-center group-hover:bg-surface-active transition-colors duration-300 ${
                hasLibrary ? 'size-10' : 'size-14'
              }`}>
                <HardDrive size={hasLibrary ? 18 : 24} className="text-text-muted" strokeWidth={1.5} />
              </div>
              <div className="text-center">
                <p className={`font-medium text-text ${hasLibrary ? 'text-sm' : 'text-base'}`}>From drive</p>
                <p className={`text-text-dim mt-1 ${hasLibrary ? 'text-[11px]' : 'text-sm mt-2'}`}>SSD, hard drive, folder</p>
              </div>
            </div>
          </button>

          <button
            onClick={() => handleImport('card')}
            className="group cursor-pointer"
          >
            <div className={`rounded-2xl border border-border hover:border-border-active bg-surface hover:bg-surface-hover flex flex-col items-center justify-center gap-4 transition-all duration-300 ${
              hasLibrary ? 'w-44 py-8' : 'w-56 py-14 gap-6'
            }`}>
              <div className={`rounded-xl bg-surface-active/50 flex items-center justify-center group-hover:bg-surface-active transition-colors duration-300 ${
                hasLibrary ? 'size-10' : 'size-14'
              }`}>
                <CreditCard size={hasLibrary ? 18 : 24} className="text-text-muted" strokeWidth={1.5} />
              </div>
              <div className="text-center">
                <p className={`font-medium text-text ${hasLibrary ? 'text-sm' : 'text-base'}`}>From card</p>
                <p className={`text-text-dim mt-1 ${hasLibrary ? 'text-[11px]' : 'text-sm mt-2'}`}>Camera card, SD, CFexpress</p>
              </div>
            </div>
          </button>
        </motion.div>

        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5, duration: 0.4 }}
          onClick={() => setWorkflowPhase('home')}
          className="mt-12 flex items-center gap-2 text-text-dim hover:text-text-muted text-sm transition-colors duration-200 cursor-pointer"
        >
          <ArrowLeft size={14} />
          Back
        </motion.button>
      </motion.div>
    </div>
  )
}
