import fs from 'fs'
import fsp from 'fs/promises'
import path from 'path'
import crypto from 'crypto'
import { getClipAnalysisService } from './clipAnalysis.js'
import { VisionAnalysisService } from './visionAnalysis.js'

interface LibraryEntry {
  id: string
  filePath: string
  fileName: string
  fileSize: number
  lastModified: string
  thumbnailPath: string
  metadata: Record<string, any>
  analysis: Record<string, any>
  visionAnalysis: Record<string, any> | null
  analyzedAt: string
  visionAnalyzedAt: string | null
  usedInProjects: string[]
}

interface LibraryStats {
  totalClips: number
  analyzed: number
  visionAnalyzed: number
  watchedFolder: string | null
  isScanning: boolean
  queueLength: number
  lastScanAt: string | null
  availableClips: number
  maxUsesPerClip: number
}

interface ScanProgress {
  phase: 'scanning' | 'metadata' | 'vision' | 'idle'
  total: number
  done: number
  currentFile: string | null
}

const VIDEO_EXTENSIONS = new Set(['.mp4', '.mov', '.mxf', '.avi', '.mkv', '.m4v', '.mpg', '.mts', '.r3d', '.braw', '.ari'])

const LIBRARY_DIR = path.join(process.cwd(), '.media-library')
const INDEX_PATH = path.join(LIBRARY_DIR, 'index.json')

export class MediaLibraryService {
  private entries: Map<string, LibraryEntry> = new Map()
  private watchedFolder: string | null = null
  private watcher: fs.FSWatcher | null = null
  private scanTimer: ReturnType<typeof setTimeout> | null = null
  private pollTimer: ReturnType<typeof setInterval> | null = null
  private isScanning = false
  private scanProgress: ScanProgress = { phase: 'idle', total: 0, done: 0, currentFile: null }
  private visionQueue: string[] = []
  private isProcessingVision = false
  private lastScanAt: string | null = null
  private clipAnalysis = getClipAnalysisService()
  private visionService = new VisionAnalysisService()

  constructor() {
    fs.mkdirSync(LIBRARY_DIR, { recursive: true })
    this.loadIndex()
    this.restoreWatchedFolder()
    this.resumeVisionQueue()
  }

  private loadIndex() {
    try {
      if (fs.existsSync(INDEX_PATH)) {
        const data = JSON.parse(fs.readFileSync(INDEX_PATH, 'utf-8'))
        for (const entry of data.entries || []) {
          if (!entry.usedInProjects) entry.usedInProjects = []
          this.entries.set(entry.filePath, entry)
        }
        this.lastScanAt = data.lastScanAt || null
      }
    } catch {
      this.entries.clear()
    }
  }

  private saveIndex() {
    const data = {
      lastScanAt: this.lastScanAt,
      entries: Array.from(this.entries.values()),
    }
    fs.writeFileSync(INDEX_PATH, JSON.stringify(data), 'utf-8')
  }

  private resumeVisionQueue() {
    const pending = Array.from(this.entries.values())
      .filter(e => !e.visionAnalysis)
      .map(e => e.filePath)

    if (pending.length > 0) {
      this.visionQueue.push(...pending)
      setTimeout(() => {
        if (!this.isProcessingVision && this.visionQueue.length > 0) {
          this.processVisionQueue()
        }
      }, 5000)
    }
  }

  private restoreWatchedFolder() {
    try {
      const settingsPath = path.join(LIBRARY_DIR, 'settings.json')
      if (fs.existsSync(settingsPath)) {
        const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'))
        if (settings.watchedFolder && fs.existsSync(settings.watchedFolder)) {
          this.setWatchedFolder(settings.watchedFolder)
        }
      }
    } catch {}
  }

  getStats(): LibraryStats {
    const entries = Array.from(this.entries.values())
    return {
      totalClips: this.entries.size,
      analyzed: this.entries.size,
      visionAnalyzed: entries.filter(e => e.visionAnalysis).length,
      watchedFolder: this.watchedFolder,
      isScanning: this.isScanning,
      queueLength: this.visionQueue.length,
      lastScanAt: this.lastScanAt,
      availableClips: entries.filter(e => (e.usedInProjects?.length || 0) < 2).length,
      maxUsesPerClip: 2,
    }
  }

  getProgress(): ScanProgress {
    return { ...this.scanProgress }
  }

  getEntries(options?: { limit?: number; offset?: number; search?: string }): { entries: LibraryEntry[]; total: number } {
    let all = Array.from(this.entries.values())

    if (options?.search) {
      const q = options.search.toLowerCase()
      all = all.filter(e => {
        if (e.fileName.toLowerCase().includes(q)) return true
        if (e.visionAnalysis?.description?.toLowerCase().includes(q)) return true
        if (e.visionAnalysis?.contentTags?.some((t: string) => t.toLowerCase().includes(q))) return true
        if (e.visionAnalysis?.sceneType?.toLowerCase().includes(q)) return true
        return false
      })
    }

    const total = all.length
    const offset = options?.offset ?? 0
    const limit = options?.limit ?? 50
    return { entries: all.slice(offset, offset + limit), total }
  }

