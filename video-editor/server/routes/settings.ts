import { Router } from 'express'
import fs from 'fs'
import path from 'path'

const router = Router()
const ENV_PATH = path.join(process.cwd(), '.env')

const SUPPORTED_KEYS = [
  'ANTHROPIC_API_KEY',
  'CLOUDINARY_CLOUD_NAME',
  'CLOUDINARY_API_KEY',
  'CLOUDINARY_API_SECRET',
  'DOLBY_API_KEY',
] as const

type SettingKey = (typeof SUPPORTED_KEYS)[number]

function readEnv(): Record<string, string> {
  try {
    const content = fs.readFileSync(ENV_PATH, 'utf-8')
    const result: Record<string, string> = {}
    for (const line of content.split('\n')) {
      const match = line.match(/^([A-Z_]+)=(.*)$/)
      if (match) result[match[1]] = match[2]
    }
    return result
  } catch {
    return {}
  }
}

function writeEnv(values: Record<string, string>) {
  const existing = readEnv()
  const merged = { ...existing, ...values }
  const content = Object.entries(merged)
    .filter(([, v]) => v)
    .map(([k, v]) => `${k}=${v}`)
    .join('\n') + '\n'
  fs.writeFileSync(ENV_PATH, content)
}

router.get('/', (_req, res) => {
  const env = readEnv()
  const status: Record<string, boolean> = {}
  for (const key of SUPPORTED_KEYS) {
    status[key] = !!env[key]
  }
  res.json(status)
})

router.post('/', (req, res) => {
  const updates: Record<string, string> = {}
  let hasUpdate = false

  // Legacy single-key support
  if (req.body.apiKey) {
    if (!req.body.apiKey.startsWith('sk-ant-')) {
      res.status(400).json({ error: 'Invalid Anthropic API key format. Should start with sk-ant-' })
      return
    }
    updates.ANTHROPIC_API_KEY = req.body.apiKey
    hasUpdate = true
  }

  // Multi-key support
  for (const key of SUPPORTED_KEYS) {
    if (req.body[key] !== undefined) {
      updates[key] = req.body[key]
      hasUpdate = true
    }
  }

  if (!hasUpdate) {
    res.status(400).json({ error: 'No settings provided' })
    return
  }

  // Validate Anthropic key format
  if (updates.ANTHROPIC_API_KEY && !updates.ANTHROPIC_API_KEY.startsWith('sk-ant-')) {
    res.status(400).json({ error: 'Invalid Anthropic API key format. Should start with sk-ant-' })
    return
  }

  try {
    writeEnv(updates)

    for (const [key, value] of Object.entries(updates)) {
      process.env[key] = value
    }

    res.json({ success: true })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

export { router as settingsRouter }
