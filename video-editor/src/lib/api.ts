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

export async function sendToResolve(action: string, params?: Record<string, any>): Promise<any> {
  const res = await fetch(`${API_BASE}/resolve/command`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, params }),
  })
  return res.json()
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
): Promise<AssembledResult> {
  const res = await fetch(`${API_BASE}/brief/build`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ brief, clips, music, projectId }),
  })
  if (!res.ok) throw new Error('Failed to build assembly')
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

export interface ClientData {
  profile: ClientProfile
  instructions: ClientInstructions
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
