import { describe, it, expect, beforeAll } from 'vitest'
import { AuthService } from '../services/auth.js'

describe('Authentication System - Basic Tests', () => {
  beforeAll(() => {
    // Set up test environment
    process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing-only'
    process.env.NODE_ENV = 'test'
  })

  describe('JWT Token Generation and Verification', () => {
    it('should generate and verify a valid JWT access token', () => {
      const payload = { userId: 'test-user-id', email: 'test@example.com' }
      
      // Generate token
      const token = AuthService.generateAccessToken(payload)
      expect(token).toBeTruthy()
      expect(typeof token).toBe('string')
      
      // Verify token
      const decoded = AuthService.verifyAccessToken(token)
      expect(decoded.userId).toBe(payload.userId)
      expect(decoded.email).toBe(payload.email)
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

    it('should throw error when JWT_SECRET is missing', () => {
      const originalSecret = process.env.JWT_SECRET
      delete process.env.JWT_SECRET

      expect(() => {
        AuthService.generateAccessToken({ userId: 'test', email: 'test@example.com' })
      }).toThrow('Token generation failed')

      process.env.JWT_SECRET = originalSecret
    })
  })

  describe('Session Management', () => {
    it('should clean up expired sessions without error', async () => {
      // This should not throw even if no sessions exist
      await expect(AuthService.cleanupExpiredSessions()).resolves.not.toThrow()
    })
  })
})