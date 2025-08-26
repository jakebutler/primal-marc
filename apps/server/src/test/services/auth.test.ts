import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from 'vitest'
import { PrismaClient } from '@prisma/client'
import { AuthService } from '../../services/auth.js'
import jwt from 'jsonwebtoken'

// Test database
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'file:./test-auth-service.db'
    }
  }
})

describe('AuthService', () => {
  const testUserId = 'test-user-id'
  const testEmail = 'test@example.com'

  beforeAll(async () => {
    // Set up test environment
    process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing-only'
    process.env.NODE_ENV = 'test'
    
    // Initialize database and create schema
    await prisma.$executeRaw`PRAGMA foreign_keys = ON`
    
    // Create test database schema
    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        passwordHash TEXT NOT NULL,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        firstName TEXT,
        lastName TEXT,
        bio TEXT,
        preferences TEXT,
        writingGenres TEXT,
        experienceLevel TEXT DEFAULT 'BEGINNER'
      )
    `
    
    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        userId TEXT NOT NULL,
        refreshToken TEXT UNIQUE NOT NULL,
        expiresAt DATETIME NOT NULL,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        lastUsedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
      )
    `
    
    await prisma.$executeRaw`
      CREATE INDEX IF NOT EXISTS idx_sessions_userId ON sessions(userId)
    `
    
    await prisma.$executeRaw`
      CREATE INDEX IF NOT EXISTS idx_sessions_expiresAt ON sessions(expiresAt)
    `
  }))

  beforeEach(async () => {
    // Clean up database before each test
    await prisma.session.deleteMany()
    await prisma.user.deleteMany()
    
    // Create test user
    await prisma.user.create({
      data: {
        id: testUserId,
        email: testEmail,
        passwordHash: 'hashed-password',
        experienceLevel: 'BEGINNER'
      }
    })
  })

  afterAll(async () => {
    // Clean up after all tests
    await prisma.session.deleteMany()
    await prisma.user.deleteMany()
    await prisma.$disconnect()
  })

  describe('generateAccessToken', () => {
    it('should generate a valid JWT access token', () => {
      const payload = { userId: testUserId, email: testEmail }
      const token = AuthService.generateAccessToken(payload)

      expect(token).toBeTruthy()
      expect(typeof token).toBe('string')

      // Verify token structure
      const decoded = jwt.decode(token) as any
      expect(decoded.userId).toBe(testUserId)
      expect(decoded.email).toBe(testEmail)
      expect(decoded.iss).toBe('primal-marc')
      expect(decoded.aud).toBe('primal-marc-client')
    })

    it('should throw error when JWT_SECRET is missing', () => {
      const originalSecret = process.env.JWT_SECRET
      delete process.env.JWT_SECRET

      expect(() => {
        AuthService.generateAccessToken({ userId: testUserId, email: testEmail })
      }).toThrow('JWT_SECRET environment variable is required')

      process.env.JWT_SECRET = originalSecret
    })
  })

  describe('verifyAccessToken', () => {
    it('should verify a valid access token', () => {
      const payload = { userId: testUserId, email: testEmail }
      const token = AuthService.generateAccessToken(payload)

      const decoded = AuthService.verifyAccessToken(token)

      expect(decoded.userId).toBe(testUserId)
      expect(decoded.email).toBe(testEmail)
    })

    it('should throw error for invalid token', () => {
      expect(() => {
        AuthService.verifyAccessToken('invalid-token')
      }).toThrow('Invalid access token')
    })

    it('should throw error for malformed token', () => {
      expect(() => {
        AuthService.verifyAccessToken('malformed.token.here')
      }).toThrow('Invalid access token')
    })

    it('should throw error for token with wrong issuer', () => {
      const token = jwt.sign(
        { userId: testUserId, email: testEmail },
        process.env.JWT_SECRET!,
        { issuer: 'wrong-issuer' }
      )

      expect(() => {
        AuthService.verifyAccessToken(token)
      }).toThrow('Invalid access token')
    })
  })

  describe('generateRefreshToken', () => {
    it('should generate and store a refresh token', async () => {
      const refreshToken = await AuthService.generateRefreshToken(testUserId)

      expect(refreshToken).toBeTruthy()
      expect(typeof refreshToken).toBe('string')
      expect(refreshToken.length).toBe(128) // 64 bytes in hex = 128 characters

      // Verify token is stored in database
      const session = await prisma.session.findUnique({
        where: { refreshToken }
      })

      expect(session).toBeTruthy()
      expect(session?.userId).toBe(testUserId)
      expect(session?.expiresAt).toBeInstanceOf(Date)
      expect(session?.expiresAt.getTime()).toBeGreaterThan(Date.now())
    })

    it('should clean up old sessions when generating new token', async () => {
      // Create 5 existing sessions
      for (let i = 0; i < 5; i++) {
        await AuthService.generateRefreshToken(testUserId)
      }

      // Verify we have 5 sessions
      let sessions = await prisma.session.findMany({
        where: { userId: testUserId }
      })
      expect(sessions.length).toBe(5)

      // Generate one more token
      await AuthService.generateRefreshToken(testUserId)

      // Should still have only 5 sessions (oldest one deleted)
      sessions = await prisma.session.findMany({
        where: { userId: testUserId }
      })
      expect(sessions.length).toBe(5)
    })
  })

  describe('generateTokens', () => {
    it('should generate both access and refresh tokens', async () => {
      const tokens = await AuthService.generateTokens(testUserId, testEmail)

      expect(tokens).toMatchObject({
        accessToken: expect.any(String),
        refreshToken: expect.any(String),
        expiresIn: 15 * 60 // 15 minutes
      })

      // Verify access token is valid
      const decoded = AuthService.verifyAccessToken(tokens.accessToken)
      expect(decoded.userId).toBe(testUserId)
      expect(decoded.email).toBe(testEmail)

      // Verify refresh token is stored
      const session = await prisma.session.findUnique({
        where: { refreshToken: tokens.refreshToken }
      })
      expect(session).toBeTruthy()
    })
  })

  describe('verifyRefreshToken', () => {
    let refreshToken: string

    beforeEach(async () => {
      refreshToken = await AuthService.generateRefreshToken(testUserId)
    })

    it('should verify a valid refresh token', async () => {
      const user = await AuthService.verifyRefreshToken(refreshToken)

      expect(user.id).toBe(testUserId)
      expect(user.email).toBe(testEmail)

      // Verify lastUsedAt was updated
      const session = await prisma.session.findUnique({
        where: { refreshToken }
      })
      expect(session?.lastUsedAt).toBeInstanceOf(Date)
    })

    it('should throw error for invalid refresh token', async () => {
      await expect(
        AuthService.verifyRefreshToken('invalid-token')
      ).rejects.toThrow('Invalid refresh token')
    })

    it('should throw error and clean up expired refresh token', async () => {
      // Create expired session
      await prisma.session.updateMany({
        where: { refreshToken },
        data: { expiresAt: new Date(Date.now() - 1000) } // 1 second ago
      })

      await expect(
        AuthService.verifyRefreshToken(refreshToken)
      ).rejects.toThrow('Refresh token expired')

      // Verify session was deleted
      const session = await prisma.session.findUnique({
        where: { refreshToken }
      })
      expect(session).toBeNull()
    })
  })

  describe('refreshAccessToken', () => {
    let refreshToken: string

    beforeEach(async () => {
      refreshToken = await AuthService.generateRefreshToken(testUserId)
    })

    it('should refresh access token successfully', async () => {
      const tokens = await AuthService.refreshAccessToken(refreshToken)

      expect(tokens).toMatchObject({
        accessToken: expect.any(String),
        refreshToken: expect.any(String),
        expiresIn: 15 * 60
      })

      // Verify new access token is valid
      const decoded = AuthService.verifyAccessToken(tokens.accessToken)
      expect(decoded.userId).toBe(testUserId)
      expect(decoded.email).toBe(testEmail)

      // Verify new refresh token is different and valid
      expect(tokens.refreshToken).not.toBe(refreshToken)
      const user = await AuthService.verifyRefreshToken(tokens.refreshToken)
      expect(user.id).toBe(testUserId)
    })

    it('should throw error for invalid refresh token', async () => {
      await expect(
        AuthService.refreshAccessToken('invalid-token')
      ).rejects.toThrow('Invalid refresh token')
    })
  })

  describe('revokeRefreshToken', () => {
    let refreshToken: string

    beforeEach(async () => {
      refreshToken = await AuthService.generateRefreshToken(testUserId)
    })

    it('should revoke refresh token successfully', async () => {
      await AuthService.revokeRefreshToken(refreshToken)

      // Verify token is deleted from database
      const session = await prisma.session.findUnique({
        where: { refreshToken }
      })
      expect(session).toBeNull()
    })

    it('should not throw error for non-existent token', async () => {
      await expect(
        AuthService.revokeRefreshToken('non-existent-token')
      ).resolves.not.toThrow()
    })
  })

  describe('revokeAllUserTokens', () => {
    beforeEach(async () => {
      // Create multiple sessions for the user
      await AuthService.generateRefreshToken(testUserId)
      await AuthService.generateRefreshToken(testUserId)
      await AuthService.generateRefreshToken(testUserId)
    })

    it('should revoke all user tokens', async () => {
      // Verify we have sessions
      let sessions = await prisma.session.findMany({
        where: { userId: testUserId }
      })
      expect(sessions.length).toBeGreaterThan(0)

      await AuthService.revokeAllUserTokens(testUserId)

      // Verify all sessions are deleted
      sessions = await prisma.session.findMany({
        where: { userId: testUserId }
      })
      expect(sessions.length).toBe(0)
    })

    it('should not affect other users sessions', async () => {
      const otherUserId = 'other-user-id'
      
      // Create other user
      await prisma.user.create({
        data: {
          id: otherUserId,
          email: 'other@example.com',
          passwordHash: 'hashed-password',
          experienceLevel: 'BEGINNER'
        }
      })

      // Create session for other user
      await AuthService.generateRefreshToken(otherUserId)

      await AuthService.revokeAllUserTokens(testUserId)

      // Verify other user's session still exists
      const otherUserSessions = await prisma.session.findMany({
        where: { userId: otherUserId }
      })
      expect(otherUserSessions.length).toBe(1)
    })
  })

  describe('cleanupExpiredSessions', () => {
    it('should clean up expired sessions', async () => {
      // Create some sessions
      const token1 = await AuthService.generateRefreshToken(testUserId)
      const token2 = await AuthService.generateRefreshToken(testUserId)

      // Expire one session
      await prisma.session.updateMany({
        where: { refreshToken: token1 },
        data: { expiresAt: new Date(Date.now() - 1000) }
      })

      await AuthService.cleanupExpiredSessions()

      // Verify expired session is deleted
      const expiredSession = await prisma.session.findUnique({
        where: { refreshToken: token1 }
      })
      expect(expiredSession).toBeNull()

      // Verify valid session still exists
      const validSession = await prisma.session.findUnique({
        where: { refreshToken: token2 }
      })
      expect(validSession).toBeTruthy()
    })

    it('should not fail when no expired sessions exist', async () => {
      await expect(
        AuthService.cleanupExpiredSessions()
      ).resolves.not.toThrow()
    })
  })
})