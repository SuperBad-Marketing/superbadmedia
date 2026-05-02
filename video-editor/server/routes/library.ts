import { Router } from 'express'
import { getMediaLibrary } from '../services/mediaLibrary.js'

const router = Router()

router.get('/stats', (_req, res) => {
  try {
    const library = getMediaLibrary()
    res.json(library.getStats())
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

router.get('/progress', (_req, res) => {
  const library = getMediaLibrary()
  res.json(library.getProgress())
})

router.get('/folders', (_req, res) => {
  try {
    const library = getMediaLibrary()
    res.json(library.getFolders())
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

router.get('/entries', (req, res) => {
  const library = getMediaLibrary()
  const limit = req.query.limit ? Number(req.query.limit) : 50
  const offset = req.query.offset ? Number(req.query.offset) : 0
  const search = req.query.search as string | undefined
  res.json(library.getEntries({ limit, offset, search }))
})

router.post('/watch', (req, res) => {
  const { folderPath } = req.body
  if (!folderPath) {
    res.status(400).json({ error: 'folderPath is required' })
    return
  }

  const library = getMediaLibrary()
  try {
    library.setWatchedFolder(folderPath)
    res.json({ success: true, watchedFolder: folderPath })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

router.delete('/watch', (_req, res) => {
  const library = getMediaLibrary()
  library.removeWatchedFolder()
  res.json({ success: true })
})

router.post('/scan', async (_req, res) => {
  const library = getMediaLibrary()
  library.scan()
  res.json({ success: true, message: 'Scan started' })
})

router.post('/import', async (req, res) => {
  const { filePaths, folder, projectId } = req.body
  const library = getMediaLibrary()

  let paths: string[]
  if (folder) {
    paths = library.getFilesInFolder(folder)
  } else if (filePaths && Array.isArray(filePaths)) {
    paths = filePaths
  } else {
    res.status(400).json({ error: 'filePaths array or folder path is required' })
    return
  }

  if (!paths.length) {
    res.json({ clips: [] })
    return
  }

  try {
    const clips = await library.importToProject(paths, projectId || 'default')
    res.json({ clips })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

export { router as libraryRouter }
