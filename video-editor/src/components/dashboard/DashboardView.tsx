import { useState, useEffect, useCallback } from 'react'
import { Plus, Trash2, FolderOpen, Clock, Film, Music, Loader2 } from 'lucide-react'
import { listProjects, loadProject, saveProject, deleteProject } from '../../lib/api'
import type { ProjectSummary } from '../../lib/api'
import { useAppStore } from '../../stores/appStore'

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  return new Date(dateStr).toLocaleDateString()
}

function formatDuration(seconds: number): string {
  if (seconds === 0) return '--'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return m > 0 ? `${m}m ${s}s` : `${s}s`
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  ingesting: { label: 'Ingesting', color: 'text-orange' },
  ready: { label: 'Ready', color: 'text-accent' },
  editing: { label: 'Editing', color: 'text-accent' },
  grading: { label: 'Grading', color: 'text-pink' },
  exporting: { label: 'Exporting', color: 'text-orange' },
  delivered: { label: 'Delivered', color: 'text-green' },
}

export default function DashboardView() {
  const [projects, setProjects] = useState<ProjectSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const currentProject = useAppStore((s) => s.currentProject)
  const setCentreView = useAppStore((s) => s.setCentreView)
  const saveCurrentProject = useAppStore((s) => s.saveCurrentProject)
  const loadProjectState = useAppStore((s) => s.loadProjectState)
  const resetToNewProject = useAppStore((s) => s.resetToNewProject)
  const setCurrentProject = useAppStore((s) => s.setCurrentProject)

  const fetchProjects = useCallback(async () => {
    try {
      const data = await listProjects()
      setProjects(data)
    } catch {
      // silently fail
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchProjects()
  }, [fetchProjects])

  const handleSaveAndNew = useCallback(async () => {
    if (currentProject) {
      setSaving(true)
      try {
        const state = saveCurrentProject()
        await saveProject(currentProject.id, currentProject.name, currentProject.clientName, state)
      } catch {
        // save failed — continue to new anyway
      }
      setSaving(false)
    }
    resetToNewProject()
    const newId = crypto.randomUUID()
    setCurrentProject({
      id: newId,
      name: 'Untitled Project',
      clientName: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: 'editing',
    })
    setCentreView('ingest')
  }, [currentProject, saveCurrentProject, resetToNewProject, setCurrentProject, setCentreView])

  const handleOpen = useCallback(async (projectId: string) => {
    if (currentProject) {
      try {
        const state = saveCurrentProject()
        await saveProject(currentProject.id, currentProject.name, currentProject.clientName, state)
      } catch {
        // continue
      }
    }

    try {
      const data = await loadProject(projectId)
      loadProjectState(data.state)
      setCurrentProject({
        id: data.id,
        name: data.name,
        clientName: data.clientName,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
        status: data.status as any,
      })
    } catch {
      // load failed
    }
  }, [currentProject, saveCurrentProject, loadProjectState, setCurrentProject])

  const handleDelete = useCallback(async (projectId: string) => {
    setDeleting(projectId)
    try {
      await deleteProject(projectId)
      setProjects((prev) => prev.filter((p) => p.id !== projectId))
      if (currentProject?.id === projectId) {
        resetToNewProject()
      }
    } catch {
      // delete failed
    } finally {
      setDeleting(null)
    }
  }, [currentProject, resetToNewProject])

  const handleSaveCurrent = useCallback(async () => {
    if (!currentProject) return
    setSaving(true)
    try {
      const state = saveCurrentProject()
      await saveProject(currentProject.id, currentProject.name, currentProject.clientName, state)
      await fetchProjects()
    } catch {
      // save failed
    } finally {
      setSaving(false)
    }
  }, [currentProject, saveCurrentProject, fetchProjects])

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-y-auto">
      <div className="max-w-3xl mx-auto w-full px-8 py-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="font-display font-bold text-lg text-text">Projects</h1>
            <p className="text-[11px] text-text-dim mt-0.5">
              {projects.length} project{projects.length !== 1 ? 's' : ''}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {currentProject && (
              <button
                onClick={handleSaveCurrent}
                disabled={saving}
                className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium text-text-muted bg-surface-active rounded-lg hover:bg-surface-raised transition-colors duration-150 disabled:opacity-40"
              >
                {saving && <Loader2 size={11} className="animate-spin" />}
                Save current
              </button>
            )}
            <button
              onClick={handleSaveAndNew}
              disabled={saving}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold text-white bg-accent rounded-lg hover:bg-accent-hover transition-colors duration-150 disabled:opacity-40"
            >
              <Plus size={12} />
              New project
            </button>
          </div>
        </div>

        {/* Current project banner */}
        {currentProject && (
          <div className="mb-6 px-4 py-3 bg-surface-active/60 rounded-xl border border-border/50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="size-2 rounded-full bg-accent animate-pulse" />
                <div>
                  <span className="text-[12px] font-display font-semibold text-text">
                    {currentProject.name}
                  </span>
                  {currentProject.clientName && (
                    <span className="text-[11px] text-text-dim ml-2">{currentProject.clientName}</span>
                  )}
                </div>
              </div>
              <span className="text-[10px] text-text-dim">Currently open</span>
            </div>
          </div>
        )}

        {/* Project list */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={18} className="animate-spin text-text-dim" />
          </div>
        ) : projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <FolderOpen size={28} className="text-text-dim" />
            <p className="text-[12px] text-text-dim text-center text-pretty max-w-xs">
              No saved projects yet. Start a new project or save your current work.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {projects.map((project) => {
              const isActive = currentProject?.id === project.id
              const statusInfo = STATUS_LABELS[project.status] || { label: project.status, color: 'text-text-dim' }

              return (
                <div
                  key={project.id}
                  className={`group px-4 py-3 rounded-xl border transition-colors duration-150 ${
                    isActive
                      ? 'bg-accent-dim/30 border-accent/30'
                      : 'bg-surface-active/40 border-border/30 hover:bg-surface-active/70'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[12px] font-display font-semibold text-text truncate">
                          {project.name}
                        </span>
                        <span className={`text-[9px] font-mono uppercase ${statusInfo.color}`}>
                          {statusInfo.label}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 mt-1">
                        {project.clientName && (
                          <span className="text-[10px] text-text-dim">{project.clientName}</span>
                        )}
                        <span className="flex items-center gap-1 text-[10px] text-text-dim">
                          <Film size={9} />
                          {project.clipCount} clip{project.clipCount !== 1 ? 's' : ''}
                        </span>
                        {project.storyboardClipCount > 0 && (
                          <span className="flex items-center gap-1 text-[10px] text-text-dim">
                            <Clock size={9} />
                            {formatDuration(project.totalDuration)}
                          </span>
                        )}
                        {project.musicTrackTitle && (
                          <span className="flex items-center gap-1 text-[10px] text-text-dim truncate max-w-[120px]">
                            <Music size={9} />
                            {project.musicTrackTitle}
                          </span>
                        )}
                        <span className="text-[10px] text-text-dim">
                          {timeAgo(project.updatedAt)}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                      {!isActive && (
                        <button
                          onClick={() => handleOpen(project.id)}
                          className="px-2.5 py-1 text-[10px] font-medium text-accent bg-accent-dim rounded-md hover:bg-accent/20 transition-colors duration-150"
                        >
                          Open
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(project.id)}
                        disabled={deleting === project.id}
                        className="p-1.5 text-text-dim hover:text-red-400 transition-colors duration-150 rounded-md hover:bg-surface-hover disabled:opacity-40"
                        aria-label={`Delete ${project.name}`}
                      >
                        {deleting === project.id ? (
                          <Loader2 size={11} className="animate-spin" />
                        ) : (
                          <Trash2 size={11} />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
