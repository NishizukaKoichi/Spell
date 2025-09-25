import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createHmac } from 'node:crypto'
import handler from '../src/worker'

const runQueryMock = vi.fn()

vi.mock('../src/db', () => ({
  getDatabase: vi.fn(),
  runQuery: (...args: any[]) => runQueryMock(...args),
  runQuerySingle: vi.fn(),
}))

const kvStore = new Map<string, string>()

const envBase: any = {
  DATABASE_URL: 'mysql://user:pass@host/db',
  CORS_ALLOW_ORIGIN: '*',
  SESSION_SECRET: 'test-secret',
  JWT_ISSUER: 'https://test',
  JWT_AUDIENCE: 'https://test',
  KV: {
    async get(key: string) {
      return kvStore.get(key) ?? null
    },
    async put(key: string, value: string) {
      kvStore.set(key, value)
    },
    async delete(key: string) {
      kvStore.delete(key)
    },
    async list() {
      return { keys: [], list_complete: true }
    },
  },
}

function makeCookie(payload: Record<string, any>) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const sig = createHmac('sha256', envBase.SESSION_SECRET).update(`${header}.${body}`).digest('base64url')
  return `sid=${header}.${body}.${sig}`
}

describe('GET /api/v1/billing/ledger', () => {
  beforeEach(() => {
    runQueryMock.mockReset()
    kvStore.clear()
  })

  it('returns ledger entries for tenant', async () => {
    runQueryMock.mockResolvedValue([
      {
        id: 1,
        cast_id: 10,
        kind: 'charge',
        amount_cents: 500,
        currency: 'JPY',
        occurred_at: '2024-01-01T00:00:00Z',
        reason: 'usage',
      },
    ])
    const req = new Request('https://worker.test/api/v1/billing/ledger', {
      headers: { cookie: makeCookie({ tenant_id: 42, role: 'caster', exp: Date.now() / 1000 + 3600 }) },
    })
    const res = await handler.fetch(req, envBase)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.items.length).toBe(1)
    expect(json.items[0].kind).toBe('charge')
  })

  it('returns empty when not authenticated', async () => {
    const res = await handler.fetch(new Request('https://worker.test/api/v1/billing/ledger'), envBase)
    expect(res.status).toBe(401)
  })
})

describe('POST /api/v1/billing/caps', () => {
  beforeEach(() => {
    kvStore.clear()
  })

  it('stores monthly and total caps for tenant', async () => {
    const req = new Request('https://worker.test/api/v1/billing/caps', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        cookie: makeCookie({ tenant_id: 42, role: 'operator', exp: Date.now() / 1000 + 3600 }),
      },
      body: JSON.stringify({ monthly_cents: 5000, total_cents: 20000 }),
    })
    const res = await handler.fetch(req, envBase)
    expect(res.status).toBe(204)
    const stored = kvStore.get('cap:tenant_cap:42')
    expect(stored).toBeTruthy()
    const parsed = JSON.parse(stored as string)
    expect(parsed.monthly_cents).toBe(5000)
    expect(parsed.total_cents).toBe(20000)
  })

  it('deletes cap entry when no values provided', async () => {
    kvStore.set('cap:tenant_cap:42', JSON.stringify({ monthly_cents: 1000, total_cents: 5000 }))
    const req = new Request('https://worker.test/api/v1/billing/caps', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        cookie: makeCookie({ tenant_id: 42, role: 'caster', exp: Date.now() / 1000 + 3600 }),
      },
      body: JSON.stringify({}),
    })
    const res = await handler.fetch(req, envBase)
    expect(res.status).toBe(204)
    expect(kvStore.has('cap:tenant_cap:42')).toBe(false)
  })

  it('reads cap settings for tenant', async () => {
    kvStore.set('cap:tenant_cap:42', JSON.stringify({ monthly_cents: 500, total_cents: 1000 }))
    const req = new Request('https://worker.test/api/v1/billing/caps', {
      headers: {
        cookie: makeCookie({ tenant_id: 42, role: 'caster', exp: Date.now() / 1000 + 3600 }),
      },
    })
    const res = await handler.fetch(req, envBase)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.monthly_cents).toBe(500)
    expect(json.total_cents).toBe(1000)
  })
})
