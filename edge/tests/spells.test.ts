import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createHmac } from 'node:crypto'
import handler from '../src/worker'

const runQueryMock = vi.fn()
const runQuerySingleMock = vi.fn()
const executeMock = vi.fn()

vi.mock('../src/db', () => ({
  getDatabase: () => ({ execute: executeMock }),
  runQuery: (...args: any[]) => runQueryMock(...args),
  runQuerySingle: (...args: any[]) => runQuerySingleMock(...args),
}))

const envBase: any = {
  DATABASE_URL: 'mysql://user:pass@host/db',
  CORS_ALLOW_ORIGIN: '*',
  SESSION_SECRET: 'test-secret',
}

function makeCookie(payload: Record<string, any>) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const sig = createHmac('sha256', envBase.SESSION_SECRET).update(`${header}.${body}`).digest('base64url')
  return `sid=${header}.${body}.${sig}`
}

describe('spells endpoints', () => {
  beforeEach(() => {
    runQueryMock.mockReset()
    runQuerySingleMock.mockReset()
    executeMock.mockReset()
  })

  it('returns spells from database', async () => {
    runQueryMock.mockResolvedValue([
      {
        id: 1,
        tenant_id: 99,
        spell_key: 'demo.spell',
        version: 'v1',
        name: 'Demo Spell',
        summary: 'demo summary',
        description: 'desc',
        visibility: 'public',
        execution_mode: 'service',
        pricing_json: JSON.stringify({ model: 'flat', currency: 'usd', amount_cents: 1200 }),
        input_schema_json: JSON.stringify({ type: 'object' }),
        repo_ref: null,
        workflow_id: null,
        template_repo: null,
        status: 'published',
        published_at: '2025-01-01T00:00:00Z',
        created_at: '2024-12-01T00:00:00Z',
      },
    ])

    const req = new Request('https://worker.test/api/v1/spells', {
      headers: {
        cookie: makeCookie({ tenant_id: 99, role: 'maker', sub: 'github:1', exp: Date.now() / 1000 + 3600 }),
      },
    })
    const res = await handler.fetch(req, envBase)
    expect(res.status).toBe(200)
    const body = (await res.json()) as { items: any[] }
    expect(body.items.length).toBe(1)
    expect(body.items[0].name).toBe('Demo Spell')
    expect(body.items[0].pricing_json.amount_cents).toBe(1200)
  })

  it('creates a spell', async () => {
    runQuerySingleMock.mockResolvedValueOnce(null).mockResolvedValueOnce({
      id: 101,
      tenant_id: 1,
      spell_key: 'demo.spell',
      version: 'v1',
      name: 'Demo Spell',
      summary: 'summary',
      description: 'desc',
      visibility: 'private',
      execution_mode: 'service',
      pricing_json: JSON.stringify({ flat_cents: 100 }),
      input_schema_json: JSON.stringify({ type: 'object' }),
      repo_ref: null,
      workflow_id: null,
      template_repo: null,
      status: 'draft',
      published_at: null,
      created_at: '2025-01-01T00:00:00Z',
    })
    executeMock.mockResolvedValue({ insertId: 101 })

    const body = {
      spell_key: 'demo.spell',
      name: 'Demo Spell',
      summary: 'summary',
      pricing: { flat_cents: 100 },
      input_schema: { type: 'object' },
    }
    const req = new Request('https://worker.test/api/v1/spells', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        cookie: makeCookie({ tenant_id: 1, role: 'maker', name: 'maker', sub: 'github:1', exp: Date.now() / 1000 + 3600 }),
      },
      body: JSON.stringify(body),
    })

    const res = await handler.fetch(req, envBase)
    expect(res.status).toBe(201)
    expect(executeMock).toHaveBeenCalled()
  })

  it('updates a spell', async () => {
    const existing = {
      id: 201,
      tenant_id: 1,
      spell_key: 'update.spell',
      version: 'v1',
      name: 'Old',
      summary: 'Old summary',
      description: null,
      visibility: 'private',
      execution_mode: 'service',
      pricing_json: JSON.stringify({}),
      input_schema_json: JSON.stringify({}),
      repo_ref: null,
      workflow_id: null,
      template_repo: null,
      status: 'draft',
      published_at: null,
      created_at: '2025-01-01T00:00:00Z',
    }
    runQuerySingleMock.mockResolvedValueOnce(existing).mockResolvedValueOnce({ ...existing, name: 'New Name' })

    const req = new Request('https://worker.test/api/v1/spells/201', {
      method: 'PATCH',
      headers: {
        'content-type': 'application/json',
        cookie: makeCookie({ tenant_id: 1, role: 'operator', name: 'op', sub: 'github:1', exp: Date.now() / 1000 + 3600 }),
      },
      body: JSON.stringify({ name: 'New Name' }),
    })

    const res = await handler.fetch(req, envBase)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.name).toBe('New Name')
    expect(executeMock).toHaveBeenCalled()
  })

  it('publishes a spell', async () => {
    const req = new Request('https://worker.test/api/v1/spells/301:publish', {
      method: 'POST',
      headers: { cookie: makeCookie({ tenant_id: 1, role: 'maker', name: 'maker', sub: 'github:1', exp: Date.now() / 1000 + 3600 }) },
    })

    const res = await handler.fetch(req, envBase)
    expect(res.status).toBe(204)
    expect(executeMock).toHaveBeenCalled()
  })

  it('returns a spell by id', async () => {
    runQuerySingleMock.mockResolvedValueOnce({
      id: 77,
      tenant_id: 1,
      spell_key: 'inspect.spell',
      version: 'v1',
      name: 'Inspect',
      summary: 'inspect summary',
      description: null,
      visibility: 'public',
      execution_mode: 'service',
      pricing_json: JSON.stringify({ flat_cents: 10 }),
      input_schema_json: JSON.stringify({ type: 'object' }),
      repo_ref: null,
      workflow_id: null,
      template_repo: null,
      status: 'published',
      published_at: '2025-01-01T00:00:00Z',
      created_at: '2025-01-01T00:00:00Z',
    })
    const res = await handler.fetch(
      new Request('https://worker.test/api/v1/spells/77', {
        headers: { cookie: makeCookie({ tenant_id: 1, role: 'caster', sub: 'github:1', exp: Date.now() / 1000 + 3600 }) },
      }),
      envBase,
    )
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.name).toBe('Inspect')
  })
})
