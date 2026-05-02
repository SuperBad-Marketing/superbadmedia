import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import { isCloudinaryConfigured, createCloudinaryFolder } from './cloudinary.js'
import { dataPath } from './dataRoot.js'

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

export interface ReferenceReel {
  id: string
  url: string
  localPath?: string
  addedAt: string
  analysis?: {
    totalDuration: number
    cutCount: number
    avgCutLength: number
    cutLengths: number[]
    rhythmPattern: string[]
    energyCurve: number[]
    hasText: boolean
    hasFaceCam: boolean
    dominantColors: string[]
    transitionTypes: string[]
    pacing: 'fast' | 'medium' | 'slow'
    notes: string
  }
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

const CLIENTS_DIR = dataPath('.clients')

class ClientService {
  constructor() {
    fs.mkdirSync(CLIENTS_DIR, { recursive: true })
  }

  private filePath(id: string): string {
    return path.join(CLIENTS_DIR, `${id}.json`)
  }

  list(): ClientProfile[] {
    try {
      const files = fs.readdirSync(CLIENTS_DIR).filter(f => f.endsWith('.json') && !f.startsWith('._'))
      return files.map(f => {
        const data: ClientData = JSON.parse(fs.readFileSync(path.join(CLIENTS_DIR, f), 'utf-8'))
        return data.profile
      }).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    } catch {
      return []
    }
  }

  get(id: string): ClientData | null {
    try {
      return JSON.parse(fs.readFileSync(this.filePath(id), 'utf-8'))
    } catch {
      return null
    }
  }

  create(profile: Omit<ClientProfile, 'id' | 'createdAt' | 'updatedAt'>): ClientData {
    const now = new Date().toISOString()
    const safeName = profile.name.replace(/[^a-zA-Z0-9-_ ]/g, '').replace(/\s+/g, '-').toLowerCase()
    const cloudinaryFolder = `clients/${safeName}`

    const data: ClientData = {
      profile: {
        ...profile,
        id: crypto.randomUUID(),
        createdAt: now,
        updatedAt: now,
      },
      typography: {
        heading: { family: '', weight: '700' },
        subheading: { family: '', weight: '600' },
        body: { family: '', weight: '400' },
      },
      logoUsage: {
        intro: false,
        outro: true,
        watermark: false,
        watermarkPosition: 'bottom-right',
        watermarkOpacity: 30,
        outroDuration: 3,
      },
      audioDefaults: {
        musicVolume: 'balanced',
        preserveOriginalAudio: true,
      },
      brandColors: profile.brandColors || [],
      defaultPlatform: 'instagram-reel',
      instructions: { editing: [], style: [], avoid: [], general: [] },
      editStyles: [],
      referenceReels: [],
      cloudinaryFolder,
      projectIds: [],
    }
    fs.writeFileSync(this.filePath(data.profile.id), JSON.stringify(data, null, 2))

    if (isCloudinaryConfigured()) {
      this.ensureCloudinaryFolder(data.profile.id, cloudinaryFolder)
    }

    return data
  }

  update(id: string, updates: Partial<ClientProfile>): ClientData | null {
    const data = this.get(id)
    if (!data) return null

    Object.assign(data.profile, updates)
    data.profile.updatedAt = new Date().toISOString()
    fs.writeFileSync(this.filePath(id), JSON.stringify(data, null, 2))
    return data
  }

  updateInstructions(id: string, instructions: ClientInstructions): ClientData | null {
    const data = this.get(id)
    if (!data) return null

    data.instructions = instructions
    data.profile.updatedAt = new Date().toISOString()
    fs.writeFileSync(this.filePath(id), JSON.stringify(data, null, 2))
    return data
  }

  addInstruction(id: string, category: keyof ClientInstructions, instruction: string): ClientData | null {
    const data = this.get(id)
    if (!data) return null

    if (!data.instructions[category].includes(instruction)) {
      data.instructions[category].push(instruction)
      data.profile.updatedAt = new Date().toISOString()
      fs.writeFileSync(this.filePath(id), JSON.stringify(data, null, 2))
    }
    return data
  }

