import { useState, useEffect } from 'react'
import { motion } from 'motion/react'
import { Plus, ArrowRight, Film, Clock, Music, ListOrdered } from 'lucide-react'
import { useAppStore } from '../../stores/appStore'
import { listProjects, loadProject } from '../../lib/api'
import type { ProjectSummary } from '../../lib/api'

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

export default function HomeScreen() {
  const setWorkflowPhase = useAppStore((s) => s.setWorkflowPhase)
  const setCurrentProject = useAppStore((s) => s.setCurrentProject)
  const loadProjectState = useAppStore((s) => s.loadProjectState)
  const currentProject = useAppStore((s) => s.currentProject)

  const [projects, setProjects] = useState<ProjectSummary[]>([])
  const [loading, setLoading] = useState(true)

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
      setWorkflowPhase('assemble')
    } catch {
      setWorkflowPhase('assemble')
    }
  }

  function startNew() {
    setWorkflowPhase('import')
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
          <motion.button
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            onClick={() => openProject(heroProject)}
            className="w-full group cursor-pointer"
          >
            <div className="relative rounded-2xl overflow-hidden bg-surface border border-border hover:border-border-active transition-all duration-300">
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

              {/* Continue CTA */}
              <div className="absolute bottom-6 right-6">
                <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-accent/90 text-text text-xs font-semibold group-hover:bg-accent transition-colors duration-200">
                  Continue editing
                  <ArrowRight size={14} />
                </div>
              </div>
            </div>
          </motion.button>
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
                <motion.button
                  key={project.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.45 + i * 0.05, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                  onClick={() => openProject(project)}
                  className="shrink-0 w-44 rounded-xl bg-surface hover:bg-surface-hover border border-border hover:border-border-active p-3 text-left transition-all duration-200 cursor-pointer"
                >
                  <p className="text-xs font-medium text-text truncate">{project.name}</p>
                  <p className="text-[10px] text-text-dim mt-0.5">{project.clientName}</p>
                  <p className="text-[10px] text-text-dim mt-1">{timeAgo(project.updatedAt)}</p>
                </motion.button>
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
        </motion.div>
      </motion.div>
    </div>
  )
}
