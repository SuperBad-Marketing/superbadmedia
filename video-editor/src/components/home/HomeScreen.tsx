import { useState, useEffect, useCallback, lazy, Suspense } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { Plus, ArrowRight, Film, Clock, Music, ListOrdered, HardDrive, Loader2, Check, Settings, Trash2, Users } from 'lucide-react'
import { useAppStore } from '../../stores/appStore'
import { listProjects, loadProject, deleteProject, loadResolveProject } from '../../lib/api'
import { useLibraryStats } from '../../hooks/useLibraryStats'
import type { ProjectSummary } from '../../lib/api'

const SettingsModal = lazy(() => import('../settings/SettingsModal'))
const ClientsPage = lazy(() => import('../clients/ClientsPage'))

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

function MediaLibraryCard({ onOpenSettings }: { onOpenSettings: () => void }) {
  const { stats, progress, isActive, phase } = useLibraryStats()

  if (!stats) return null

  // No watched folder — prompt to set one
  if (!stats.watchedFolder) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="w-full rounded-xl bg-surface border border-border p-4"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="size-7 rounded-lg bg-surface-active/60 flex items-center justify-center">
              <HardDrive size={13} className="text-text-dim" />
            </div>
            <div>
              <p className="text-xs font-medium text-text-muted">Media library</p>
              <p className="text-[10px] text-text-dim mt-0.5">
                Set a watched folder in settings to pre-analyze footage.
              </p>
            </div>
          </div>
          <button
            onClick={onOpenSettings}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-medium text-text-dim hover:text-text-muted hover:bg-surface-hover transition-colors duration-150"
          >
            <Settings size={11} />
            Settings
          </button>
        </div>
      </motion.div>
    )
  }

  // Watched folder set — show status
  const allAnalyzed = stats.visionAnalyzed === stats.totalClips && stats.totalClips > 0

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.5, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="w-full rounded-xl bg-surface border border-border p-4"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className={`size-7 rounded-lg flex items-center justify-center ${
            isActive ? 'bg-orange/10' : allAnalyzed ? 'bg-green/10' : 'bg-surface-active/60'
          }`}>
            {isActive ? (
              <Loader2 size={13} className="animate-spin text-orange" />
            ) : allAnalyzed ? (
              <Check size={13} className="text-green" />
            ) : (
              <HardDrive size={13} className="text-text-dim" />
            )}
          </div>
          <div>
            <p className="text-xs font-medium text-text-muted">Media library</p>
            <p className="text-[10px] text-text-dim mt-0.5">
              {isActive ? (
                phase === 'scanning'
                  ? `Scanning folder${progress ? ` — ${progress.done}/${progress.total}` : ''}`
                  : phase === 'metadata'
                    ? `Extracting metadata${progress ? ` — ${progress.done}/${progress.total}` : ''}`
                    : phase === 'vision'
                      ? `Analyzing clips${progress ? ` — ${progress.done}/${progress.total}` : ''}`
                      : `${stats.queueLength} clips queued`
              ) : allAnalyzed ? (
                `${stats.totalClips} clips analyzed and ready`
              ) : (
                `${stats.visionAnalyzed}/${stats.totalClips} clips analyzed`
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 text-[10px] text-text-dim tabular-nums">
          <span>{stats.totalClips} clips</span>
          <span className="text-text-dim/30">|</span>
          <span className="text-green">{stats.visionAnalyzed} ready</span>
        </div>
      </div>
    </motion.div>
  )
}

