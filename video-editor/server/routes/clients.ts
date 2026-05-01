import { Router } from 'express'
import { clientService } from '../services/clients.js'

const router = Router()

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

router.delete('/:id', (req, res) => {
  const removed = clientService.delete(req.params.id)
  if (!removed) {
    res.status(404).json({ error: 'Client not found' })
    return
  }
  res.json({ success: true })
})

export { router as clientsRouter }
