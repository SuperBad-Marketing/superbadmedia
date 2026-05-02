import fs from 'fs'
import path from 'path'
import Anthropic from '@anthropic-ai/sdk'
import { dataPath } from './dataRoot.js'

interface ClipSnapshot {
  clipId: string
  filePath: string
  startTime: number
  endTime: number
  position: number
  shotType?: string
  hasFaces?: boolean
  environment?: string
  movement?: string
}

interface TransitionSnapshot {
  afterPosition: number
  presetId: string
}

interface AssemblySnapshot {
  id: string
  projectId?: string
  clientId?: string
  timestamp: string
  clips: ClipSnapshot[]
  transitions: TransitionSnapshot[]
  sfxCount: number
  totalDuration: number
  brief: { duration: number; mood: string; pacing: string }
}

interface EditDiff {
  clipsRemoved: string[]
  clipsReordered: boolean
  inOutAdjustments: { clipId: string; field: 'startTime' | 'endTime'; original: number; final: number; delta: number; shotType?: string; hasFaces?: boolean }[]
  transitionsRemoved: number
  transitionsKept: number
  durationChange: number
  clipCountChange: number
}

interface TasteObservation {
  pattern: string
  confidence: number
  occurrences: number
  category: 'cut-length' | 'shot-preference' | 'transition' | 'pacing' | 'structure' | 'removal'
}

interface ClientStyleProfile {
  assembliesAnalyzed: number
  avgCutLength: number
  pacingPreference: string
  transitionUsageRate: number
  energyCurve: number[]
  notes: string[]
}

interface TasteData {
  totalEditsAnalyzed: number
  lastUpdated: string
  observations: TasteObservation[]
  clientStyles: Record<string, ClientStyleProfile>
  rawDiffs: EditDiff[]
  referenceStyles: Record<string, ReferenceStyle>
}

export interface ReferenceStyle {
  id: string
  name: string
  sourceAssemblyId: string
  createdAt: string
  avgCutLength: number
  cutLengthVariance: number
  rhythmPattern: string[]
  shotTypeRatios: Record<string, number>
  energyCurve: number[]
  transitionDensity: number
  totalDuration: number
}

const TASTE_DIR = dataPath('.taste')
const PROFILE_PATH = path.join(TASTE_DIR, 'profile.json')
const SNAPSHOTS_DIR = path.join(TASTE_DIR, 'snapshots')

export class TasteProfileService {
  private data: TasteData

  constructor() {
    fs.mkdirSync(TASTE_DIR, { recursive: true })
    fs.mkdirSync(SNAPSHOTS_DIR, { recursive: true })
    this.data = this.load()
  }

  private load(): TasteData {
    try {
      if (fs.existsSync(PROFILE_PATH)) {
        return JSON.parse(fs.readFileSync(PROFILE_PATH, 'utf-8'))
      }
    } catch {}
    return {
      totalEditsAnalyzed: 0,
      lastUpdated: new Date().toISOString(),
      observations: [],
      clientStyles: {},
      rawDiffs: [],
      referenceStyles: {},
    }
  }

  private save(): void {
    fs.writeFileSync(PROFILE_PATH, JSON.stringify(this.data, null, 2), 'utf-8')
  }

  saveOriginalAssembly(snapshot: AssemblySnapshot): void {
    const filePath = path.join(SNAPSHOTS_DIR, `${snapshot.id}.json`)
    fs.writeFileSync(filePath, JSON.stringify(snapshot, null, 2), 'utf-8')
  }

  getOriginalAssembly(assemblyId: string): AssemblySnapshot | null {
    const filePath = path.join(SNAPSHOTS_DIR, `${assemblyId}.json`)
    try {
      return JSON.parse(fs.readFileSync(filePath, 'utf-8'))
    } catch {
      return null
    }
  }

