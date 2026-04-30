import { execSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import Anthropic from '@anthropic-ai/sdk'

export interface MusicSection {
  type: 'intro' | 'build' | 'drop' | 'verse' | 'chorus' | 'breakdown' | 'outro' | 'transition'
  startTime: number
  endTime: number
  energy: 'low' | 'medium' | 'high' | 'peak'
}

export interface MusicStructure {
  bpm: number
  beatInterval: number
  beats: number[]
  sections: MusicSection[]
  energyCurve: { time: number; energy: number }[]
  totalDuration: number
}

const TEMP_DIR = path.join(process.cwd(), '.music-analysis')

export class MusicAnalysisService {
  constructor() {
    fs.mkdirSync(TEMP_DIR, { recursive: true })
  }

  async analyzeTrack(
    previewUrl: string | null,
    bpm: number,
    trackDuration: number,
  ): Promise<MusicStructure> {
    if (!previewUrl) {
      return this.buildFromBpmOnly(bpm, trackDuration)
    }
    const audioPath = await this.downloadPreview(previewUrl)
    if (!audioPath) {
      return this.buildFromBpmOnly(bpm, trackDuration)
    }

    try {
      const energyCurve = this.extractEnergyCurve(audioPath)
      const actualDuration = this.getAudioDuration(audioPath) || trackDuration

      const beatInterval = 60 / bpm
      const beats: number[] = []
      for (let t = 0; t < actualDuration; t += beatInterval) {
        beats.push(Math.round(t * 1000) / 1000)
      }

      const sections = await this.identifySections(energyCurve, bpm, actualDuration)

      return {
        bpm,
        beatInterval,
        beats,
        sections,
        energyCurve,
        totalDuration: actualDuration,
      }
    } finally {
      try { fs.unlinkSync(audioPath) } catch {}
    }
  }

  private async downloadPreview(url: string): Promise<string | null> {
    try {
      const response = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        signal: AbortSignal.timeout(15000),
      })
      if (!response.ok) return null

      const buffer = Buffer.from(await response.arrayBuffer())
      const filePath = path.join(TEMP_DIR, `preview-${Date.now()}.mp3`)
      fs.writeFileSync(filePath, buffer)
      return filePath
    } catch {
      return null
    }
  }

  private getAudioDuration(audioPath: string): number | null {
    try {
      const output = execSync(
        `ffprobe -v quiet -print_format json -show_format "${audioPath}"`,
        { encoding: 'utf-8', timeout: 10000 },
      )
      const data = JSON.parse(output)
      return parseFloat(data.format?.duration || '0')
    } catch {
      return null
    }
  }

  private extractEnergyCurve(audioPath: string): { time: number; energy: number }[] {
    try {
      const windowSize = 0.5
      const output = execSync(
        `ffmpeg -i "${audioPath}" -af "aresample=16000,astats=metadata=1:reset=${windowSize}" -f null - 2>&1`,
        { encoding: 'utf-8', timeout: 30000, maxBuffer: 10 * 1024 * 1024 },
      )

      const rmsValues: number[] = []
      const rmsRegex = /lavfi\.astats\.\d+\.RMS_level=(-?\d+\.?\d*)/g
      let match: RegExpExecArray | null
      while ((match = rmsRegex.exec(output)) !== null) {
        rmsValues.push(parseFloat(match[1]))
      }

      if (rmsValues.length < 4) {
        return this.extractEnergyCurveFallback(audioPath)
      }

      const validRms = rmsValues.filter(v => v > -100 && isFinite(v))
      if (validRms.length === 0) return this.extractEnergyCurveFallback(audioPath)

      const minRms = Math.min(...validRms)
      const maxRms = Math.max(...validRms)
      const range = maxRms - minRms || 1

      const curve: { time: number; energy: number }[] = []
      for (let i = 0; i < validRms.length; i++) {
        curve.push({
          time: Math.round(i * windowSize * 100) / 100,
          energy: Math.round(((validRms[i] - minRms) / range) * 100),
        })
      }

      return curve
    } catch {
      return this.extractEnergyCurveFallback(audioPath)
    }
  }

  private extractEnergyCurveFallback(audioPath: string): { time: number; energy: number }[] {
    try {
      const output = execSync(
        `ffmpeg -i "${audioPath}" -af "volumedetect" -f null - 2>&1`,
        { encoding: 'utf-8', timeout: 15000 },
      )

      const meanMatch = output.match(/mean_volume:\s*(-?\d+\.?\d*)\s*dB/)
      const maxMatch = output.match(/max_volume:\s*(-?\d+\.?\d*)\s*dB/)

      const mean = meanMatch ? parseFloat(meanMatch[1]) : -20
      const max = maxMatch ? parseFloat(maxMatch[1]) : -3

      const duration = this.getAudioDuration(audioPath) || 30
      const curve: { time: number; energy: number }[] = []
      const midEnergy = Math.round(((mean + 60) / 60) * 100)

      for (let t = 0; t < duration; t += 0.5) {
        curve.push({ time: t, energy: Math.max(0, Math.min(100, midEnergy)) })
      }

      return curve
    } catch {
      return []
    }
  }

  private async identifySections(
    energyCurve: { time: number; energy: number }[],
    bpm: number,
    duration: number,
  ): Promise<MusicSection[]> {
    if (energyCurve.length < 4) {
      return this.heuristicSections(duration, bpm)
    }

    const windowSize = Math.max(4, Math.floor(energyCurve.length / 12))
    const smoothed: number[] = []
    for (let i = 0; i < energyCurve.length; i++) {
      const start = Math.max(0, i - Math.floor(windowSize / 2))
      const end = Math.min(energyCurve.length, i + Math.ceil(windowSize / 2))
      const slice = energyCurve.slice(start, end)
      smoothed.push(slice.reduce((sum, p) => sum + p.energy, 0) / slice.length)
    }

    const sections: MusicSection[] = []
    const avgEnergy = smoothed.reduce((a, b) => a + b, 0) / smoothed.length
    const highThreshold = avgEnergy + (100 - avgEnergy) * 0.4
    const lowThreshold = avgEnergy * 0.6

    let currentType: MusicSection['type'] = 'intro'
    let currentEnergy: MusicSection['energy'] = 'low'
    let sectionStart = 0

    for (let i = 1; i < smoothed.length; i++) {
      const energy = smoothed[i]
      const prevEnergy = smoothed[i - 1]
      const time = energyCurve[i].time

      let newType: MusicSection['type'] | null = null
      let newEnergy: MusicSection['energy'] | null = null

      const risingFast = energy - prevEnergy > 15
      const droppingFast = prevEnergy - energy > 15

      if (risingFast && energy > highThreshold) {
        newType = 'drop'
        newEnergy = 'peak'
      } else if (droppingFast && energy < lowThreshold) {
        newType = 'breakdown'
        newEnergy = 'low'
      } else if (energy > highThreshold && currentType !== 'drop' && currentType !== 'chorus') {
        newType = 'chorus'
        newEnergy = 'high'
      } else if (energy > avgEnergy && energy <= highThreshold && (currentType === 'intro' || currentType === 'breakdown')) {
        newType = 'build'
        newEnergy = 'medium'
      }

      if (i === smoothed.length - 1 && time > duration - 4) {
        newType = 'outro'
        newEnergy = energy < avgEnergy ? 'low' : 'medium'
      }

      if (newType && newType !== currentType && time - sectionStart > 1.5) {
        sections.push({
          type: currentType,
          startTime: Math.round(sectionStart * 100) / 100,
          endTime: Math.round(time * 100) / 100,
          energy: currentEnergy,
        })
        sectionStart = time
        currentType = newType
        currentEnergy = newEnergy!
      }
    }

    sections.push({
      type: currentType,
      startTime: Math.round(sectionStart * 100) / 100,
      endTime: Math.round(duration * 100) / 100,
      energy: currentEnergy,
    })

    return sections
  }

  private heuristicSections(duration: number, bpm: number): MusicSection[] {
    const barDuration = (60 / bpm) * 4
    if (duration < 10) {
      return [{ type: 'chorus', startTime: 0, endTime: duration, energy: 'high' }]
    }

    const sections: MusicSection[] = []
    const introEnd = Math.min(barDuration * 2, duration * 0.15)
    const outroStart = Math.max(duration - barDuration * 2, duration * 0.85)
    const midpoint = duration / 2

    sections.push({ type: 'intro', startTime: 0, endTime: introEnd, energy: 'low' })
    sections.push({ type: 'build', startTime: introEnd, endTime: introEnd + barDuration * 2, energy: 'medium' })
    sections.push({ type: 'drop', startTime: introEnd + barDuration * 2, endTime: midpoint, energy: 'peak' })
    sections.push({ type: 'breakdown', startTime: midpoint, endTime: midpoint + barDuration * 2, energy: 'low' })
    sections.push({ type: 'chorus', startTime: midpoint + barDuration * 2, endTime: outroStart, energy: 'high' })
    sections.push({ type: 'outro', startTime: outroStart, endTime: duration, energy: 'low' })

    return sections
  }

  private buildFromBpmOnly(bpm: number, duration: number): MusicStructure {
    const beatInterval = 60 / bpm
    const beats: number[] = []
    for (let t = 0; t < duration; t += beatInterval) {
      beats.push(Math.round(t * 1000) / 1000)
    }

    return {
      bpm,
      beatInterval,
      beats,
      sections: this.heuristicSections(duration, bpm),
      energyCurve: [],
      totalDuration: duration,
    }
  }
}
