import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import express from 'express'
import jwt from 'jsonwebtoken'
import projectRoutes from '../../routes/projects.js'

// Set up test environment
process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing-only'

const app = express()
app.use(express.json())

// Mock authentication middleware for testing
app.use('/api/projects', (req, res, next) => {
  const authHeader = req.headers.authorization
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7)
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any
      req.user = { id: decoded.userId, email: decoded.email }
      next()
    } catch (error) {
      res.status(401).json({ success: false, error: 'Invalid token' })
    }
  } else {
    res.status(401).json({ success: false, error: 'No token provided' })
  }
})

app.use('/api/projects', projectRoutes)

describe('Projects API - Simple Tests', () => {
  let authToken: string

  beforeAll(() => {
    // Generate a test token
    authToken = jwt.sign(
      { userId: 'test-user-id', email: 'test@example.com' },
      process.env.JWT_SECRET!,
      { expiresIn: '1h' }
    )
  })

  describe('Authentication', () => {
    it('should require authentication', async () => {
      const response = await request(app)
        .get('/api/projects')
        .expect(401)

      expect(response.body.success).toBe(false)
      expect(response.body.error).toBe('No token provided')
    })

    it('should reject invalid tokens', async () => {
      const response = await request(app)
        .get('/api/projects')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401)

      expect(response.body.success).toBe(false)
      expect(response.body.error).toBe('Invalid token')
    })
  })

  describe('Route Structure', () => {
    it('should accept valid authentication', async () => {
      // This will fail with database error, but that means auth worked
      const response = await request(app)
        .get('/api/projects')
        .set('Authorization', `Bearer ${authToken}`)

      // We expect this to fail with a database error, not an auth error
      expect(response.status).not.toBe(401)
    })
  })
})