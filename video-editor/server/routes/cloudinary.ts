import { Router } from 'express'
import { uploadToCloudinary, isCloudinaryConfigured, listCloudinaryFolders, createCloudinaryFolder } from '../services/cloudinary.js'

const router = Router()

router.get('/status', (_req, res) => {
  res.json({ configured: isCloudinaryConfigured() })
})

router.post('/upload', async (req, res) => {
  const { filePath, folder, publicId } = req.body

  if (!filePath) {
    res.status(400).json({ error: 'filePath is required' })
    return
  }

  try {
    const result = await uploadToCloudinary(filePath, { folder, publicId })
    res.json(result)
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

router.get('/folders', async (req, res) => {
  try {
    const prefix = req.query.prefix as string | undefined
    const folders = await listCloudinaryFolders(prefix)
    res.json(folders)
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

router.post('/folders', async (req, res) => {
  const { path: folderPath } = req.body
  if (!folderPath) {
    res.status(400).json({ error: 'path is required' })
    return
  }
  try {
    await createCloudinaryFolder(folderPath)
    res.json({ success: true, path: folderPath })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

export { router as cloudinaryRouter }