export default function HomeScreen() {
  const setWorkflowPhase = useAppStore((s) => s.setWorkflowPhase)
  const setCurrentProject = useAppStore((s) => s.setCurrentProject)
  const loadProjectState = useAppStore((s) => s.loadProjectState)
  const currentProject = useAppStore((s) => s.currentProject)

  const [projects, setProjects] = useState<ProjectSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [showClients, setShowClients] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    listProjects()
      .then(setProjects)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const heroProject = currentProject
    ? projects.find((p) => p.id === currentProject.id) || projects[0]
    : projects[0]

  const recentProjects = projects.filter((p) => p.id !== heroProject?.id).slice(0, 5)

  const resolveConnected = useAppStore((s) => s.resolveConnected)

  async function openProject(project: ProjectSummary) {
    try {
      const full = await loadProject(project.id)
      setCurrentProject({
        id: full.id,
        name: full.name,
        clientName: full.clientName,
        createdAt: full.createdAt,
        updatedAt: full.updatedAt,
        status: full.status as any,
      })
      if (full.state) loadProjectState(full.state)

      if (resolveConnected) {
        loadResolveProject(full.name).catch(() => {})
      }

      setWorkflowPhase('assemble')
    } catch {
      setWorkflowPhase('assemble')
    }
  }

  const handleDelete = useCallback(async (id: string) => {
    setDeleting(true)
    try {
      await deleteProject(id)
      setProjects((prev) => prev.filter((p) => p.id !== id))
      if (currentProject?.id === id) {
        setCurrentProject(null)
      }
    } catch {}
    setDeleting(false)
    setConfirmDelete(null)
  }, [currentProject, setCurrentProject])

  function startNew() {
    setWorkflowPhase('import')
  }

  if (showClients) {
    return (
      <Suspense fallback={null}>
        <ClientsPage onBack={() => setShowClients(false)} />
      </Suspense>
    )
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-8 select-none">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="flex flex-col items-center max-w-2xl w-full"
      >
        {/* Logo */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1, duration: 0.6 }}
          className="mb-12 text-center"
        >
          <h1 className="font-display font-bold text-2xl tracking-tight text-text">
            SuperEdits
          </h1>
          <p className="text-[10px] font-semibold text-pink/40 tracking-[0.25em] uppercase mt-1">
            SuperBad
          </p>
        </motion.div>

        {/* Hero project */}
        {heroProject && !loading && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="w-full group"
          >
            <div
              onClick={() => confirmDelete !== heroProject.id && openProject(heroProject)}
              className="relative rounded-2xl overflow-hidden bg-surface border border-border hover:border-border-active transition-all duration-300 cursor-pointer"
            >
              {/* Thumbnail area */}
              <div className="aspect-[21/9] bg-surface-active flex items-center justify-center">
                <Film size={32} className="text-text-dim/30" />
              </div>

              {/* Info overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-bg/90 via-bg/20 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-6">
                <h2 className="font-display font-bold text-xl text-text tracking-tight">
                  {heroProject.name}
                </h2>
                <div className="flex items-center gap-4 mt-2 text-text-muted text-xs">
                  <span>{heroProject.clientName}</span>
                  <span className="text-text-dim">·</span>
                  <span className="flex items-center gap-1">
                    <Film size={11} />
                    {heroProject.clipCount} clips
                  </span>
                  {heroProject.totalDuration > 0 && (
                    <>
                      <span className="text-text-dim">·</span>
                      <span className="flex items-center gap-1">
                        <Clock size={11} />
                        {Math.round(heroProject.totalDuration)}s
                      </span>
                    </>
                  )}
                  {heroProject.musicTrackTitle && (
                    <>
                      <span className="text-text-dim">·</span>
                      <span className="flex items-center gap-1">
                        <Music size={11} />
                        {heroProject.musicTrackTitle}
                      </span>
                    </>
                  )}
                </div>
                <p className="text-text-dim text-[11px] mt-1">
                  {timeAgo(heroProject.updatedAt)}
                </p>
              </div>

              {/* Delete button */}
              <div className="absolute top-3 right-3">
                <AnimatePresence mode="wait">
                  {confirmDelete === heroProject.id ? (
                    <motion.div
                      key="confirm"
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      transition={{ duration: 0.15 }}
                      className="flex items-center gap-1.5 bg-bg/90 backdrop-blur-sm rounded-xl p-1.5"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        onClick={() => handleDelete(heroProject.id)}
                        disabled={deleting}
                        className="px-3 py-1.5 rounded-lg bg-red/20 text-red hover:bg-red/30 text-[11px] font-medium transition-colors duration-150 cursor-pointer disabled:opacity-50"
                      >
                        {deleting ? <Loader2 size={11} className="animate-spin" /> : 'Delete'}
                      </button>
                      <button
                        onClick={() => setConfirmDelete(null)}
                        className="px-2 py-1.5 rounded-lg text-text-dim hover:text-text-muted text-[11px] font-medium transition-colors duration-150 cursor-pointer"
                      >
                        Cancel
                      </button>
                    </motion.div>
                  ) : (
                    <motion.button
                      key="trash"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      onClick={(e) => { e.stopPropagation(); setConfirmDelete(heroProject.id) }}
                      className="size-8 rounded-lg bg-bg/60 backdrop-blur-sm flex items-center justify-center text-text-dim hover:text-red opacity-0 group-hover:opacity-100 transition-all duration-200 cursor-pointer"
                    >
                      <Trash2 size={13} />
                    </motion.button>
                  )}
                </AnimatePresence>
              </div>

              {/* Continue CTA */}
              <div className="absolute bottom-6 right-6">
                <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-accent/90 text-text text-xs font-semibold group-hover:bg-accent transition-colors duration-200">
                  Continue editing
                  <ArrowRight size={14} />
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Empty state */}
        {!heroProject && !loading && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="text-center py-16"
          >
            <p className="text-text-muted text-sm">No projects yet.</p>
            <p className="text-text-dim text-xs mt-1">Start with your footage.</p>
          </motion.div>
        )}

        {/* Recent projects */}
        {recentProjects.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4, duration: 0.5 }}
            className="mt-8 w-full"
          >
            <h3 className="text-[10px] font-semibold text-text-dim tracking-[0.15em] uppercase mb-3 px-1">
              Recent
            </h3>
            <div className="flex gap-3 overflow-x-auto pb-2">
              {recentProjects.map((project, i) => (
                <motion.div
                  key={project.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.45 + i * 0.05, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                  className="shrink-0 w-44 rounded-xl bg-surface hover:bg-surface-hover border border-border hover:border-border-active p-3 text-left transition-all duration-200 cursor-pointer group/card relative"
                  onClick={() => confirmDelete !== project.id && openProject(project)}
                >
                  <p className="text-xs font-medium text-text truncate pr-6">{project.name}</p>
                  <p className="text-[10px] text-text-dim mt-0.5">{project.clientName}</p>
                  <p className="text-[10px] text-text-dim mt-1">{timeAgo(project.updatedAt)}</p>

                  <AnimatePresence mode="wait">
                    {confirmDelete === project.id ? (
                      <motion.div
                        key="confirm"
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        transition={{ duration: 0.15 }}
                        className="absolute inset-0 rounded-xl bg-surface/95 backdrop-blur-sm flex items-center justify-center gap-1.5 p-2"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          onClick={() => handleDelete(project.id)}
                          disabled={deleting}
                          className="px-3 py-1.5 rounded-lg bg-red/20 text-red hover:bg-red/30 text-[11px] font-medium transition-colors duration-150 cursor-pointer disabled:opacity-50"
                        >
                          {deleting ? <Loader2 size={11} className="animate-spin" /> : 'Delete'}
                        </button>
                        <button
                          onClick={() => setConfirmDelete(null)}
                          className="px-2 py-1.5 rounded-lg text-text-dim hover:text-text-muted text-[11px] font-medium transition-colors duration-150 cursor-pointer"
                        >
                          Cancel
                        </button>
                      </motion.div>
                    ) : (
                      <motion.button
                        key="trash"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={(e) => { e.stopPropagation(); setConfirmDelete(project.id) }}
                        className="absolute top-2 right-2 size-6 rounded-md flex items-center justify-center text-text-dim hover:text-red opacity-0 group-hover/card:opacity-100 transition-all duration-200 cursor-pointer"
                      >
                        <Trash2 size={11} />
                      </motion.button>
                    )}
                  </AnimatePresence>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Action buttons */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6, duration: 0.4 }}
          className="mt-10 flex items-center gap-3"
        >
          <button
            onClick={startNew}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-border hover:border-border-active hover:bg-surface-hover text-text-muted hover:text-text text-xs font-medium transition-all duration-200 cursor-pointer"
          >
            <Plus size={14} />
            New project
          </button>
          <button
            onClick={() => setWorkflowPhase('queue')}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-border hover:border-border-active hover:bg-surface-hover text-text-muted hover:text-text text-xs font-medium transition-all duration-200 cursor-pointer"
          >
            <ListOrdered size={14} />
            Overnight queue
          </button>
          <button
            onClick={() => setShowClients(true)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-border hover:border-border-active hover:bg-surface-hover text-text-muted hover:text-text text-xs font-medium transition-all duration-200 cursor-pointer"
          >
            <Users size={14} />
            Clients
          </button>
        </motion.div>

        {/* Media library status */}
        <div className="mt-8 w-full">
          <MediaLibraryCard onOpenSettings={() => setSettingsOpen(true)} />
        </div>
      </motion.div>

      {settingsOpen && (
        <Suspense fallback={null}>
          <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
        </Suspense>
      )}
    </div>
  )
}
