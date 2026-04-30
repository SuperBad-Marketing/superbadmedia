import { Router } from 'express'
import { BriefAssembler } from '../services/briefAssembler.js'

const router = Router()
const assembler = new BriefAssembler()

router.post('/parse', async (req, res) => {
  const { braindump } = req.body
  if (!braindump) {
    res.status(400).json({ error: 'braindump is required' })
    return
  }

  try {
    const fields = await assembler.parseBrief(braindump)
    res.json(fields)
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

router.post('/build', async (req, res) => {
  const { brief } = req.body
  if (!brief) {
    res.status(400).json({ error: 'brief is required' })
    return
  }

  try {
    const result = await assembler.assemble(brief)
    res.json(result)
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

export { router as briefRouter }
