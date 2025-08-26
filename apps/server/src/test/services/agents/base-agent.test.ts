import { describe, it, expect, beforeEach, vi, Mock } from 'vitest'
import { BaseAgent, AgentType, AgentCapabilities, AgentRequest, AgentContext } from '../../../services/agents/base-agent.js'
import { LLMService, LLMResponse } from '../../../services/llm.js'
import { logger } from '../../../utils/logger.js'

// Mock logger
vi.mock('../../../utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}))

// Test implementation of BaseAgent
class TestAgent extends BaseAgent {
  constructor(type: AgentType, capabilities: AgentCapabilities, llmService: LLMService) {
    super(type, capabilities, llmService)
  }

  async processRequest(request: AgentRequest) {
    const context = await this.buildContext(request)
    const llmResponse = await this.makeLLMRequest(request, context)
    return this.parseResponse(llmResponse)
  }

  buildSystemPrompt(context: AgentContext): string {
    return `Test system prompt for ${this.type} agent`
  }

  parseResponse(llmResponse: LLMResponse) {
    return {
      content: llmResponse.content,
      suggestions: [],
      metadata: {
        processingTime: 1000,
        tokenUsage: llmResponse.usage,
        model: llmResponse.model,
      },
    }
  }

  protected async performInitialization(): Promise<void> {
    // Test initialization
  }

  protected async performCleanup(): Promise<void> {
    // Test cleanup
  }

  protected async performHealthCheck(): Promise<boolean> {
    return true
  }

  protected async getSpecificMetrics(): Promise<Record<string, any>> {
    return { testMetric: 'value' }
  }
}

describe('BaseAgent', () => {
  let mockLLMService: LLMService
  let testAgent: TestAgent
  let mockCapabilities: AgentCapabilities

  beforeEach(() => {
    // Mock LLM service
    mockLLMService = {
      generateCompletion: vi.fn(),
      healthCheck: vi.fn(),
      getBudgetStatus: vi.fn(),
      getUserUsageStats: vi.fn(),
      getRemainingRateLimit: vi.fn(),
      updateConfig: vi.fn(),
    } as any

    mockCapabilities = {
      canHandlePhase: vi.fn().mockReturnValue(true),
      canProcessContent: vi.fn().mockReturnValue(true),
      supportedLanguages: ['en'],
      maxContextLength: 8000,
      estimatedCostPerRequest: 0.01,
    }

    testAgent = new TestAgent('IDEATION', mockCapabilities, mockLLMService)
  })

  describe('constructor', () => {
    it('should initialize with correct properties', () => {
      expect(testAgent.type).toBe('IDEATION')
      expect(testAgent.capabilities).toBe(mockCapabilities)
    })
  })

  describe('validateRequest', () => {
    it('should validate a valid request', async () => {
      const request: AgentRequest = {
        userId: 'user123',
        projectId: 'project123',
        conversationId: 'conv123',
        content: 'Test content',
      }

      const isValid = await testAgent.validateRequest(request)
      expect(isValid).toBe(true)
    })

    it('should reject request with missing required fields', async () => {
      const request: AgentRequest = {
        userId: '',
        projectId: 'project123',
        conversationId: 'conv123',
        content: 'Test content',
      }

      const isValid = await testAgent.validateRequest(request)
      expect(isValid).toBe(false)
      expect(logger.warn).toHaveBeenCalled()
    })

    it('should reject request with content too long', async () => {
      const longContent = 'a'.repeat(10000) // Exceeds maxContextLength
      const request: AgentRequest = {
        userId: 'user123',
        projectId: 'project123',
        conversationId: 'conv123',
        content: longContent,
      }

      const isValid = await testAgent.validateRequest(request)
      expect(isValid).toBe(false)
      expect(logger.warn).toHaveBeenCalled()
    })

    it('should reject request when agent cannot handle phase', async () => {
      ;(mockCapabilities.canHandlePhase as Mock).mockReturnValue(false)

      const request: AgentRequest = {
        userId: 'user123',
        projectId: 'project123',
        conversationId: 'conv123',
        content: 'Test content',
        context: {
          previousPhases: [{
            phaseType: 'REFINER',
            status: 'completed',
            outputs: [],
            summary: 'Test',
          }],
          userPreferences: {
            preferredAgentPersonality: 'casual',
            writingGenres: [],
            experienceLevel: 'INTERMEDIATE',
          },
        },
      }

      const isValid = await testAgent.validateRequest(request)
      expect(isValid).toBe(false)
      expect(mockCapabilities.canHandlePhase).toHaveBeenCalledWith('REFINER')
    })
  })

  describe('buildContext', () => {
    it('should build context with system prompt', async () => {
      const request: AgentRequest = {
        userId: 'user123',
        projectId: 'project123',
        conversationId: 'conv123',
        content: 'Test content',
      }

      const context = await testAgent.buildContext(request)
      expect(context).toContain('Test system prompt for IDEATION agent')
    })

    it('should include conversation history in context', async () => {
      const request: AgentRequest = {
        userId: 'user123',
        projectId: 'project123',
        conversationId: 'conv123',
        content: 'Test content',
        context: {
          conversationHistory: [{
            conversationId: 'conv123',
            agentType: 'IDEATION',
            messageCount: 2,
            lastMessage: 'Previous message',
            timestamp: new Date(),
          }],
          previousPhases: [],
          userPreferences: {
            preferredAgentPersonality: 'casual',
            writingGenres: [],
            experienceLevel: 'INTERMEDIATE',
          },
        },
      }

      const context = await testAgent.buildContext(request)
      expect(context).toContain('Conversation History:')
      expect(context).toContain('[IDEATION] Previous message')
    })

    it('should include project content in context', async () => {
      const request: AgentRequest = {
        userId: 'user123',
        projectId: 'project123',
        conversationId: 'conv123',
        content: 'Test content',
        context: {
          projectContent: 'Existing project content',
          previousPhases: [],
          userPreferences: {
            preferredAgentPersonality: 'casual',
            writingGenres: [],
            experienceLevel: 'INTERMEDIATE',
          },
        },
      }

      const context = await testAgent.buildContext(request)
      expect(context).toContain('Current Project Content:')
      expect(context).toContain('Existing project content')
    })

    it('should include previous phase results in context', async () => {
      const request: AgentRequest = {
        userId: 'user123',
        projectId: 'project123',
        conversationId: 'conv123',
        content: 'Test content',
        context: {
          previousPhases: [{
            phaseType: 'IDEATION',
            status: 'completed',
            outputs: [],
            summary: 'Ideation completed successfully',
          }],
          userPreferences: {
            preferredAgentPersonality: 'casual',
            writingGenres: [],
            experienceLevel: 'INTERMEDIATE',
          },
        },
      }

      const context = await testAgent.buildContext(request)
      expect(context).toContain('Previous Phase Results:')
      expect(context).toContain('IDEATION: Ideation completed successfully')
    })
  })

  describe('lifecycle methods', () => {
    it('should initialize successfully', async () => {
      await testAgent.initialize()
      expect(testAgent['initialized']).toBe(true)
      expect(logger.info).toHaveBeenCalledWith('Initializing IDEATION agent')
    })

    it('should not initialize twice', async () => {
      await testAgent.initialize()
      await testAgent.initialize() // Second call should be ignored
      expect(testAgent['initialized']).toBe(true)
    })

    it('should cleanup successfully', async () => {
      await testAgent.initialize()
      await testAgent.cleanup()
      expect(testAgent['initialized']).toBe(false)
      expect(logger.info).toHaveBeenCalledWith('Cleaning up IDEATION agent')
    })
  })

  describe('healthCheck', () => {
    it('should return false if not initialized', async () => {
      const isHealthy = await testAgent.healthCheck()
      expect(isHealthy).toBe(false)
    })

    it('should return false if LLM service is unhealthy', async () => {
      ;(mockLLMService.healthCheck as Mock).mockResolvedValue({ status: 'unhealthy' })
      await testAgent.initialize()

      const isHealthy = await testAgent.healthCheck()
      expect(isHealthy).toBe(false)
    })

    it('should return true if initialized and LLM service is healthy', async () => {
      ;(mockLLMService.healthCheck as Mock).mockResolvedValue({ status: 'healthy' })
      await testAgent.initialize()

      const isHealthy = await testAgent.healthCheck()
      expect(isHealthy).toBe(true)
    })
  })

  describe('getMetrics', () => {
    it('should return base metrics', async () => {
      await testAgent.initialize()
      const metrics = await testAgent.getMetrics()

      expect(metrics).toMatchObject({
        agentType: 'IDEATION',
        initialized: true,
        capabilities: mockCapabilities,
        testMetric: 'value',
      })
      expect(metrics.timestamp).toBeDefined()
    })

    it('should handle errors gracefully', async () => {
      // Mock getSpecificMetrics to throw error
      vi.spyOn(testAgent as any, 'getSpecificMetrics').mockRejectedValue(new Error('Test error'))

      const metrics = await testAgent.getMetrics()
      expect(metrics.error).toBe('Test error')
    })
  })

  describe('helper methods', () => {
    it('should create suggestions with correct format', () => {
      const suggestion = testAgent['createSuggestion'](
        'action',
        'Test Title',
        'Test Description',
        'high',
        { custom: 'data' }
      )

      expect(suggestion).toMatchObject({
        type: 'action',
        title: 'Test Title',
        description: 'Test Description',
        priority: 'high',
        metadata: { custom: 'data' },
      })
      expect(suggestion.id).toMatch(/^ideation_\d+_[a-z0-9]+$/)
    })

    it('should make LLM request with correct parameters', async () => {
      const mockResponse: LLMResponse = {
        content: 'Test response',
        usage: {
          promptTokens: 10,
          completionTokens: 20,
          totalTokens: 30,
          cost: 0.01,
        },
        model: 'gpt-3.5-turbo',
        requestId: 'req123',
      }

      ;(mockLLMService.generateCompletion as Mock).mockResolvedValue(mockResponse)

      const request: AgentRequest = {
        userId: 'user123',
        projectId: 'project123',
        conversationId: 'conv123',
        content: 'Test content',
      }

      const response = await testAgent['makeLLMRequest'](request, 'System context')

      expect(mockLLMService.generateCompletion).toHaveBeenCalledWith({
        userId: 'user123',
        agentType: 'IDEATION',
        prompt: 'Test content',
        context: 'System context',
        metadata: {
          projectId: 'project123',
          conversationId: 'conv123',
          agentType: 'IDEATION',
        },
      })

      expect(response).toBe(mockResponse)
    })
  })
})