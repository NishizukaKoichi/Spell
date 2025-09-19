import { describe, it, expect, beforeEach } from 'vitest'
import handler from '../src/worker'
import { createHmac } from 'node:crypto'

const envBase: any = {
  SESSION_SECRET: 'test-secret',
  CORS_ALLOW_ORIGIN: '*',
  JWT_ISSUER: 'https://test',
  JWT_AUDIENCE: 'https://test',
}

function makeJwt(claims: Record<string, any>) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')
  const payload = Buffer.from(JSON.stringify(claims)).toString('base64url')
  const signature = createHmac('sha256', envBase.SESSION_SECRET!).update(`${header}.${payload}`).digest('base64url')
  return `${header}.${payload}.${signature}`
}

describe('session endpoints', () => {
  beforeEach(() => {
    envBase.CORS_ALLOW_ORIGIN = '*'
  })

  it('returns 401 when no session cookie present', async () => {
    const req = new Request('https://worker.test/api/session')
    const res = await handler.fetch(req, envBase)
    expect(res.status).toBe(401)
  })

  it('returns user info when valid session cookie provided', async () => {
    const jwt = makeJwt({ sub: 'github:1', name: 'tester', exp: Math.floor(Date.now() / 1000) + 60 })
    const req = new Request('https://worker.test/api/session', { headers: { cookie: `sid=${jwt}` } })
    const res = await handler.fetch(req, envBase)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.user).toMatchObject({ sub: 'github:1', name: 'tester' })
  })

  it('clears cookie on logout', async () => {
    const req = new Request('https://worker.test/api/logout', { method: 'POST' })
    const res = await handler.fetch(req, envBase)
    expect(res.status).toBe(200)
    expect(res.headers.get('set-cookie')).toContain('Max-Age=0')
  })
})
