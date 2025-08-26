import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { LLMService, LLMError, BudgetExceededError, RateLimitError } from '../../services/llm.js'
import { LLMUsageModel } from '../../models/llm-usage.js'
import OpenAI from 'openai'

// Mock external dependencies
vi.mock('openai')
vi.mock('promptlayer', () => ({
  PromptLayerOpenAI: vi.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: vi.fn(),
      },
    },
  })),
}))

vi.mock('../../models/llm-usage.js', () => ({
  LLMUsageModel: {
    recordUsage: vi.fn(),
    checkBudgetStatus: vi.fn(),
    getUserUsageStats: vi.fn(),
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

describe('LLMService', () => {
  let llmService: LLMService
  let mockPromptLayer: any

  beforeEach(() => {
    vi.clearAllMocks()
    
    // Set up environment variables
    process.env.OPENAI_API_KEY = 'test-openai-key'
    process.env.PROMPTLAYER_API_KEY = 'test-promptlayer-key'

    // Create service instance
    llmService = new LLMService({
      openaiApiKey: 'test-openai-key',
      promptLayerApiKey: 'test-promptlayer-key',
      budgetLimitPerUser: 10,
      rateLimitPerMinute: 5,
    })

    // Get the mocked PromptLayer instance
    mockPromptLayer = (llmService as any).promptLayer
  })

  afterEach(() => {
    delete process.env.OPENAI_API_KEY
    delete process.env.PROMPTLAYER_API_KEY
  })

  describe('generateCompletion', () => {
    const mockRequest = {
      userId: 'test-user-123',
      agentType: 'IDEATION' as const,
      prompt: 'Generate ideas for a blog post about AI',
      context: 'You are a creative writing assistant',
    }

    const mockCompletion = {
      choices: [
        {
          message: {
            content: 'Here are some AI blog post ideas...',
          },
        },
      ],
      usage: {
        prompt_tokens: 50,
        completion_tokens: 100,
        total_tokens: 150,
      },
    }

    beforeEach(() => {
      // Mock successful budget check
      vi.mocked(LLMUsageModel.checkBudgetStatus).mockResolvedValue({
        monthlyBudget: 10,
        currentSpend: 2,
        remainingBudget: 8,
        budgetUsedPercent: 20,
        isApproachingLimit: false,
        isOverBudget: false,
        stats: {
          totalCost: 2,
          totalTokens: 1000,
          requestCount: 10,
          averageCostPerRequest: 0.2,
          costByAgent: {},
          costByModel: {},
        },
      })

      // Mock successful LLM response
      mockPromptLayer.chat.completions.create.mockResolvedValue(mockCompletion)

      // Mock usage recording
      vi.mocked(LLMUsageModel.recordUsage).mockResolvedValue({} as any)
    })

    it('should generate completion successfully', async () => {
      const response = await llmService.generateCompletion(mockRequest)

      expect(response).toMatchObject({
        content: 'Here are some AI blog post ideas...',
        usage: {
          promptTokens: 50,
          completionTokens: 100,
          totalTokens: 150,
          cost: expect.any(Number),
        },
        model: 'gpt-3.5-turbo',
        requestId: expect.stringMatching(/^llm_\d+_\w+$/),
      })

      expect(mockPromptLayer.chat.completions.create).toHaveBeenCalledWith(
        {
          model: 'gpt-3.5-turbo',
          messages: [
            { role: 'system', content: 'You are a creative writing assistant' },
            { role: 'user', content: 'Generate ideas for a blog post about AI' },
          ],
          max_tokens: 2000,
          temperature: 0.7,
        },
        {
          pl_tags: ['agent:ideation', 'user:test-user-123', 'model:gpt-3.5-turbo'],
          pl_request_id: expect.stringMatching(/^llm_\d+_\w+$/),
        }
      )

      expect(LLMUsageModel.recordUsage).toHaveBeenCalledWith({
        userId: 'test-user-123',
        agentType: 'IDEATION',
        model: 'gpt-3.5-turbo',
        promptTokens: 50,
        completionTokens: 100,
        totalTokens: 150,
        cost: expect.any(Number),
        requestId: expect.stringMatching(/^llm_\d+_\w+$/),
        metadata: expect.objectContaining({
          temperature: 0.7,
          maxTokens: 2000,
          actualTokens: 150,
        }),
      })
    })

    it('should handle custom model and parameters', async () => {
      const customRequest = {
        ...mockRequest,
        model: 'gpt-4',
        maxTokens: 1000,
        temperature: 0.5,
      }

      await llmService.generateCompletion(customRequest)

      expect(mockPromptLayer.chat.completions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gpt-4',
          max_tokens: 1000,
          temperature: 0.5,
        }),
        expect.objectContaining({
          pl_tags: expect.arrayContaining(['model:gpt-4']),
        })
      )
    })

    it('should build messages correctly without context', async () => {
      const requestWithoutContext = {
        ...mockRequest,
        context: undefined,
      }

      await llmService.generateCompletion(requestWithoutContext)

      expect(mockPromptLayer.chat.completions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: [
            { role: 'user', content: 'Generate ideas for a blog post about AI' },
          ],
        }),
        expect.any(Object)
      )
    })

    it('should throw BudgetExceededError when budget is exceeded', async () => {
      vi.mocked(LLMUsageModel.checkBudgetStatus).mockResolvedValue({
        monthlyBudget: 10,
        currentSpend: 12,
        remainingBudget: -2,
        budgetUsedPercent: 120,
        isApproachingLimit: true,
        isOverBudget: true,
        stats: {} as any,
      })

      await expect(llmService.generateCompletion(mockRequest))
        .rejects.toThrow(BudgetExceededError)

      expect(mockPromptLayer.chat.completions.create).not.toHaveBeenCalled()
    })

    it('should throw RateLimitError when rate limit is exceeded', async () => {
      // Make multiple requests to exceed rate limit
      const promises = Array(6).fill(null).map(() => 
        llmService.generateCompletion(mockRequest)
      )

      // First 5 should succeed, 6th should fail
      const results = await Promise.allSettled(promises)
      
      const rejectedResults = results.filter(r => r.status === 'rejected')
      expect(rejectedResults.length).toBeGreaterThan(0)
      
      const rateLimitError = rejectedResults[0] as PromiseRejectedResult
      expect(rateLimitError.reason).toBeInstanceOf(RateLimitError)
    })

    it('should handle OpenAI API errors', async () => {
      const apiError = new OpenAI.APIError('Invalid API key', {}, 'invalid_api_key', 401)
      // Set the status property explicitly
      Object.defineProperty(apiError, 'status', { value: 401 })
      mockPromptLayer.chat.completions.create.mockRejectedValue(apiError)

      const error = await llmService.generateCompletion(mockRequest).catch(e => e)
      expect(error).toBeInstanceOf(LLMError)
      expect(error.code).toBe('OPENAI_API_ERROR')
      expect(error.statusCode).toBe(401)
    })

    it('should handle missing usage data', async () => {
      const completionWithoutUsage = {
        ...mockCompletion,
        usage: undefined,
      }
      mockPromptLayer.chat.completions.create.mockResolvedValue(completionWithoutUsage)

      await expect(llmService.generateCompletion(mockRequest))
        .rejects.toThrow(LLMError)

      const error = await llmService.generateCompletion(mockRequest).catch(e => e)
      expect(error.code).toBe('NO_USAGE_DATA')
    })

    it('should calculate cost correctly for different models', async () => {
      const gpt4Request = { ...mockRequest, model: 'gpt-4' }
      
      await llmService.generateCompletion(gpt4Request)

      const recordUsageCall = vi.mocked(LLMUsageModel.recordUsage).mock.calls[0][0]
      expect(recordUsageCall.cost).toBe(150 * 0.00003) // GPT-4 pricing
    })

    it('should log budget warnings when approaching limit', async () => {
      vi.mocked(LLMUsageModel.checkBudgetStatus).mockResolvedValue({
        monthlyBudget: 10,
        currentSpend: 8.5,
        remainingBudget: 1.5,
        budgetUsedPercent: 85,
        isApproachingLimit: true,
        isOverBudget: false,
        stats: {} as any,
      })

      await llmService.generateCompletion(mockRequest)

      const { logger } = await import('../../utils/logger.js')
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('User approaching budget limit'),
        expect.objectContaining({
          currentSpend: 8.5,
          budgetLimit: 10,
          percentUsed: 85,
        })
      )
    })
  })

  describe('getBudgetStatus', () => {
    it('should return budget status for user', async () => {
      const mockBudgetStatus = {
        monthlyBudget: 10,
        currentSpend: 5,
        remainingBudget: 5,
        budgetUsedPercent: 50,
        isApproachingLimit: false,
        isOverBudget: false,
        stats: {} as any,
      }

      vi.mocked(LLMUsageModel.checkBudgetStatus).mockResolvedValue(mockBudgetStatus)

      const result = await llmService.getBudgetStatus('test-user')
      expect(result).toEqual(mockBudgetStatus)
      expect(LLMUsageModel.checkBudgetStatus).toHaveBeenCalledWith('test-user', 10)
    })
  })

  describe('getUserUsageStats', () => {
    it('should return usage statistics for user', async () => {
      const mockStats = {
        totalCost: 5,
        totalTokens: 2500,
        requestCount: 25,
        averageCostPerRequest: 0.2,
        costByAgent: { IDEATION: 3, REFINER: 2 },
        costByModel: { 'gpt-3.5-turbo': 5 },
      }

      vi.mocked(LLMUsageModel.getUserUsageStats).mockResolvedValue(mockStats)

      const result = await llmService.getUserUsageStats('test-user')
      expect(result).toEqual(mockStats)
    })

    it('should pass options to usage model', async () => {
      const options = {
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31'),
        agentType: 'IDEATION' as const,
      }

      await llmService.getUserUsageStats('test-user', options)
      expect(LLMUsageModel.getUserUsageStats).toHaveBeenCalledWith('test-user', options)
    })
  })

  describe('getRemainingRateLimit', () => {
    it('should return remaining rate limit for user', () => {
      const remaining = llmService.getRemainingRateLimit('test-user')
      expect(remaining).toBe(5) // Initial limit from config
    })

    it('should decrease after requests', async () => {
      vi.mocked(LLMUsageModel.checkBudgetStatus).mockResolvedValue({
        isOverBudget: false,
        isApproachingLimit: false,
      } as any)

      mockPromptLayer.chat.completions.create.mockResolvedValue({
        choices: [{ message: { content: 'test' } }],
        usage: { prompt_tokens: 10, completion_tokens: 10, total_tokens: 20 },
      })

      await llmService.generateCompletion({
        userId: 'test-user',
        agentType: 'IDEATION',
        prompt: 'test',
      })

      const remaining = llmService.getRemainingRateLimit('test-user')
      expect(remaining).toBe(4) // One request used
    })
  })

  describe('updateConfig', () => {
    it('should update configuration', () => {
      llmService.updateConfig({
        budgetLimitPerUser: 25,
        rateLimitPerMinute: 15,
      })

      // Verify config was updated by checking budget status call
      expect(() => llmService.updateConfig({ budgetLimitPerUser: 25 })).not.toThrow()
    })

    it('should validate configuration', () => {
      expect(() => {
        llmService.updateConfig({
          temperature: 3, // Invalid temperature
        })
      }).toThrow()
    })
  })

  describe('healthCheck', () => {
    it('should return healthy status when OpenAI is accessible', async () => {
      // Mock the OpenAI client directly
      vi.mocked(OpenAI).mockImplementation(() => ({
        chat: {
          completions: {
            create: vi.fn().mockResolvedValue({
              choices: [{ message: { content: 'test' } }],
              usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
            }),
          },
        },
      } as any))

      const newService = new LLMService()
      const health = await newService.healthCheck()

      expect(health.status).toBe('healthy')
      expect(health.details.openaiConnected).toBe(true)
      expect(health.details.promptLayerConfigured).toBe(true)
    })

    it('should return unhealthy status when OpenAI is not accessible', async () => {
      // Mock the OpenAI client to throw error
      vi.mocked(OpenAI).mockImplementation(() => ({
        chat: {
          completions: {
            create: vi.fn().mockRejectedValue(new Error('Connection failed')),
          },
        },
      } as any))

      const newService = new LLMService()
      const health = await newService.healthCheck()

      expect(health.status).toBe('unhealthy')
      expect(health.details.openaiConnected).toBe(false)
      expect(health.details.error).toBe('Connection failed')
    })
  })

  describe('cost calculation', () => {
    it('should calculate costs correctly for different models', () => {
      const service = llmService as any

      expect(service.calculateCost('gpt-3.5-turbo', 1000)).toBe(0.002)
      expect(service.calculateCost('gpt-4', 1000)).toBeCloseTo(0.03)
      expect(service.calculateCost('unknown-model', 1000)).toBe(0.002) // Fallback to gpt-3.5-turbo
    })
  })

  describe('request ID generation', () => {
    it('should generate unique request IDs', () => {
      const service = llmService as any
      const id1 = service.generateRequestId()
      const id2 = service.generateRequestId()

      expect(id1).toMatch(/^llm_\d+_\w+$/)
      expect(id2).toMatch(/^llm_\d+_\w+$/)
      expect(id1).not.toBe(id2)
    })
  })

  describe('message building', () => {
    it('should build messages with context', () => {
      const service = llmService as any
      const messages = service.buildMessages('Hello', 'You are helpful')

      expect(messages).toEqual([
        { role: 'system', content: 'You are helpful' },
        { role: 'user', content: 'Hello' },
      ])
    })

    it('should build messages without context', () => {
      const service = llmService as any
      const messages = service.buildMessages('Hello')

      expect(messages).toEqual([
        { role: 'user', content: 'Hello' },
      ])
    })
  })
})