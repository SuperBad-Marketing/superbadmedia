// Project
export interface Project {
  id: string
  name: string
  clientName: string
  createdAt: string
  updatedAt: string
  status: 'ingesting' | 'ready' | 'editing' | 'grading' | 'exporting' | 'delivered'
  musicTrackId?: string
  notes?: string
}

// Clip (from analysis)
export interface Clip {
  id: string
  projectId: string
  filePath: string
  fileName: string
  thumbnailPath?: string
  duration: number // seconds
  width: number
  height: number
  fps: number
  codec: string
  isLog: boolean
  camera?: string
  analysis?: ClipAnalysis
}

export interface ClipAnalysis {
  sharpness: number // 0-100
  exposure: number // -2 to +2
  hasFaces: boolean
  faceCount: number
  movementLevel: 'static' | 'low' | 'medium' | 'high'
  energyLevel: number // 0-100
  contentTags: string[]
  qualityRating: number // 1-5
  audioQuality?: 'good' | 'fair' | 'poor' | 'none'
  description?: string
  isBestMoment?: boolean
  visionAnalyzed?: boolean
  hasSmiles?: boolean
  hasAction?: boolean
  bestMomentTimestamps?: number[]
  sceneType?: string
  dominantColors?: string[]
  composition?: string
  emotionalTone?: string
  shotType?: 'drone-aerial' | 'wide' | 'medium' | 'close-up' | 'extreme-close-up' | 'macro' | 'pov' | 'over-shoulder' | 'tracking'
  cameraMovement?: 'static' | 'pan' | 'tilt' | 'dolly' | 'handheld' | 'gimbal-smooth' | 'drone-orbit' | 'crane' | 'whip-pan'
  humanContent?: ('emotion-joy' | 'emotion-focus' | 'emotion-surprise' | 'emotion-sadness' | 'candid-moment' | 'posed' | 'interaction' | 'solo' | 'group' | 'crowd')[]
  activityType?: ('working' | 'socialising' | 'eating-drinking' | 'sport-action' | 'creative-process' | 'presenting' | 'conversation' | 'walking' | 'celebration' | 'performing')[]
  environment?: 'indoor' | 'outdoor' | 'urban' | 'nature' | 'studio' | 'venue' | 'office' | 'retail' | 'restaurant' | 'residential'
  lighting?: 'golden-hour' | 'daylight' | 'overcast' | 'night' | 'artificial' | 'mixed' | 'backlit' | 'dramatic'
  editUtility?: ('b-roll' | 'hero-shot' | 'establishing' | 'detail-insert' | 'reaction' | 'transition-friendly' | 'opener' | 'closer')[]
  rankedMoments?: { timestamp: number; score: number; reason: string }[]
}

// Storyboard
export interface StoryboardClip {
  id: string
  clipId: string
  clip: Clip
  startTime: number // in source clip
  endTime: number // in source clip
  position: number // order in storyboard
  transitionIn?: Transition
  transitionOut?: Transition
}

export interface Transition {
  type: 'cut' | 'dissolve' | 'wipe' | 'impact' | 'light-leak' | 'whip' | 'zoom-blur' | 'film-burn' | 'glitch' | 'custom'
  duration: number
  sfxId?: string
  isFromLibrary: boolean
}

// Music
export interface MusicTrack {
  id: string
  title: string
  artist: string
  duration: number
  bpm: number
  genre: string
  mood: string[]
  energy: number // 0-100
  hasStems: boolean
  previewUrl?: string
  coverUrl?: string
  source: 'epidemic' | 'local'
  filePath?: string
}

// Chat
export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: string
  isLoading?: boolean
  action?: ChatAction
}

export interface ChatAction {
  type: 'ingest' | 'assemble' | 'transition' | 'sfx' | 'grade' | 'export' | 'learn' | 'music-search' | 'reframe' | 'caption' | 'title-card' | 'find-clips'
  status: 'pending' | 'running' | 'complete' | 'error'
  description: string
  progress?: number
}

