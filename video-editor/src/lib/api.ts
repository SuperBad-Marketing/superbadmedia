import type { ChatAction, IngestJob, MusicTrack, SkillFile, SfxPreset, EpidemicSfx, TransitionPreset, TitleCardPreset } from '../types'

const API_BASE = '/api'

// Projects
export interface ProjectSummary {
  id: string
  name: string
  clientName: string
  createdAt: string
  updatedAt: string
  status: string
  clipCount: number
  storyboardClipCount: number
  totalDuration: number
  musicTrackTitle?: string
  notes?: string
}

export async function listProjects(): Promise<ProjectSummary[]> {
  const res = await fetch(`${API_BASE}/projects`)
  if (!res.ok) throw new Error('Failed to list projects')
  return res.json()
}

export async function loadProject(id: string): Promise<{ state: Record<string, any> } & ProjectSummary> {
  const res = await fetch(`${API_BASE}/projects/${id}`)
  if (!res.ok) throw new Error('Failed to load project')
  return res.json()
}

export async function saveProject(id: string, name: string, clientName: string, state: Record<string, any>): Promise<ProjectSummary> {
  const res = await fetch(`${API_BASE}/projects/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, clientName, state }),
  })
  if (res.status === 404) {
    const createRes = await fetch(`${API_BASE}/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, name, clientName, state }),
    })
    if (!createRes.ok) throw new Error('Failed to create project')
    return createRes.json()
  }
  if (!res.ok) throw new Error('Failed to save project')
  return res.json()
}

export async function deleteProject(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/projects/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error('Failed to delete project')
}

