import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { WorkflowPhase, DockPanel, Project, Clip, ClipAnalysis, StoryboardClip, ChatMessage, SkillFile, IngestJob, MusicTrack, SfxPlacement, TransitionPlacement, AppliedEffect, EditPreferences } from '../types'
import type { EditIntent, BriefFields } from '../lib/api'

interface AppState {

  // Project
  currentProject: Project | null
  setCurrentProject: (project: Project | null) => void

  // Clips
  clips: Clip[]
  setClips: (clips: Clip[]) => void
  addClip: (clip: Clip) => void
  updateClipAnalysis: (clipId: string, analysis: Partial<ClipAnalysis>) => void

  // Storyboard
  lastAssemblyId: string | null
  setLastAssemblyId: (id: string | null) => void
  storyboardClips: StoryboardClip[]
  setStoryboardClips: (clips: StoryboardClip[]) => void
  addToStoryboard: (clip: Clip) => void
  removeFromStoryboard: (id: string) => void
  reorderStoryboardClip: (fromIndex: number, toIndex: number) => void

  // Chat
  chatMessages: ChatMessage[]
  addChatMessage: (message: ChatMessage) => void
  updateChatMessage: (id: string, updates: Partial<ChatMessage>) => void
  clearChat: () => void

  // Music
  selectedTrack: MusicTrack | null
  setSelectedTrack: (track: MusicTrack | null) => void
  isPlaying: boolean
  setIsPlaying: (playing: boolean) => void

  // Skills
  skills: SkillFile[]
  setSkills: (skills: SkillFile[]) => void
  addSkill: (skill: SkillFile) => void
  removeSkill: (id: string) => void

  // Applied effects
  appliedEffects: AppliedEffect[]
  setAppliedEffects: (effects: AppliedEffect[]) => void
  addAppliedEffect: (effect: AppliedEffect) => void
  removeAppliedEffect: (id: string) => void
  updateAppliedEffect: (id: string, updates: Partial<AppliedEffect>) => void

  // SFX & Transitions (from assembly)
  sfxPlacements: SfxPlacement[]
  setSfxPlacements: (placements: SfxPlacement[]) => void
  editTransitions: TransitionPlacement[]
  setEditTransitions: (transitions: TransitionPlacement[]) => void

  // Edit intent (from pre-edit questions)
  lastEditIntent: EditIntent | null
  setLastEditIntent: (intent: EditIntent | null) => void

  // Client selection
  selectedClientId: string | null
  setSelectedClientId: (id: string | null) => void
  selectedEditStyleId: string | null
  setSelectedEditStyleId: (id: string | null) => void

  // Brief state (preserved across remounts)
  briefPhase: 'client-select' | 'braindump' | 'fields' | 'questions' | 'building'
  setBriefPhase: (phase: 'client-select' | 'braindump' | 'fields' | 'questions' | 'building') => void
  briefBraindump: string
  setBriefBraindump: (text: string) => void

  // Brief fields (preserved for recuts)
  lastBriefFields: (BriefFields & { selectedSkillIds?: string[] }) | null
  setLastBriefFields: (fields: (BriefFields & { selectedSkillIds?: string[] }) | null) => void

  // Edit preferences
  editPreferences: EditPreferences | null
  setEditPreferences: (prefs: EditPreferences | null) => void

  // Ingest
  currentIngest: IngestJob | null
  setCurrentIngest: (job: IngestJob | null) => void

  // Clip selection (for effects panel)
  selectedClipIndex: number
  setSelectedClipIndex: (index: number) => void

  // Resolve connection & transport
  resolveConnected: boolean
  setResolveConnected: (connected: boolean) => void
  playheadTimecode: string
  setPlayheadTimecode: (tc: string) => void

  // Project management
  saveCurrentProject: () => Record<string, any>
  loadProjectState: (state: Record<string, any>) => void
  resetToNewProject: () => void

