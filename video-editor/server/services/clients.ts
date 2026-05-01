import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import { isCloudinaryConfigured, createCloudinaryFolder } from './cloudinary.js'

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

const CLIENTS_DIR = path.join(process.cwd(), '.clients')

class ClientService {
  constructor() {
    fs.mkdirSync(CLIENTS_DIR, { recursive: true })
  }

  private filePath(id: string): string {
    return path.join(CLIENTS_DIR, `${id}.json`)
  }

  list(): ClientProfile[] {
    try {
      const files = fs.readdirSync(CLIENTS_DIR).filter(f => f.endsWith('.json'))
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
      instructions: { editing: [], style: [], avoid: [], general: [] },
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

  getInstructionsPrompt(id: string): string {
    const data = this.get(id)
    if (!data) return ''

    const sections: string[] = []

    if (data.instructions.editing.length > 0) {
      sections.push(`EDITING RULES:\n${data.instructions.editing.map(i => `- ${i}`).join('\n')}`)
    }
    if (data.instructions.style.length > 0) {
      sections.push(`STYLE PREFERENCES:\n${data.instructions.style.map(i => `- ${i}`).join('\n')}`)
    }
    if (data.instructions.avoid.length > 0) {
      sections.push(`AVOID:\n${data.instructions.avoid.map(i => `- ${i}`).join('\n')}`)
    }
    if (data.instructions.general.length > 0) {
      sections.push(`GENERAL NOTES:\n${data.instructions.general.map(i => `- ${i}`).join('\n')}`)
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
