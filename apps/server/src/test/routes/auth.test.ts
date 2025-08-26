import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import express from 'express'
import cors from 'cors'
import { PrismaClient } from '@prisma/client'
import authRoutes from '../../routes/auth.js'
import { AuthService } from '../../services/auth.js'

// Test app setup
const app = express()
app.use(cors())
app.use(express.json())
app.use('/api/auth', authRoutes)

// Test database
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'file:./test-auth.db'
    }
  }
})

// Test data
const testUser = {
  email: 'test@example.com',
  password: 'TestPassword123',
  firstName: 'Test',
  lastName: 'User',
  experienceLevel: 'BEGINNER' as const
}

const testUser2 = {
  email: 'test2@example.com',
  password: 'TestPassword456',
  firstName: 'Test2',
  lastName: 'User2'
}

describe('Authentication Routes', () => {
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
  })

  afterAll(async () => {
    // Clean up after all tests
    await prisma.session.deleteMany()
    await prisma.user.deleteMany()
    await prisma.$disconnect()
  })

  describe('POST /api/auth/register', () => {
    it('should register a new user successfully', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send(testUser)
        .expect(201)

      expect(response.body).toMatchObject({
        success: true,
        message: 'User registered successfully',
        data: {
          user: {
            email: testUser.email,
            firstName: testUser.firstName,
            lastName: testUser.lastName,
            experienceLevel: testUser.experienceLevel
          },
          tokens: {
            accessToken: expect.any(String),
            refreshToken: expect.any(String),
            expiresIn: expect.any(Number)
          }
        }
      })

      // Verify user was created in database
      const user = await prisma.user.findUnique({
        where: { email: testUser.email }
      })
      expect(user).toBeTruthy()
      expect(user?.email).toBe(testUser.email)
    })

    it('should reject registration with invalid email', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          ...testUser,
          email: 'invalid-email'
        })
        .expect(400)

      expect(response.body).toMatchObject({
        success: false,
        error: 'Validation failed',
        code: 'VALIDATION_ERROR'
      })
    })

    it('should reject registration with weak password', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          ...testUser,
          password: 'weak'
        })
        .expect(400)

      expect(response.body).toMatchObject({
        success: false,
        error: 'Validation failed',
        code: 'VALIDATION_ERROR'
      })
    })

    it('should reject registration with duplicate email', async () => {
      // First registration
      await request(app)
        .post('/api/auth/register')
        .send(testUser)
        .expect(201)

      // Second registration with same email
      const response = await request(app)
        .post('/api/auth/register')
        .send(testUser)
        .expect(409)

      expect(response.body).toMatchObject({
        success: false,
        error: 'User with this email already exists',
        code: 'USER_EXISTS'
      })
    })
  })

  describe('POST /api/auth/login', () => {
    beforeEach(async () => {
      // Create a test user for login tests
      await request(app)
        .post('/api/auth/register')
        .send(testUser)
    })

    it('should login successfully with valid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password
        })
        .expect(200)

      expect(response.body).toMatchObject({
        success: true,
        message: 'Login successful',
        data: {
          user: {
            email: testUser.email,
            firstName: testUser.firstName,
            lastName: testUser.lastName
          },
          tokens: {
            accessToken: expect.any(String),
            refreshToken: expect.any(String),
            expiresIn: expect.any(Number)
          }
        }
      })
    })

    it('should reject login with invalid email', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: testUser.password
        })
        .expect(401)

      expect(response.body).toMatchObject({
        success: false,
        error: 'Invalid email or password',
        code: 'INVALID_CREDENTIALS'
      })
    })

    it('should reject login with invalid password', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: 'wrongpassword'
        })
        .expect(401)

      expect(response.body).toMatchObject({
        success: false,
        error: 'Invalid email or password',
        code: 'INVALID_CREDENTIALS'
      })
    })

    it('should reject login with malformed email', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'invalid-email',
          password: testUser.password
        })
        .expect(400)

      expect(response.body).toMatchObject({
        success: false,
        error: 'Validation failed',
        code: 'VALIDATION_ERROR'
      })
    })
  })

  describe('POST /api/auth/refresh', () => {
    let refreshToken: string

    beforeEach(async () => {
      // Register and login to get refresh token
      const loginResponse = await request(app)
        .post('/api/auth/register')
        .send(testUser)

      refreshToken = loginResponse.body.data.tokens.refreshToken
    })

    it('should refresh access token successfully', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken })
        .expect(200)

      expect(response.body).toMatchObject({
        success: true,
        message: 'Token refreshed successfully',
        data: {
          tokens: {
            accessToken: expect.any(String),
            refreshToken: expect.any(String),
            expiresIn: expect.any(Number)
          }
        }
      })
    })

    it('should reject refresh with invalid token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: 'invalid-token' })
        .expect(401)

      expect(response.body).toMatchObject({
        success: false,
        code: 'INVALID_REFRESH_TOKEN'
      })
    })

    it('should reject refresh with missing token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({})
        .expect(400)

      expect(response.body).toMatchObject({
        success: false,
        error: 'Validation failed',
        code: 'VALIDATION_ERROR'
      })
    })
  })

  describe('POST /api/auth/logout', () => {
    let refreshToken: string

    beforeEach(async () => {
      const loginResponse = await request(app)
        .post('/api/auth/register')
        .send(testUser)

      refreshToken = loginResponse.body.data.tokens.refreshToken
    })

    it('should logout successfully', async () => {
      const response = await request(app)
        .post('/api/auth/logout')
        .send({ refreshToken })
        .expect(200)

      expect(response.body).toMatchObject({
        success: true,
        message: 'Logged out successfully'
      })

      // Verify token is revoked
      const refreshResponse = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken })
        .expect(401)
    })

    it('should handle logout with invalid token gracefully', async () => {
      const response = await request(app)
        .post('/api/auth/logout')
        .send({ refreshToken: 'invalid-token' })
        .expect(200)

      expect(response.body).toMatchObject({
        success: true,
        message: 'Logged out successfully'
      })
    })
  })

  describe('GET /api/auth/me', () => {
    let accessToken: string
    let userId: string

    beforeEach(async () => {
      const loginResponse = await request(app)
        .post('/api/auth/register')
        .send(testUser)

      accessToken = loginResponse.body.data.tokens.accessToken
      userId = loginResponse.body.data.user.id
    })

    it('should return user profile for authenticated user', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)

      expect(response.body).toMatchObject({
        success: true,
        data: {
          user: {
            id: userId,
            email: testUser.email,
            firstName: testUser.firstName,
            lastName: testUser.lastName,
            experienceLevel: testUser.experienceLevel
          }
        }
      })
    })

    it('should reject request without token', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .expect(401)

      expect(response.body).toMatchObject({
        success: false,
        error: 'Access token required',
        code: 'MISSING_TOKEN'
      })
    })

    it('should reject request with invalid token', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401)

      expect(response.body).toMatchObject({
        success: false,
        code: 'INVALID_TOKEN'
      })
    })
  })

  describe('POST /api/auth/logout-all', () => {
    let accessToken: string
    let refreshToken1: string
    let refreshToken2: string

    beforeEach(async () => {
      // Create user and get first session
      const loginResponse1 = await request(app)
        .post('/api/auth/register')
        .send(testUser)

      accessToken = loginResponse1.body.data.tokens.accessToken
      refreshToken1 = loginResponse1.body.data.tokens.refreshToken

      // Create second session
      const loginResponse2 = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password
        })

      refreshToken2 = loginResponse2.body.data.tokens.refreshToken
    })

    it('should logout from all devices', async () => {
      const response = await request(app)
        .post('/api/auth/logout-all')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)

      expect(response.body).toMatchObject({
        success: true,
        message: 'Logged out from all devices successfully'
      })

      // Verify both refresh tokens are revoked
      await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: refreshToken1 })
        .expect(401)

      await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: refreshToken2 })
        .expect(401)
    })

    it('should require authentication', async () => {
      const response = await request(app)
        .post('/api/auth/logout-all')
        .expect(401)

      expect(response.body).toMatchObject({
        success: false,
        error: 'Access token required',
        code: 'MISSING_TOKEN'
      })
    })
  })

  describe('Authentication Middleware', () => {
    let accessToken: string

    beforeEach(async () => {
      const loginResponse = await request(app)
        .post('/api/auth/register')
        .send(testUser)

      accessToken = loginResponse.body.data.tokens.accessToken
    })

    it('should authenticate valid token', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)

      expect(response.body.success).toBe(true)
    })

    it('should reject expired token', async () => {
      // Create a token that expires immediately
      const expiredToken = AuthService.generateAccessToken({
        userId: 'test-user-id',
        email: 'test@example.com'
      })

      // Wait a moment to ensure expiration
      await new Promise(resolve => setTimeout(resolve, 100))

      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${expiredToken}`)
        .expect(401)

      expect(response.body).toMatchObject({
        success: false,
        code: 'INVALID_TOKEN'
      })
    })

    it('should reject malformed token', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer malformed.token.here')
        .expect(401)

      expect(response.body).toMatchObject({
        success: false,
        code: 'INVALID_TOKEN'
      })
    })

    it('should reject missing Bearer prefix', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', accessToken)
        .expect(401)

      expect(response.body).toMatchObject({
        success: false,
        error: 'Access token required',
        code: 'MISSING_TOKEN'
      })
    })
  })

  describe('Rate Limiting', () => {
    it('should rate limit registration attempts', async () => {
      // Make 3 failed registration attempts (rate limit is 3 for registration)
      for (let i = 0; i < 3; i++) {
        await request(app)
          .post('/api/auth/register')
          .send({
            email: 'invalid-email',
            password: 'weak'
          })
          .expect(400)
      }

      // 4th attempt should be rate limited
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'test@example.com',
          password: 'ValidPassword123'
        })
        .expect(429)

      expect(response.body).toMatchObject({
        success: false,
        code: 'RATE_LIMITED'
      })
    })

    it('should rate limit login attempts', async () => {
      // Create a user first
      await request(app)
        .post('/api/auth/register')
        .send(testUser)

      // Make 5 failed login attempts (rate limit is 5 for login)
      for (let i = 0; i < 5; i++) {
        await request(app)
          .post('/api/auth/login')
          .send({
            email: testUser.email,
            password: 'wrongpassword'
          })
          .expect(401)
      }

      // 6th attempt should be rate limited
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password
        })
        .expect(429)

      expect(response.body).toMatchObject({
        success: false,
        code: 'RATE_LIMITED'
      })
    })
  })
})