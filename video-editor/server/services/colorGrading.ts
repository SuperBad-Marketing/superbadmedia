import { resolveBridge } from './resolveBridge.js'
import { getEditIntentService, type EditIntent } from './editIntent.js'
import { getClipAnalysisService } from './clipAnalysis.js'
import Anthropic from '@anthropic-ai/sdk'
import { execSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import { dataPath } from './dataRoot.js'

interface CameraProfile {
  camera: string
  isLog: boolean
  colorSpace?: string
}

interface GradeDecision {
  clipIndex: number
  fileName: string
  nodes: GradeNode[]
}

interface GradeNode {
  purpose: 'cst' | 'correction' | 'look'
  params: Record<string, any>
}

const CST_MAP: Record<string, { inputColorSpace: string; inputGamma: string }> = {
  'bmpcc-film-gen5': { inputColorSpace: 'Blackmagic Design Film Gen 5', inputGamma: 'Blackmagic Design Film Gen 5' },
  'bmpcc-film-gen4': { inputColorSpace: 'Blackmagic Design Film Gen 4', inputGamma: 'Blackmagic Design Film Gen 4' },
  'bmpcc-film': { inputColorSpace: 'Blackmagic Design Film', inputGamma: 'Blackmagic Design Film' },
  'sony-slog3': { inputColorSpace: 'S-Gamut3.Cine', inputGamma: 'S-Log3' },
  'sony-slog2': { inputColorSpace: 'S-Gamut', inputGamma: 'S-Log2' },
  'canon-clog3': { inputColorSpace: 'Cinema Gamut', inputGamma: 'Canon Log 3' },
  'canon-clog2': { inputColorSpace: 'Cinema Gamut', inputGamma: 'Canon Log 2' },
  'panasonic-vlog': { inputColorSpace: 'V-Gamut', inputGamma: 'V-Log' },
  'arri-logc3': { inputColorSpace: 'ARRI Wide Gamut 3', inputGamma: 'ARRI LogC3' },
  'arri-logc4': { inputColorSpace: 'ARRI Wide Gamut 4', inputGamma: 'ARRI LogC4' },
  'red-log3g10': { inputColorSpace: 'REDWideGamutRGB', inputGamma: 'Log3G10' },
  'fuji-flog': { inputColorSpace: 'FUJIFILM F-Gamut', inputGamma: 'F-Log' },
  'dji-dlog': { inputColorSpace: 'DJI D-Gamut', inputGamma: 'DJI D-Log' },
}

const LOOK_PRESETS: Record<string, { contrast: number; saturation: number; temperature: number; tint: number; lift: { r: number; g: number; b: number }; gamma: { r: number; g: number; b: number }; gain: { r: number; g: number; b: number } }> = {
  natural: {
    contrast: 1.0, saturation: 1.0, temperature: 0, tint: 0,
    lift: { r: 0, g: 0, b: 0 },
    gamma: { r: 0, g: 0, b: 0 },
    gain: { r: 1, g: 1, b: 1 },
  },
  warm: {
    contrast: 1.05, saturation: 1.1, temperature: 200, tint: 5,
    lift: { r: 0.01, g: 0, b: -0.01 },
    gamma: { r: 0.02, g: 0.01, b: -0.01 },
    gain: { r: 1.05, g: 1.0, b: 0.95 },
  },
  cool: {
    contrast: 1.05, saturation: 0.85, temperature: -150, tint: -5,
    lift: { r: -0.01, g: 0, b: 0.02 },
    gamma: { r: -0.01, g: 0, b: 0.01 },
    gain: { r: 0.95, g: 1.0, b: 1.05 },
  },
  punchy: {
    contrast: 1.2, saturation: 1.25, temperature: 50, tint: 0,
    lift: { r: -0.02, g: -0.02, b: -0.02 },
    gamma: { r: 0.01, g: 0.01, b: 0 },
    gain: { r: 1.05, g: 1.02, b: 1.0 },
  },
}

const FRAME_DIR = dataPath('.grading-frames')

export class ColorGradingService {
  private clipAnalysis = getClipAnalysisService()

  async gradeTimeline(intent: EditIntent): Promise<{ graded: number; decisions: GradeDecision[] }> {
    const timelineClips = await resolveBridge.getTimelineClips()
    if (timelineClips.error || !timelineClips.clips?.length) {
      return { graded: 0, decisions: [] }
    }

    const analysedClips = this.clipAnalysis.getAllAnalysed()
    const decisions: GradeDecision[] = []

    for (let i = 0; i < timelineClips.clips.length; i++) {
      const timelineClip = timelineClips.clips[i]
      const analysed = analysedClips.find((c: any) =>
        c.fileName === timelineClip.name ||
        c.filePath?.endsWith(timelineClip.name)
      )

      const camera = analysed?.camera || analysed?.analysis?.camera || ''
      const isLog = analysed?.isLog ?? false
      const profile: CameraProfile = { camera, isLog }

      const decision = this.buildGradeDecision(i, timelineClip.name, profile, intent)
      decisions.push(decision)
    }

    for (const decision of decisions) {
      await this.applyGrade(decision)
    }

    return { graded: decisions.length, decisions }
  }

  private buildGradeDecision(
    clipIndex: number,
    fileName: string,
    profile: CameraProfile,
    intent: EditIntent,
  ): GradeDecision {
    const nodes: GradeNode[] = []

    if (profile.isLog) {
      const cstKey = this.detectCstKey(profile.camera)
      if (cstKey && CST_MAP[cstKey]) {
        nodes.push({
          purpose: 'cst',
          params: {
            inputColorSpace: CST_MAP[cstKey].inputColorSpace,
            inputGamma: CST_MAP[cstKey].inputGamma,
            outputColorSpace: 'Rec.709',
            outputGamma: 'Gamma 2.4',
          },
        })
      }
    }

    nodes.push({
      purpose: 'correction',
      params: {
        contrast: 1.0,
        saturation: 1.0,
      },
    })

    const lookName = intent.grading?.look || 'natural'
    const preset = LOOK_PRESETS[lookName] || LOOK_PRESETS.natural
    nodes.push({
      purpose: 'look',
      params: {
        contrast: preset.contrast,
        saturation: preset.saturation,
        temperature: preset.temperature,
        tint: preset.tint,
        lift: preset.lift,
        gamma: preset.gamma,
        gain: preset.gain,
      },
    })

    return { clipIndex, fileName, nodes }
  }

  private detectCstKey(camera: string): string | null {
    const lower = camera.toLowerCase()
    if (lower.includes('blackmagic') || lower.includes('bmpcc') || lower.includes('braw')) {
      if (lower.includes('gen5') || lower.includes('gen 5')) return 'bmpcc-film-gen5'
      if (lower.includes('gen4') || lower.includes('gen 4')) return 'bmpcc-film-gen4'
      return 'bmpcc-film'
    }
    if (lower.includes('sony') || lower.includes('a7') || lower.includes('fx')) {
      if (lower.includes('slog3') || lower.includes('s-log3')) return 'sony-slog3'
      return 'sony-slog2'
    }
    if (lower.includes('canon') || lower.includes('eos')) {
      if (lower.includes('clog3') || lower.includes('c-log3')) return 'canon-clog3'
      return 'canon-clog2'
    }
    if (lower.includes('panasonic') || lower.includes('lumix') || lower.includes('gh')) return 'panasonic-vlog'
    if (lower.includes('arri') || lower.includes('alexa')) {
      if (lower.includes('logc4')) return 'arri-logc4'
      return 'arri-logc3'
    }
    if (lower.includes('red') || lower.includes('dsmc')) return 'red-log3g10'
    if (lower.includes('fuji') || lower.includes('fujifilm')) return 'fuji-flog'
    if (lower.includes('dji') || lower.includes('mavic') || lower.includes('inspire')) return 'dji-dlog'
    return null
  }

  private async applyGrade(decision: GradeDecision): Promise<void> {
    for (let i = 0; i < decision.nodes.length; i++) {
      const node = decision.nodes[i]

      if (i > 0) {
        await resolveBridge.addColorNode(decision.clipIndex, 'serial')
      }

      const nodeIndex = i + 1

      if (node.purpose === 'cst') {
        await resolveBridge.send({
          action: 'apply_cst',
          params: {
            clip_index: decision.clipIndex,
            node_index: nodeIndex,
            input_color_space: node.params.inputColorSpace,
            input_gamma: node.params.inputGamma,
            output_color_space: node.params.outputColorSpace,
            output_gamma: node.params.outputGamma,
          },
        })
      } else {
        const { lift, gamma, gain, ...simpleParams } = node.params
        if (lift || gamma || gain) {
          await resolveBridge.setNodeParams(decision.clipIndex, nodeIndex, { lift, gamma, gain })
        }
        if (Object.keys(simpleParams).length > 0) {
          await resolveBridge.setNodeParams(decision.clipIndex, nodeIndex, simpleParams)
        }
      }
    }
  }

  async analyzeAndRefineGrade(
    intent: EditIntent,
    clipIndex: number,
    filePath: string,
  ): Promise<{ adjustments: Record<string, any> } | null> {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) return null

    fs.mkdirSync(FRAME_DIR, { recursive: true })
    const framePath = path.join(FRAME_DIR, `grade_${clipIndex}.jpg`)

    try {
      execSync(
        `ffmpeg -y -ss 1 -i "${filePath}" -frames:v 1 -q:v 2 "${framePath}" 2>/dev/null`,
        { timeout: 5000 },
      )
    } catch {
      return null
    }

    if (!fs.existsSync(framePath)) return null

    const frameData = fs.readFileSync(framePath)
    const client = new Anthropic({ apiKey })

    try {
      const lookDescription = intent.grading?.look || 'natural'
      const response = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        system: `You are a colourist analyzing a video frame. The editor wants a "${lookDescription}" look. Suggest specific corrections.

Respond with ONLY a JSON object:
{
  "issues": ["overexposed highlights", "cool skin tones"],
  "adjustments": {
    "contrast": 1.05,
    "saturation": 0.95,
    "temperature": 100,
    "lift": { "r": 0, "g": 0, "b": 0 },
    "gamma": { "r": 0, "g": 0, "b": 0 },
    "gain": { "r": 1, "g": 1, "b": 1 }
  }
}

Only include parameters that need changing. Contrast is a multiplier around 1.0. Saturation is a multiplier around 1.0. Temperature is Kelvin offset (-500 to +500). LGG values are small offsets.`,
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: `Analyze this frame. Target look: ${lookDescription}. What corrections are needed?` },
            { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: frameData.toString('base64') } },
          ],
        }],
      })

      const text = response.content.find(b => b.type === 'text')?.text ?? '{}'
      const parsed = JSON.parse(text.match(/\{[\s\S]*\}/)?.[0] || '{}')

      try { fs.unlinkSync(framePath) } catch {}

      return { adjustments: parsed.adjustments || {} }
    } catch {
      try { fs.unlinkSync(framePath) } catch {}
      return null
    }
  }
}

let instance: ColorGradingService | null = null

export function getColorGradingService(): ColorGradingService {
  if (!instance) {
    instance = new ColorGradingService()
  }
  return instance
}
