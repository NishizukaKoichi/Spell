import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals'
import { NextRequest } from 'next/server'

jest.mock('@/lib/auth-shared', () => {
  const actual = jest.requireActual('@/lib/auth-shared')
  return {
    ...actual,
    verifyJwt: jest.fn()
  }
})

const { verifyJwt, InvalidTokenError } = jest.requireMock('@/lib/auth-shared') as typeof import('@/lib/auth-shared')

const { middleware } = require('@/middleware') as typeof import('@/middleware')

const originalFetch = global.fetch

function createRequest(headers: HeadersInit = {}, path = '/api/me') {
  return new NextRequest(new URL(`http://localhost${path}`), {
    headers: new Headers(headers)
  })
}

describe('Auth middleware', () => {
  beforeEach(() => {
    ;(verifyJwt as jest.Mock).mockReset()
  })

  afterEach(() => {
    global.fetch = originalFetch
  })

  it('allows request when token is valid and user is not banned', async () => {
    ;(verifyJwt as jest.Mock).mockResolvedValue('user-123')

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ banned: false })
    }) as unknown as typeof fetch

    const response = await middleware(
      createRequest({
        Authorization: 'Bearer good-token'
      })
    )

    expect(response?.status).toBe(200)
    expect(global.fetch).toHaveBeenCalledWith(
      expect.any(URL),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ userId: 'user-123' })
      })
    )
  })

  it('rejects requests without Authorization header', async () => {
    const response = await middleware(createRequest({}))
    const body = await response?.json()

    expect(response?.status).toBe(401)
    expect(body).toMatchObject({
      code: 'AUTH_MISSING_HEADER'
    })
  })

  it('rejects invalid tokens', async () => {
    ;(verifyJwt as jest.Mock).mockRejectedValue(new InvalidTokenError())

    const response = await middleware(
      createRequest({
        Authorization: 'Bearer invalid-token'
      })
    )

    expect(response?.status).toBe(401)
    const body = await response?.json()
    expect(body).toMatchObject({
      code: 'AUTH_INVALID_TOKEN'
    })
  })

  it('rejects banned users', async () => {
    ;(verifyJwt as jest.Mock).mockResolvedValue('user-banned')

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ banned: true })
    }) as unknown as typeof fetch

    const response = await middleware(
      createRequest({
        Authorization: 'Bearer banned-token'
      })
    )

    expect(response?.status).toBe(403)
    const body = await response?.json()
    expect(body).toMatchObject({
      code: 'AUTH_BANNED'
    })
  })

  it('returns 500 when ban check fails', async () => {
    ;(verifyJwt as jest.Mock).mockResolvedValue('user-500')

    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      json: async () => ({})
    }) as unknown as typeof fetch

    const response = await middleware(
      createRequest({
        Authorization: 'Bearer token'
      })
    )

    expect(response?.status).toBe(500)
    const body = await response?.json()
    expect(body).toMatchObject({
      code: 'AUTH_INTERNAL_ERROR'
    })
  })
})