  // Workflow navigation
  workflowPhase: WorkflowPhase
  setWorkflowPhase: (phase: WorkflowPhase) => void

  // Dock
  activeDockPanel: DockPanel | null
  setActiveDockPanel: (panel: DockPanel | null) => void
  toggleDockPanel: (panel: DockPanel) => void
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      currentProject: null as Project | null,
      setCurrentProject: (project) => set({ currentProject: project }),

      clips: [],
      setClips: (clips) => set({ clips }),
      addClip: (clip) => set((state) => ({ clips: [...state.clips, clip] })),
      updateClipAnalysis: (clipId, analysis) => set((state) => ({
        clips: state.clips.map((c) =>
          c.id === clipId ? { ...c, analysis: { ...c.analysis!, ...analysis } } : c,
        ),
      })),

      lastAssemblyId: null,
      setLastAssemblyId: (id) => set({ lastAssemblyId: id }),
      storyboardClips: [],
      setStoryboardClips: (clips) => set({ storyboardClips: clips }),
      addToStoryboard: (clip) => set((state) => {
        const sc: StoryboardClip = {
          id: crypto.randomUUID(),
          clipId: clip.id,
          clip,
          startTime: 0,
          endTime: clip.duration,
          position: state.storyboardClips.length,
          audioOffset: 0,
        }
        return { storyboardClips: [...state.storyboardClips, sc] }
      }),
      removeFromStoryboard: (id) => set((state) => ({
        storyboardClips: state.storyboardClips
          .filter((c) => c.id !== id)
          .map((c, i) => ({ ...c, position: i })),
      })),
      reorderStoryboardClip: (fromIndex, toIndex) => set((state) => {
        const newClips = [...state.storyboardClips]
        const [moved] = newClips.splice(fromIndex, 1)
        newClips.splice(toIndex, 0, moved)
        return { storyboardClips: newClips.map((c, i) => ({ ...c, position: i })) }
      }),

      chatMessages: [],
      addChatMessage: (message) => set((state) => ({ chatMessages: [...state.chatMessages, message] })),
      updateChatMessage: (id, updates) => set((state) => ({
        chatMessages: state.chatMessages.map((m) => m.id === id ? { ...m, ...updates } : m)
      })),
      clearChat: () => set({ chatMessages: [] }),

      selectedTrack: null,
      setSelectedTrack: (track) => set({ selectedTrack: track }),
      isPlaying: false,
      setIsPlaying: (playing) => set({ isPlaying: playing }),

      skills: [],
      setSkills: (skills) => set({ skills }),
      addSkill: (skill) => set((state) => ({ skills: [...state.skills, skill] })),
      removeSkill: (id) => set((state) => ({ skills: state.skills.filter((s) => s.id !== id) })),

      appliedEffects: [],
      setAppliedEffects: (effects) => set({ appliedEffects: effects }),
      addAppliedEffect: (effect) => set((state) => ({ appliedEffects: [...state.appliedEffects, effect] })),
      removeAppliedEffect: (id) => set((state) => ({ appliedEffects: state.appliedEffects.filter((e) => e.id !== id) })),
      updateAppliedEffect: (id, updates) => set((state) => ({
        appliedEffects: state.appliedEffects.map((e) => e.id === id ? { ...e, ...updates } : e),
      })),

      sfxPlacements: [],
      setSfxPlacements: (placements) => set({ sfxPlacements: placements }),
      editTransitions: [],
      setEditTransitions: (transitions) => set({ editTransitions: transitions }),

      lastEditIntent: null,
      setLastEditIntent: (intent) => set({ lastEditIntent: intent }),

      selectedClientId: null,
      setSelectedClientId: (id) => set({ selectedClientId: id }),
      selectedEditStyleId: null,
      setSelectedEditStyleId: (id) => set({ selectedEditStyleId: id }),

