import { resolveBridge } from './resolveBridge.js'
import { getEditIntentService, type EditIntent } from './editIntent.js'
import { getClipAnalysisService } from './clipAnalysis.js'

interface MixDecision {
  clipIndex: number
  fileName: string
  volumeDb: number
  muted: boolean
  noiseReduction: 'aggressive' | 'light' | 'none'
  reason: string
}

interface MusicMixDecision {
  trackVolume: number
  reason: string
}

interface MixResult {
  clipsProcessed: number
  musicLevel: number | null
  decisions: MixDecision[]
  musicDecision: MusicMixDecision | null
}

const MUSIC_LEVELS: Record<string, number> = {
  front: -8,
  cinematic: -14,
  background: -22,
}

const CLIP_LEVELS: Record<string, number> = {
  polished: -12,
  immersive: -14,
  'music-forward': -24,
}

export class AudioMixingService {
  private clipAnalysis = getClipAnalysisService()

  async mixTimeline(intent: EditIntent): Promise<MixResult> {
    const timelineClips = await resolveBridge.getTimelineClips()
    if (timelineClips.error || !timelineClips.clips?.length) {
      return { clipsProcessed: 0, musicLevel: null, decisions: [], musicDecision: null }
    }

    const analysedClips = this.clipAnalysis.getAllAnalysed()
    const decisions: MixDecision[] = []

    const baseVolume = CLIP_LEVELS[intent.audio.feel || 'polished'] ?? -12
    const noiseMode = this.resolveNoiseMode(intent)

    for (let i = 0; i < timelineClips.clips.length; i++) {
      const timelineClip = timelineClips.clips[i]
      const analysed = analysedClips.find((c: any) =>
        c.fileName === timelineClip.name ||
        c.filePath?.endsWith(timelineClip.name)
      )

      const audioQuality = analysed?.analysis?.audioQuality || 'fair'
      const hasDialogue = analysed?.analysis?.activityType?.includes('conversation') ||
        analysed?.analysis?.activityType?.includes('presenting') || false

      const decision = this.buildMixDecision(
        i, timelineClip.name, baseVolume, noiseMode,
        audioQuality, hasDialogue, intent,
      )
      decisions.push(decision)
    }

    for (const d of decisions) {
      await this.applyMixDecision(d)
    }

    let musicDecision: MusicMixDecision | null = null
    if (intent.audio.musicLevel) {
      const musicDb = MUSIC_LEVELS[intent.audio.musicLevel] ?? -14
      musicDecision = {
        trackVolume: musicDb,
        reason: `Music level set to ${intent.audio.musicLevel} (${musicDb}dB)`,
      }
    }

    return {
      clipsProcessed: decisions.length,
      musicLevel: musicDecision?.trackVolume ?? null,
      decisions,
      musicDecision,
    }
  }

  private buildMixDecision(
    clipIndex: number,
    fileName: string,
    baseVolume: number,
    noiseMode: 'aggressive' | 'light' | 'none',
    audioQuality: string,
    hasDialogue: boolean,
    intent: EditIntent,
  ): MixDecision {
    let volumeDb = baseVolume

    if (hasDialogue) {
      volumeDb = Math.max(volumeDb, -10)
    }

    if (intent.audio.feel === 'music-forward' && !hasDialogue) {
      return {
        clipIndex,
        fileName,
        volumeDb: -40,
        muted: true,
        noiseReduction: 'none',
        reason: 'Music-forward: non-dialogue clip muted',
      }
    }

    if (audioQuality === 'poor') {
      volumeDb -= 6
    }

    let noiseReduction = noiseMode
    if (audioQuality === 'good') {
      noiseReduction = 'none'
    }
    if (hasDialogue && noiseMode === 'aggressive') {
      noiseReduction = 'light'
    }

    const reason = this.buildReason(intent, hasDialogue, audioQuality, noiseReduction)

    return {
      clipIndex,
      fileName,
      volumeDb,
      muted: false,
      noiseReduction,
      reason,
    }
  }

  private resolveNoiseMode(intent: EditIntent): 'aggressive' | 'light' | 'none' {
    switch (intent.audio.backgroundNoise) {
      case 'clean': return 'aggressive'
      case 'subtle': return 'light'
      case 'keep': return 'none'
      default: return 'light'
    }
  }

  private buildReason(
    intent: EditIntent,
    hasDialogue: boolean,
    audioQuality: string,
    noiseReduction: string,
  ): string {
    const parts: string[] = []
    parts.push(`Feel: ${intent.audio.feel || 'polished'}`)
    if (hasDialogue) parts.push('has dialogue — boosted')
    if (audioQuality === 'poor') parts.push('poor audio quality — reduced')
    if (noiseReduction !== 'none') parts.push(`noise reduction: ${noiseReduction}`)
    return parts.join(', ')
  }

  private async applyMixDecision(decision: MixDecision): Promise<void> {
    if (decision.muted) {
      await resolveBridge.muteClipAudio(decision.clipIndex, true)
      return
    }

    await resolveBridge.setClipVolume(decision.clipIndex, decision.volumeDb)

    if (decision.noiseReduction !== 'none') {
      const timelineClips = await resolveBridge.getTimelineClips()
      const clip = timelineClips.clips?.[decision.clipIndex]
      if (!clip) return

      const analysedClips = this.clipAnalysis.getAllAnalysed()
      const analysed = analysedClips.find((c: any) =>
        c.fileName === clip.name || c.filePath?.endsWith(clip.name)
      )
      if (!analysed?.filePath) return

      const filters = decision.noiseReduction === 'aggressive'
        ? [
            { type: 'highpass' as const, frequency: 80 },
            { type: 'lowpass' as const, frequency: 12000 },
          ]
        : [
            { type: 'highpass' as const, frequency: 60 },
          ]

      const startTime = 0
      const endTime = analysed.duration || clip.duration / 24

      const result = await resolveBridge.preprocessAudio(
        analysed.filePath, startTime, endTime, filters,
      )

      if (result.success && result.processed_path) {
        await resolveBridge.replaceClipAudio(decision.clipIndex, result.processed_path)
      }
    }
  }
}

let instance: AudioMixingService | null = null

export function getAudioMixingService(): AudioMixingService {
  if (!instance) {
    instance = new AudioMixingService()
  }
  return instance
}