  removeInstruction(id: string, category: keyof ClientInstructions, index: number): ClientData | null {
    const data = this.get(id)
    if (!data) return null

    data.instructions[category].splice(index, 1)
    data.profile.updatedAt = new Date().toISOString()
    fs.writeFileSync(this.filePath(id), JSON.stringify(data, null, 2))
    return data
  }

  addProjectId(id: string, projectId: string): void {
    const data = this.get(id)
    if (!data) return
    if (!data.projectIds.includes(projectId)) {
      data.projectIds.push(projectId)
      fs.writeFileSync(this.filePath(id), JSON.stringify(data, null, 2))
    }
  }

  setFootageLibraryPath(id: string, footagePath: string): ClientData | null {
    const data = this.get(id)
    if (!data) return null
    data.footageLibraryPath = footagePath
    data.profile.updatedAt = new Date().toISOString()
    fs.writeFileSync(this.filePath(id), JSON.stringify(data, null, 2))
    return data
  }

  updateTypography(id: string, typography: ClientTypography): ClientData | null {
    const data = this.get(id)
    if (!data) return null
    data.typography = typography
    data.profile.updatedAt = new Date().toISOString()
    fs.writeFileSync(this.filePath(id), JSON.stringify(data, null, 2))
    return data
  }

  updateLogoUsage(id: string, logoUsage: LogoUsage): ClientData | null {
    const data = this.get(id)
    if (!data) return null
    data.logoUsage = logoUsage
    data.profile.updatedAt = new Date().toISOString()
    fs.writeFileSync(this.filePath(id), JSON.stringify(data, null, 2))
    return data
  }

  updateAudioDefaults(id: string, audioDefaults: AudioDefaults): ClientData | null {
    const data = this.get(id)
    if (!data) return null
    data.audioDefaults = audioDefaults
    data.profile.updatedAt = new Date().toISOString()
    fs.writeFileSync(this.filePath(id), JSON.stringify(data, null, 2))
    return data
  }

  updateBrandColors(id: string, colors: string[]): ClientData | null {
    const data = this.get(id)
    if (!data) return null
    data.brandColors = colors
    data.profile.updatedAt = new Date().toISOString()
    fs.writeFileSync(this.filePath(id), JSON.stringify(data, null, 2))
    return data
  }

  setDefaultPlatform(id: string, platform: string): ClientData | null {
    const data = this.get(id)
    if (!data) return null
    data.defaultPlatform = platform
    data.profile.updatedAt = new Date().toISOString()
    fs.writeFileSync(this.filePath(id), JSON.stringify(data, null, 2))
    return data
  }

  addEditStyle(id: string, name: string, initial?: Partial<EditStyle>): ClientData | null {
    const data = this.get(id)
    if (!data) return null
    if (!data.editStyles) data.editStyles = []

    const style: EditStyle = {
      id: crypto.randomUUID(),
      name,
      isDefault: data.editStyles.length === 0,
      instructions: { editing: [], style: [], avoid: [], general: [] },
      captionStyle: { position: 'bottom', background: 'solid', size: 'standard' },
      defaultPacing: 'medium',
      defaultMood: '',
      gradingLook: '',
      musicKeywords: '',
      referenceReels: [],
      ...initial,
      id: crypto.randomUUID(),
    }
    data.editStyles.push(style)
    data.profile.updatedAt = new Date().toISOString()
    fs.writeFileSync(this.filePath(id), JSON.stringify(data, null, 2))
    return data
  }

  updateEditStyle(id: string, styleId: string, updates: Partial<EditStyle>): ClientData | null {
    const data = this.get(id)
    if (!data) return null
    const style = (data.editStyles || []).find(s => s.id === styleId)
    if (!style) return null
    Object.assign(style, updates)
    data.profile.updatedAt = new Date().toISOString()
    fs.writeFileSync(this.filePath(id), JSON.stringify(data, null, 2))
    return data
  }

  removeEditStyle(id: string, styleId: string): ClientData | null {
    const data = this.get(id)
    if (!data) return null
    data.editStyles = (data.editStyles || []).filter(s => s.id !== styleId)
    if (data.editStyles.length > 0 && !data.editStyles.some(s => s.isDefault)) {
      data.editStyles[0].isDefault = true
    }
    data.profile.updatedAt = new Date().toISOString()
    fs.writeFileSync(this.filePath(id), JSON.stringify(data, null, 2))
    return data
  }

