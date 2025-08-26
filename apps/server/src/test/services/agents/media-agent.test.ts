import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { MediaAgent } from '../../../services/agents/media-agent.js'
import { AgentCapabilities, AgentRequest } from '../../../services/agents/base-agent.js'
import { LLMService } from '../../../services/llm.js'

// Mock the media service
vi.mock('../../../services/media/media-service.js')

// Mock LLM service
const mockLLMService = {
  generateCompletion: vi.fn(),
  healthCheck: vi.fn().mockResolvedValue({ status: 'healthy' }),
  getUsageStats: vi.fn().mockResolvedValue({})
} as unknown as LLMService

describe('MediaAgent', () => {
  let mediaAgent: MediaAgent
  let capabilities: AgentCapabilities

  beforeEach(() => {
    capabilities = {
      canHandlePhase: (phase) => phase === 'MEDIA',
      canProcessContent: (contentType) => ['text', 'markdown', 'image', 'chart'].includes(contentType),
      supportedLanguages: ['en'],
      maxContextLength: 6000,
      estimatedCostPerRequest: 0.02
    }

    mediaAgent = new MediaAgent(capabilities, mockLLMService)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('initialization', () => {
    it('should initialize with correct type and capabilities', () => {
      expect(mediaAgent.type).toBe('MEDIA')
      expect(mediaAgent.capabilities).toEqual(capabilities)
    })

    it('should initialize media service with correct configuration', async () => {
      await mediaAgent.initialize()
      expect(mediaAgent['initialized']).toBe(true)
    })
  })

  describe('processRequest', () => {
    const mockRequest: AgentRequest = {
      userId: 'user-123',
      projectId: 'project-456',
      conversationId: 'conv-789',
      content: 'I need some visual content for my blog post about sustainable farming',
      context: {
        previousPhases: [],
        userPreferences: {
          preferredAgentPersonality: 'helpful',
          writingGenres: ['blog'],
          experienceLevel: 'INTERMEDIATE'
        }
      }
    }

    beforeEach(async () => {
      await mediaAgent.initialize()
    })

    it('should process media request successfully', async () => {
      // Mock LLM response for content analysis
      const mockLLMResponse = {
        content: 'This content would benefit from images of sustainable farming practices and possibly a chart showing environmental benefits.',
        usage: {
          promptTokens: 100,
          completionTokens: 50,
          totalTokens: 150,
          cost: 0.001
        },
        model: 'gpt-3.5-turbo'
      }

      mockLLMService.generateCompletion = vi.fn().mockResolvedValue(mockLLMResponse)

      // Mock media service results
      const mockMediaService = mediaAgent['mediaService'] as any
      mockMediaService.processMediaRequest = vi.fn().mockResolvedValue([
        {
          type: 'image',
          url: 'https://example.com/farming-image.jpg',
          metadata: {
            description: 'Sustainable farming image',
            alt: 'Farmers working in sustainable fields',
            source: 'unsplash'
          },
          suggestions: [
            {
              type: 'alternative',
              title: 'Download and optimize',
              description: 'Download this image for local use'
            }
          ]
        }
      ])

      const response = await mediaAgent.processRequest(mockRequest)

      expect(response).toHaveProperty('content')
      expect(response).toHaveProperty('suggestions')
      expect(response).toHaveProperty('metadata')
      expect(response.content).toContain('visual enhancement')
      expect(response.suggestions.length).toBeGreaterThan(0)
      expect(mockMediaService.processMediaRequest).toHaveBeenCalled()
    })

    it('should handle LLM analysis failure gracefully', async () => {
      // Mock LLM failure
      mockLLMService.generateCompletion = vi.fn().mockRejectedValue(new Error('LLM error'))

      // Mock media service to still work
      const mockMediaService = mediaAgent['mediaService'] as any
      mockMediaService.processMediaRequest = vi.fn().mockResolvedValue([])

      const response = await mediaAgent.processRequest(mockRequest)

      expect(response).toHaveProperty('content')
      expect(response.content).toContain('visual enhancement')
      // Should still process despite LLM failure
    })

    it('should handle media service failure with fallback response', async () => {
      // Mock LLM success
      mockLLMService.generateCompletion = vi.fn().mockResolvedValue({
        content: 'Analysis result',
        usage: { promptTokens: 50, completionTokens: 25, totalTokens: 75, cost: 0.0005 },
        model: 'gpt-3.5-turbo'
      })

      // Mock media service failure
      const mockMediaService = mediaAgent['mediaService'] as any
      mockMediaService.processMediaRequest = vi.fn().mockRejectedValue(new Error('Media service error'))

      const response = await mediaAgent.processRequest(mockRequest)

      expect(response).toHaveProperty('content')
      expect(response.content).toContain('visual enhancement')
      expect(response.suggestions.length).toBeGreaterThan(0)
    })

    it('should validate request before processing', async () => {
      const invalidRequest: AgentRequest = {
        userId: '',
        projectId: '',
        conversationId: '',
        content: ''
      }

      const response = await mediaAgent.processRequest(invalidRequest)

      expect(response.content).toContain('encountered an issue')
    })
  })

  describe('buildSystemPrompt', () => {
    it('should build appropriate system prompt', () => {
      const context = {
        previousPhases: [],
        userPreferences: {
          preferredAgentPersonality: 'creative',
          writingGenres: ['blog'],
          experienceLevel: 'ADVANCED' as const
        },
        projectContent: 'Some project content'
      }

      const prompt = mediaAgent.buildSystemPrompt(context)

      expect(prompt).toContain('creative media assistant')
      expect(prompt).toContain('visual content creation')
      expect(prompt).toContain('creative')
      expect(prompt).toContain('ADVANCED')
      expect(prompt).toContain('Available')
    })
  })

  describe('content analysis helpers', () => {
    it('should detect structured data in content', () => {
      const contentWithData = 'Sales data: Q1 100, Q2 150, Q3 200'
      // Access private method through any cast for testing
      const hasData = (mediaAgent as any).hasStructuredData(contentWithData)

      expect(hasData).toBe(true)
    })

    it('should detect humorous content', () => {
      const humorousContent = 'This is a funny joke about programming'
      // Access private method through any cast for testing
      const isHumorous = (mediaAgent as any).isHumorousContent(humorousContent)

      expect(isHumorous).toBe(true)
    })

    it('should not detect humor in serious content', () => {
      const seriousContent = 'This is a serious business report'
      // Access private method through any cast for testing
      const isHumorous = (mediaAgent as any).isHumorousContent(seriousContent)

      expect(isHumorous).toBe(false)
    })
  })

  describe('health check and metrics', () => {
    beforeEach(async () => {
      await mediaAgent.initialize()
    })

    it('should perform health check', async () => {
      const mockMediaService = mediaAgent['mediaService'] as any
      mockMediaService.getHealthStatus = vi.fn().mockResolvedValue({
        status: 'healthy'
      })

      const isHealthy = await mediaAgent.healthCheck()

      expect(isHealthy).toBe(true)
    })

    it('should return health check failure when media service is unhealthy', async () => {
      const mockMediaService = mediaAgent['mediaService'] as any
      mockMediaService.getHealthStatus = vi.fn().mockResolvedValue({
        status: 'unhealthy'
      })

      const isHealthy = await mediaAgent.healthCheck()

      expect(isHealthy).toBe(false)
    })

    it('should get agent metrics', async () => {
      const mockMediaService = mediaAgent['mediaService'] as any
      mockMediaService.getUsageStats = vi.fn().mockResolvedValue({
        totalRequests: 10,
        averageProcessingTime: 500
      })

      const metrics = await mediaAgent.getMetrics()

      expect(metrics).toHaveProperty('agentType', 'MEDIA')
      expect(metrics).toHaveProperty('requestCount')
      expect(metrics).toHaveProperty('mediaServiceStats')
    })
  })

  describe('cleanup', () => {
    beforeEach(async () => {
      await mediaAgent.initialize()
    })

    it('should cleanup resources', async () => {
      const mockMediaService = mediaAgent['mediaService'] as any
      mockMediaService.cleanupOldMedia = vi.fn().mockResolvedValue(undefined)

      await mediaAgent.cleanup()

      expect(mockMediaService.cleanupOldMedia).toHaveBeenCalled()
      expect(mediaAgent['initialized']).toBe(false)
    })
  })

  describe('parseResponse', () => {
    it('should parse LLM response correctly', () => {
      const llmResponse = {
        content: 'I suggest adding images and charts to enhance your content.',
        usage: {
          promptTokens: 100,
          completionTokens: 50,
          totalTokens: 150,
          cost: 0.001
        },
        model: 'gpt-3.5-turbo'
      }

      const parsed = mediaAgent.parseResponse(llmResponse)

      expect(parsed.content).toBe(llmResponse.content)
      expect(parsed.metadata.tokenUsage).toEqual(llmResponse.usage)
      expect(parsed.metadata.model).toBe(llmResponse.model)
      expect(parsed.metadata.confidence).toBe(0.8)
      expect(parsed.suggestions.length).toBeGreaterThan(0)
    })
  })
})