export async function sendChatMessage(
  message: string,
  projectId?: string
): Promise<{ content: string; action?: ChatAction }> {
  const res = await fetch(`${API_BASE}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, projectId }),
  })
  if (!res.ok) throw new Error('Failed to send message')
  return res.json()
}

export async function startIngest(
  sourcePath: string,
  clientName: string,
  sourceType: 'card' | 'folder'
): Promise<IngestJob> {
  const res = await fetch(`${API_BASE}/ingest`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sourcePath, clientName, sourceType }),
  })
  if (!res.ok) throw new Error('Failed to start ingest')
  return res.json()
}

export async function getIngestStatus(jobId: string): Promise<IngestJob> {
  const res = await fetch(`${API_BASE}/ingest/${jobId}`)
  if (!res.ok) throw new Error('Failed to get ingest status')
  return res.json()
}

export async function searchMusic(
  query: string,
  filters?: { mood?: string; genre?: string; pacing?: string; intensity?: number }
): Promise<MusicTrack[]> {
  const params = new URLSearchParams({ q: query })
  if (filters?.mood) params.set('mood', filters.mood)
  if (filters?.genre) params.set('genre', filters.genre)
  if (filters?.pacing) params.set('pacing', filters.pacing)
  if (filters?.intensity !== undefined) params.set('intensity', String(filters.intensity))
  const res = await fetch(`${API_BASE}/music/search?${params}`)
  if (!res.ok) throw new Error('Failed to search music')
  return res.json()
}

export async function learnFromUrl(url: string): Promise<SkillFile> {
  const res = await fetch(`${API_BASE}/skills/learn`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  })
  if (!res.ok) throw new Error('Failed to learn from URL')
  return res.json()
}

export async function getSkills(): Promise<SkillFile[]> {
  const res = await fetch(`${API_BASE}/skills`)
  if (!res.ok) throw new Error('Failed to get skills')
  return res.json()
}

export async function createManualSkill(name: string, content: string): Promise<SkillFile> {
  const res = await fetch(`${API_BASE}/skills/learn`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, content }),
  })
  if (!res.ok) throw new Error('Failed to create skill')
  return res.json()
}

export async function deleteSkill(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/skills/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error('Failed to delete skill')
}

export async function selectFolder(): Promise<string | null> {
  const res = await fetch(`${API_BASE}/files/select-folder`, { method: 'POST' })
  if (!res.ok) return null
  const data = await res.json()
  return data.path
}

export async function checkResolveConnection(): Promise<{ connected: boolean; project?: string; timeline?: string }> {
  try {
    const res = await fetch(`${API_BASE}/resolve/status`)
    return res.json()
  } catch {
    return { connected: false }
  }
}

export async function connectResolve(): Promise<{ connected: boolean; version?: string; project?: string; error?: string }> {
  try {
    const res = await fetch(`${API_BASE}/resolve/connect`, { method: 'POST' })
    return res.json()
  } catch {
    return { connected: false, error: 'Server unreachable' }
  }
}

export async function listResolveProjects(): Promise<{ projects: string[]; error?: string }> {
  try {
    const res = await fetch(`${API_BASE}/resolve/projects`)
    return res.json()
  } catch {
    return { projects: [], error: 'Server unreachable' }
  }
}

export async function loadResolveProject(name: string): Promise<{ project?: string; timeline?: string; error?: string }> {
  try {
    const res = await fetch(`${API_BASE}/resolve/projects/load`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    })
    return res.json()
  } catch {
    return { error: 'Server unreachable' }
  }
}

export async function sendToResolve(action: string, params?: Record<string, any>): Promise<any> {
  const res = await fetch(`${API_BASE}/resolve/command`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, params }),
  })
  return res.json()
}

export async function getResolvePlayhead(): Promise<{ timecode?: string; error?: string }> {
  try {
    const res = await fetch(`${API_BASE}/resolve/playhead`)
    return res.json()
  } catch {
    return { error: 'Server unreachable' }
  }
}

export async function seekResolve(timecode: string): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch(`${API_BASE}/resolve/seek`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ timecode }),
    })
    return res.json()
  } catch {
    return { success: false, error: 'Server unreachable' }
  }
}

export async function playResolve(): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch(`${API_BASE}/resolve/play`, { method: 'POST' })
    return res.json()
  } catch {
    return { success: false, error: 'Server unreachable' }
  }
}

export async function stopResolve(): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch(`${API_BASE}/resolve/stop`, { method: 'POST' })
    return res.json()
  } catch {
    return { success: false, error: 'Server unreachable' }
  }
}

export async function startExport(config: {
  clipPaths: string[]
  outputPath: string
  format: string
  codec: string
  resolution: string
  musicTrack?: { path: string; volume: number }
}): Promise<any> {
  const res = await fetch(`${API_BASE}/export/render`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  })
  if (!res.ok) throw new Error('Export failed')
  return res.json()
}

export async function getExportStatus(jobId: string): Promise<any> {
  const res = await fetch(`${API_BASE}/export/status/${jobId}`)
  if (!res.ok) throw new Error('Failed to get export status')
  return res.json()
}

export async function getSfxLibrary(): Promise<SfxPreset[]> {
  const res = await fetch(`${API_BASE}/sfx/library`)
  if (!res.ok) throw new Error('Failed to get SFX library')
  return res.json()
}

export async function searchSfx(query: string): Promise<SfxPreset[]> {
  const res = await fetch(`${API_BASE}/sfx/search?q=${encodeURIComponent(query)}`)
  if (!res.ok) throw new Error('Failed to search SFX')
  return res.json()
}

export async function searchEpidemicSfx(query: string): Promise<EpidemicSfx[]> {
  const res = await fetch(`${API_BASE}/sfx/epidemic/search?q=${encodeURIComponent(query)}`)
  if (!res.ok) throw new Error('Failed to search Epidemic Sound SFX')
  return res.json()
}

export async function getTransitionPresets(): Promise<TransitionPreset[]> {
  const res = await fetch(`${API_BASE}/transitions/presets`)
  if (!res.ok) throw new Error('Failed to get transition presets')
  return res.json()
}

export async function getTitleCardPresets(): Promise<TitleCardPreset[]> {
  const res = await fetch(`${API_BASE}/title-cards/presets`)
  if (!res.ok) throw new Error('Failed to get title card presets')
  return res.json()
}

export interface MoodAxes {
  intensity: number
  intimacy: number
  chaos: number
}

export interface BriefFields {
  duration: number
  platform: string
  mood: string
  pacing: 'fast' | 'medium' | 'slow'
  musicKeywords: string
  narrativeNotes: string
  clipSelectionHints: string
  moodAxes?: MoodAxes
}

export interface AssembledResult {
  assemblyId: string
  storyboardClips: {
    id: string
    clipId: string
    filePath: string
    fileName: string
    thumbnailPath: string
    duration: number
    width: number
    height: number
    fps: number
    codec: string
    startTime: number
    endTime: number
    position: number
    audioOffset: number
    reason: string
  }[]
  sfxPlacements: {
    id: string
    category: string
    role: string
    searchQuery: string
    timelineStart: number
    timelineEnd?: number
    volume: number
    fadeIn: number
    fadeOut: number
    reason: string
    epidemicTrack?: { id: string; title: string; previewUrl?: string }
  }[]
  transitions: {
    id: string
    afterClipPosition: number
    presetId: string
    presetName: string
    duration: number
    reason: string
  }[]
  musicQuery: string
  totalDuration: number
  narrative: string
  resolveStatus?: 'pushed' | 'no-resolve'
  zoomPlan?: { clipIndex: number; direction: string }[]
  slowMoPlan?: { clipIndex: number; speed: number }[]
  stabilizedClips?: number[]
}

export interface VisionAnalysisResult {
  description: string
  contentTags: string[]
  hasFaces: boolean
  faceCount: number
  hasSmiles: boolean
  hasAction: boolean
  bestMomentTimestamps: number[]
  sceneType: string
  dominantColors: string[]
  composition: string
  emotionalTone: string
  shotType: string
  cameraMovement: string
  humanContent: string[]
  activityType: string[]
  environment: string
  lighting: string
  editUtility: string[]
  rankedMoments: { timestamp: number; score: number; reason: string }[]
}

export async function analyzeClipVision(
  filePath: string,
  clipId: string,
  duration: number,
): Promise<VisionAnalysisResult> {
  const res = await fetch(`${API_BASE}/clips/vision-analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filePath, clipId, duration }),
  })
  if (!res.ok) throw new Error('Vision analysis failed')
  return res.json()
}

