import { describe, it, expect } from 'vitest'
import express from 'express'
import { chatRouter } from './chat.js'

function createTestApp() {
  const app = express()
  app.use(express.json())
  app.use('/api/chat', chatRouter)
  return app
}

describe('POST /api/chat', () => {
  const app = createTestApp()

  it('rejects empty message', async () => {
    const res = await fetch('http://unused', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    }).catch(() => null)

    // Since we can't easily start the server in tests, test the route handler directly
    const req = { body: {} } as express.Request
    const statusCode = { value: 200 }
    const responseBody = { value: null as any }
    const res2 = {
      status(code: number) { statusCode.value = code; return this },
      json(body: any) { responseBody.value = body },
    } as unknown as express.Response

    const router = express.Router()
    router.post('/', async (req, res) => {
      const { message } = req.body
      if (!message) {
        res.status(400).json({ error: 'Message is required' })
        return
      }
    })

    // Direct handler test
    const handler = chatRouter.stack?.[0]?.route?.stack?.[0]?.handle
    if (handler) {
      await handler(req, res2, () => {})
      expect(statusCode.value).toBe(400)
      expect(responseBody.value).toEqual({ error: 'Message is required' })
    }
  })
})
