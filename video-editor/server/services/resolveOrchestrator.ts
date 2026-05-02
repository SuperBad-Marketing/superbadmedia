import { resolveBridge } from './resolveBridge.js'
import { planZooms, zoomToFusionScript, type ZoomPlan } from './dynamicZoom.js'
import { detectSlowMoCandidates, type SlowMoPlan } from './slowMoDetector.js'
import { ColorGradingService } from './colorGrading.js'
import type { EditIntent } from './editIntent.js'
import type { EditPreferences } from './editPreferences.js'

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

export interface OrchestratorResult {
  resolveStatus: 'pushed' | 'failed' | 'no-resolve'
  error?: string
  zoomPlan: ZoomPlan[]
  slowMoPlan: SlowMoPlan[]
  stabilizedClips: number[]
}

export class ResolveOrchestrator {
  private grading = new ColorGradingService()

  async pushFullEdit(
    projectName: string,
    storyboardClips: StoryboardClip[],
    transitions: Transition[],
    sfxPlacements: SfxPlacement[],
    editIntent?: EditIntent | null,
    moodAxes?: { intensity?: number; intimacy?: number; chaos?: number },
    editPreferences?: EditPreferences | null,
  ): Promise<OrchestratorResult> {
    const result: OrchestratorResult = {
      resolveStatus: 'no-resolve',
      zoomPlan: [],
      slowMoPlan: [],
      stabilizedClips: [],
    }

    if (!resolveBridge.status.connected) {
      try {
        const status = await resolveBridge.start()
        if (!status.connected) return result
      } catch {
        return result
      }
    }

    // 1. Push timeline (clips + transitions)
    const sorted = [...storyboardClips].sort((a, b) => a.position - b.position)
    const timelineClips = sorted.map(c => ({
      filePath: c.filePath,
      startTime: c.startTime,
      endTime: c.endTime,
      position: c.position,
    }))

    const resolveTransitions = transitions.map(t => ({
      afterClipPosition: t.afterClipPosition,
      type: t.presetName || 'Cross Dissolve',
      duration: t.duration,
    }))

    const pushResult = await resolveBridge.pushTimeline(projectName, timelineClips, resolveTransitions)
    if (!pushResult.success) {
      result.resolveStatus = 'failed'
      result.error = pushResult.error
      return result
    }

    result.resolveStatus = 'pushed'

    // 2. Dynamic zooms (gated by preferences)
    if (editPreferences?.zoom.enabled !== false) {
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

    // 3. Slow-mo (gated by preferences)
    if (editPreferences?.slowMo.enabled !== false) {
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

        const targetSpeed = editPreferences?.slowMo.speed ?? 50
        for (const sm of slowMoCandidates) {
          sm.speed = targetSpeed as 25 | 50 | 75
        }

        result.slowMoPlan = slowMoCandidates

        for (const sm of slowMoCandidates) {
          await resolveBridge.setRetiming(sm.clipIndex, 'optical_flow', sm.speed / 100).catch(() => {})
        }
      } catch {}
    }

    // 4. Stabilisation (gated by preferences)
    if (editPreferences?.stabilisation.enabled !== false) {
      try {
        const stabMode = editPreferences?.stabilisation.mode ?? 'perspective'
        const applyTo = editPreferences?.stabilisation.applyTo ?? 'shaky-only'

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

    // 5. Color grading (gated by preferences)
    if (editPreferences?.grading.enabled !== false && editIntent) {
      try {
        await this.grading.gradeTimeline(editIntent)
      } catch {}
    }

    return result
  }
}

export const resolveOrchestrator = new ResolveOrchestrator()
