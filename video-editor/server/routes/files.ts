import { Router } from 'express'
import { execSync } from 'child_process'
import { platform } from 'os'

const router = Router()

router.post('/select-folder', (_req, res) => {
  try {
    let folderPath: string | null = null

    if (platform() === 'darwin') {
      const result = execSync(
        `osascript -e 'POSIX path of (choose folder with prompt "Select footage folder")'`,
        { encoding: 'utf-8', timeout: 60000 }
      ).trim()
      folderPath = result
    } else {
      folderPath = null
    }

    if (folderPath) {
      res.json({ path: folderPath })
    } else {
      res.status(400).json({ error: 'No folder selected' })
    }
  } catch {
    res.status(400).json({ error: 'Folder selection cancelled' })
  }
})

export { router as filesRouter }
