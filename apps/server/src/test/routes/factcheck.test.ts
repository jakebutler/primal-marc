import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import request from 'supertest'
import express from 'express'
import factcheckRouter from '../../routes/factcheck.js'
import { authenticateToken } from '../../middleware/auth.js'

// Mock the auth middleware
vi.mock('../../middleware/auth.js', () => ({
  authenticateToken: vi.fn((req, res, next) => {
    req.user = { id: 'test-user-id' }
    next()
  })
}))

// Mock fetch for external API calls
global.fetch = vi.fn()

// Mock LLM service
vi.mock('../../services/llm.js', () => ({
  LLMService: vi.fn().mockImplementation(() => ({
    generateCompletion: vi.fn().mockResolvedValue({
      content: 'Test fact-check response',
      usage: {
        promptTokens: 100,
        completionTokens: 50,
        totalTokens: 150,
        cost: 0.001
      },
      model: 'gpt-3.5-turbo'
    }),
    healthCheck: vi.fn().mockResolvedValue({ status: 'healthy' })
  }))
}))

describe('Fact-check API Routes', () => {
  let app: express.Application

  beforeEach(() => {
    app = express()
    app.use(express.json())
    app.use('/api/factcheck', factcheckRouter)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('POST /api/factcheck', () => {
    it('should process fact-check request successfully', async () => {
      const requestBody = {
        content: 'The Earth is approximately 4.5 billion years old.',
        projectId: 'test-project',
        conversationId: 'test-conversation',
        context: {
          previousPhases: [],
          userPreferences: {
            preferredAgentPersonality: 'formal',
            writingGenres: ['scientific'],
            experienceLevel: 'INTERMEDIATE'
          }
        }
      }

      // Mock search results
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          AbstractText: 'Earth formed approximately 4.54 billion years ago.',
          Heading: 'Age of Earth',
          AbstractURL: 'https://en.wikipedia.org/wiki/Age_of_the_Earth',
          AbstractSource: 'Wikipedia'
        })
      } as any)

      const response = await request(app)
        .post('/api/factcheck')
        .send(requestBody)
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.data).toBeDefined()
      expect(response.body.data.content).toBeDefined()
      expect(response.body.data.suggestions).toBeDefined()
      expect(response.body.data.metadata).toBeDefined()
    })

    it('should return 400 for missing required fields', async () => {
      const requestBody = {
        content: 'Test content'
        // Missing projectId and conversationId
      }

      const response = await request(app)
        .post('/api/factcheck')
        .send(requestBody)
        .expect(400)

      expect(response.body.success).toBe(false)
      expect(response.body.error).toContain('Missing required fields')
    })

    it('should handle processing errors gracefully', async () => {
      const requestBody = {
        content: 'Test content',
        projectId: 'test-project',
        conversationId: 'test-conversation'
      }

      // Mock fetch failure to trigger error handling
      vi.mocked(fetch).mockRejectedValue(new Error('Network error'))

      const response = await request(app)
        .post('/api/factcheck')
        .send(requestBody)
        .expect(200) // Should still return 200 with fallback response

      expect(response.body.success).toBe(true)
      expect(response.body.data.content).toBeDefined()
    })
  })

  describe('GET /api/factcheck/health', () => {
    it('should return health status', async () => {
      const response = await request(app)
        .get('/api/factcheck/health')
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.data).toBeDefined()
      expect(response.body.data.healthy).toBeDefined()
      expect(response.body.data.metrics).toBeDefined()
      expect(response.body.data.capabilities).toBeDefined()
    })
  })

  describe('GET /api/factcheck/capabilities', () => {
    it('should return agent capabilities', async () => {
      const response = await request(app)
        .get('/api/factcheck/capabilities')
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.data).toBeDefined()
      expect(response.body.data.canHandlePhase).toBe('FACTCHECKER')
      expect(response.body.data.canProcessContent).toEqual(['text', 'markdown', 'html', 'url'])
      expect(response.body.data.supportedLanguages).toBeDefined()
      expect(response.body.data.maxContextLength).toBeDefined()
      expect(response.body.data.estimatedCostPerRequest).toBeDefined()
    })
  })
})