import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createHmac } from 'node:crypto'
import handler from '../src/worker'

const runQueryMock = vi.fn()

vi.mock('../src/db', () => ({
  getDatabase: vi.fn(),
  runQuery: (...args: any[]) => runQueryMock(...args),
  runQuerySingle: vi.fn(),
}))

const envBase: any = {
  DATABASE_URL: 'mysql://user:pass@host/db',
  CORS_ALLOW_ORIGIN: '*',
  SESSION_SECRET: 'test-secret',
  JWT_ISSUER: 'https://test',
  JWT_AUDIENCE: 'https://test',
}

function makeCookie(payload: Record<string, any>) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const sig = createHmac('sha256', envBase.SESSION_SECRET).update(`${header}.${body}`).digest('base64url')
  return `sid=${header}.${body}.${sig}`
}

describe('GET /api/v1/casts', () => {
  beforeEach(() => {
    runQueryMock.mockReset()
  })

  it('returns casts for tenant', async () => {
    runQueryMock.mockResolvedValue([
      {
        id: 1,
        spell_id: 2,
        run_id: 'run_1',
        status: 'succeeded',
        estimate_cents: 120,
        cost_cents: 100,
        created_at: '2024-01-01T00:00:00Z',
        finished_at: '2024-01-01T00:02:00Z',
        spell_name: 'Demo Spell',
      },
    ])
    const req = new Request('https://worker.test/api/v1/casts', {
      headers: { cookie: makeCookie({ tenant_id: 99, role: 'caster', exp: Date.now() / 1000 + 3600 }) },
    })
    const res = await handler.fetch(req, envBase)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.items.length).toBe(1)
    expect(json.items[0].spell_name).toBe('Demo Spell')
  })

  it('returns empty when not authenticated', async () => {
    const req = new Request('https://worker.test/api/v1/casts')
    const res = await handler.fetch(req, envBase)
    expect(res.status).toBe(401)
  })
})
