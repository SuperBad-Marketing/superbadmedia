import express from 'express'
import cors from 'cors'
import { chatRouter } from './routes/chat.js'
import { ingestRouter } from './routes/ingest.js'
import { skillsRouter } from './routes/skills.js'
import { musicRouter } from './routes/music.js'
import { resolveRouter } from './routes/resolve.js'
import { filesRouter } from './routes/files.js'

const app = express()
const PORT = 5201

app.use(cors())
app.use(express.json())

app.use('/api/chat', chatRouter)
app.use('/api/ingest', ingestRouter)
app.use('/api/skills', skillsRouter)
app.use('/api/music', musicRouter)
app.use('/api/resolve', resolveRouter)
app.use('/api/files', filesRouter)

app.listen(PORT, () => {
  console.warn(`SuperEdits server running on port ${PORT}`)
})