export async function analyzeClipsBatchVision(
  clips: { id: string; filePath: string; duration: number }[],
): Promise<{ results: Record<string, VisionAnalysisResult>; errors: Record<string, string> }> {
  const res = await fetch(`${API_BASE}/clips/vision-analyze-batch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clips }),
  })
  if (!res.ok) throw new Error('Batch vision analysis failed')
  return res.json()
}

export async function recordClipUsage(projectId: string, filePaths: string[]): Promise<{ recorded: number }> {
  const res = await fetch(`${API_BASE}/clips/record-usage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ projectId, filePaths }),
  })
  if (!res.ok) throw new Error('Failed to record clip usage')
  return res.json()
}

export async function parseBrief(braindump: string): Promise<BriefFields> {
  const res = await fetch(`${API_BASE}/brief/parse`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ braindump }),
  })
  if (!res.ok) throw new Error('Failed to parse brief')
  return res.json()
}

export async function buildFromBrief(
  brief: BriefFields & { selectedSkillIds?: string[] },
  clips?: any[],
  music?: { musicBpm?: number; musicMood?: string[]; musicPreviewUrl?: string; musicDuration?: number },
  projectId?: string,
  editPreferences?: any,
  clientId?: string,
  editStyleId?: string,
): Promise<AssembledResult> {
  const res = await fetch(`${API_BASE}/brief/build`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ brief, clips, music, projectId, editPreferences, clientId, editStyleId }),
  })
  if (!res.ok) throw new Error('Failed to build assembly')
  return res.json()
}

export async function recutToMusic(
  brief: BriefFields & { selectedSkillIds?: string[] },
  clips: any[],
  music: { musicBpm?: number; musicMood?: string[]; musicPreviewUrl?: string; musicDuration?: number },
  projectId?: string,
  editPreferences?: any,
  clientId?: string,
  editStyleId?: string,
): Promise<AssembledResult> {
  const res = await fetch(`${API_BASE}/brief/recut`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ brief, clips, music, projectId, editPreferences, clientId, editStyleId }),
  })
  if (!res.ok) throw new Error('Failed to recut to music')
  return res.json()
}

