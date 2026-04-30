import { Router } from 'express'
import { uploadToCloudinary, isCloudinaryConfigured } from '../services/cloudinary.js'

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

export { router as cloudinaryRouter }
