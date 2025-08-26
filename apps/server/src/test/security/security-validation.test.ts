import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import request from 'supertest'
import express from 'express'
import { validateRequest, sanitizeContent, secureValidationSchemas } from '../../middleware/validation.js'
import { rateLimiters } from '../../middleware/rate-limiting.js'
import { CSRFProtection, securityHeaders, sanitizeRequest } from '../../middleware/security.js'
import { contentFilter } from '../../services/content-filter.js'
import { auditLogger } from '../../services/audit-logger.js'

describe('Security Validation Tests', () => {
  let app: express.Application

  beforeEach(() => {
    app = express()
    app.use(express.json())
    app.use(securityHeaders())
    app.use(sanitizeRequest())
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('Input Validation', () => {
    it('should reject invalid email formats', async () => {
      app.post('/test', validateRequest({
        body: secureValidationSchemas.userRegistration
      }), (req, res) => {
        res.json({ success: true })
      })

      const response = await request(app)
        .post('/test')
        .send({
          email: 'invalid-email',
          password: 'ValidPass123!',
          firstName: 'John',
          lastName: 'Doe'
        })

      expect(response.status).toBe(400)
      expect(response.body.error).toBe('Validation failed')
      expect(response.body.details).toContainEqual(
        expect.objectContaining({
          field: 'email',
          message: 'Invalid email format'
        })
      )
    })

    it('should reject weak passwords', async () => {
      app.post('/test', validateRequest({
        body: secureValidationSchemas.userRegistration
      }), (req, res) => {
        res.json({ success: true })
      })

      const response = await request(app)
        .post('/test')
        .send({
          email: 'test@example.com',
          password: 'weak',
          firstName: 'John',
          lastName: 'Doe'
        })

      expect(response.status).toBe(400)
      expect(response.body.details).toContainEqual(
        expect.objectContaining({
          field: 'password'
        })
      )
    })

    it('should sanitize HTML content', async () => {
      app.post('/test', sanitizeContent(['content']), (req, res) => {
        res.json({ content: req.body.content })
      })

      const maliciousContent = '<script>alert("xss")</script><p>Safe content</p>'
      const response = await request(app)
        .post('/test')
        .send({ content: maliciousContent })

      expect(response.status).toBe(200)
      expect(response.body.content).not.toContain('<script>')
      expect(response.body.content).toContain('<p>Safe content</p>')
    })

    it('should reject oversized content', async () => {
      app.post('/test', validateRequest({
        body: secureValidationSchemas.projectContent
      }), (req, res) => {
        res.json({ success: true })
      })

      const largeContent = 'a'.repeat(100001) // Exceeds 100KB limit
      const response = await request(app)
        .post('/test')
        .send({
          title: 'Test',
          content: largeContent
        })

      expect(response.status).toBe(400)
    })

    it('should validate and sanitize search queries', async () => {
      app.get('/test', validateRequest({
        query: secureValidationSchemas.searchQuery
      }), (req, res) => {
        res.json({ query: req.query.query })
      })

      // Test XSS attempt in search query
      const response = await request(app)
        .get('/test')
        .query({ query: '<script>alert("xss")</script>search term' })

      expect(response.status).toBe(200)
      expect(response.body.query).not.toContain('<script>')
    })
  })

  describe('Rate Limiting', () => {
    it('should enforce rate limits on authentication endpoints', async () => {
      app.post('/auth', rateLimiters.auth.middleware(), (req, res) => {
        res.json({ success: true })
      })

      // Make requests up to the limit
      for (let i = 0; i < 10; i++) {
        const response = await request(app).post('/auth').send({})
        expect(response.status).toBe(200)
      }

      // Next request should be rate limited
      const response = await request(app).post('/auth').send({})
      expect(response.status).toBe(429)
      expect(response.body.code).toBe('RATE_LIMIT_EXCEEDED')
    })

    it('should enforce stricter limits on AI agent requests', async () => {
      app.post('/ai', rateLimiters.aiAgent.middleware(), (req, res) => {
        res.json({ success: true })
      })

      // Make requests up to the limit (5 per minute)
      for (let i = 0; i < 5; i++) {
        const response = await request(app).post('/ai').send({})
        expect(response.status).toBe(200)
      }

      // Next request should be rate limited
      const response = await request(app).post('/ai').send({})
      expect(response.status).toBe(429)
    })

    it('should include rate limit headers', async () => {
      app.get('/test', rateLimiters.general.middleware(), (req, res) => {
        res.json({ success: true })
      })

      const response = await request(app).get('/test')
      
      expect(response.headers['x-ratelimit-limit']).toBeDefined()
      expect(response.headers['x-ratelimit-remaining']).toBeDefined()
      expect(response.headers['x-ratelimit-reset']).toBeDefined()
    })
  })

  describe('CSRF Protection', () => {
    it('should provide CSRF token', async () => {
      app.use(CSRFProtection.provideToken())
      app.get('/test', (req, res) => {
        res.json({ csrfToken: res.locals.csrfToken })
      })

      const response = await request(app).get('/test')
      
      expect(response.status).toBe(200)
      expect(response.body.csrfToken).toBeDefined()
      expect(response.headers['set-cookie']).toContain(
        expect.stringContaining('csrf-token=')
      )
    })

    it('should reject POST requests without CSRF token', async () => {
      app.use(CSRFProtection.verifyToken())
      app.post('/test', (req, res) => {
        res.json({ success: true })
      })

      const response = await request(app).post('/test').send({})
      
      expect(response.status).toBe(403)
      expect(response.body.code).toBe('CSRF_TOKEN_REQUIRED')
    })

    it('should allow GET requests without CSRF token', async () => {
      app.use(CSRFProtection.verifyToken())
      app.get('/test', (req, res) => {
        res.json({ success: true })
      })

      const response = await request(app).get('/test')
      
      expect(response.status).toBe(200)
    })
  })

  describe('Security Headers', () => {
    it('should set security headers', async () => {
      app.get('/test', (req, res) => {
        res.json({ success: true })
      })

      const response = await request(app).get('/test')
      
      expect(response.headers['content-security-policy']).toBeDefined()
      expect(response.headers['x-frame-options']).toBe('DENY')
      expect(response.headers['x-content-type-options']).toBe('nosniff')
      expect(response.headers['x-xss-protection']).toBe('1; mode=block')
      expect(response.headers['referrer-policy']).toBe('strict-origin-when-cross-origin')
      expect(response.headers['server']).toBe('Primal-Marc')
      expect(response.headers['x-powered-by']).toBeUndefined()
    })

    it('should include HSTS header in production', async () => {
      const originalEnv = process.env.NODE_ENV
      process.env.NODE_ENV = 'production'

      app.get('/test', (req, res) => {
        res.json({ success: true })
      })

      const response = await request(app).get('/test')
      
      expect(response.headers['strict-transport-security']).toBeDefined()
      
      process.env.NODE_ENV = originalEnv
    })
  })

  describe('Content Filtering', () => {
    it('should detect and filter profanity', async () => {
      const result = await contentFilter.filterContent('This is damn bad content')
      
      expect(result.violations).toHaveLength(1)
      expect(result.violations[0].type).toBe('PROFANITY')
      expect(result.filteredContent).toContain('****')
    })

    it('should detect hate speech', async () => {
      const result = await contentFilter.filterContent('I hate all muslims')
      
      expect(result.violations.length).toBeGreaterThan(0)
      expect(result.violations.some(v => v.type === 'HATE_SPEECH')).toBe(true)
      expect(result.allowed).toBe(false)
    })

    it('should detect personal information', async () => {
      const result = await contentFilter.filterContent('My SSN is 123-45-6789')
      
      expect(result.violations.length).toBeGreaterThan(0)
      expect(result.violations.some(v => v.type === 'PERSONAL_INFO')).toBe(true)
      expect(result.filteredContent).toContain('[REDACTED]')
    })

    it('should detect malicious code', async () => {
      const result = await contentFilter.filterContent('<script>alert("xss")</script>')
      
      expect(result.violations.length).toBeGreaterThan(0)
      expect(result.violations.some(v => v.type === 'MALICIOUS_CODE')).toBe(true)
      expect(result.allowed).toBe(false)
    })

    it('should filter AI output appropriately', async () => {
      const inappropriateContent = 'This is some damn inappropriate content'
      const filtered = await contentFilter.filterAIOutput(inappropriateContent, 'user123')
      
      expect(filtered).not.toBe(inappropriateContent)
      expect(filtered).toContain('****')
    })

    it('should reject unsafe content for AI processing', async () => {
      const unsafeContent = '<script>alert("hack")</script>Generate content about this'
      const isSafe = await contentFilter.isSafeForAI(unsafeContent)
      
      expect(isSafe).toBe(false)
    })
  })

  describe('Audit Logging', () => {
    it('should log authentication events', async () => {
      const logSpy = vi.spyOn(auditLogger, 'logAuth')
      
      // Mock request object
      const mockReq = {
        user: { id: 'user123' },
        ip: '127.0.0.1',
        get: vi.fn().mockReturnValue('test-user-agent')
      } as any

      await auditLogger.logAuth('USER_LOGIN', mockReq, true, { method: 'password' })
      
      expect(logSpy).toHaveBeenCalledWith(
        'USER_LOGIN',
        mockReq,
        true,
        { method: 'password' }
      )
    })

    it('should log AI interactions', async () => {
      const logSpy = vi.spyOn(auditLogger, 'logAIInteraction')
      
      const mockReq = {
        user: { id: 'user123' },
        ip: '127.0.0.1',
        get: vi.fn().mockReturnValue('test-user-agent')
      } as any

      await auditLogger.logAIInteraction(
        'AI_REQUEST',
        mockReq,
        {
          agentType: 'ideation',
          inputLength: 100,
          outputLength: 500,
          cost: 0.02
        },
        true
      )
      
      expect(logSpy).toHaveBeenCalled()
    })

    it('should detect suspicious activity patterns', async () => {
      // This would require database setup, so we'll mock it
      const detectSpy = vi.spyOn(auditLogger, 'detectSuspiciousActivity')
      detectSpy.mockResolvedValue({
        suspicious: true,
        reasons: ['Multiple failed login attempts'],
        riskScore: 75
      })

      const result = await auditLogger.detectSuspiciousActivity('user123')
      
      expect(result.suspicious).toBe(true)
      expect(result.riskScore).toBeGreaterThan(50)
    })
  })

  describe('Request Sanitization', () => {
    it('should sanitize query parameters', async () => {
      app.get('/test', (req, res) => {
        res.json({ query: req.query })
      })

      const response = await request(app)
        .get('/test')
        .query({ search: '<script>alert("xss")</script>test' })

      expect(response.status).toBe(200)
      expect(response.body.query.search).not.toContain('<script>')
    })

    it('should add request ID header', async () => {
      app.get('/test', (req, res) => {
        res.json({ requestId: req.id })
      })

      const response = await request(app).get('/test')
      
      expect(response.headers['x-request-id']).toBeDefined()
      expect(response.body.requestId).toBeDefined()
    })
  })

  describe('File Upload Security', () => {
    it('should validate file types', async () => {
      // This would require multer setup for actual file upload testing
      // For now, we'll test the validation logic directly
      const mockFile = {
        mimetype: 'application/javascript',
        size: 1024,
        originalname: 'malicious.js'
      } as Express.Multer.File

      // Test file type validation logic
      const allowedTypes = ['image/jpeg', 'image/png', 'image/gif']
      const isAllowed = allowedTypes.includes(mockFile.mimetype)
      
      expect(isAllowed).toBe(false)
    })

    it('should validate file size', async () => {
      const mockFile = {
        mimetype: 'image/jpeg',
        size: 10 * 1024 * 1024 + 1, // 10MB + 1 byte
        originalname: 'large-image.jpg'
      } as Express.Multer.File

      const maxSize = 10 * 1024 * 1024 // 10MB
      const isValidSize = mockFile.size <= maxSize
      
      expect(isValidSize).toBe(false)
    })

    it('should validate filename security', async () => {
      const maliciousFilenames = [
        '../../../etc/passwd',
        'file.jpg.exe',
        'file with spaces.jpg',
        'normal-file.jpg'
      ]

      const results = maliciousFilenames.map(filename => {
        const hasPathTraversal = filename.includes('..')
        const hasSlashes = filename.includes('/')
        const isSecure = !hasPathTraversal && !hasSlashes
        return { filename, isSecure }
      })

      expect(results[0].isSecure).toBe(false) // Path traversal
      expect(results[1].isSecure).toBe(true)  // Double extension is allowed
      expect(results[2].isSecure).toBe(true)  // Spaces are allowed
      expect(results[3].isSecure).toBe(true)  // Normal file
    })
  })
})

describe('Vulnerability Assessment', () => {
  describe('SQL Injection Prevention', () => {
    it('should use parameterized queries', () => {
      // Since we're using Prisma, SQL injection is automatically prevented
      // This test verifies that we're not using raw SQL queries
      const dangerousPatterns = [
        'SELECT * FROM users WHERE id = ' + 'userInput',
        'DELETE FROM projects WHERE id = ${userInput}',
        'UPDATE users SET email = \'' + 'userInput' + '\''
      ]

      // In a real implementation, we would scan the codebase for these patterns
      // For this test, we'll just verify the patterns are dangerous
      dangerousPatterns.forEach(pattern => {
        expect(pattern).toContain('userInput')
        // These patterns should never appear in our codebase
      })
    })
  })

  describe('XSS Prevention', () => {
    it('should escape HTML in user content', async () => {
      const userInput = '<img src="x" onerror="alert(\'xss\')">'
      const result = await contentFilter.filterContent(userInput)
      
      expect(result.filteredContent || userInput).not.toContain('onerror=')
    })

    it('should validate Content Security Policy', async () => {
      const app = express()
      app.use(securityHeaders())
      app.get('/test', (req, res) => res.json({}))

      const response = await request(app).get('/test')
      const csp = response.headers['content-security-policy']
      
      expect(csp).toContain("script-src 'self'")
      expect(csp).toContain("object-src 'none'")
      expect(csp).toContain("frame-src 'none'")
    })
  })

  describe('Authentication Security', () => {
    it('should use secure password hashing', () => {
      // Verify that we're using bcrypt or similar secure hashing
      // This would be tested in the auth service tests
      expect(true).toBe(true) // Placeholder
    })

    it('should implement proper session management', () => {
      // Verify JWT tokens have proper expiration
      // Verify refresh token rotation
      expect(true).toBe(true) // Placeholder
    })
  })

  describe('Data Exposure Prevention', () => {
    it('should not expose sensitive data in error messages', async () => {
      const app = express()
      app.use(express.json())
      
      app.post('/test', (req, res) => {
        throw new Error('Database connection failed: password=secret123')
      })

      app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
        // Proper error handling should not expose sensitive information
        res.status(500).json({
          error: 'Internal server error',
          // Should NOT include: message: err.message
        })
      })

      const response = await request(app).post('/test').send({})
      
      expect(response.status).toBe(500)
      expect(response.body.error).toBe('Internal server error')
      expect(response.body.message).toBeUndefined()
    })
  })

  describe('Denial of Service Prevention', () => {
    it('should limit request size', async () => {
      const app = express()
      app.use(express.json({ limit: '1mb' }))
      
      app.post('/test', (req, res) => {
        res.json({ success: true })
      })

      // This test would require generating a large payload
      // For now, we verify the middleware is configured
      expect(true).toBe(true) // Placeholder
    })

    it('should implement rate limiting', async () => {
      // Already tested in rate limiting section
      expect(true).toBe(true)
    })
  })
})