export interface SkillSummary {
  id: string
  name: string
  category: string
  llmReady: boolean
}

export async function getBriefSkills(): Promise<SkillSummary[]> {
  const res = await fetch(`${API_BASE}/brief/skills`)
  if (!res.ok) throw new Error('Failed to get skills')
  return res.json()
}

export async function recommendPreferences(
  brief: BriefFields,
  clips: any[],
): Promise<{ preferences: any; reasoning: string }> {
  const res = await fetch(`${API_BASE}/brief/recommend-preferences`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ brief, clips }),
  })
  if (!res.ok) throw new Error('Failed to get recommendations')
  return res.json()
}

export async function autoSelectSkills(
  clips: any[],
  brief: BriefFields,
): Promise<string[]> {
  const res = await fetch(`${API_BASE}/brief/auto-select-skills`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clips, brief }),
  })
  if (!res.ok) throw new Error('Failed to auto-select skills')
  const data = await res.json()
  return data.selectedIds
}

// Cloudinary
export async function checkCloudinaryStatus(): Promise<{ configured: boolean }> {
  const res = await fetch(`${API_BASE}/cloudinary/status`)
  return res.json()
}

export async function uploadToCloudinary(
  filePath: string,
  folder?: string,
): Promise<{ publicId: string; secureUrl: string; bytes: number }> {
  const res = await fetch(`${API_BASE}/cloudinary/upload`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filePath, folder }),
  })
  if (!res.ok) throw new Error('Cloudinary upload failed')
  return res.json()
}

// Audio cleanup
export async function checkAudioStatus(): Promise<{ dolbyConfigured: boolean; ffmpegAvailable: boolean }> {
  const res = await fetch(`${API_BASE}/audio/status`)
  return res.json()
}

export async function analyzeAudio(filePath: string): Promise<{
  hasAudio: boolean
  noiseLevel: 'clean' | 'moderate' | 'noisy'
  peakDb: number
  needsCleanup: boolean
}> {
  const res = await fetch(`${API_BASE}/audio/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filePath }),
  })
  if (!res.ok) throw new Error('Audio analysis failed')
  return res.json()
}

// Settings
export async function getSettings(): Promise<Record<string, boolean>> {
  const res = await fetch(`${API_BASE}/settings`)
  return res.json()
}

export async function saveSettings(settings: Record<string, string>): Promise<{ success: boolean; error?: string }> {
  const res = await fetch(`${API_BASE}/settings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(settings),
  })
  return res.json()
}

// Queue
export interface StructuredBrief {
  businessName: string
  contactName: string
  email: string
  projectTitle?: string
  briefType: 'shoot' | 'edit' | 'shoot-edit'
  description: string
  keyMessages?: string
  targetAudience?: string
  deliverables?: string
  styleReferences?: string
  budgetRange?: string
  deliveryDate?: string
  notes?: string
}

export interface QueueJob {
  id: string
  projectId: string
  projectName: string
  sourcePath: string
  clientId?: string
  structuredBrief: StructuredBrief
  editBrief?: BriefFields
  status: 'pending' | 'importing' | 'analyzing-vision' | 'translating' | 'assembling' | 'pushing-resolve' | 'exporting' | 'uploading' | 'saving' | 'complete' | 'error'
  progress: number
  statusText: string
  result?: { clipCount: number; totalDuration: number; narrative: string; resolveProject?: string; exportPath?: string; cloudinaryUrl?: string }
  error?: string
  createdAt: string
  startedAt?: string
  completedAt?: string
}

export async function getQueue(): Promise<{ jobs: QueueJob[]; processing: boolean }> {
  const res = await fetch(`${API_BASE}/queue`)
  return res.json()
}