  addEditStyleReel(id: string, styleId: string, reel: ReferenceReel): ClientData | null {
    const data = this.get(id)
    if (!data) return null
    const style = (data.editStyles || []).find(s => s.id === styleId)
    if (!style) return null
    style.referenceReels.push(reel)
    data.profile.updatedAt = new Date().toISOString()
    fs.writeFileSync(this.filePath(id), JSON.stringify(data, null, 2))
    return data
  }

  removeEditStyleReel(id: string, styleId: string, reelId: string): ClientData | null {
    const data = this.get(id)
    if (!data) return null
    const style = (data.editStyles || []).find(s => s.id === styleId)
    if (!style) return null
    style.referenceReels = style.referenceReels.filter(r => r.id !== reelId)
    data.profile.updatedAt = new Date().toISOString()
    fs.writeFileSync(this.filePath(id), JSON.stringify(data, null, 2))
    return data
  }

  private formatInstructions(instructions: ClientInstructions, prefix: string): string[] {
    const sections: string[] = []
    if (instructions.editing.length > 0) {
      sections.push(`${prefix}EDITING RULES:\n${instructions.editing.map(i => `- ${i}`).join('\n')}`)
    }
    if (instructions.style.length > 0) {
      sections.push(`${prefix}STYLE PREFERENCES:\n${instructions.style.map(i => `- ${i}`).join('\n')}`)
    }
    if (instructions.avoid.length > 0) {
      sections.push(`${prefix}AVOID:\n${instructions.avoid.map(i => `- ${i}`).join('\n')}`)
    }
    if (instructions.general.length > 0) {
      sections.push(`${prefix}GENERAL NOTES:\n${instructions.general.map(i => `- ${i}`).join('\n')}`)
    }
    return sections
  }

  getInstructionsPrompt(id: string, editStyleId?: string): string {
    const data = this.get(id)
    if (!data) return ''

    const sections: string[] = []

    // Global brand settings
    const brandParts: string[] = []
    if (data.typography?.heading?.family) {
      brandParts.push(`Heading font: ${data.typography.heading.family} (weight ${data.typography.heading.weight})`)
    }
    if (data.typography?.subheading?.family) {
      brandParts.push(`Subheading font: ${data.typography.subheading.family} (weight ${data.typography.subheading.weight})`)
    }
    if (data.typography?.body?.family) {
      brandParts.push(`Body/caption font: ${data.typography.body.family} (weight ${data.typography.body.weight})`)
    }
    if (data.brandColors?.length > 0) {
      brandParts.push(`Brand colours: ${data.brandColors.join(', ')}`)
    }
    if (data.logoUsage) {
      const usages: string[] = []
      if (data.logoUsage.intro) usages.push('intro')
      if (data.logoUsage.outro) usages.push(`outro (${data.logoUsage.outroDuration}s)`)
      if (data.logoUsage.watermark) usages.push(`watermark (${data.logoUsage.watermarkPosition}, ${data.logoUsage.watermarkOpacity}% opacity)`)
      if (usages.length > 0) brandParts.push(`Logo usage: ${usages.join(', ')}`)
    }
    if (data.audioDefaults) {
      brandParts.push(`Music level: ${data.audioDefaults.musicVolume}`)
      if (!data.audioDefaults.preserveOriginalAudio) brandParts.push('Mute original audio by default')
    }
    if (brandParts.length > 0) {
      sections.push(`BRAND SETTINGS:\n${brandParts.map(p => `- ${p}`).join('\n')}`)
    }

    // Global instructions
    sections.push(...this.formatInstructions(data.instructions, ''))

    // Edit style specific
    if (editStyleId) {
      const style = (data.editStyles || []).find(s => s.id === editStyleId)
      if (style) {
        const styleParts: string[] = [`Edit style: "${style.name}"`]
        if (style.defaultPacing) styleParts.push(`Default pacing: ${style.defaultPacing}`)
        if (style.defaultMood) styleParts.push(`Default mood: ${style.defaultMood}`)
        if (style.gradingLook) styleParts.push(`Grading look: ${style.gradingLook}`)
        if (style.musicKeywords) styleParts.push(`Music direction: ${style.musicKeywords}`)
        if (style.captionStyle) {
          styleParts.push(`Captions: ${style.captionStyle.size} size, ${style.captionStyle.position} position, ${style.captionStyle.background} background`)
        }
        sections.push(`EDIT STYLE "${style.name.toUpperCase()}":\n${styleParts.map(p => `- ${p}`).join('\n')}`)

        const styleInstructions = this.formatInstructions(style.instructions, `[${style.name}] `)
        sections.push(...styleInstructions)

        const styleReelContext = this.getReelContextFromReels(style.referenceReels)
        if (styleReelContext) sections.push(styleReelContext)
      }
    }

    // Global reference reels (only if no style-specific ones were added)
    if (!editStyleId) {
      const reelContext = this.getReferenceReelContext(id)
      if (reelContext) sections.push(reelContext)
    }

    if (sections.length === 0) return ''
    return `## CLIENT-SPECIFIC INSTRUCTIONS (${data.profile.name})\n\n${sections.join('\n\n')}`
  }