// Skill / Knowledge
export interface SkillQualityScore {
  quantifiedParams: number
  conditionalLogic: number
  structuredPatterns: number
  decisionBoundaries: number
  total: number
  passing: boolean
  gaps: string[]
}

export interface SkillFile {
  id: string
  name: string
  category: 'resolve-core' | 'editorial-craft' | 'integration' | 'personal' | 'project-learned'
  source: 'youtube' | 'article' | 'pdf' | 'manual' | 'project-analysis'
  sourceUrl?: string
  content: string
  createdAt: string
  updatedAt: string
  topicCount: number
  qualityScore?: SkillQualityScore
  llmReady?: boolean
}

// Ingest
export interface IngestJob {
  id: string
  projectId: string
  sourcePath: string
  sourceType: 'card' | 'folder'
  status: 'pending' | 'copying' | 'analyzing' | 'cleaning-audio' | 'creating-project' | 'complete' | 'error'
  progress: number
  totalFiles: number
  processedFiles: number
  errors: string[]
  clips?: Clip[]
}

// Export
export interface ExportJob {
  id: string
  projectId: string
  format: '16:9' | '9:16' | '1:1' | '4:5'
  resolution: string
  codec: string
  status: 'pending' | 'rendering' | 'uploading' | 'complete' | 'error'
  progress: number
  outputPath?: string
}

export type WorkflowPhase = 'home' | 'import' | 'brief' | 'assemble' | 'refine' | 'polish' | 'deliver' | 'queue'
export type DockPanel = 'media' | 'ai' | 'music' | 'sound' | 'transitions' | 'text' | 'knowledge'

export interface SfxPreset {
  id: string
  name: string
  category: 'impact' | 'whoosh' | 'riser' | 'ambient' | 'foley' | 'ui' | 'musical'
  description: string
  duration: number
  tags: string[]
}

export interface EpidemicSfx {
  id: string
  title: string
  duration: number
  category: string
  subCategory: string
  tags: string[]
  previewUrl?: string
  waveformUrl?: string
  coverUrl?: string
  source: 'epidemic'
}

export interface TransitionPreset {
  id: string
  name: string
  category: 'impact' | 'dissolve' | 'wipe' | 'zoom' | 'film' | 'glitch'
  description: string
  duration: number
  hasSfx: boolean
}

export interface TitleCardPreset {
  id: string
  name: string
  type: 'title' | 'lower-third' | 'end-card' | 'chapter' | 'quote'
  description: string
  hasAnimation: boolean
}

// SFX Placement (timeline-level, from assembly)
export interface SfxPlacement {
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
  epidemicTrack?: {
    id: string
    title: string
    previewUrl?: string
  }
}

// Transition Placement (between clips, from assembly)
export interface TransitionPlacement {
  id: string
  afterClipPosition: number
  presetId: string
  presetName: string
  duration: number
  reason: string
}

export interface AdVariationConfig {
  formats: ('16:9' | '9:16' | '1:1' | '4:5')[]
  lengths: number[]
  hookCount: number
  ctas: string[]
  includeFasterPacing: boolean
  includeSlowerPacing: boolean
  includeStatics: boolean
  staticTypes: ('single' | 'carousel' | 'before-after' | 'quote-card')[]
  headline?: string
  subheadline?: string
}

export interface AdVariation {
  id: string
  type: 'video' | 'static'
  format: '16:9' | '9:16' | '1:1' | '4:5'
  length?: number
  hookVariant?: number
  cta?: string
  pacing?: 'normal' | 'fast' | 'slow'
  staticType?: 'single' | 'carousel' | 'before-after' | 'quote-card'
  thumbnailUrl?: string
  status: 'pending' | 'generating' | 'ready' | 'approved' | 'rejected'
  headline?: string
  subheadline?: string
}