  captureFeedback(
    assemblyId: string,
    finalClips: ClipSnapshot[],
    finalTransitions: TransitionSnapshot[],
    finalDuration: number,
  ): EditDiff | null {
    const original = this.getOriginalAssembly(assemblyId)
    if (!original) return null

    const originalClipIds = new Set(original.clips.map(c => c.clipId))
    const finalClipIds = new Set(finalClips.map(c => c.clipId))

    const clipsRemoved = original.clips
      .filter(c => !finalClipIds.has(c.clipId))
      .map(c => c.clipId)

    const originalOrder = original.clips.map(c => c.clipId)
    const finalOrder = finalClips.map(c => c.clipId)
    const commonOrder = finalOrder.filter(id => originalClipIds.has(id))
    const originalCommonOrder = originalOrder.filter(id => finalClipIds.has(id))
    const clipsReordered = commonOrder.join(',') !== originalCommonOrder.join(',')

    const inOutAdjustments: EditDiff['inOutAdjustments'] = []
    for (const finalClip of finalClips) {
      const originalClip = original.clips.find(c => c.clipId === finalClip.clipId)
      if (!originalClip) continue

      const startDelta = finalClip.startTime - originalClip.startTime
      if (Math.abs(startDelta) > 0.05) {
        inOutAdjustments.push({
          clipId: finalClip.clipId,
          field: 'startTime',
          original: originalClip.startTime,
          final: finalClip.startTime,
          delta: startDelta,
          shotType: originalClip.shotType,
          hasFaces: originalClip.hasFaces,
        })
      }

      const endDelta = finalClip.endTime - originalClip.endTime
      if (Math.abs(endDelta) > 0.05) {
        inOutAdjustments.push({
          clipId: finalClip.clipId,
          field: 'endTime',
          original: originalClip.endTime,
          final: finalClip.endTime,
          delta: endDelta,
          shotType: originalClip.shotType,
          hasFaces: originalClip.hasFaces,
        })
      }
    }

    const diff: EditDiff = {
      clipsRemoved,
      clipsReordered,
      inOutAdjustments,
      transitionsRemoved: Math.max(0, original.transitions.length - finalTransitions.length),
      transitionsKept: finalTransitions.length,
      durationChange: finalDuration - original.totalDuration,
      clipCountChange: finalClips.length - original.clips.length,
    }

    const isIdentical = clipsRemoved.length === 0
      && !clipsReordered
      && inOutAdjustments.length === 0
      && diff.transitionsRemoved === 0
      && Math.abs(diff.durationChange) < 0.1

    if (isIdentical) return null

    this.data.rawDiffs.push(diff)
    if (this.data.rawDiffs.length > 100) {
      this.data.rawDiffs = this.data.rawDiffs.slice(-100)
    }

    this.data.totalEditsAnalyzed++
    this.data.lastUpdated = new Date().toISOString()

    this.computeObservations()

    if (original.clientId) {
      this.updateClientStyle(original.clientId, finalClips, finalTransitions, finalDuration)
    }

    this.save()
    return diff
  }

