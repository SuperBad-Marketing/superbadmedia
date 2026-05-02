import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import path from 'path'
import { dataPath } from './services/dataRoot.js'
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
import { queueRouter } from './routes/queue.js'
import { clientsRouter } from './routes/clients.js'
import { revisionRouter } from './routes/revision.js'
import { libraryRouter } from './routes/library.js'
import { tasteRouter } from './routes/taste.js'
import { intentRouter } from './routes/intent.js'
import { gradingRouter } from './routes/grading.js'

const app = express()
const PORT = 5201

app.use(cors())
app.use(express.json({ limit: '50mb' }))

app.use('/thumbnails', express.static(dataPath('.thumbnails')))

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
app.use('/api/queue', queueRouter)
app.use('/api/clients', clientsRouter)
app.use('/api/revision', revisionRouter)
app.use('/api/library', libraryRouter)
app.use('/api/taste', tasteRouter)
app.use('/api/intent', intentRouter)
app.use('/api/grading', gradingRouter)

app.listen(PORT, () => {
  console.warn(`SuperEdits server running on port ${PORT}`)
})
