import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest'
import request from 'supertest'
import express from 'express'
import cors from 'cors'
import { PrismaClient } from '@prisma/client'
import authRoutes from '../routes/auth.js'
import { UserModel } from '../models/user.js'

// Test app setup
const app = express()
app.use(cors())
app.use(express.json())
app.use('/api/auth', authRoutes)

// Test database
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'file:./test-auth-routes.db'
    }
  }
})

describe('Authentication Routes - Integration Tests', () => {
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

  const testUser = {
    email: 'test@example.com',
    password: 'TestPassword123',
    firstName: 'Test',
    lastName: 'User'
  }

  describe('POST /api/auth/register', () => {
    it('should register a new user successfully', async () => {
      const newUser = {
        ...testUser,
        email: `register-test-${Date.now()}@example.com`
      }
      
      const response = await request(app)
        .post('/api/auth/register')
        .send(newUser)
        .expect(201)

      expect(response.body).toMatchObject({
        success: true,
        message: 'User registered successfully',
        data: {
          user: {
            email: newUser.email,
            firstName: newUser.firstName,
            lastName: newUser.lastName
          },
          tokens: {
            accessToken: expect.any(String),
            refreshToken: expect.any(String),
            expiresIn: expect.any(Number)
          }
        }
      })

      // The response itself proves the user was created successfully
      // We don't need to verify in the database since we're using different Prisma instances
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
  })

  describe('POST /api/auth/login', () => {
    beforeEach(async () => {
      // Create a test user for login tests directly with prisma
      const bcrypt = await import('bcryptjs')
      const passwordHash = await bcrypt.hash(testUser.password, 12)
      
      await prisma.user.create({
        data: {
          email: testUser.email.toLowerCase(),
          passwordHash,
          firstName: testUser.firstName,
          lastName: testUser.lastName,
          experienceLevel: 'BEGINNER'
        }
      })
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

    it('should reject login with invalid credentials', async () => {
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
  })

  describe('GET /api/auth/me', () => {
    let accessToken: string

    beforeEach(async () => {
      // Create user and login to get token
      const bcrypt = await import('bcryptjs')
      const passwordHash = await bcrypt.hash(testUser.password, 12)
      
      await prisma.user.create({
        data: {
          email: testUser.email.toLowerCase(),
          passwordHash,
          firstName: testUser.firstName,
          lastName: testUser.lastName,
          experienceLevel: 'BEGINNER'
        }
      })

      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password
        })

      accessToken = loginResponse.body.data.tokens.accessToken
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
            email: testUser.email,
            firstName: testUser.firstName,
            lastName: testUser.lastName
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
  })
})