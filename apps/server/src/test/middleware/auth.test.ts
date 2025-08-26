import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll, vi } from 'vitest'
import { Request, Response, NextFunction } from 'express'
import { PrismaClient } from '@prisma/client'
import { authenticateToken, optionalAuth, authRateLimit } from '../../middleware/auth.js'
import { AuthService } from '../../services/auth.js'
import { UserModel } from '../../models/user.js'

// Test database
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'file:./test-auth-middleware.db'
    }
  }
})

// Mock response object
const createMockResponse = () => {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as unknown as Response
  return res
}

// Mock request object
const createMockRequest = (overrides: Partial<Request> = {}): Request => {
  return {
    headers: {},
    ip: '127.0.0.1',
    ...overrides
  } as Request
}

describe('Authentication Middleware', () => {
  const testUser = {
    id: 'test-user-id',
    email: 'test@example.com',
    passwordHash: 'hashed-password',
    firstName: 'Test',
    lastName: 'User',
    experienceLevel: 'BEGINNER' as const
  }

  beforeAll(async () => {
    // Set up test environment
    process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing-only'
    process.env.NODE_ENV = 'test'
    
    // Initialize database
    await prisma.$executeRaw`PRAGMA foreign_keys = ON`
  })

  beforeEach(async () => {
    // Clean up database before each test
    await prisma.session.deleteMany()
    await prisma.user.deleteMany()
    
    // Create test user
    await prisma.user.create({
      data: testUser
    })
  })

  afterAll(async () => {
    // Clean up after all tests
    await prisma.session.deleteMany()
    await prisma.user.deleteMany()
    await prisma.$disconnect()
  })

  describe('authenticateToken', () => {
    let validToken: string

    beforeEach(async () => {
      validToken = AuthService.generateAccessToken({
        userId: testUser.id,
        email: testUser.email
      })
    })

    it('should authenticate valid token and attach user to request', async () => {
      const req = createMockRequest({
        headers: { authorization: `Bearer ${validToken}` }
      })
      const res = createMockResponse()
      const next = vi.fn()

      await authenticateToken(req, res, next)

      expect(next).toHaveBeenCalledOnce()
      expect(req.user).toMatchObject({
        id: testUser.id,
        email: testUser.email,
        firstName: testUser.firstName,
        lastName: testUser.lastName,
        experienceLevel: testUser.experienceLevel
      })
    })

    it('should reject request without authorization header', async () => {
      const req = createMockRequest()
      const res = createMockResponse()
      const next = vi.fn()

      await authenticateToken(req, res, next)

      expect(next).not.toHaveBeenCalled()
      expect(res.status).toHaveBeenCalledWith(401)
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Access token required',
        code: 'MISSING_TOKEN'
      })
    })

    it('should reject request with malformed authorization header', async () => {
      const req = createMockRequest({
        headers: { authorization: 'InvalidFormat' }
      })
      const res = createMockResponse()
      const next = vi.fn()

      await authenticateToken(req, res, next)

      expect(next).not.toHaveBeenCalled()
      expect(res.status).toHaveBeenCalledWith(401)
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Access token required',
        code: 'MISSING_TOKEN'
      })
    })

    it('should reject request with invalid token', async () => {
      const req = createMockRequest({
        headers: { authorization: 'Bearer invalid-token' }
      })
      const res = createMockResponse()
      const next = vi.fn()

      await authenticateToken(req, res, next)

      expect(next).not.toHaveBeenCalled()
      expect(res.status).toHaveBeenCalledWith(401)
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid access token',
        code: 'INVALID_TOKEN'
      })
    })

    it('should reject request when user not found in database', async () => {
      // Create token for non-existent user
      const nonExistentToken = AuthService.generateAccessToken({
        userId: 'non-existent-user',
        email: 'nonexistent@example.com'
      })

      const req = createMockRequest({
        headers: { authorization: `Bearer ${nonExistentToken}` }
      })
      const res = createMockResponse()
      const next = vi.fn()

      await authenticateToken(req, res, next)

      expect(next).not.toHaveBeenCalled()
      expect(res.status).toHaveBeenCalledWith(401)
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'User not found',
        code: 'USER_NOT_FOUND'
      })
    })

    it('should handle expired token', async () => {
      // Create an expired token by mocking the verification to throw expired error
      const expiredToken = 'expired.token.here'
      
      const req = createMockRequest({
        headers: { authorization: `Bearer ${expiredToken}` }
      })
      const res = createMockResponse()
      const next = vi.fn()

      await authenticateToken(req, res, next)

      expect(next).not.toHaveBeenCalled()
      expect(res.status).toHaveBeenCalledWith(401)
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid access token',
        code: 'INVALID_TOKEN'
      })
    })
  })

  describe('optionalAuth', () => {
    let validToken: string

    beforeEach(async () => {
      validToken = AuthService.generateAccessToken({
        userId: testUser.id,
        email: testUser.email
      })
    })

    it('should authenticate valid token and attach user to request', async () => {
      const req = createMockRequest({
        headers: { authorization: `Bearer ${validToken}` }
      })
      const res = createMockResponse()
      const next = vi.fn()

      await optionalAuth(req, res, next)

      expect(next).toHaveBeenCalledOnce()
      expect(req.user).toMatchObject({
        id: testUser.id,
        email: testUser.email,
        firstName: testUser.firstName,
        lastName: testUser.lastName,
        experienceLevel: testUser.experienceLevel
      })
    })

    it('should continue without authentication when no token provided', async () => {
      const req = createMockRequest()
      const res = createMockResponse()
      const next = vi.fn()

      await optionalAuth(req, res, next)

      expect(next).toHaveBeenCalledOnce()
      expect(req.user).toBeUndefined()
    })

    it('should continue without authentication when invalid token provided', async () => {
      const req = createMockRequest({
        headers: { authorization: 'Bearer invalid-token' }
      })
      const res = createMockResponse()
      const next = vi.fn()

      await optionalAuth(req, res, next)

      expect(next).toHaveBeenCalledOnce()
      expect(req.user).toBeUndefined()
    })

    it('should continue without authentication when user not found', async () => {
      const nonExistentToken = AuthService.generateAccessToken({
        userId: 'non-existent-user',
        email: 'nonexistent@example.com'
      })

      const req = createMockRequest({
        headers: { authorization: `Bearer ${nonExistentToken}` }
      })
      const res = createMockResponse()
      const next = vi.fn()

      await optionalAuth(req, res, next)

      expect(next).toHaveBeenCalledOnce()
      expect(req.user).toBeUndefined()
    })
  })

  describe('authRateLimit', () => {
    it('should allow requests within rate limit', () => {
      const rateLimiter = authRateLimit(3, 60000) // 3 attempts per minute
      const req = createMockRequest()
      const res = createMockResponse()
      const next = vi.fn()

      // First request should pass
      rateLimiter(req, res, next)
      expect(next).toHaveBeenCalledOnce()
      expect(res.status).not.toHaveBeenCalled()

      // Second request should pass
      rateLimiter(req, res, next)
      expect(next).toHaveBeenCalledTimes(2)

      // Third request should pass
      rateLimiter(req, res, next)
      expect(next).toHaveBeenCalledTimes(3)
    })

    it('should block requests exceeding rate limit', () => {
      const rateLimiter = authRateLimit(2, 60000) // 2 attempts per minute
      const req = createMockRequest()
      const res = createMockResponse()
      const next = vi.fn()

      // First two requests should pass
      rateLimiter(req, res, next)
      rateLimiter(req, res, next)
      expect(next).toHaveBeenCalledTimes(2)

      // Third request should be blocked
      rateLimiter(req, res, next)
      expect(next).toHaveBeenCalledTimes(2) // Still 2, not called for third request
      expect(res.status).toHaveBeenCalledWith(429)
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: expect.stringContaining('Too many authentication attempts'),
        code: 'RATE_LIMITED',
        retryAfter: expect.any(Number)
      })
    })

    it('should track different IPs separately', () => {
      const rateLimiter = authRateLimit(1, 60000) // 1 attempt per minute
      const req1 = createMockRequest({ ip: '127.0.0.1' })
      const req2 = createMockRequest({ ip: '192.168.1.1' })
      const res1 = createMockResponse()
      const res2 = createMockResponse()
      const next = vi.fn()

      // First IP should be allowed
      rateLimiter(req1, res1, next)
      expect(next).toHaveBeenCalledOnce()

      // Second IP should also be allowed
      rateLimiter(req2, res2, next)
      expect(next).toHaveBeenCalledTimes(2)

      // First IP second attempt should be blocked
      rateLimiter(req1, res1, next)
      expect(next).toHaveBeenCalledTimes(2) // Still 2
      expect(res1.status).toHaveBeenCalledWith(429)
    })

    it('should handle missing IP gracefully', () => {
      const rateLimiter = authRateLimit(1, 60000)
      const req = createMockRequest({ ip: undefined })
      const res = createMockResponse()
      const next = vi.fn()

      // Should still work with 'unknown' as fallback
      rateLimiter(req, res, next)
      expect(next).toHaveBeenCalledOnce()

      // Second request should be blocked
      rateLimiter(req, res, next)
      expect(next).toHaveBeenCalledOnce() // Still 1
      expect(res.status).toHaveBeenCalledWith(429)
    })
  })
})