  getEntry(filePath: string): LibraryEntry | undefined {
    return this.entries.get(filePath)
  }

  setWatchedFolder(folderPath: string) {
    if (this.watcher) {
      this.watcher.close()
      this.watcher = null
    }
    if (this.scanTimer) {
      clearTimeout(this.scanTimer)
      this.scanTimer = null
    }

    this.watchedFolder = folderPath

    const settingsPath = path.join(LIBRARY_DIR, 'settings.json')
    fs.writeFileSync(settingsPath, JSON.stringify({ watchedFolder: folderPath }), 'utf-8')

    this.startWatching()
    this.scan()
  }

  removeWatchedFolder() {
    if (this.watcher) {
      this.watcher.close()
      this.watcher = null
    }
    if (this.scanTimer) {
      clearTimeout(this.scanTimer)
      this.scanTimer = null
    }
    if (this.pollTimer) {
      clearInterval(this.pollTimer)
      this.pollTimer = null
    }
    this.watchedFolder = null

    const settingsPath = path.join(LIBRARY_DIR, 'settings.json')
    if (fs.existsSync(settingsPath)) fs.unlinkSync(settingsPath)
  }

  private startWatching() {
    if (!this.watchedFolder || !fs.existsSync(this.watchedFolder)) return

    try {
      this.watcher = fs.watch(this.watchedFolder, { recursive: true }, (eventType, filename) => {
        if (!filename) return
        const ext = path.extname(filename).toLowerCase()
        if (!VIDEO_EXTENSIONS.has(ext)) return

        if (this.scanTimer) clearTimeout(this.scanTimer)
        this.scanTimer = setTimeout(() => this.scan(), 3000)
      })
    } catch {}

    // fs.watch is unreliable on external/network volumes — poll every 60s as fallback
    if (this.pollTimer) clearInterval(this.pollTimer)
    this.pollTimer = setInterval(() => {
      if (!this.isScanning && this.watchedFolder && fs.existsSync(this.watchedFolder)) {
        this.scan()
      }
    }, 60000)
  }

  async scan() {
    if (this.isScanning || !this.watchedFolder) return
    if (!fs.existsSync(this.watchedFolder)) return

    this.isScanning = true
    this.scanProgress = { phase: 'scanning', total: 0, done: 0, currentFile: null }

    try {
      const files = await this.walkDir(this.watchedFolder)
      const videoFiles = files.filter(f => VIDEO_EXTENSIONS.has(path.extname(f).toLowerCase()))

      const newFiles: string[] = []
      for (const filePath of videoFiles) {
        const existing = this.entries.get(filePath)
        if (existing) {
          try {
            const stat = await fsp.stat(filePath)
            if (stat.mtime.toISOString() === existing.lastModified) continue
          } catch { continue }
        }
        newFiles.push(filePath)
      }

      // Remove entries for files that no longer exist
      for (const [filePath] of this.entries) {
        if (!fs.existsSync(filePath)) {
          this.entries.delete(filePath)
        }
      }

      if (newFiles.length === 0) {
        this.scanProgress = { phase: 'idle', total: 0, done: 0, currentFile: null }
        this.isScanning = false
        this.lastScanAt = new Date().toISOString()
        this.saveIndex()
        return
      }

      this.scanProgress = { phase: 'metadata', total: newFiles.length, done: 0, currentFile: null }

      const CONCURRENCY = 4
      for (let i = 0; i < newFiles.length; i += CONCURRENCY) {
        const batch = newFiles.slice(i, i + CONCURRENCY)
        const results = await Promise.allSettled(
          batch.map(async (filePath) => {
            this.scanProgress.currentFile = path.basename(filePath)
            const result = await this.clipAnalysis.analyzeClip(filePath, 'library')
            const stat = await fsp.stat(filePath)

            const existing = this.entries.get(filePath)
            const entry: LibraryEntry = {
              id: result.id,
              filePath: result.filePath,
              fileName: result.fileName,
              fileSize: stat.size,
              lastModified: stat.mtime.toISOString(),
              thumbnailPath: result.thumbnailPath,
              metadata: {
                duration: result.duration,
                width: result.width,
                height: result.height,
                fps: result.fps,
                codec: result.codec,
                isLog: result.isLog,
                camera: result.camera,
              },
              analysis: result.analysis,
              visionAnalysis: null,
              analyzedAt: new Date().toISOString(),
              visionAnalyzedAt: null,
              usedInProjects: existing?.usedInProjects || [],
            }

            this.entries.set(filePath, entry)
            return entry
          })
        )

        this.scanProgress.done += results.filter(r => r.status === 'fulfilled').length
        this.saveIndex()
      }

      // Queue all new files for vision analysis
      const newVisionQueue = newFiles.filter(f => {
        const entry = this.entries.get(f)
        return entry && !entry.visionAnalysis
      })
      this.visionQueue.push(...newVisionQueue)

      this.lastScanAt = new Date().toISOString()
      this.saveIndex()

      if (!this.isProcessingVision && this.visionQueue.length > 0) {
        this.processVisionQueue()
      }
    } catch (err: any) {
      console.error('[MediaLibrary] Scan error:', err.message)
    } finally {
      this.isScanning = false
      this.scanProgress = { phase: this.visionQueue.length > 0 ? 'vision' : 'idle', total: 0, done: 0, currentFile: null }
    }
  }

