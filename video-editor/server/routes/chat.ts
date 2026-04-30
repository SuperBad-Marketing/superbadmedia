import { Router } from 'express'
import Anthropic from '@anthropic-ai/sdk'

const router = Router()

const getClient = () => {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return null
  return new Anthropic({ apiKey })
}

const SYSTEM_PROMPT = `You are SuperEdits, an AI video editing assistant built into a desktop app that controls DaVinci Resolve Studio. You help with:
- Importing and organizing footage
- Building rough cut assemblies
- Adding transitions, SFX, title cards, and captions
- Colour grading via plain English descriptions
- Music selection and placement
- Exporting for multiple platforms and aspect ratios
- Learning new editing techniques from YouTube videos and articles

You speak concisely and practically. You're an expert editor who communicates in plain English, never jargon. When the user asks you to do something, describe what you'll do briefly, then do it.

If the user pastes a YouTube link or URL, offer to learn from it (create a skill file from its content).

Keep responses short — 2-3 sentences for simple requests. Only elaborate when explaining a creative decision.`

router.post('/', async (req, res) => {
  const { message, projectId } = req.body

  if (!message) {
    res.status(400).json({ error: 'Message is required' })
    return
  }

  const client = getClient()
  if (!client) {
    res.json({
      content: "I need an API key to work. Add your Anthropic API key to a `.env` file in the video-editor folder:\n\n`ANTHROPIC_API_KEY=your-key-here`\n\nThen restart the server.",
    })
    return
  }

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: message }],
    })

    const textContent = response.content.find(b => b.type === 'text')
    res.json({
      content: textContent?.text ?? 'No response generated.',
    })
  } catch (error: any) {
    console.error('Chat error:', error.message)
    res.json({
      content: `Something went wrong: ${error.message}`,
    })
  }
})

export { router as chatRouter }
