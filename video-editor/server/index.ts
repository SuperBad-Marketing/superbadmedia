import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import path from 'path'
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

const app = express()
const PORT = 5201

app.use(cors())
app.use(express.json())

app.use('/thumbnails', express.static(path.join(process.cwd(), '.thumbnails')))

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

app.listen(PORT, () => {
  console.warn(`SuperEdits server running on port ${PORT}`)
})