  private async processVisionQueue() {
    if (this.isProcessingVision) return
    this.isProcessingVision = true

    const totalVision = this.visionQueue.length
    let doneVision = 0

    this.scanProgress = { phase: 'vision', total: totalVision, done: 0, currentFile: null }

    while (this.visionQueue.length > 0) {
      const filePath = this.visionQueue.shift()!
      const entry = this.entries.get(filePath)
      if (!entry) continue

      this.scanProgress.currentFile = entry.fileName
      this.scanProgress.done = doneVision

      try {
        const visionResult = await this.visionService.analyzeClipVision(
          filePath,
          entry.id,
          entry.metadata.duration,
        )

        entry.visionAnalysis = visionResult as any
        entry.visionAnalyzedAt = new Date().toISOString()
        this.entries.set(filePath, entry)
        this.saveIndex()
      } catch (err: any) {
        console.error(`[MediaLibrary] Vision analysis failed for ${entry.fileName}:`, err.message)
      }

      doneVision++

      // Small pause between API calls to avoid rate limiting
      if (this.visionQueue.length > 0) {
        await new Promise(r => setTimeout(r, 500))
      }
    }

    this.isProcessingVision = false
    this.scanProgress = { phase: 'idle', total: 0, done: 0, currentFile: null }
    this.saveIndex()
  }

  recordUsage(projectId: string, filePaths: string[]): void {
    let changed = false
    for (const fp of filePaths) {
      const entry = this.entries.get(fp)
      if (!entry) continue
      if (!entry.usedInProjects) entry.usedInProjects = []
      if (!entry.usedInProjects.includes(projectId)) {
        entry.usedInProjects.push(projectId)
        changed = true
      }
    }
    if (changed) this.saveIndex()
  }

  getUsageCounts(): Map<string, number> {
    const counts = new Map<string, number>()
    for (const [fp, entry] of this.entries) {
      counts.set(fp, entry.usedInProjects?.length || 0)
    }
    return counts
  }

  async importToProject(filePaths: string[], projectId: string): Promise<any[]> {
    const results: any[] = []

    for (const filePath of filePaths) {
      const entry = this.entries.get(filePath)
      if (entry) {
        results.push({
          id: entry.id,
          projectId,
          filePath: entry.filePath,
          fileName: entry.fileName,
          thumbnailPath: entry.thumbnailPath,
          duration: entry.metadata.duration,
          width: entry.metadata.width,
          height: entry.metadata.height,
          fps: entry.metadata.fps,
          codec: entry.metadata.codec,
          isLog: entry.metadata.isLog,
          camera: entry.metadata.camera,
          analysis: {
            ...entry.analysis,
            ...(entry.visionAnalysis || {}),
            visionAnalyzed: !!entry.visionAnalysis,
          },
        })
      } else {
        const clip = await this.clipAnalysis.analyzeClip(filePath, projectId)
        results.push({
          ...clip,
          projectId,
          analysis: {
            ...clip.analysis,
            visionAnalyzed: false,
          },
        })
      }
    }

    return results
  }

  private async walkDir(dir: string): Promise<string[]> {
    const results: string[] = []
    try {
      const entries = await fsp.readdir(dir, { withFileTypes: true })
      for (const entry of entries) {
        if (entry.name.startsWith('.') || entry.name.startsWith('_')) continue
        const fullPath = path.join(dir, entry.name)
        if (entry.isDirectory()) {
          const sub = await this.walkDir(fullPath)
          results.push(...sub)
        } else {
          results.push(fullPath)
        }
      }
    } catch {}
    return results
  }
}

let instance: MediaLibraryService | null = null

export function getMediaLibrary(): MediaLibraryService {
  if (!instance) {
    instance = new MediaLibraryService()
  }
  return instance
}
