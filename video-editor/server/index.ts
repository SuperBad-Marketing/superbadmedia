import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import path from 'path'
import fs from 'fs'
import { chatRouter } from './routes/chat.js'
import { ingestRouter } from './routes/ingest.js'
import { skillsRouter } from './routes/skills.js'
import { musicRouter } from './routes/music.js'
import { resolveRouter } from './routes/resolve.js'
import { filesRouter } from './routes/files.js'
import { adsRouter } from './routes/ads.js'
import { clipsRouter } from './routes/clips.js'
import { captionsRouter } from './routes/captions.js'
import { transitionsRouter } from './routes/transitions.js'
import { titleCardsRouter } from './routes/titleCards.js'
import { sfxRouter } from './routes/sfx.js'
import { settingsRouter } from './routes/settings.js'
import { exportRouter } from './routes/export.js'
import { briefRouter } from './routes/brief.js'
import { projectsRouter } from './routes/projects.js'
import { cloudinaryRouter } from './routes/cloudinary.js'
import { audioRouter } from './routes/audio.js'

const app = express()
const PORT = 5201

app.use(cors())
app.use(express.json())

app.use('/thumbnails', express.static(path.join(process.cwd(), '.thumbnails')))

app.get('/media/stream', (req, res) => {
  const filePath = req.query.path as string
  if (!filePath || !path.isAbsolute(filePath)) {
    res.status(400).json({ error: 'Absolute file path required' })
    return
  }

  try {
    const stat = fs.statSync(filePath)
    const ext = path.extname(filePath).toLowerCase()
    const mimeTypes: Record<string, string> = {
      '.mp4': 'video/mp4',
      '.mov': 'video/quicktime',
      '.mkv': 'video/x-matroska',
      '.avi': 'video/x-msvideo',
      '.m4v': 'video/x-m4v',
      '.mxf': 'application/mxf',
      '.mts': 'video/mp2t',
    }

    const range = req.headers.range
    const contentType = mimeTypes[ext] || 'video/mp4'

    if (range) {
      const parts = range.replace(/bytes=/, '').split('-')
      const start = parseInt(parts[0], 10)
      const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1
      const chunkSize = end - start + 1

      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${stat.size}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunkSize,
        'Content-Type': contentType,
      })
      fs.createReadStream(filePath, { start, end }).pipe(res)
    } else {
      res.writeHead(200, {
        'Content-Length': stat.size,
        'Content-Type': contentType,
      })
      fs.createReadStream(filePath).pipe(res)
    }
  } catch {
    res.status(404).json({ error: 'File not found' })
  }
})

app.use('/api/chat', chatRouter)
app.use('/api/ingest', ingestRouter)
app.use('/api/skills', skillsRouter)
app.use('/api/music', musicRouter)
app.use('/api/resolve', resolveRouter)
app.use('/api/files', filesRouter)
app.use('/api/ads', adsRouter)
app.use('/api/clips', clipsRouter)
app.use('/api/captions', captionsRouter)
app.use('/api/transitions', transitionsRouter)
app.use('/api/title-cards', titleCardsRouter)
app.use('/api/sfx', sfxRouter)
app.use('/api/settings', settingsRouter)
app.use('/api/export', exportRouter)
app.use('/api/brief', briefRouter)
app.use('/api/projects', projectsRouter)
app.use('/api/cloudinary', cloudinaryRouter)
app.use('/api/audio', audioRouter)

app.listen(PORT, () => {
  console.warn(`SuperEdits server running on port ${PORT}`)
})
