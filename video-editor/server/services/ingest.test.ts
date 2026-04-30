import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { IngestService } from './ingest.js'

describe('IngestService', () => {
  let service: IngestService
  let tmpDir: string

  beforeEach(() => {
    service = new IngestService()
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'superedits-test-'))
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  describe('startIngest', () => {
    it('returns a job with correct initial state', async () => {
      fs.writeFileSync(path.join(tmpDir, 'test.mp4'), 'fake video')

      const job = await service.startIngest(tmpDir, 'Test Client', 'folder')

      expect(job.id).toBeDefined()
      expect(job.projectId).toBeDefined()
      expect(job.sourcePath).toBe(tmpDir)
      expect(job.sourceType).toBe('folder')
      expect(job.errors).toEqual([])
    })

    it('sanitises client name in destination path', async () => {
      fs.writeFileSync(path.join(tmpDir, 'test.mp4'), 'fake video')

      const job = await service.startIngest(tmpDir, 'Client & Co!', 'folder')

      expect(job.destinationPath).toBeDefined()
      expect(job.destinationPath).not.toContain('&')
      expect(job.destinationPath).not.toContain('!')
    })
  })

  describe('getJob', () => {
    it('returns undefined for unknown job ID', () => {
      expect(service.getJob('nonexistent')).toBeUndefined()
    })

    it('returns the job after creation', async () => {
      fs.writeFileSync(path.join(tmpDir, 'test.mp4'), 'fake video')
      const job = await service.startIngest(tmpDir, 'Test', 'folder')
      const retrieved = service.getJob(job.id)

      expect(retrieved).toBeDefined()
      expect(retrieved!.id).toBe(job.id)
    })
  })
})