  private computeObservations(): void {
    const diffs = this.data.rawDiffs
    if (diffs.length < 3) return

    const observations: TasteObservation[] = []

    const allAdjustments = diffs.flatMap(d => d.inOutAdjustments)
    if (allAdjustments.length >= 3) {
      const endAdjustments = allAdjustments.filter(a => a.field === 'endTime')
      const startAdjustments = allAdjustments.filter(a => a.field === 'startTime')

      if (endAdjustments.length >= 3) {
        const avgDelta = endAdjustments.reduce((s, a) => s + a.delta, 0) / endAdjustments.length
        if (Math.abs(avgDelta) > 0.1) {
          observations.push({
            pattern: avgDelta > 0
              ? `Extends clips by ~${Math.abs(avgDelta).toFixed(1)}s on average (holds shots longer than suggested)`
              : `Trims clips by ~${Math.abs(avgDelta).toFixed(1)}s on average (prefers tighter cuts)`,
            confidence: Math.min(1, endAdjustments.length / 10),
            occurrences: endAdjustments.length,
            category: 'cut-length',
          })
        }
      }

      const faceAdjustments = allAdjustments.filter(a => a.hasFaces && a.field === 'endTime')
      if (faceAdjustments.length >= 2) {
        const avgFaceDelta = faceAdjustments.reduce((s, a) => s + a.delta, 0) / faceAdjustments.length
        if (Math.abs(avgFaceDelta) > 0.15) {
          observations.push({
            pattern: avgFaceDelta > 0
              ? `Extends face/people shots by ~${Math.abs(avgFaceDelta).toFixed(1)}s (wants more time to read emotion)`
              : `Trims face/people shots by ~${Math.abs(avgFaceDelta).toFixed(1)}s (prefers quicker cuts on people)`,
            confidence: Math.min(1, faceAdjustments.length / 8),
            occurrences: faceAdjustments.length,
            category: 'shot-preference',
          })
        }
      }

      if (startAdjustments.length >= 3) {
        const avgStartDelta = startAdjustments.reduce((s, a) => s + a.delta, 0) / startAdjustments.length
        if (Math.abs(avgStartDelta) > 0.1) {
          observations.push({
            pattern: avgStartDelta > 0
              ? `Pushes clip starts later by ~${Math.abs(avgStartDelta).toFixed(1)}s (skips the lead-in)`
              : `Pulls clip starts earlier by ~${Math.abs(avgStartDelta).toFixed(1)}s (wants more lead-in)`,
            confidence: Math.min(1, startAdjustments.length / 10),
            occurrences: startAdjustments.length,
            category: 'cut-length',
          })
        }
      }

      const byShotType = new Map<string, number[]>()
      for (const a of allAdjustments.filter(a => a.shotType && a.field === 'endTime')) {
        const existing = byShotType.get(a.shotType!) || []
        existing.push(a.delta)
        byShotType.set(a.shotType!, existing)
      }
      for (const [shotType, deltas] of byShotType) {
        if (deltas.length < 2) continue
        const avg = deltas.reduce((s, d) => s + d, 0) / deltas.length
        if (Math.abs(avg) > 0.2) {
          observations.push({
            pattern: avg > 0
              ? `Holds ${shotType} shots ~${Math.abs(avg).toFixed(1)}s longer than suggested`
              : `Cuts ${shotType} shots ~${Math.abs(avg).toFixed(1)}s shorter than suggested`,
            confidence: Math.min(1, deltas.length / 6),
            occurrences: deltas.length,
            category: 'shot-preference',
          })
        }
      }
    }

    const totalTransitionsOffered = diffs.reduce((s, d) => s + d.transitionsKept + d.transitionsRemoved, 0)
    const totalTransitionsKept = diffs.reduce((s, d) => s + d.transitionsKept, 0)
    if (totalTransitionsOffered >= 5) {
      const keepRate = totalTransitionsKept / totalTransitionsOffered
      if (keepRate < 0.3) {
        observations.push({
          pattern: `Removes transitions ${Math.round((1 - keepRate) * 100)}% of the time (prefers hard cuts)`,
          confidence: Math.min(1, totalTransitionsOffered / 15),
          occurrences: totalTransitionsOffered,
          category: 'transition',
        })
      } else if (keepRate > 0.8) {
        observations.push({
          pattern: `Keeps transitions ${Math.round(keepRate * 100)}% of the time (likes transition variety)`,
          confidence: Math.min(1, totalTransitionsOffered / 15),
          occurrences: totalTransitionsOffered,
          category: 'transition',
        })
      }
    }

    const totalRemoved = diffs.reduce((s, d) => s + d.clipsRemoved.length, 0)
    const totalOriginalClips = diffs.reduce((s, d) => s + d.clipsRemoved.length + Math.abs(d.clipCountChange) + d.clipsRemoved.length, 0)
    if (totalRemoved >= 5 && totalOriginalClips > 0) {
      observations.push({
        pattern: `Removes ~${Math.round(totalRemoved / diffs.length)} clips per edit (prefers leaner timelines)`,
        confidence: Math.min(1, totalRemoved / 20),
        occurrences: totalRemoved,
        category: 'structure',
      })
    }

    const reorderedCount = diffs.filter(d => d.clipsReordered).length
    if (reorderedCount >= 3) {
      observations.push({
        pattern: `Reorders clips in ${Math.round(reorderedCount / diffs.length * 100)}% of edits (the AI's clip order often isn't right)`,
        confidence: Math.min(1, reorderedCount / 8),
        occurrences: reorderedCount,
        category: 'structure',
      })
    }

    const durationChanges = diffs.map(d => d.durationChange).filter(d => Math.abs(d) > 0.5)
    if (durationChanges.length >= 3) {
      const avgChange = durationChanges.reduce((s, d) => s + d, 0) / durationChanges.length
      if (Math.abs(avgChange) > 0.5) {
        observations.push({
          pattern: avgChange > 0
            ? `Edits end up ~${Math.abs(avgChange).toFixed(1)}s longer than the assembly suggests`
            : `Edits end up ~${Math.abs(avgChange).toFixed(1)}s shorter than the assembly suggests`,
          confidence: Math.min(1, durationChanges.length / 8),
          occurrences: durationChanges.length,
          category: 'pacing',
        })
      }
    }

    this.data.observations = observations
  }

