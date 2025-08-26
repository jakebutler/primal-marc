import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import request from 'supertest'
import express from 'express'
import llmRouter from '../../routes/llm.js'
import { llmService } from '../../services/llm.js'
import { promptManager } from '../../services/prompt-manager.js'
import { costEvaluator } from '../../services/cost-evaluator.js'

// Mock dependencies
vi.mock('../../services/llm.js', () => ({
  llmService: {
    generateCompletion: vi.fn(),
    getBudgetStatus: vi.fn(),
    getUserUsageStats: vi.fn(),
    getRemainingRateLimit: vi.fn(),
    healthCheck: vi.fn(),
  },
}))

vi.mock('../../services/prompt-manager.js', () => ({
  promptManager: {
    getTemplatesByAgent: vi.fn(),
    getCostOptimizedTemplates: vi.fn(),
    exportTemplates: vi.fn(),
    getTemplate: vi.fn(),
    renderPrompt: vi.fn(),
    addTemplate: vi.fn(),
    removeTemplate: vi.fn(),
    getRecommendedTemplate: vi.fn(),
    recordPerformance: vi.fn(),
    getPerformanceMetrics: vi.fn(),
    getUsageStatistics: vi.fn(),
  },
}))

vi.mock('../../services/cost-evaluator.js', () => ({
  costEvaluator: {
    evaluateAllTemplates: vi.fn(),
    checkBudgetAlerts: vi.fn(),
    generateOptimizationSuggestions: vi.fn(),
    getCostTrends: vi.fn(),
    generateCostReport: vi.fn(),
  },
}))

vi.mock('../../middleware/auth.js', () => ({
  authenticateToken: (req: any, res: any, next: any) => {
    req.user = { id: 'test-user-123', email: 'test@example.com' }
    next()
  },
}))

