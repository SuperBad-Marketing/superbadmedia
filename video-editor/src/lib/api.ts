import type { ChatAction, IngestJob, MusicTrack, SkillFile } from '../types'

const API_BASE = '/api'

export async function sendChatMessage(
  message: string,
  projectId?: string
): Promise<{ content: string; action?: ChatAction }> {
  const res = await fetch(`${API_BASE}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, projectId }),
  })
  if (!res.ok) throw new Error('Failed to send message')
  return res.json()
}

export async function startIngest(
  sourcePath: string,
  clientName: string,
  sourceType: 'card' | 'folder'
): Promise<IngestJob> {
  const res = await fetch(`${API_BASE}/ingest`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sourcePath, clientName, sourceType }),
  })
  if (!res.ok) throw new Error('Failed to start ingest')
  return res.json()
}

export async function getIngestStatus(jobId: string): Promise<IngestJob> {
  const res = await fetch(`${API_BASE}/ingest/${jobId}`)
  if (!res.ok) throw new Error('Failed to get ingest status')
  return res.json()
}

export async function searchMusic(
  query: string,
  filters?: { mood?: string; genre?: string; bpm?: [number, number]; energy?: [number, number] }
): Promise<MusicTrack[]> {
  const params = new URLSearchParams({ q: query })
  if (filters?.mood) params.set('mood', filters.mood)
  if (filters?.genre) params.set('genre', filters.genre)
  const res = await fetch(`${API_BASE}/music/search?${params}`)
  if (!res.ok) throw new Error('Failed to search music')
  return res.json()
}

export async function learnFromUrl(url: string): Promise<SkillFile> {
  const res = await fetch(`${API_BASE}/skills/learn`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  })
  if (!res.ok) throw new Error('Failed to learn from URL')
  return res.json()
}

export async function getSkills(): Promise<SkillFile[]> {
  const res = await fetch(`${API_BASE}/skills`)
  if (!res.ok) throw new Error('Failed to get skills')
  return res.json()
}

export async function deleteSkill(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/skills/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error('Failed to delete skill')
}

export async function selectFolder(): Promise<string | null> {
  const res = await fetch(`${API_BASE}/files/select-folder`, { method: 'POST' })
  if (!res.ok) return null
  const data = await res.json()
  return data.path
}

export async function checkResolveConnection(): Promise<{ connected: boolean; project?: string; timeline?: string }> {
  try {
    const res = await fetch(`${API_BASE}/resolve/status`)
    return res.json()
  } catch {
    return { connected: false }
  }
}

export async function connectResolve(): Promise<{ connected: boolean; version?: string; project?: string; error?: string }> {
  try {
    const res = await fetch(`${API_BASE}/resolve/connect`, { method: 'POST' })
    return res.json()
  } catch {
    return { connected: false, error: 'Server unreachable' }
  }
}

export async function sendToResolve(action: string, params?: Record<string, any>): Promise<any> {
  const res = await fetch(`${API_BASE}/resolve/command`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, params }),
  })
  return res.json()
}
