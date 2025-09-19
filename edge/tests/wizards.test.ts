import { describe, it, expect, beforeEach, vi } from 'vitest'
import handler from '../src/worker'

const runQueryMock = vi.fn()

vi.mock('../src/db', () => ({
  getDatabase: vi.fn(),
  runQuery: (...args: any[]) => runQueryMock(...args),
  runQuerySingle: vi.fn(),
}))

describe('GET /api/v1/wizards', () => {
  const envBase: any = { DATABASE_URL: 'mysql://user:pass@host/db', CORS_ALLOW_ORIGIN: '*' }

  beforeEach(() => {
    runQueryMock.mockReset()
  })

  it('returns wizard list from database', async () => {
    runQueryMock.mockResolvedValue([
      {
        id: 1,
        name: 'DevTeam',
        avatar: 'https://example.com/avatar.png',
        bio: 'Great team',
        github_username: 'devteam',
        published_spells: 12,
        total_executions: 5400,
        success_rate: 0.98,
        joined_at: '2024-01-01T00:00:00Z',
      },
    ])

    const res = await handler.fetch(new Request('https://worker.test/api/v1/wizards'), envBase)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.items.length).toBe(1)
    expect(body.items[0].name).toBe('DevTeam')
  })

  it('returns empty list when database unavailable', async () => {
    const res = await handler.fetch(new Request('https://worker.test/api/v1/wizards'), { ...envBase, DATABASE_URL: undefined })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.items).toEqual([])
  })
})