  private updateClientStyle(
    clientId: string,
    clips: ClipSnapshot[],
    transitions: TransitionSnapshot[],
    duration: number,
  ): void {
    const existing = this.data.clientStyles[clientId] || {
      assembliesAnalyzed: 0,
      avgCutLength: 0,
      pacingPreference: 'medium',
      transitionUsageRate: 0,
      energyCurve: [],
      notes: [],
    }

    const cutLengths = clips.map(c => c.endTime - c.startTime)
    const avgCut = cutLengths.reduce((s, l) => s + l, 0) / (cutLengths.length || 1)

    const n = existing.assembliesAnalyzed
    existing.avgCutLength = (existing.avgCutLength * n + avgCut) / (n + 1)
    existing.transitionUsageRate = (existing.transitionUsageRate * n + (transitions.length / (clips.length || 1))) / (n + 1)

    if (existing.avgCutLength < 1.2) existing.pacingPreference = 'fast'
    else if (existing.avgCutLength > 2.5) existing.pacingPreference = 'slow'
    else existing.pacingPreference = 'medium'

    const segments = 10
    const segmentDuration = duration / segments
    const curve = new Array(segments).fill(0)
    let t = 0
    for (const clip of clips) {
      const clipDur = clip.endTime - clip.startTime
      const segIdx = Math.min(segments - 1, Math.floor(t / segmentDuration))
      curve[segIdx] += 1 / clipDur
      t += clipDur
    }
    const maxDensity = Math.max(...curve, 1)
    existing.energyCurve = curve.map(v => Math.round((v / maxDensity) * 100) / 100)

    existing.assembliesAnalyzed = n + 1
    this.data.clientStyles[clientId] = existing
  }

  extractReferenceStyle(
    name: string,
    clips: ClipSnapshot[],
    transitions: TransitionSnapshot[],
    totalDuration: number,
  ): ReferenceStyle {
    const cutLengths = clips.map(c => c.endTime - c.startTime)
    const avgCutLength = cutLengths.reduce((s, l) => s + l, 0) / (cutLengths.length || 1)
    const variance = cutLengths.reduce((s, l) => s + Math.pow(l - avgCutLength, 2), 0) / (cutLengths.length || 1)

    const shotTypeCounts = new Map<string, number>()
    for (const clip of clips) {
      const st = clip.shotType || 'unknown'
      shotTypeCounts.set(st, (shotTypeCounts.get(st) || 0) + 1)
    }
    const shotTypeRatios: Record<string, number> = {}
    for (const [type, count] of shotTypeCounts) {
      shotTypeRatios[type] = Math.round((count / clips.length) * 100) / 100
    }

    const rhythmPattern: string[] = []
    for (let i = 0; i < cutLengths.length; i++) {
      const len = cutLengths[i]
      if (len < 0.5) rhythmPattern.push('flash')
      else if (len < 1.0) rhythmPattern.push('quick')
      else if (len < 2.0) rhythmPattern.push('normal')
      else if (len < 3.5) rhythmPattern.push('held')
      else rhythmPattern.push('lingering')
    }

    const segments = 10
    const segDur = totalDuration / segments
    const curve = new Array(segments).fill(0)
    let t = 0
    for (const clip of clips) {
      const clipDur = clip.endTime - clip.startTime
      const segIdx = Math.min(segments - 1, Math.floor(t / segDur))
      curve[segIdx] += 1 / clipDur
      t += clipDur
    }
    const maxD = Math.max(...curve, 1)
    const energyCurve = curve.map(v => Math.round((v / maxD) * 100) / 100)

    const ref: ReferenceStyle = {
      id: crypto.randomUUID(),
      name,
      sourceAssemblyId: '',
      createdAt: new Date().toISOString(),
      avgCutLength: Math.round(avgCutLength * 100) / 100,
      cutLengthVariance: Math.round(variance * 100) / 100,
      rhythmPattern: this.compressRhythmPattern(rhythmPattern),
      shotTypeRatios,
      energyCurve,
      transitionDensity: Math.round((transitions.length / (clips.length || 1)) * 100) / 100,
      totalDuration,
    }

    this.data.referenceStyles[ref.id] = ref
    this.save()
    return ref
  }

