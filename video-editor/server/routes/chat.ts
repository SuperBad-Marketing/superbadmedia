import { Router } from 'express'
import { chatRouter } from '../services/chatRouter.js'

const router = Router()

router.post('/', async (req, res) => {
  const { message, projectId } = req.body

  if (!message) {
    res.status(400).json({ error: 'Message is required' })
    return
  }

  try {
    const response = await chatRouter.route(message, projectId)
    res.json(response)
  } catch (err: any) {
    console.error('Chat error:', err.message)
    res.json({ content: `Something went wrong: ${err.message}` })
  }
})

export { router as chatRouter }
