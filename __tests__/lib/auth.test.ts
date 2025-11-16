import { describe, it, expect, beforeEach, jest } from '@jest/globals'

jest.mock('@/lib/prisma', () => jest.requireActual('../../__mocks__/lib/prisma'))
jest.mock('jose', () => ({
  jwtVerify: jest.fn()
}))

const {
  prisma,
  resetPrismaMock
} = jest.requireMock('@/lib/prisma') as {
  prisma: {
    ban: { findUnique: jest.Mock }
  }
  resetPrismaMock: () => void
}
const { jwtVerify } = jest.requireMock('jose') as { jwtVerify: jest.Mock }
const jwtVerifyMock = jwtVerify as jest.Mock

const {
  verifyToken,
  checkBanStatus,
  authenticateRequest
} = require('@/lib/auth') as typeof import('@/lib/auth')

const JWT_SECRET = 'test-secret-key-for-testing-only-32-bytes'
process.env.JWT_SECRET = JWT_SECRET

describe('Auth Module', () => {
  beforeEach(() => {
    resetPrismaMock()
    jwtVerifyMock.mockReset()
  })

  describe('verifyToken', () => {
    it('should verify valid JWT and return user_id', async () => {
      const userId = 'test-user-123'
      jwtVerifyMock.mockResolvedValue({ payload: { sub: userId } })

      const result = await verifyToken('valid-token')
      expect(result).toBe(userId)
      expect(jwtVerifyMock).toHaveBeenCalled()
    })

    it('should throw error for token without sub claim', async () => {
      jwtVerifyMock.mockResolvedValue({ payload: {} })

      await expect(verifyToken('no-sub')).rejects.toThrow('Invalid token: missing sub claim')
    })

    it('should throw error for invalid signature', async () => {
      jwtVerifyMock.mockRejectedValue(new Error('Token verification failed'))

      await expect(verifyToken('bad-signature')).rejects.toThrow('Token verification failed')
    })

    it('should throw error for expired token', async () => {
      jwtVerifyMock.mockRejectedValue(new Error('Token verification failed'))

      await expect(verifyToken('expired-token')).rejects.toThrow('Token verification failed')
    })
  })

  describe('checkBanStatus', () => {
    it('should return true if user is banned', async () => {
      const userId = 'banned-user'

      ;(prisma.ban.findUnique as jest.Mock).mockResolvedValue({
        userId,
        reason: 'Violation of terms',
        createdAt: new Date()
      })

      const result = await checkBanStatus(userId)
      expect(result).toBe(true)
      expect(prisma.ban.findUnique).toHaveBeenCalledWith({
        where: { userId }
      })
    })

    it('should return false if user is not banned', async () => {
      const userId = 'active-user'

      ;(prisma.ban.findUnique as jest.Mock).mockResolvedValue(null)

      const result = await checkBanStatus(userId)
      expect(result).toBe(false)
    })
  })

  describe('authenticateRequest', () => {
    it('should authenticate valid request with Bearer token', async () => {
      const userId = 'test-user-123'
      jwtVerifyMock.mockResolvedValue({ payload: { sub: userId } })

      const headers = new Headers()
      headers.set('Authorization', 'Bearer valid-token')

      ;(prisma.ban.findUnique as jest.Mock).mockResolvedValue(null)

      const result = await authenticateRequest(headers)
      expect(result).toBe(userId)
    })

    it('should throw error for missing Authorization header', async () => {
      const headers = new Headers()

      await expect(authenticateRequest(headers)).rejects.toThrow(
        'Missing or invalid Authorization header'
      )
    })

    it('should throw error for invalid Authorization format', async () => {
      const headers = new Headers()
      headers.set('Authorization', 'Invalid token-format')

      await expect(authenticateRequest(headers)).rejects.toThrow(
        'Missing or invalid Authorization header'
      )
    })

    it('should throw error for banned user', async () => {
      const userId = 'banned-user'
      jwtVerifyMock.mockResolvedValue({ payload: { sub: userId } })

      const headers = new Headers()
      headers.set('Authorization', 'Bearer banned-token')

      ;(prisma.ban.findUnique as jest.Mock).mockResolvedValue({
        userId,
        reason: 'Violation of terms',
        createdAt: new Date()
      })

      await expect(authenticateRequest(headers)).rejects.toThrow('User is banned')
    })
  })
})