  findByName(name: string): ClientData | null {
    const all = this.list()
    const match = all.find(p =>
      p.name.toLowerCase() === name.toLowerCase() ||
      p.name.toLowerCase().includes(name.toLowerCase())
    )
    return match ? this.get(match.id) : null
  }

  setCloudinaryFolder(id: string, folder: string): ClientData | null {
    const data = this.get(id)
    if (!data) return null
    data.cloudinaryFolder = folder
    data.profile.updatedAt = new Date().toISOString()
    fs.writeFileSync(this.filePath(id), JSON.stringify(data, null, 2))
    return data
  }

  getCloudinaryFolder(id: string): string | null {
    const data = this.get(id)
    if (!data) return null
    if (data.cloudinaryFolder) return data.cloudinaryFolder
    const safeName = data.profile.name.replace(/[^a-zA-Z0-9-_ ]/g, '').replace(/\s+/g, '-').toLowerCase()
    const folder = `clients/${safeName}`
    this.setCloudinaryFolder(id, folder)
    return folder
  }

  private async ensureCloudinaryFolder(_clientId: string, folder: string): Promise<void> {
    try {
      await createCloudinaryFolder(folder)
    } catch {
      // Folder may already exist — that's fine
    }
  }

  getGalleryUrl(id: string): string | null {
    const data = this.get(id)
    if (!data?.cloudinaryFolder) return null
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME
    if (!cloudName) return null
    return `https://res.cloudinary.com/${cloudName}/video/upload/${data.cloudinaryFolder}/`
  }

  addReferenceReel(id: string, reel: ReferenceReel): ClientData | null {
    const data = this.get(id)
    if (!data) return null
    if (!data.referenceReels) data.referenceReels = []
    data.referenceReels.push(reel)
    data.profile.updatedAt = new Date().toISOString()
    fs.writeFileSync(this.filePath(id), JSON.stringify(data, null, 2))
    return data
  }

  updateReelLocalPath(id: string, reelId: string, localPath: string): ClientData | null {
    const data = this.get(id)
    if (!data) return null
    const reel = (data.referenceReels || []).find(r => r.id === reelId)
    if (!reel) return null
    reel.localPath = localPath
    fs.writeFileSync(this.filePath(id), JSON.stringify(data, null, 2))
    return data
  }

  updateReelAnalysis(id: string, reelId: string, analysis: ReferenceReel['analysis']): ClientData | null {
    const data = this.get(id)
    if (!data) return null
    const reel = (data.referenceReels || []).find(r => r.id === reelId)
    if (!reel) return null
    reel.analysis = analysis
    data.profile.updatedAt = new Date().toISOString()
    fs.writeFileSync(this.filePath(id), JSON.stringify(data, null, 2))
    return data
  }

