import { useState, useCallback } from 'react'
import { motion } from 'motion/react'
import { HardDrive, CreditCard, ArrowLeft, Loader2 } from 'lucide-react'
import { useAppStore } from '../../stores/appStore'
import { startIngest, getIngestStatus, selectFolder } from '../../lib/api'
import ProgressRing from '../shared/ProgressRing'

export default function ImportScreen() {
  const setWorkflowPhase = useAppStore((s) => s.setWorkflowPhase)
  const setClips = useAppStore((s) => s.setClips)
  const setCurrentProject = useAppStore((s) => s.setCurrentProject)
  const setCurrentIngest = useAppStore((s) => s.setCurrentIngest)

  const [importing, setImporting] = useState(false)
  const [progress, setProgress] = useState(0)
  const [statusText, setStatusText] = useState('')

  const handleImport = useCallback(async (sourceType: 'card' | 'folder') => {
    const folderPath = await selectFolder()
    if (!folderPath) return

    setImporting(true)
    setStatusText('Starting import...')

    try {
      const job = await startIngest(folderPath, 'New Project', sourceType)
      setCurrentIngest(job)

      const poll = setInterval(async () => {
        try {
          const status = await getIngestStatus(job.id)
          setProgress(status.progress)

          if (status.status === 'copying') {
            setStatusText(`Copying files. ${status.processedFiles} of ${status.totalFiles}.`)
          } else if (status.status === 'analyzing') {
            setStatusText(`Watching your footage. ${status.processedFiles} of ${status.totalFiles}.`)
          } else if (status.status === 'creating-project') {
            setStatusText('Setting up your project.')
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
            setWorkflowPhase('brief')
          } else if (status.status === 'error') {
            clearInterval(poll)
            setImporting(false)
            setStatusText('Something went wrong. Try again.')
          }
        } catch {
          clearInterval(poll)
          setImporting(false)
          setStatusText('Lost connection. Try again.')
        }
      }, 1000)
    } catch {
      setImporting(false)
      setStatusText('Couldn\'t start import. Try again.')
    }
  }, [setClips, setCurrentIngest, setCurrentProject, setWorkflowPhase])

  if (importing) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center select-none">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="flex flex-col items-center"
        >
          <ProgressRing
            progress={progress}
            size={64}
            strokeWidth={3}
            showPercent
            color="var(--color-accent)"
          />
          <p className="text-sm text-text-muted mt-6">{statusText}</p>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-center select-none">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="flex flex-col items-center"
      >
        <h1 className="font-display font-bold text-xl tracking-tight text-text mb-2">
          Where's your footage?
        </h1>
        <p className="text-text-dim text-xs mb-12">
          Point us at the files. We'll handle the rest.
        </p>

        <div className="flex gap-5">
          <motion.button
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            onClick={() => handleImport('folder')}
            className="group cursor-pointer"
          >
            <div className="w-56 h-56 rounded-2xl border border-border hover:border-border-active bg-surface hover:bg-surface-hover flex flex-col items-center justify-center gap-4 transition-all duration-300">
              <div className="size-14 rounded-xl bg-accent-dim flex items-center justify-center group-hover:bg-accent/15 transition-colors duration-300">
                <HardDrive size={24} className="text-accent" strokeWidth={1.5} />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-text">From drive</p>
                <p className="text-[11px] text-text-dim mt-0.5">SSD, hard drive, folder</p>
              </div>
            </div>
          </motion.button>

          <motion.button
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            onClick={() => handleImport('card')}
            className="group cursor-pointer"
          >
            <div className="w-56 h-56 rounded-2xl border border-border hover:border-border-active bg-surface hover:bg-surface-hover flex flex-col items-center justify-center gap-4 transition-all duration-300">
              <div className="size-14 rounded-xl bg-pink-dim flex items-center justify-center group-hover:bg-pink/15 transition-colors duration-300">
                <CreditCard size={24} className="text-pink" strokeWidth={1.5} />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-text">From card</p>
                <p className="text-[11px] text-text-dim mt-0.5">Camera card, SD, CFexpress</p>
              </div>
            </div>
          </motion.button>
        </div>

        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5, duration: 0.4 }}
          onClick={() => setWorkflowPhase('home')}
          className="mt-10 flex items-center gap-1.5 text-text-dim hover:text-text-muted text-xs transition-colors duration-200 cursor-pointer"
        >
          <ArrowLeft size={12} />
          Back
        </motion.button>
      </motion.div>
    </div>
  )
}
