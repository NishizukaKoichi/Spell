import { describe, it, expect, beforeEach, jest } from '@jest/globals'
import { SignJWT } from 'jose'
import { verifyToken, checkBanStatus, authenticateRequest } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// Mock Prisma
jest.mock('@/lib/prisma', () => ({
  prisma: {
    ban: {
      findUnique: jest.fn()
    },
    user: {
      findUnique: jest.fn(),
      create: jest.fn()
    }
  }
}))

const JWT_SECRET = 'test-secret-key-for-testing-only-32-bytes'
process.env.JWT_SECRET = JWT_SECRET

describe('Auth Module', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('verifyToken', () => {
    it('should verify valid JWT and return user_id', async () => {
      const userId = 'test-user-123'
      const secret = new TextEncoder().encode(JWT_SECRET)

      const token = await new SignJWT({ sub: userId })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('2h')
        .sign(secret)

      const result = await verifyToken(token)
      expect(result).toBe(userId)
    })

    it('should throw error for token without sub claim', async () => {
      const secret = new TextEncoder().encode(JWT_SECRET)

      const token = await new SignJWT({})
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('2h')
        .sign(secret)

      await expect(verifyToken(token)).rejects.toThrow('Invalid token: missing sub claim')
    })

    it('should throw error for invalid signature', async () => {
      const wrongSecret = new TextEncoder().encode('wrong-secret')

      const token = await new SignJWT({ sub: 'test-user' })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('2h')
        .sign(wrongSecret)

      await expect(verifyToken(token)).rejects.toThrow('Token verification failed')
    })

    it('should throw error for expired token', async () => {
      const secret = new TextEncoder().encode(JWT_SECRET)

      const token = await new SignJWT({ sub: 'test-user' })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('-1h') // Expired 1 hour ago
        .sign(secret)

      await expect(verifyToken(token)).rejects.toThrow('Token verification failed')
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
      const secret = new TextEncoder().encode(JWT_SECRET)

      const token = await new SignJWT({ sub: userId })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('2h')
        .sign(secret)

      const headers = new Headers()
      headers.set('Authorization', `Bearer ${token}`)

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
      const secret = new TextEncoder().encode(JWT_SECRET)

      const token = await new SignJWT({ sub: userId })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('2h')
        .sign(secret)

      const headers = new Headers()
      headers.set('Authorization', `Bearer ${token}`)

      ;(prisma.ban.findUnique as jest.Mock).mockResolvedValue({
        userId,
        reason: 'Violation of terms',
        createdAt: new Date()
      })

      await expect(authenticateRequest(headers)).rejects.toThrow('User is banned')
    })
  })
})