  removeReferenceReel(id: string, reelId: string): ClientData | null {
    const data = this.get(id)
    if (!data) return null
    data.referenceReels = (data.referenceReels || []).filter(r => r.id !== reelId)
    data.profile.updatedAt = new Date().toISOString()
    fs.writeFileSync(this.filePath(id), JSON.stringify(data, null, 2))
    return data
  }

  getReelContextFromReels(reels: ReferenceReel[]): string {
    if (!reels?.length) return ''

    const analyzed = reels.filter(r => r.analysis)
    if (analyzed.length === 0) return ''

    const avgCut = analyzed.reduce((s, r) => s + (r.analysis!.avgCutLength || 0), 0) / analyzed.length
    const avgDuration = analyzed.reduce((s, r) => s + (r.analysis!.totalDuration || 0), 0) / analyzed.length

    const pacingCounts = { fast: 0, medium: 0, slow: 0 }
    for (const r of analyzed) {
      pacingCounts[r.analysis!.pacing]++
    }
    const dominantPacing = Object.entries(pacingCounts).sort((a, b) => b[1] - a[1])[0][0]

    const allRhythms = analyzed.flatMap(r => r.analysis!.rhythmPattern)
    const rhythmCounts = new Map<string, number>()
    for (const r of allRhythms) rhythmCounts.set(r, (rhythmCounts.get(r) || 0) + 1)
    const topRhythms = [...rhythmCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([r]) => r)

    const allTransitions = analyzed.flatMap(r => r.analysis!.transitionTypes)
    const transitionSet = [...new Set(allTransitions)]

    const notes = analyzed.map(r => r.analysis!.notes).filter(Boolean)

    return `## REFERENCE STYLE (from ${analyzed.length} example reel${analyzed.length > 1 ? 's' : ''})

Match this editing feel:
- Average cut length: ${avgCut.toFixed(1)}s
- Typical duration: ${Math.round(avgDuration)}s
- Dominant pacing: ${dominantPacing}
- Rhythm tendencies: ${topRhythms.join(', ')}
- Transition types used: ${transitionSet.length > 0 ? transitionSet.join(', ') : 'mostly hard cuts'}
${notes.length > 0 ? `\nStyle notes:\n${notes.map(n => `- ${n}`).join('\n')}` : ''}

Stay close to this feel unless the brief explicitly asks for something different.`
  }

  getReferenceReelContext(id: string): string {
    const data = this.get(id)
    if (!data?.referenceReels?.length) return ''
    return this.getReelContextFromReels(data.referenceReels)
  }

  getClientFolder(id: string): string | null {
    const data = this.get(id)
    if (!data) return null
    const safeName = data.profile.name.replace(/[^a-zA-Z0-9-_ ]/g, '').replace(/\s+/g, ' ').trim()
    const clientDir = path.join(CLIENTS_DIR, safeName)
    fs.mkdirSync(path.join(clientDir, 'logos'), { recursive: true })
    fs.mkdirSync(path.join(clientDir, 'reference-reels'), { recursive: true })
    fs.mkdirSync(path.join(clientDir, 'exports'), { recursive: true })
    return clientDir
  }

  setLogo(id: string, logoPath: string): ClientData | null {
    const data = this.get(id)
    if (!data) return null
    data.profile.logoPath = logoPath
    data.profile.updatedAt = new Date().toISOString()
    fs.writeFileSync(this.filePath(id), JSON.stringify(data, null, 2))
    return data
  }

  getLogoPath(id: string): string | null {
    const data = this.get(id)
    if (!data) return null
    if (data.profile.logoPath && fs.existsSync(data.profile.logoPath)) {
      return data.profile.logoPath
    }
    const folder = this.getClientFolder(id)
    if (!folder) return null
    const logosDir = path.join(folder, 'logos')
    try {
      const files = fs.readdirSync(logosDir).filter(f =>
        /\.(png|svg|jpg|jpeg|webp)$/i.test(f)
      )
      if (files.length > 0) {
        const logoPath = path.join(logosDir, files[0])
        this.setLogo(id, logoPath)
        return logoPath
      }
    } catch {}
    return null
  }

  delete(id: string): boolean {
    try {
      fs.unlinkSync(this.filePath(id))
      return true
    } catch {
      return false
    }
  }
}

export const clientService = new ClientService()
