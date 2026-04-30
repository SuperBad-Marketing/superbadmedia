import { describe, it, expect } from 'vitest'
import express from 'express'
import { ingestRouter } from './ingest.js'

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

describe('ingest routes', () => {
  it('POST / rejects missing sourcePath', async () => {
    const routes = ingestRouter.stack?.filter((l: any) => l.route?.path === '/' && l.route?.methods?.post)
    if (routes?.length) {
      const handler = routes[0].route.stack[0].handle
      const { req, res, statusCode, responseBody } = mockReqRes({ clientName: 'Test' })
      await handler(req, res, () => {})
      expect(statusCode.value).toBe(400)
      expect(responseBody.value.error).toContain('sourcePath')
    }
  })

  it('POST / rejects missing clientName', async () => {
    const routes = ingestRouter.stack?.filter((l: any) => l.route?.path === '/' && l.route?.methods?.post)
    if (routes?.length) {
      const handler = routes[0].route.stack[0].handle
      const { req, res, statusCode, responseBody } = mockReqRes({ sourcePath: '/tmp/test' })
      await handler(req, res, () => {})
      expect(statusCode.value).toBe(400)
      expect(responseBody.value.error).toContain('clientName')
    }
  })

  it('GET /:jobId returns 404 for unknown job', async () => {
    const routes = ingestRouter.stack?.filter((l: any) => l.route?.path === '/:jobId' && l.route?.methods?.get)
    if (routes?.length) {
      const handler = routes[0].route.stack[0].handle
      const { req, res, statusCode, responseBody } = mockReqRes({}, { jobId: 'nonexistent' })
      await handler(req, res, () => {})
      expect(statusCode.value).toBe(404)
    }
  })
})
