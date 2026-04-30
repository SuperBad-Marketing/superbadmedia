import { Router } from 'express'
import fs from 'fs'
import path from 'path'

const router = Router()
const ENV_PATH = path.join(process.cwd(), '.env')

router.get('/', (_req, res) => {
  const apiKeySet = !!process.env.ANTHROPIC_API_KEY
  res.json({ apiKeySet })
})

router.post('/', (req, res) => {
  const { apiKey } = req.body
  if (!apiKey) {
    res.status(400).json({ error: 'API key is required' })
    return
  }

  if (!apiKey.startsWith('sk-ant-')) {
    res.status(400).json({ error: 'Invalid API key format. Should start with sk-ant-' })
    return
  }

  try {
    let envContent = ''
    try {
      envContent = fs.readFileSync(ENV_PATH, 'utf-8')
    } catch {}

    const lines = envContent.split('\n').filter((l) => !l.startsWith('ANTHROPIC_API_KEY='))
    lines.push(`ANTHROPIC_API_KEY=${apiKey}`)
    fs.writeFileSync(ENV_PATH, lines.filter(Boolean).join('\n') + '\n')

    process.env.ANTHROPIC_API_KEY = apiKey

    res.json({ success: true })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

export { router as settingsRouter }
