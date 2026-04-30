import { describe, it, expect, afterEach } from 'vitest'
import express from 'express'
import fs from 'fs'
import path from 'path'
import { skillsRouter } from './skills.js'

const SKILLS_DIR = path.join(process.cwd(), 'skills')

function mockReqRes(body: any = {}, params: any = {}) {
  const req = { body, params } as unknown as express.Request
  const statusCode = { value: 200 }
  const responseBody = { value: null as any }
  const res = {
    status(code: number) { statusCode.value = code; return this },
    json(body: any) { responseBody.value = body },
  } as unknown as express.Response
  return { req, res, statusCode, responseBody }
}

describe('skills routes', () => {
  afterEach(() => {
    const files = fs.readdirSync(SKILLS_DIR).filter(f => f.endsWith('.json'))
    for (const file of files) {
      try {
        const content = JSON.parse(fs.readFileSync(path.join(SKILLS_DIR, file), 'utf-8'))
        if (content.name?.startsWith('[TEST]')) {
          fs.unlinkSync(path.join(SKILLS_DIR, file))
        }
      } catch { /* skip */ }
    }
  })

  it('GET / returns skills array', async () => {
    const routes = skillsRouter.stack?.filter((l: any) => l.route?.path === '/' && l.route?.methods?.get)
    if (routes?.length) {
      const handler = routes[0].route.stack[0].handle
      const { req, res, responseBody } = mockReqRes()
      await handler(req, res, () => {})
      expect(Array.isArray(responseBody.value)).toBe(true)
    }
  })

  it('POST /learn rejects missing url and content', async () => {
    const routes = skillsRouter.stack?.filter((l: any) => l.route?.path === '/learn' && l.route?.methods?.post)
    if (routes?.length) {
      const handler = routes[0].route.stack[0].handle
      const { req, res, statusCode, responseBody } = mockReqRes({})
      await handler(req, res, () => {})
      expect(statusCode.value).toBe(400)
      expect(responseBody.value.error).toBeDefined()
    }
  })

  it('POST /learn creates manual skill', async () => {
    const routes = skillsRouter.stack?.filter((l: any) => l.route?.path === '/learn' && l.route?.methods?.post)
    if (routes?.length) {
      const handler = routes[0].route.stack[0].handle
      const { req, res, responseBody } = mockReqRes({ name: '[TEST] Manual Skill', content: '- Test topic' })
      await handler(req, res, () => {})
      expect(responseBody.value.name).toBe('[TEST] Manual Skill')
      expect(responseBody.value.source).toBe('manual')
    }
  })

  it('DELETE /:id succeeds for any ID', async () => {
    const routes = skillsRouter.stack?.filter((l: any) => l.route?.path === '/:id' && l.route?.methods?.delete)
    if (routes?.length) {
      const handler = routes[0].route.stack[0].handle
      const { req, res, responseBody } = mockReqRes({}, { id: 'nonexistent' })
      await handler(req, res, () => {})
      expect(responseBody.value.success).toBe(true)
    }
  })

  it('POST /find-resources rejects missing topic', async () => {
    const routes = skillsRouter.stack?.filter((l: any) => l.route?.path === '/find-resources' && l.route?.methods?.post)
    if (routes?.length) {
      const handler = routes[0].route.stack[0].handle
      const { req, res, statusCode, responseBody } = mockReqRes({})
      await handler(req, res, () => {})
      expect(statusCode.value).toBe(400)
    }
  })
})
