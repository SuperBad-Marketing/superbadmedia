import { Router } from 'express'
import { exec } from 'child_process'
import crypto from 'crypto'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import { clientService } from '../services/clients.js'
import { analyzeReel } from '../services/reelAnalyzer.js'

const router = Router()

const logoUpload = multer({
  storage: multer.diskStorage({
    destination: (req, _file, cb) => {
      const folder = clientService.getClientFolder(req.params.id)
      if (!folder) return cb(new Error('Client not found'), '')
      const logosDir = path.join(folder, 'logos')
      fs.mkdirSync(logosDir, { recursive: true })
      cb(null, logosDir)
    },
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase()
      cb(null, `logo${ext}`)
    },
  }),
  fileFilter: (_req, file, cb) => {
    if (/\.(png|svg|jpg|jpeg|webp)$/i.test(file.originalname)) {
      cb(null, true)
    } else {
      cb(new Error('Only image files are allowed'))
    }
  },
  limits: { fileSize: 10 * 1024 * 1024 },
})

router.get('/', (_req, res) => {
  res.json(clientService.list())
})

router.get('/:id', (req, res) => {
  const data = clientService.get(req.params.id)
  if (!data) {
    res.status(404).json({ error: 'Client not found' })
    return
  }
  res.json(data)
})

router.post('/', (req, res) => {
  const { name, contactName, email, logoPath, brandColors } = req.body
  if (!name) {
    res.status(400).json({ error: 'name is required' })
    return
  }
  const client = clientService.create({ name, contactName: contactName || '', email: email || '', logoPath, brandColors })
  res.json(client)
})

router.put('/:id', (req, res) => {
  const updated = clientService.update(req.params.id, req.body)
  if (!updated) {
    res.status(404).json({ error: 'Client not found' })
    return
  }
  res.json(updated)
})

router.put('/:id/instructions', (req, res) => {
  const updated = clientService.updateInstructions(req.params.id, req.body)
  if (!updated) {
    res.status(404).json({ error: 'Client not found' })
    return
  }
  res.json(updated)
})

router.post('/:id/instructions', (req, res) => {
  const { category, instruction } = req.body
  if (!category || !instruction) {
    res.status(400).json({ error: 'category and instruction are required' })
    return
  }
  const updated = clientService.addInstruction(req.params.id, category, instruction)
  if (!updated) {
    res.status(404).json({ error: 'Client not found' })
    return
  }
  res.json(updated)
})

router.delete('/:id/instructions/:category/:index', (req, res) => {
  const { id, category, index } = req.params
  const updated = clientService.removeInstruction(id, category as any, parseInt(index))
  if (!updated) {
    res.status(404).json({ error: 'Client not found' })
    return
  }
  res.json(updated)
})

router.put('/:id/footage-path', (req, res) => {
  const { path: footagePath } = req.body
  if (!footagePath) {
    res.status(400).json({ error: 'path is required' })
    return
  }
  const updated = clientService.setFootageLibraryPath(req.params.id, footagePath)
  if (!updated) {
    res.status(404).json({ error: 'Client not found' })
    return
  }
  res.json(updated)
})

router.put('/:id/typography', (req, res) => {
  const updated = clientService.updateTypography(req.params.id, req.body)
  if (!updated) { res.status(404).json({ error: 'Client not found' }); return }
  res.json(updated)
})

router.put('/:id/logo-usage', (req, res) => {
  const updated = clientService.updateLogoUsage(req.params.id, req.body)
  if (!updated) { res.status(404).json({ error: 'Client not found' }); return }
  res.json(updated)
})

router.put('/:id/audio-defaults', (req, res) => {
  const updated = clientService.updateAudioDefaults(req.params.id, req.body)
  if (!updated) { res.status(404).json({ error: 'Client not found' }); return }
  res.json(updated)
})

router.put('/:id/brand-colors', (req, res) => {
  const { colors } = req.body
  if (!Array.isArray(colors)) { res.status(400).json({ error: 'colors array required' }); return }
  const updated = clientService.updateBrandColors(req.params.id, colors)
  if (!updated) { res.status(404).json({ error: 'Client not found' }); return }
  res.json(updated)
})

router.put('/:id/default-platform', (req, res) => {
  const { platform } = req.body
  if (!platform) { res.status(400).json({ error: 'platform required' }); return }
  const updated = clientService.setDefaultPlatform(req.params.id, platform)
  if (!updated) { res.status(404).json({ error: 'Client not found' }); return }
  res.json(updated)
})

// Edit styles
router.post('/:id/edit-styles', (req, res) => {
  const { name, ...initial } = req.body
  if (!name) { res.status(400).json({ error: 'name required' }); return }
  const updated = clientService.addEditStyle(req.params.id, name, initial)
  if (!updated) { res.status(404).json({ error: 'Client not found' }); return }
  res.json(updated)
})