export async function getQueueJob(id: string): Promise<QueueJob> {
  const res = await fetch(`${API_BASE}/queue/${id}`)
  return res.json()
}

export async function submitQueueJob(
  sourcePath: string,
  brief: StructuredBrief,
  clientId?: string,
): Promise<QueueJob> {
  const res = await fetch(`${API_BASE}/queue/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sourcePath, brief, clientId }),
  })
  return res.json()
}

export async function startQueue(): Promise<void> {
  await fetch(`${API_BASE}/queue/start`, { method: 'POST' })
}

export async function stopQueue(): Promise<void> {
  await fetch(`${API_BASE}/queue/stop`, { method: 'POST' })
}

export async function removeQueueJob(id: string): Promise<void> {
  await fetch(`${API_BASE}/queue/${id}`, { method: 'DELETE' })
}

// Clients
export interface ClientProfile {
  id: string
  name: string
  contactName: string
  email: string
  logoPath?: string
  brandColors?: string[]
  createdAt: string
  updatedAt: string
}

export interface ClientInstructions {
  editing: string[]
  style: string[]
  avoid: string[]
  general: string[]
}

export interface FontSpec {
  family: string
  weight: string
  style?: 'normal' | 'italic'
}

export interface ClientTypography {
  heading: FontSpec
  subheading: FontSpec
  body: FontSpec
}

export interface LogoUsage {
  intro: boolean
  outro: boolean
  watermark: boolean
  watermarkPosition: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
  watermarkOpacity: number
  outroDuration: number
}

export interface AudioDefaults {
  musicVolume: 'background' | 'balanced' | 'music-forward'
  preserveOriginalAudio: boolean
}

export interface CaptionStyle {
  position: 'bottom' | 'center' | 'top'
  background: 'none' | 'solid' | 'gradient' | 'outline'
  size: 'subtle' | 'standard' | 'bold'
}

export interface ReferenceReel {
  id: string
  url: string
  localPath?: string
  addedAt: string
  analysis?: {
    totalDuration: number
    cutCount: number
    avgCutLength: number
    pacing: 'fast' | 'medium' | 'slow'
    notes: string
  }
}

export interface EditStyle {
  id: string
  name: string
  isDefault: boolean
  instructions: ClientInstructions
  captionStyle: CaptionStyle
  defaultPacing: 'fast' | 'medium' | 'slow'
  defaultMood: string
  gradingLook: string
  musicKeywords: string
  referenceReels: ReferenceReel[]
}

export interface ClientData {
  profile: ClientProfile
  typography: ClientTypography
  logoUsage: LogoUsage
  audioDefaults: AudioDefaults
  brandColors: string[]
  defaultPlatform: string
  instructions: ClientInstructions
  editStyles: EditStyle[]
  referenceReels: ReferenceReel[]
  footageLibraryPath?: string
  cloudinaryFolder?: string
  projectIds: string[]
}

export async function listClients(): Promise<ClientProfile[]> {
  const res = await fetch(`${API_BASE}/clients`)
  return res.json()
}

export async function getClient(id: string): Promise<ClientData> {
  const res = await fetch(`${API_BASE}/clients/${id}`)
  return res.json()
}

export async function createClient(profile: { name: string; contactName?: string; email?: string }): Promise<ClientData> {
  const res = await fetch(`${API_BASE}/clients`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(profile),
  })
  return res.json()
}

export async function updateClientInstructions(id: string, instructions: ClientInstructions): Promise<ClientData> {
  const res = await fetch(`${API_BASE}/clients/${id}/instructions`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(instructions),
  })
  return res.json()
}

export async function addClientInstruction(
  id: string,
  category: keyof ClientInstructions,
  instruction: string,
): Promise<ClientData> {
  const res = await fetch(`${API_BASE}/clients/${id}/instructions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ category, instruction }),
  })
  return res.json()
}

export async function getClientCloudinary(id: string): Promise<{ folder: string; galleryUrl: string | null }> {
  const res = await fetch(`${API_BASE}/clients/${id}/cloudinary`)
  return res.json()
}