vi.mock('../../utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}))

describe('LLM Routes', () => {
  let app: express.Application

  beforeEach(() => {
    vi.clearAllMocks()
    app = express()
    app.use(express.json())
    app.use('/api/llm', llmRouter)
  })

  describe('POST /api/llm/generate', () => {
    const validRequest = {
      agentType: 'IDEATION',
      prompt: 'Generate ideas for a blog post',
      context: 'You are a creative writing assistant',
    }

    const mockResponse = {
      content: 'Here are some blog post ideas...',
      usage: {
        promptTokens: 50,
        completionTokens: 100,
        totalTokens: 150,
        cost: 0.0003,
      },
      model: 'gpt-3.5-turbo',
      requestId: 'llm_123_abc',
    }

    it('should generate completion successfully', async () => {
      vi.mocked(llmService.generateCompletion).mockResolvedValue(mockResponse)

      const response = await request(app)
        .post('/api/llm/generate')
        .send(validRequest)

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data).toEqual(mockResponse)
      expect(llmService.generateCompletion).toHaveBeenCalledWith({
        userId: 'test-user-123',
        ...validRequest,
      })
    })

    it('should validate request data', async () => {
      const invalidRequest = {
        agentType: 'INVALID',
        prompt: '',
      }

      const response = await request(app)
        .post('/api/llm/generate')
        .send(invalidRequest)

      expect(response.status).toBe(400)
      expect(response.body.success).toBe(false)
      expect(response.body.error).toBe('Invalid request data')
      expect(response.body.details).toBeDefined()
    })

    it('should handle LLM service errors', async () => {
      const error = new Error('Budget exceeded') as any
      error.code = 'BUDGET_EXCEEDED'
      error.statusCode = 429
      error.details = { currentSpend: 25, budgetLimit: 20 }

      vi.mocked(llmService.generateCompletion).mockRejectedValue(error)

      const response = await request(app)
        .post('/api/llm/generate')
        .send(validRequest)

      expect(response.status).toBe(429)
      expect(response.body.success).toBe(false)
      expect(response.body.error).toBe('Budget exceeded')
      expect(response.body.code).toBe('BUDGET_EXCEEDED')
      expect(response.body.details).toEqual({ currentSpend: 25, budgetLimit: 20 })
    })

    it('should handle unexpected errors', async () => {
      vi.mocked(llmService.generateCompletion).mockRejectedValue(new Error('Unexpected error'))

      const response = await request(app)
        .post('/api/llm/generate')
        .send(validRequest)

      expect(response.status).toBe(500)
      expect(response.body.success).toBe(false)
      expect(response.body.error).toBe('Internal server error')
    })
  })

  describe('GET /api/llm/budget', () => {
    const mockBudgetStatus = {
      monthlyBudget: 20,
      currentSpend: 15,
      remainingBudget: 5,
      budgetUsedPercent: 75,
      isApproachingLimit: false,
      isOverBudget: false,
      stats: {},
    }

    it('should return budget status', async () => {
      vi.mocked(llmService.getBudgetStatus).mockResolvedValue(mockBudgetStatus)

      const response = await request(app).get('/api/llm/budget')

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data).toEqual(mockBudgetStatus)
      expect(llmService.getBudgetStatus).toHaveBeenCalledWith('test-user-123')
    })

    it('should handle errors', async () => {
      vi.mocked(llmService.getBudgetStatus).mockRejectedValue(new Error('Database error'))

      const response = await request(app).get('/api/llm/budget')

      expect(response.status).toBe(500)
      expect(response.body.success).toBe(false)
      expect(response.body.error).toBe('Failed to get budget status')
    })
  })

  describe('GET /api/llm/usage', () => {
    const mockUsageStats = {
      totalCost: 15,
      totalTokens: 7500,
      requestCount: 50,
      averageCostPerRequest: 0.3,
      costByAgent: { IDEATION: 8, REFINER: 7 },
      costByModel: { 'gpt-3.5-turbo': 15 },
    }

    it('should return usage statistics', async () => {
      vi.mocked(llmService.getUserUsageStats).mockResolvedValue(mockUsageStats)

      const response = await request(app).get('/api/llm/usage')

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data).toEqual(mockUsageStats)
      expect(llmService.getUserUsageStats).toHaveBeenCalledWith('test-user-123', {})
    })

    it('should handle query parameters', async () => {
      vi.mocked(llmService.getUserUsageStats).mockResolvedValue(mockUsageStats)

      const response = await request(app)
        .get('/api/llm/usage')
        .query({
          startDate: '2024-01-01',
          endDate: '2024-01-31',
          agentType: 'IDEATION',
        })

      expect(llmService.getUserUsageStats).toHaveBeenCalledWith('test-user-123', {
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31'),
        agentType: 'IDEATION',
      })
    })
  })

  describe('GET /api/llm/rate-limit', () => {
    it('should return remaining rate limit', async () => {
      vi.mocked(llmService.getRemainingRateLimit).mockReturnValue(8)

      const response = await request(app).get('/api/llm/rate-limit')

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data.remaining).toBe(8)
      expect(llmService.getRemainingRateLimit).toHaveBeenCalledWith('test-user-123')
    })
  })

  describe('GET /api/llm/health', () => {
    const mockHealth = {
      status: 'healthy' as const,
      details: {
        openaiConnected: true,
        promptLayerConfigured: true,
        defaultModel: 'gpt-3.5-turbo',
        budgetLimit: 20,
      },
    }

    it('should return health status', async () => {
      vi.mocked(llmService.healthCheck).mockResolvedValue(mockHealth)

      const response = await request(app).get('/api/llm/health')

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data).toEqual(mockHealth)
    })
  })

  describe('Template Management Routes', () => {
    const mockTemplate = {
      id: 'test-template',
      name: 'Test Template',
      description: 'A test template',
      agentType: 'IDEATION' as const,
      template: 'Test prompt with {{variable}}',
      variables: ['variable'],
      costOptimized: true,
      version: '1.0',
      tags: ['test'],
    }

    describe('GET /api/llm/templates', () => {
      it('should return all templates', async () => {
        const mockTemplates = [mockTemplate]
        vi.mocked(promptManager.exportTemplates).mockReturnValue(mockTemplates)

        const response = await request(app).get('/api/llm/templates')

        expect(response.status).toBe(200)
        expect(response.body.success).toBe(true)
        expect(response.body.data).toEqual(mockTemplates)
      })

      it('should filter by agent type', async () => {
        const mockTemplates = [mockTemplate]
        vi.mocked(promptManager.getTemplatesByAgent).mockReturnValue(mockTemplates)

        const response = await request(app)
          .get('/api/llm/templates')
          .query({ agentType: 'IDEATION' })

        expect(promptManager.getTemplatesByAgent).toHaveBeenCalledWith('IDEATION')
        expect(response.body.data).toEqual(mockTemplates)
      })

      it('should filter cost-optimized templates', async () => {
        const mockTemplates = [mockTemplate]
        vi.mocked(promptManager.getCostOptimizedTemplates).mockReturnValue(mockTemplates)

        const response = await request(app)
          .get('/api/llm/templates')
          .query({ costOptimized: 'true' })

        expect(promptManager.getCostOptimizedTemplates).toHaveBeenCalled()
        expect(response.body.data).toEqual(mockTemplates)
      })
    })

    describe('GET /api/llm/templates/:id', () => {
      it('should return specific template', async () => {
        vi.mocked(promptManager.getTemplate).mockReturnValue(mockTemplate)

        const response = await request(app).get('/api/llm/templates/test-template')

        expect(response.status).toBe(200)
        expect(response.body.success).toBe(true)
        expect(response.body.data).toEqual(mockTemplate)
        expect(promptManager.getTemplate).toHaveBeenCalledWith('test-template')
      })

      it('should return 404 for non-existent template', async () => {
        vi.mocked(promptManager.getTemplate).mockReturnValue(null)

        const response = await request(app).get('/api/llm/templates/non-existent')

        expect(response.status).toBe(404)
        expect(response.body.success).toBe(false)
        expect(response.body.error).toBe('Template not found')
      })
    })

    describe('POST /api/llm/templates/render', () => {
      const renderRequest = {
        templateId: 'test-template',
        context: { variable: 'test value' },
      }

      const mockRendered = {
        prompt: 'Test prompt with test value',
        systemContext: 'You are helpful',
        config: {
          maxTokens: 300,
          temperature: 0.7,
          model: 'gpt-3.5-turbo',
        },
      }

      it('should render template successfully', async () => {
        vi.mocked(promptManager.renderPrompt).mockReturnValue(mockRendered)

        const response = await request(app)
          .post('/api/llm/templates/render')
          .send(renderRequest)

        expect(response.status).toBe(200)
        expect(response.body.success).toBe(true)
        expect(response.body.data).toEqual(mockRendered)
        expect(promptManager.renderPrompt).toHaveBeenCalledWith('test-template', { variable: 'test value' })
      })

      it('should return 404 for failed render', async () => {
        vi.mocked(promptManager.renderPrompt).mockReturnValue(null)

        const response = await request(app)
          .post('/api/llm/templates/render')
          .send(renderRequest)

        expect(response.status).toBe(404)
        expect(response.body.success).toBe(false)
        expect(response.body.error).toBe('Template not found or render failed')
      })

      it('should validate request data', async () => {
        const invalidRequest = {
          templateId: '',
          context: 'invalid',
        }

        const response = await request(app)
          .post('/api/llm/templates/render')
          .send(invalidRequest)

        expect(response.status).toBe(400)
        expect(response.body.success).toBe(false)
        expect(response.body.error).toBe('Invalid request data')
      })
    })

    describe('POST /api/llm/templates', () => {
      it('should add template successfully', async () => {
        const response = await request(app)
          .post('/api/llm/templates')
          .send(mockTemplate)

        expect(response.status).toBe(200)
        expect(response.body.success).toBe(true)
        expect(response.body.message).toBe('Template added successfully')
        expect(promptManager.addTemplate).toHaveBeenCalledWith(mockTemplate)
      })

      it('should validate template data', async () => {
        const invalidTemplate = {
          id: 'test',
          // Missing required fields
        }

        const response = await request(app)
          .post('/api/llm/templates')
          .send(invalidTemplate)

        expect(response.status).toBe(400)
        expect(response.body.success).toBe(false)
        expect(response.body.error).toBe('Invalid template data')
      })
    })

    describe('DELETE /api/llm/templates/:id', () => {
      it('should delete template successfully', async () => {
        vi.mocked(promptManager.removeTemplate).mockReturnValue(true)

        const response = await request(app).delete('/api/llm/templates/test-template')

        expect(response.status).toBe(200)
        expect(response.body.success).toBe(true)
        expect(response.body.message).toBe('Template deleted successfully')
        expect(promptManager.removeTemplate).toHaveBeenCalledWith('test-template')
      })

      it('should return 404 for non-existent template', async () => {
        vi.mocked(promptManager.removeTemplate).mockReturnValue(false)

        const response = await request(app).delete('/api/llm/templates/non-existent')

        expect(response.status).toBe(404)
        expect(response.body.success).toBe(false)
        expect(response.body.error).toBe('Template not found')
      })
    })

    describe('GET /api/llm/templates/recommend/:agentType', () => {
      it('should return recommended template', async () => {
        vi.mocked(promptManager.getRecommendedTemplate).mockReturnValue(mockTemplate)

        const response = await request(app).get('/api/llm/templates/recommend/IDEATION')

        expect(response.status).toBe(200)
        expect(response.body.success).toBe(true)
        expect(response.body.data).toEqual(mockTemplate)
        expect(promptManager.getRecommendedTemplate).toHaveBeenCalledWith('IDEATION', true)
      })

      it('should handle prioritizeCost query parameter', async () => {
        vi.mocked(promptManager.getRecommendedTemplate).mockReturnValue(mockTemplate)

        await request(app)
          .get('/api/llm/templates/recommend/IDEATION')
          .query({ prioritizeCost: 'false' })

        expect(promptManager.getRecommendedTemplate).toHaveBeenCalledWith('IDEATION', false)
      })

      it('should return 404 when no templates found', async () => {
        vi.mocked(promptManager.getRecommendedTemplate).mockReturnValue(null)

        const response = await request(app).get('/api/llm/templates/recommend/IDEATION')

        expect(response.status).toBe(404)
        expect(response.body.success).toBe(false)
        expect(response.body.error).toBe('No templates found for agent type')
      })
    })
  })

  describe('Cost Evaluation Routes', () => {
    describe('GET /api/llm/cost/evaluation', () => {
      const mockEvaluation = {
        evaluations: [],
        summary: {
          totalTemplates: 5,
          excellentCount: 2,
          goodCount: 2,
          fairCount: 1,
          poorCount: 0,
          averageScore: 0.8,
          totalPotentialSavings: 0,
        },
      }

      it('should return cost evaluation', async () => {
        vi.mocked(costEvaluator.evaluateAllTemplates).mockResolvedValue(mockEvaluation)

        const response = await request(app).get('/api/llm/cost/evaluation')

        expect(response.status).toBe(200)
        expect(response.body.success).toBe(true)
        expect(response.body.data).toEqual(mockEvaluation)
      })
    })

    describe('GET /api/llm/cost/alerts', () => {
      const mockAlerts = [
        {
          userId: 'test-user-123',
          alertType: 'warning' as const,
          currentSpend: 16,
          budgetLimit: 20,
          percentUsed: 80,
          projectedMonthlySpend: 25,
          message: 'Warning: 80% of budget used',
          timestamp: new Date(),
        },
      ]

      it('should return budget alerts', async () => {
        vi.mocked(costEvaluator.checkBudgetAlerts).mockResolvedValue(mockAlerts)

        const response = await request(app).get('/api/llm/cost/alerts')

        expect(response.status).toBe(200)
        expect(response.body.success).toBe(true)
        expect(response.body.data).toHaveLength(1)
        expect(response.body.data[0].alertType).toBe('warning')
        expect(response.body.data[0].userId).toBe('test-user-123')
        expect(costEvaluator.checkBudgetAlerts).toHaveBeenCalledWith('test-user-123', 20)
      })

      it('should handle custom budget limit', async () => {
        vi.mocked(costEvaluator.checkBudgetAlerts).mockResolvedValue(mockAlerts)

        await request(app)
          .get('/api/llm/cost/alerts')
          .query({ budgetLimit: '30' })

        expect(costEvaluator.checkBudgetAlerts).toHaveBeenCalledWith('test-user-123', 30)
      })
    })

    describe('GET /api/llm/cost/suggestions', () => {
      const mockSuggestions = [
        {
          type: 'model_downgrade' as const,
          description: 'Consider using GPT-3.5-turbo instead of GPT-4',
          potentialSavings: 5,
          impact: 'high' as const,
          actionRequired: 'Review expensive requests',
        },
      ]

      it('should return optimization suggestions', async () => {
        vi.mocked(costEvaluator.generateOptimizationSuggestions).mockResolvedValue(mockSuggestions)

        const response = await request(app).get('/api/llm/cost/suggestions')

        expect(response.status).toBe(200)
        expect(response.body.success).toBe(true)
        expect(response.body.data).toEqual(mockSuggestions)
        expect(costEvaluator.generateOptimizationSuggestions).toHaveBeenCalledWith('test-user-123')
      })
    })

    describe('GET /api/llm/cost/trends', () => {
      const mockTrends = {
        dailyTrends: [],
        projections: {
          nextWeekCost: 21,
          nextMonthCost: 90,
          yearEndCost: 1095,
        },
        insights: ['Costs increased by 15% in the last week'],
      }

      it('should return cost trends', async () => {
        vi.mocked(costEvaluator.getCostTrends).mockResolvedValue(mockTrends)

        const response = await request(app).get('/api/llm/cost/trends')

        expect(response.status).toBe(200)
        expect(response.body.success).toBe(true)
        expect(response.body.data).toEqual(mockTrends)
        expect(costEvaluator.getCostTrends).toHaveBeenCalledWith('test-user-123', 30)
      })

      it('should handle custom days parameter', async () => {
        vi.mocked(costEvaluator.getCostTrends).mockResolvedValue(mockTrends)

        await request(app)
          .get('/api/llm/cost/trends')
          .query({ days: '7' })

        expect(costEvaluator.getCostTrends).toHaveBeenCalledWith('test-user-123', 7)
      })
    })

    describe('GET /api/llm/cost/report', () => {
      const mockReport = {
        summary: {
          currentMonthSpend: 15,
          budgetRemaining: 5,
          averageCostPerRequest: 0.3,
          mostExpensiveAgent: 'IDEATION',
          leastExpensiveAgent: 'REFINER',
        },
        alerts: [],
        suggestions: [],
        trends: {},
        templateAnalysis: {},
      }

      it('should return comprehensive cost report', async () => {
        vi.mocked(costEvaluator.generateCostReport).mockResolvedValue(mockReport)

        const response = await request(app).get('/api/llm/cost/report')

        expect(response.status).toBe(200)
        expect(response.body.success).toBe(true)
        expect(response.body.data).toEqual(mockReport)
        expect(costEvaluator.generateCostReport).toHaveBeenCalledWith('test-user-123')
      })
    })
  })
})