router.put('/:id/edit-styles/:styleId', (req, res) => {
  const updated = clientService.updateEditStyle(req.params.id, req.params.styleId, req.body)
  if (!updated) { res.status(404).json({ error: 'Client or style not found' }); return }
  res.json(updated)
})

router.delete('/:id/edit-styles/:styleId', (req, res) => {
  const updated = clientService.removeEditStyle(req.params.id, req.params.styleId)
  if (!updated) { res.status(404).json({ error: 'Client or style not found' }); return }
  res.json(updated)
})

router.post('/:id/edit-styles/:styleId/reference-reels', (req, res) => {
  const { url } = req.body
  if (!url) { res.status(400).json({ error: 'url required' }); return }
  const reel = { id: crypto.randomUUID(), url, addedAt: new Date().toISOString() }
  const updated = clientService.addEditStyleReel(req.params.id, req.params.styleId, reel)
  if (!updated) { res.status(404).json({ error: 'Client or style not found' }); return }
  analyzeReel(req.params.id, reel.id, url).catch(() => {})
  res.json({ reel, client: updated })
})

router.delete('/:id/edit-styles/:styleId/reference-reels/:reelId', (req, res) => {
  const updated = clientService.removeEditStyleReel(req.params.id, req.params.styleId, req.params.reelId)
  if (!updated) { res.status(404).json({ error: 'Not found' }); return }
  res.json(updated)
})

router.get('/:id/cloudinary', (req, res) => {
  const folder = clientService.getCloudinaryFolder(req.params.id)
  const galleryUrl = clientService.getGalleryUrl(req.params.id)
  if (!folder) {
    res.status(404).json({ error: 'Client not found' })
    return
  }
  res.json({ folder, galleryUrl })
})

router.put('/:id/cloudinary', (req, res) => {
  const { folder } = req.body
  if (!folder) {
    res.status(400).json({ error: 'folder is required' })
    return
  }
  const updated = clientService.setCloudinaryFolder(req.params.id, folder)
  if (!updated) {
    res.status(404).json({ error: 'Client not found' })
    return
  }
  res.json({ folder: updated.cloudinaryFolder, galleryUrl: clientService.getGalleryUrl(req.params.id) })
})

router.post('/:id/reference-reels', (req, res) => {
  const { url } = req.body
  if (!url) {
    res.status(400).json({ error: 'url is required' })
    return
  }
  const reel = {
    id: crypto.randomUUID(),
    url,
    addedAt: new Date().toISOString(),
  }
  const updated = clientService.addReferenceReel(req.params.id, reel)
  if (!updated) {
    res.status(404).json({ error: 'Client not found' })
    return
  }

  analyzeReel(req.params.id, reel.id, url).catch(() => {})

  res.json({ reel, client: updated })
})

router.delete('/:id/reference-reels/:reelId', (req, res) => {
  const updated = clientService.removeReferenceReel(req.params.id, req.params.reelId)
  if (!updated) {
    res.status(404).json({ error: 'Client or reel not found' })
    return
  }
  res.json(updated)
})

router.get('/:id/reference-reels', (req, res) => {
  const data = clientService.get(req.params.id)
  if (!data) {
    res.status(404).json({ error: 'Client not found' })
    return
  }
  res.json(data.referenceReels || [])
})

router.get('/:id/logo', (req, res) => {
  const logoPath = clientService.getLogoPath(req.params.id)
  if (!logoPath) {
    res.status(404).json({ error: 'No logo found' })
    return
  }
  res.sendFile(logoPath)
})

router.put('/:id/logo', (req, res) => {
  const { path: logoPath } = req.body
  if (!logoPath) {
    res.status(400).json({ error: 'path is required' })
    return
  }
  const updated = clientService.setLogo(req.params.id, logoPath)
  if (!updated) {
    res.status(404).json({ error: 'Client not found' })
    return
  }
  res.json(updated)
})

router.post('/:id/logo/upload', logoUpload.single('logo'), (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: 'No file uploaded' })
    return
  }
  const updated = clientService.setLogo(req.params.id, req.file.path)
  if (!updated) {
    res.status(404).json({ error: 'Client not found' })
    return
  }
  res.json(updated)
})

router.post('/:id/open-folder', (req, res) => {
  const folder = clientService.getClientFolder(req.params.id)
  if (!folder) {
    res.status(404).json({ error: 'Client not found' })
    return
  }
  exec(`open "${folder}"`)
  res.json({ path: folder })
})

router.delete('/:id', (req, res) => {
  const removed = clientService.delete(req.params.id)
  if (!removed) {
    res.status(404).json({ error: 'Client not found' })
    return
  }
  res.json({ success: true })
})

export { router as clientsRouter }
