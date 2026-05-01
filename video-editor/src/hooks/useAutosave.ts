import { useEffect, useRef, useState } from 'react'
import { useAppStore } from '../stores/appStore'
import { saveProject } from '../lib/api'

const AUTOSAVE_INTERVAL = 30_000

export function useAutosave() {
  const currentProject = useAppStore((s) => s.currentProject)
  const storyboardClips = useAppStore((s) => s.storyboardClips)
  const clips = useAppStore((s) => s.clips)
  const sfxPlacements = useAppStore((s) => s.sfxPlacements)
  const editTransitions = useAppStore((s) => s.editTransitions)
  const selectedTrack = useAppStore((s) => s.selectedTrack)
  const chatMessages = useAppStore((s) => s.chatMessages)
  const saveCurrentProject = useAppStore((s) => s.saveCurrentProject)

  const [lastSaved, setLastSaved] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const lastSnapshotRef = useRef<string>('')

  useEffect(() => {
    if (!currentProject?.id) return

    const timer = setInterval(async () => {
      const state = saveCurrentProject()
      const snapshot = JSON.stringify(state)

      if (snapshot === lastSnapshotRef.current) return

      lastSnapshotRef.current = snapshot
      setSaving(true)

      try {
        await saveProject(
          currentProject.id,
          currentProject.name,
          currentProject.clientName,
          state,
        )
        setLastSaved(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }))
      } catch {
        // Autosave is best-effort
      } finally {
        setSaving(false)
      }
    }, AUTOSAVE_INTERVAL)

    return () => clearInterval(timer)
  }, [currentProject, storyboardClips, clips, sfxPlacements, editTransitions, selectedTrack, chatMessages, saveCurrentProject])

  return { lastSaved, saving }
}