      briefPhase: 'client-select' as const,
      setBriefPhase: (phase) => set({ briefPhase: phase }),
      briefBraindump: '',
      setBriefBraindump: (text) => set({ briefBraindump: text }),

      lastBriefFields: null,
      setLastBriefFields: (fields) => set({ lastBriefFields: fields }),

      editPreferences: null,
      setEditPreferences: (prefs) => set({ editPreferences: prefs }),

      currentIngest: null,
      setCurrentIngest: (job) => set({ currentIngest: job }),

      selectedClipIndex: 0,
      setSelectedClipIndex: (index) => set({ selectedClipIndex: index }),

      resolveConnected: false,
      setResolveConnected: (connected) => set({ resolveConnected: connected }),
      playheadTimecode: '00:00:00:00',
      setPlayheadTimecode: (tc) => set({ playheadTimecode: tc }),

      saveCurrentProject: (): Record<string, any> => {
        const s = get()
        return {
          currentProject: s.currentProject,
          clips: s.clips,
          lastAssemblyId: s.lastAssemblyId,
          storyboardClips: s.storyboardClips,
          appliedEffects: s.appliedEffects,
          sfxPlacements: s.sfxPlacements,
          editTransitions: s.editTransitions,
          chatMessages: s.chatMessages,
          selectedTrack: s.selectedTrack,
          lastEditIntent: s.lastEditIntent,
          lastBriefFields: s.lastBriefFields,
          editPreferences: s.editPreferences,
        }
      },
      loadProjectState: (state) => set({
        currentProject: state.currentProject || null,
        clips: state.clips || [],
        lastAssemblyId: state.lastAssemblyId || null,
        storyboardClips: state.storyboardClips || [],
        appliedEffects: state.appliedEffects || [],
        sfxPlacements: state.sfxPlacements || [],
        editTransitions: state.editTransitions || [],
        chatMessages: state.chatMessages || [],
        selectedTrack: state.selectedTrack || null,
        lastEditIntent: state.lastEditIntent || null,
        lastBriefFields: state.lastBriefFields || null,
        editPreferences: state.editPreferences || null,
        workflowPhase: 'brief' as WorkflowPhase,
      }),
      resetToNewProject: () => set({
        currentProject: null,
        clips: [],
        lastAssemblyId: null,
        storyboardClips: [],
        appliedEffects: [],
        sfxPlacements: [],
        editTransitions: [],
        chatMessages: [],
        selectedTrack: null,
        lastEditIntent: null,
        lastBriefFields: null,
        editPreferences: null,
        currentIngest: null,
        selectedClientId: null,
        selectedEditStyleId: null,
        briefPhase: 'client-select' as const,
        briefBraindump: '',
        workflowPhase: 'import' as WorkflowPhase,
      }),

      workflowPhase: 'home' as WorkflowPhase,
      setWorkflowPhase: (phase) => set({ workflowPhase: phase }),

      activeDockPanel: null as DockPanel | null,
      setActiveDockPanel: (panel) => set({ activeDockPanel: panel }),
      toggleDockPanel: (panel) => set((state) => ({
        activeDockPanel: state.activeDockPanel === panel ? null : panel,
      })),
    }),
    {
      name: 'superedits-state',
      partialize: (state: AppState) => ({
        currentProject: state.currentProject,
        clips: state.clips,
        storyboardClips: state.storyboardClips,
        appliedEffects: state.appliedEffects,
        sfxPlacements: state.sfxPlacements,
        editTransitions: state.editTransitions,
        chatMessages: state.chatMessages,
        selectedTrack: state.selectedTrack,
        skills: state.skills,
        workflowPhase: state.workflowPhase,
        selectedClientId: state.selectedClientId,
        selectedEditStyleId: state.selectedEditStyleId,
        briefPhase: state.briefPhase,
        briefBraindump: state.briefBraindump,
        lastBriefFields: state.lastBriefFields,
      }),
    },
  ),
)