export async function setClientCloudinaryFolder(id: string, folder: string): Promise<{ folder: string; galleryUrl: string | null }> {
  const res = await fetch(`${API_BASE}/clients/${id}/cloudinary`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ folder }),
  })
  return res.json()
}

export async function addReferenceReel(clientId: string, url: string): Promise<any> {
  const res = await fetch(`${API_BASE}/clients/${clientId}/reference-reels`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  })
  return res.json()
}

export async function listReferenceReels(clientId: string): Promise<any[]> {
  const res = await fetch(`${API_BASE}/clients/${clientId}/reference-reels`)
  return res.json()
}

export async function removeReferenceReel(clientId: string, reelId: string): Promise<void> {
  await fetch(`${API_BASE}/clients/${clientId}/reference-reels/${reelId}`, { method: 'DELETE' })
}

export async function openClientFolder(clientId: string): Promise<{ path: string }> {
  const res = await fetch(`${API_BASE}/clients/${clientId}/open-folder`, { method: 'POST' })
  return res.json()
}

export async function setClientLogo(clientId: string, logoPath: string): Promise<any> {
  const res = await fetch(`${API_BASE}/clients/${clientId}/logo`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path: logoPath }),
  })
  return res.json()
}

export async function uploadClientLogo(clientId: string, file: File): Promise<ClientData> {
  const form = new FormData()
  form.append('logo', file)
  const res = await fetch(`${API_BASE}/clients/${clientId}/logo/upload`, {
    method: 'POST',
    body: form,
  })
  if (!res.ok) throw new Error('Logo upload failed')
  return res.json()
}

export async function updateClient(id: string, updates: Partial<ClientProfile>): Promise<ClientData> {
  const res = await fetch(`${API_BASE}/clients/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  })
  if (!res.ok) throw new Error('Failed to update client')
  return res.json()
}

export async function removeClientInstruction(
  id: string,
  category: keyof ClientInstructions,
  index: number,
): Promise<ClientData> {
  const res = await fetch(`${API_BASE}/clients/${id}/instructions/${category}/${index}`, {
    method: 'DELETE',
  })
  if (!res.ok) throw new Error('Failed to remove instruction')
  return res.json()
}

export async function setClientFootagePath(id: string, footagePath: string): Promise<ClientData> {
  const res = await fetch(`${API_BASE}/clients/${id}/footage-path`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path: footagePath }),
  })
  if (!res.ok) throw new Error('Failed to set footage path')
  return res.json()
}

export async function updateClientTypography(id: string, typography: ClientTypography): Promise<ClientData> {
  const res = await fetch(`${API_BASE}/clients/${id}/typography`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(typography),
  })
  if (!res.ok) throw new Error('Failed to update typography')
  return res.json()
}

export async function updateClientLogoUsage(id: string, logoUsage: LogoUsage): Promise<ClientData> {
  const res = await fetch(`${API_BASE}/clients/${id}/logo-usage`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(logoUsage),
  })
  if (!res.ok) throw new Error('Failed to update logo usage')
  return res.json()
}

export async function updateClientAudioDefaults(id: string, audioDefaults: AudioDefaults): Promise<ClientData> {
  const res = await fetch(`${API_BASE}/clients/${id}/audio-defaults`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(audioDefaults),
  })
  if (!res.ok) throw new Error('Failed to update audio defaults')
  return res.json()
}

export async function updateClientBrandColors(id: string, colors: string[]): Promise<ClientData> {
  const res = await fetch(`${API_BASE}/clients/${id}/brand-colors`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ colors }),
  })
  if (!res.ok) throw new Error('Failed to update brand colors')
  return res.json()
}

export async function setClientDefaultPlatform(id: string, platform: string): Promise<ClientData> {
  const res = await fetch(`${API_BASE}/clients/${id}/default-platform`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ platform }),
  })
  if (!res.ok) throw new Error('Failed to set default platform')
  return res.json()
}

export async function addEditStyle(clientId: string, name: string, initial?: Partial<EditStyle>): Promise<ClientData> {
  const res = await fetch(`${API_BASE}/clients/${clientId}/edit-styles`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, ...initial }),
  })
  if (!res.ok) throw new Error('Failed to add edit style')
  return res.json()
}

export async function updateEditStyle(clientId: string, styleId: string, updates: Partial<EditStyle>): Promise<ClientData> {
  const res = await fetch(`${API_BASE}/clients/${clientId}/edit-styles/${styleId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  })
  if (!res.ok) throw new Error('Failed to update edit style')
  return res.json()
}

