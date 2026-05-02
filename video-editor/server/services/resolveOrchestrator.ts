import { resolveBridge } from './resolveBridge.js'
import { planZooms, zoomToFusionScript, type ZoomPlan } from './dynamicZoom.js'
import { detectSlowMoCandidates, type SlowMoPlan } from './slowMoDetector.js'
import { ColorGradingService } from './colorGrading.js'
import { AudioMixingService } from './audioMixing.js'
import { SfxService } from './sfx.js'
import type { EditIntent } from './editIntent.js'
import type { EditPreferences } from './editPreferences.js'
import type { BriefFields } from './briefAssembler.js'
import path from 'path'
import os from 'os'
import fs from 'fs'

interface StoryboardClip {
  id: string
  clipId: string
  filePath: string
  fileName: string
  startTime: number
  endTime: number
  position: number
  audioOffset: number
  fps?: number
  duration?: number
  analysis?: Record<string, any>
}

interface Transition {
  afterClipPosition: number
  presetId: string
  presetName: string
  duration: number
  reason: string
}

interface SfxPlacement {
  id: string
  category: string
  searchQuery: string
  timelineStart: number
  timelineEnd?: number
  volume: number
  epidemicTrack?: { id: string; title: string; previewUrl?: string }
}

interface MusicInfo {
  previewUrl?: string
  duration?: number
}

export interface OrchestratorResult {
  resolveStatus: 'pushed' | 'failed' | 'no-resolve'
  error?: string
  zoomPlan: ZoomPlan[]
  slowMoPlan: SlowMoPlan[]
  stabilizedClips: number[]
  musicPlaced: boolean
  sfxPlaced: number
  audioMixed: boolean
  graded: boolean
}

export class ResolveOrchestrator {
  private grading = new ColorGradingService()
  private audioMixing = new AudioMixingService()
  private sfxService = new SfxService()