  private compressRhythmPattern(raw: string[]): string[] {
    if (raw.length <= 20) return raw
    const compressed: string[] = []
    const chunkSize = Math.ceil(raw.length / 20)
    for (let i = 0; i < raw.length; i += chunkSize) {
      const chunk = raw.slice(i, i + chunkSize)
      const counts = new Map<string, number>()
      for (const r of chunk) counts.set(r, (counts.get(r) || 0) + 1)
      const dominant = [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0]
      compressed.push(dominant)
    }
    return compressed
  }

  getTasteContext(): string {
    if (this.data.observations.length === 0 && this.data.totalEditsAnalyzed < 3) return ''

    const confident = this.data.observations
      .filter(o => o.confidence >= 0.3)
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 8)

    if (confident.length === 0) return ''

    return `## EDITOR TASTE PROFILE (learned from ${this.data.totalEditsAnalyzed} edited assemblies)

${confident.map(o => `- ${o.pattern} (observed ${o.occurrences} times, confidence: ${Math.round(o.confidence * 100)}%)`).join('\n')}

Apply these patterns as defaults. The editor consistently makes these adjustments, so anticipate them.`
  }

  getClientStyleContext(clientId: string): string {
    const style = this.data.clientStyles[clientId]
    if (!style || style.assembliesAnalyzed < 2) return ''

    return `## CLIENT EDITING STYLE (from ${style.assembliesAnalyzed} previous edits)

- Average cut length: ${style.avgCutLength.toFixed(1)}s
- Pacing tendency: ${style.pacingPreference}
- Transition usage: ${Math.round(style.transitionUsageRate * 100)}% of cuts use transitions
- Energy curve: ${style.energyCurve.map((v, i) => `${Math.round(i / style.energyCurve.length * 100)}%: ${Math.round(v * 100)}%`).join(', ')}

Match this client's established style.`
  }

  getReferenceStyleContext(referenceId: string): string {
    const ref = this.data.referenceStyles[referenceId]
    if (!ref) return ''

    return `## REFERENCE STYLE: "${ref.name}"

Match the structural DNA of this reference edit:
- Average cut length: ${ref.avgCutLength}s (variance: ${ref.cutLengthVariance.toFixed(2)})
- Rhythm pattern: ${ref.rhythmPattern.join(' → ')}
- Shot type mix: ${Object.entries(ref.shotTypeRatios).map(([t, r]) => `${t}: ${Math.round(r * 100)}%`).join(', ')}
- Transition density: ${Math.round(ref.transitionDensity * 100)}% of cuts
- Energy curve: ${ref.energyCurve.map((v, i) => `${Math.round(i / ref.energyCurve.length * 100)}%: ${Math.round(v * 100)}%`).join(', ')}

This reference defines the target feel. Match its rhythm, pacing, and energy arc.`
  }

  getProfile(): TasteData {
    return { ...this.data }
  }

  getReferenceStyles(): ReferenceStyle[] {
    return Object.values(this.data.referenceStyles)
  }

  deleteReferenceStyle(id: string): boolean {
    if (!this.data.referenceStyles[id]) return false
    delete this.data.referenceStyles[id]
    this.save()
    return true
  }

  resetProfile(): void {
    this.data = {
      totalEditsAnalyzed: 0,
      lastUpdated: new Date().toISOString(),
      observations: [],
      clientStyles: {},
      rawDiffs: [],
      referenceStyles: {},
    }
    this.save()
  }
}

let instance: TasteProfileService | null = null

export function getTasteProfileService(): TasteProfileService {
  if (!instance) {
    instance = new TasteProfileService()
  }
  return instance
}