export async function removeEditStyle(clientId: string, styleId: string): Promise<ClientData> {
  const res = await fetch(`${API_BASE}/clients/${clientId}/edit-styles/${styleId}`, { method: 'DELETE' })
  if (!res.ok) throw new Error('Failed to remove edit style')
  return res.json()
}

export async function deleteClient(id: string): Promise<void> {
  await fetch(`${API_BASE}/clients/${id}`, { method: 'DELETE' })
}

export async function listCloudinaryFolders(prefix?: string): Promise<{ name: string; path: string }[]> {
  const params = prefix ? `?prefix=${encodeURIComponent(prefix)}` : ''
  const res = await fetch(`${API_BASE}/cloudinary/folders${params}`)
  if (!res.ok) return []
  return res.json()
}

// Revision
export interface RevisionResult {
  response: string
  storyboardUpdates?: any[]
  sfxUpdates?: any[]
  transitionUpdates?: any[]
  learnedInstructions?: { category: string; instruction: string }[]
}

// Media Library
const LIBRARY_API_BASE = 'http://localhost:5201/api'

export interface LibraryStats {
  totalClips: number
  analyzed: number
  visionAnalyzed: number
  watchedFolder: string | null
  isScanning: boolean
  queueLength: number
  lastScanAt: string | null
}

export interface LibraryProgress {
  phase: 'scanning' | 'metadata' | 'vision' | 'idle'
  total: number
  done: number
  currentFile: string
}

export async function getLibraryStats(): Promise<LibraryStats> {
  const res = await fetch(`${LIBRARY_API_BASE}/library/stats`)
  if (!res.ok) throw new Error('Failed to get library stats')
  return res.json()
}

export interface LibraryFolder {
  folder: string
  label: string
  clientName: string
  clipCount: number
  analyzedCount: number
}

export async function getLibraryFolders(): Promise<LibraryFolder[]> {
  const res = await fetch(`${LIBRARY_API_BASE}/library/folders`)
  if (!res.ok) return []
  return res.json()
}

export async function importFromLibrary(folderPath: string, projectId?: string): Promise<any[]> {
  const res = await fetch(`${LIBRARY_API_BASE}/library/import`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ folder: folderPath, projectId: projectId || 'default' }),
  })
  if (!res.ok) throw new Error('Failed to import from library')
  const data = await res.json()
  return data.clips
}

export async function getLibraryProgress(): Promise<LibraryProgress> {
  const res = await fetch(`${LIBRARY_API_BASE}/library/progress`)
  if (!res.ok) throw new Error('Failed to get library progress')
  return res.json()
}

// Revision
export async function sendRevision(
  context: any,
  feedback: string,
  conversationHistory: { role: 'user' | 'assistant'; content: string }[],
): Promise<RevisionResult> {
  const res = await fetch(`${API_BASE}/revision`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ context, feedback, conversationHistory }),
  })
  return res.json()
}

// Taste Profile
export interface TasteObservation {
  pattern: string
  confidence: number
  occurrences: number
  category: string
}

export interface TasteProfile {
  totalEditsAnalyzed: number
  lastUpdated: string
  observations: TasteObservation[]
  referenceStyles: ReferenceStyle[]
}

export interface ReferenceStyle {
  id: string
  name: string
  avgCutLength: number
  cutLengthVariance: number
  rhythmPattern: string[]
  shotTypeRatios: Record<string, number>
  energyCurve: number[]
  transitionDensity: number
  totalDuration: number
}

