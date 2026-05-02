import { FUSION_TEMPLATES, generateFusionScript, getTemplateById, getTemplatesByType } from './fusionTemplates.js'

export interface TitleCardPreset {
  id: string
  name: string
  type: 'title' | 'lower-third' | 'end-card' | 'chapter' | 'quote' | 'location' | 'stat' | 'reveal' | 'kinetic-text' | 'cta' | 'social-bug' | 'animated-counter'
  description: string
  category: string
  hasAnimation: boolean
}

export interface TitleCardRequest {
  presetId: string
  text: string
  subtext?: string
  duration: number
  position?: 'center' | 'bottom-left' | 'bottom-right' | 'top-left' | 'top-right'
  font?: string
  fontStyle?: string
  color?: { r: number; g: number; b: number }
  fps?: number
  insertAt: number
}

export class TitleCardService {
  getPresets(): TitleCardPreset[] {
    return FUSION_TEMPLATES.map(t => ({
      id: t.id,
      name: t.name,
      type: t.type,
      description: t.description,
      category: t.category,
      hasAnimation: true,
    }))
  }

  getPresetsByType(type: string): TitleCardPreset[] {
    return getTemplatesByType(type).map(t => ({
      id: t.id,
      name: t.name,
      type: t.type,
      description: t.description,
      category: t.category,
      hasAnimation: true,
    }))
  }

  generateFusionScript(request: TitleCardRequest): string {
    const script = generateFusionScript(request.presetId, {
      text: request.text,
      subtext: request.subtext,
      duration: request.duration,
      position: request.position,
      font: request.font,
      fontStyle: request.fontStyle,
      color: request.color,
      fps: request.fps,
    })

    if (!script) {
      const template = getTemplateById('doc-main-title')!
      return template.generate({
        text: request.text,
        subtext: request.subtext,
        duration: request.duration,
        font: request.font,
        fps: request.fps,
      })
    }

    return script
  }
}