  async pushFullEdit(
    projectName: string,
    storyboardClips: StoryboardClip[],
    transitions: Transition[],
    sfxPlacements: SfxPlacement[],
    editIntent?: EditIntent | null,
    moodAxes?: { intensity?: number; intimacy?: number; chaos?: number },
    editPreferences?: EditPreferences | null,
    musicInfo?: MusicInfo | null,
    brief?: BriefFields | null,
  ): Promise<OrchestratorResult> {
    const result: OrchestratorResult = {
      resolveStatus: 'no-resolve',
      zoomPlan: [],
      slowMoPlan: [],
      stabilizedClips: [],
      musicPlaced: false,
      sfxPlaced: 0,
      audioMixed: false,
      graded: false,
    }

    if (!resolveBridge.status.connected) {
      try {
        const status = await resolveBridge.start()
        if (!status.connected) return result
      } catch {
        return result
      }
    }

    // 1. Push timeline (clips with in/out timing + audio offsets)
    const sorted = [...storyboardClips].sort((a, b) => a.position - b.position)

    const resolveTransitions = transitions.map(t => ({
      afterClipPosition: t.afterClipPosition,
      type: t.presetName || 'Cross Dissolve',
      duration: t.duration,
    }))

    const pushResult = await resolveBridge.pushTimeline(projectName, sorted, resolveTransitions)
    if (!pushResult.success) {
      result.resolveStatus = 'failed'
      result.error = pushResult.error
      return result
    }

    result.resolveStatus = 'pushed'

    // 2. Place music on audio track
    if (musicInfo?.previewUrl) {
      try {
        const musicPath = await this.downloadMusic(musicInfo.previewUrl)
        if (musicPath) {
          await resolveBridge.addAudioTrack('Music')
          await resolveBridge.importAudioToTrack(1, musicPath, 0)
          result.musicPlaced = true
        }
      } catch {}
    }

    // 3. Place SFX on audio track
    if (sfxPlacements.length > 0 && editPreferences?.sfx?.enabled !== false) {
      try {
        const sfxTrackResult = await resolveBridge.addAudioTrack('SFX')
        const sfxTrackIndex = sfxTrackResult.track_index ?? 2

        for (const placement of sfxPlacements) {
          if (!placement.epidemicTrack?.previewUrl && !placement.searchQuery) continue

          let filePath: string | null = null

          if (placement.epidemicTrack?.previewUrl) {
            filePath = await this.sfxService.downloadSfxToTemp(
              placement.epidemicTrack.previewUrl,
              placement.epidemicTrack.id,
            )
          } else if (placement.searchQuery) {
            const downloaded = await this.sfxService.findAndDownload(
              placement.searchQuery,
              { category: placement.category, role: 'accent', searchQuery: placement.searchQuery },
            )
            filePath = downloaded?.filePath ?? null
          }

          if (filePath) {
            await resolveBridge.importAudioToTrack(
              sfxTrackIndex,
              filePath,
              placement.timelineStart,
            )
            result.sfxPlaced++
          }
        }
      } catch {}
    }

    // 4. Dynamic zooms (gated by preferences)
    if (editPreferences?.zoom?.enabled !== false) {
      try {
        const zoomCandidates = planZooms(
          sorted.map((c, i) => ({
            clipId: c.clipId,
            startTime: c.startTime,
            endTime: c.endTime,
            position: i,
            analysis: c.analysis,
          })),
          moodAxes,
        )
        result.zoomPlan = zoomCandidates

        for (const zoom of zoomCandidates) {
          const clip = sorted[zoom.clipIndex]
          if (!clip) continue
          const fps = clip.fps || 24
          const durFrames = Math.round((clip.endTime - clip.startTime) * fps)
          const script = zoomToFusionScript(zoom, durFrames, fps)
          await resolveBridge.injectFusionComp(zoom.clipIndex, script).catch(() => {})
        }
      } catch {}
    }

    // 5. Slow-mo (gated by preferences)
    if (editPreferences?.slowMo?.enabled !== false) {
      try {
        const slowMoCandidates = detectSlowMoCandidates(
          sorted.map((c, i) => ({
            clipId: c.clipId,
            startTime: c.startTime,
            endTime: c.endTime,
            position: i,
            analysis: c.analysis,
          })),
          moodAxes,
        )

        const targetSpeed = editPreferences?.slowMo?.speed ?? 50
        for (const sm of slowMoCandidates) {
          sm.speed = targetSpeed as 25 | 50 | 75
        }

        result.slowMoPlan = slowMoCandidates

        for (const sm of slowMoCandidates) {
          await resolveBridge.setRetiming(sm.clipIndex, 'optical_flow', sm.speed / 100).catch(() => {})
        }
      } catch {}
    }

    // 6. Stabilisation (gated by preferences)
    if (editPreferences?.stabilisation?.enabled !== false) {
      try {
        const stabMode = editPreferences?.stabilisation?.mode ?? 'perspective'
        const applyTo = editPreferences?.stabilisation?.applyTo ?? 'shaky-only'

        for (let i = 0; i < sorted.length; i++) {
          const a = sorted[i].analysis
          const isShaky = a?.cameraMovement === 'handheld' || a?.movementLevel === 'high'
          if (applyTo === 'all' || isShaky) {
            await resolveBridge.applyResolveFx(i, 'Stabilization', {
              mode: stabMode,
              strength: 0.8,
            }).catch(() => {})
            result.stabilizedClips.push(i)
          }
        }
      } catch {}
    }

    // 7. Color grading — apply even without editIntent using sensible defaults
    if (editPreferences?.grading?.enabled !== false) {
      try {
        if (editIntent) {
          await this.grading.gradeTimeline(editIntent)
          result.graded = true
        } else if (editPreferences?.grading?.look || brief?.mood) {
          const synthIntent: EditIntent = {
            structure: {},
            grading: {
              look: editPreferences?.grading?.look || this.moodToGradingLook(brief?.mood),
              consistency: editPreferences?.grading?.consistency || 'match-cameras',
            },
            audio: {},
            titles: {},
          }
          await this.grading.gradeTimeline(synthIntent)
          result.graded = true
        }
      } catch {}
    }

    // 8. Audio mixing — apply clip volume levels
    if (editIntent) {
      try {
        await this.audioMixing.mixTimeline(editIntent)
        result.audioMixed = true
      } catch {}
    }

    return result
  }

  private moodToGradingLook(mood?: string): string {
    if (!mood) return 'natural'
    const lower = mood.toLowerCase()
    if (lower.includes('warm') || lower.includes('cozy') || lower.includes('golden')) return 'warm'
    if (lower.includes('cool') || lower.includes('corporate') || lower.includes('clean')) return 'cool'
    if (lower.includes('energy') || lower.includes('intense') || lower.includes('bold')) return 'punchy'
    if (lower.includes('cinematic') || lower.includes('film') || lower.includes('dramatic')) return 'cinematic'
    return 'natural'
  }

  private async downloadMusic(previewUrl: string): Promise<string | null> {
    try {
      const musicDir = path.join(os.tmpdir(), 'superedits-music')
      fs.mkdirSync(musicDir, { recursive: true })

      const hash = previewUrl.split('/').pop()?.replace(/[^a-zA-Z0-9]/g, '') || 'track'
      const filePath = path.join(musicDir, `${hash}.mp3`)

      if (fs.existsSync(filePath)) return filePath

      const response = await fetch(previewUrl)
      if (!response.ok) return null

      const buffer = Buffer.from(await response.arrayBuffer())
      fs.writeFileSync(filePath, buffer)
      return filePath
    } catch {
      return null
    }
  }
}

export const resolveOrchestrator = new ResolveOrchestrator()
