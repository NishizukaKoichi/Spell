import { describe, it, expect, beforeEach, vi } from 'vitest'
import handler from '../src/worker'

const runQueryMock = vi.fn()

vi.mock('../src/db', () => ({
  getDatabase: vi.fn(),
  runQuery: (...args: any[]) => runQueryMock(...args),
  runQuerySingle: vi.fn(),
}))

describe('GET /api/v1/spells', () => {
  const envBase: any = {
    DATABASE_URL: 'mysql://user:pass@host/db',
    CORS_ALLOW_ORIGIN: '*',
  }

  beforeEach(() => {
    runQueryMock.mockReset()
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

    const req = new Request('https://worker.test/api/v1/spells')
    const res = await handler.fetch(req, envBase)
    expect(res.status).toBe(200)
    const body = (await res.json()) as { items: any[] }
    expect(body.items.length).toBe(1)
    expect(body.items[0].name).toBe('Demo Spell')
    expect(body.items[0].pricing_json.amount_cents).toBe(1200)
  })

  it('returns empty list when database unavailable', async () => {
    const env = { ...envBase, DATABASE_URL: undefined }
    const req = new Request('https://worker.test/api/v1/spells')
    const res = await handler.fetch(req, env as any)
    expect(res.status).toBe(200)
    const body = (await res.json()) as { items: any[] }
    expect(body.items).toEqual([])
  })
})
