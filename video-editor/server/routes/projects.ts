import { Router } from 'express'
import fs from 'fs'
import path from 'path'
import { dataPath } from '../services/dataRoot.js'

const router = Router()
const PROJECTS_DIR = dataPath('projects')

fs.mkdirSync(PROJECTS_DIR, { recursive: true })

interface SavedProject {
  id: string
  name: string
  clientName: string
  createdAt: string
  updatedAt: string
  status: string
  clipCount: number
  storyboardClipCount: number
  totalDuration: number
  musicTrackTitle?: string
  notes?: string
  state: Record<string, any>
}

function listProjects(): Omit<SavedProject, 'state'>[] {
  try {
    const files = fs.readdirSync(PROJECTS_DIR).filter(f => f.endsWith('.json'))
    return files.map(f => {
      const data = JSON.parse(fs.readFileSync(path.join(PROJECTS_DIR, f), 'utf-8')) as SavedProject
      const { state: _state, ...meta } = data
      return meta
    }).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  } catch {
    return []
  }
}

router.get('/', (_req, res) => {
  res.json(listProjects())
})

router.get('/:id', (req, res) => {
  const filePath = path.join(PROJECTS_DIR, `${req.params.id}.json`)
  try {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
    res.json(data)
  } catch {
    res.status(404).json({ error: 'Project not found' })
  }
})

router.post('/', (req, res) => {
  const { id, name, clientName, state } = req.body
  if (!id || !name) {
    res.status(400).json({ error: 'id and name are required' })
    return
  }

  const project: SavedProject = {
    id,
    name,
    clientName: clientName || '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    status: state?.currentProject?.status || 'editing',
    clipCount: state?.clips?.length || 0,
    storyboardClipCount: state?.storyboardClips?.length || 0,
    totalDuration: (state?.storyboardClips || []).reduce(
      (sum: number, c: any) => sum + ((c.endTime || 0) - (c.startTime || 0)), 0
    ),
    musicTrackTitle: state?.selectedTrack?.title,
    notes: state?.currentProject?.notes,
    state: state || {},
  }

  fs.writeFileSync(path.join(PROJECTS_DIR, `${id}.json`), JSON.stringify(project, null, 2))
  const { state: _state, ...meta } = project
  res.json(meta)
})

router.put('/:id', (req, res) => {
  const filePath = path.join(PROJECTS_DIR, `${req.params.id}.json`)
  try {
    const existing = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as SavedProject
    const { state, name, clientName, notes } = req.body

    if (name !== undefined) existing.name = name
    if (clientName !== undefined) existing.clientName = clientName
    if (notes !== undefined) existing.notes = notes
    if (state) {
      existing.state = state
      existing.clipCount = state.clips?.length || 0
      existing.storyboardClipCount = state.storyboardClips?.length || 0
      existing.totalDuration = (state.storyboardClips || []).reduce(
        (sum: number, c: any) => sum + ((c.endTime || 0) - (c.startTime || 0)), 0
      )
      existing.musicTrackTitle = state.selectedTrack?.title
      existing.status = state.currentProject?.status || existing.status
    }
    existing.updatedAt = new Date().toISOString()

    fs.writeFileSync(filePath, JSON.stringify(existing, null, 2))
    const { state: _state, ...meta } = existing
    res.json(meta)
  } catch {
    res.status(404).json({ error: 'Project not found' })
  }
})

router.delete('/:id', (req, res) => {
  const filePath = path.join(PROJECTS_DIR, `${req.params.id}.json`)
  try {
    fs.unlinkSync(filePath)
    res.json({ success: true })
  } catch {
    res.status(404).json({ error: 'Project not found' })
  }
})

export { router as projectsRouter }