export async function getTasteProfile(): Promise<TasteProfile> {
  const res = await fetch(`${API_BASE}/taste/profile`)
  if (!res.ok) throw new Error('Failed to get taste profile')
  return res.json()
}

export async function submitTasteFeedback(
  assemblyId: string,
  clips: { clipId: string; startTime: number; endTime: number; position: number }[],
  transitions: { afterPosition: number; presetId: string }[],
  totalDuration: number,
): Promise<{ captured: boolean; reason?: string }> {
  const res = await fetch(`${API_BASE}/taste/feedback`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ assemblyId, clips, transitions, totalDuration }),
  })
  if (!res.ok) throw new Error('Failed to submit feedback')
  return res.json()
}

export async function saveReferenceStyle(
  name: string,
  clips: { clipId: string; startTime: number; endTime: number; position: number; shotType?: string }[],
  transitions: { afterPosition: number; presetId: string }[],
  totalDuration: number,
): Promise<ReferenceStyle> {
  const res = await fetch(`${API_BASE}/taste/reference`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, clips, transitions, totalDuration }),
  })
  if (!res.ok) throw new Error('Failed to save reference style')
  return res.json()
}

export async function getReferenceStyles(): Promise<ReferenceStyle[]> {
  const res = await fetch(`${API_BASE}/taste/references`)
  if (!res.ok) throw new Error('Failed to get references')
  return res.json()
}

export async function deleteReferenceStyle(id: string): Promise<void> {
  await fetch(`${API_BASE}/taste/reference/${id}`, { method: 'DELETE' })
}

// Edit Intent
export interface IntentQuestion {
  id: string
  category: 'structure' | 'grading' | 'audio' | 'titles' | 'pacing'
  question: string
  options: { label: string; value: string; description?: string }[]
  priority: number
}

export interface EditIntent {
  id: string
  structure: { focus: string | null; droneUsage: string | null; peakMoment: string | null; pacing: string | null }
  grading: { look: string | null; consistency: string | null }
  audio: { feel: string | null; backgroundNoise: string | null; musicLevel: string | null }
  titles: { textUsage: string | null }
}

export async function getIntentQuestions(
  brief: BriefFields,
  musicStructure?: any,
): Promise<IntentQuestion[]> {
  const res = await fetch(`${API_BASE}/intent/questions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ brief, musicStructure }),
  })
  if (!res.ok) throw new Error('Failed to get intent questions')
  const data = await res.json()
  return data.questions
}

export async function buildEditIntent(
  answers: Record<string, string>,
  projectId?: string,
  clientId?: string,
): Promise<{ intent: EditIntent }> {
  const res = await fetch(`${API_BASE}/intent/build`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ answers, projectId, clientId }),
  })
  if (!res.ok) throw new Error('Failed to build intent')
  return res.json()
}

// Audio mixing
export async function applyAudioMix(intentId?: string, intent?: EditIntent): Promise<{
  clipsProcessed: number
  musicLevel: number | null
  decisions: { clipIndex: number; fileName: string; volumeDb: number; muted: boolean; reason: string }[]
}> {
  const res = await fetch(`${API_BASE}/audio/mix`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ intentId, intent }),
  })
  if (!res.ok) throw new Error('Failed to apply audio mix')
  return res.json()
}

// Title pipeline
export async function applyTitles(
  intentId?: string,
  intent?: EditIntent,
  projectName?: string,
  clientName?: string,
): Promise<{
  placed: number
  placements: { clipIndex: number; presetId: string; text: string; reason: string }[]
}> {
  const res = await fetch(`${API_BASE}/title-cards/apply`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ intentId, intent, projectName, clientName }),
  })
  if (!res.ok) throw new Error('Failed to apply titles')
  return res.json()
}

// Grading
export async function applyGrading(intentId?: string, intent?: EditIntent): Promise<{
  graded: number
  decisions: { clipIndex: number; fileName: string; nodes: any[] }[]
}> {
  const res = await fetch(`${API_BASE}/grading/apply`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ intentId, intent }),
  })
  if (!res.ok) throw new Error('Failed to apply grading')
  return res.json()
}
