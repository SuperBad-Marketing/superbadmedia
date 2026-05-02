import path from 'path'
import fs from 'fs'

const DATA_ROOT = process.env.SUPEREDITS_DATA_ROOT || process.cwd()

export function dataPath(...segments: string[]): string {
  return path.join(DATA_ROOT, ...segments)
}

export function ensureDataDir(...segments: string[]): string {
  const dir = dataPath(...segments)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
  return dir
}
