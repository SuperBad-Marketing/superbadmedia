import { create } from 'zustand'
import type { CentreView, RightPanelTab, Project, Clip, StoryboardClip, ChatMessage, SkillFile, IngestJob, MusicTrack } from '../types'

interface AppState {
  // View state
  centreView: CentreView
  rightPanelTab: RightPanelTab
  setCentreView: (view: CentreView) => void
  setRightPanelTab: (tab: RightPanelTab) => void

  // Project
  currentProject: Project | null
  setCurrentProject: (project: Project | null) => void

  // Clips
  clips: Clip[]
  setClips: (clips: Clip[]) => void
  addClip: (clip: Clip) => void

  // Storyboard
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

  // Ingest
  currentIngest: IngestJob | null
  setCurrentIngest: (job: IngestJob | null) => void

  // Resolve connection
  resolveConnected: boolean
  setResolveConnected: (connected: boolean) => void

  // Left panel collapse
  leftPanelCollapsed: boolean
  toggleLeftPanel: () => void
}

export const useAppStore = create<AppState>((set) => ({
  centreView: 'ingest',
  rightPanelTab: 'chat',
  setCentreView: (view) => set({ centreView: view }),
  setRightPanelTab: (tab) => set({ rightPanelTab: tab }),

  currentProject: null,
  setCurrentProject: (project) => set({ currentProject: project }),

  clips: [],
  setClips: (clips) => set({ clips }),
  addClip: (clip) => set((state) => ({ clips: [...state.clips, clip] })),

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

  currentIngest: null,
  setCurrentIngest: (job) => set({ currentIngest: job }),

  resolveConnected: false,
  setResolveConnected: (connected) => set({ resolveConnected: connected }),

  leftPanelCollapsed: false,
  toggleLeftPanel: () => set((state) => ({ leftPanelCollapsed: !state.leftPanelCollapsed })),
}))
