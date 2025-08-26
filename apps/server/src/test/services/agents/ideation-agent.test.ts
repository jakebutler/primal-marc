import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { IdeationAgent } from '../../../services/agents/ideation-agent.js'
import { LLMService, LLMResponse } from '../../../services/llm.js'
import { AgentCapabilities, AgentRequest, AgentContext } from '../../../services/agents/base-agent.js'

// Mock LLM Service
const mockLLMService = {
  generateCompletion: vi.fn(),
  healthCheck: vi.fn(),
  getBudgetStatus: vi.fn(),
  getUserUsageStats: vi.fn(),
  getRemainingRateLimit: vi.fn(),
  updateConfig: vi.fn(),
} as unknown as LLMService

// Test capabilities
const testCapabilities: AgentCapabilities = {
  canHandlePhase: (phase) => phase === 'IDEATION',
  canProcessContent: (contentType) => ['text', 'markdown'].includes(contentType),
  supportedLanguages: ['en'],
  maxContextLength: 8000,
  estimatedCostPerRequest: 0.01,
}

// Mock LLM response
const createMockLLMResponse = (content: string): LLMResponse => ({
  content,
  usage: {
    promptTokens: 100,
    completionTokens: 200,
    totalTokens: 300,
    cost: 0.01,
  },
  model: 'gpt-3.5-turbo',
  requestId: 'test-request-id',
  metadata: {},
})

describe('IdeationAgent', () => {
  let ideationAgent: IdeationAgent
  let mockHealthCheck: ReturnType<typeof vi.fn>

  beforeEach(async () => {
    vi.clearAllMocks()
    
    // Setup health check mock
    mockHealthCheck = vi.fn().mockResolvedValue({ status: 'healthy' })
    ;(mockLLMService.healthCheck as any) = mockHealthCheck

    ideationAgent = new IdeationAgent(testCapabilities, mockLLMService)
    await ideationAgent.initialize()
  })

  afterEach(async () => {
    await ideationAgent.cleanup()
  })

  describe('Initialization and Setup', () => {
    it('should initialize successfully', async () => {
      expect(ideationAgent.type).toBe('IDEATION')
      expect(ideationAgent.capabilities).toEqual(testCapabilities)
    })

    it('should perform health check correctly', async () => {
      const isHealthy = await ideationAgent.healthCheck()
      expect(isHealthy).toBe(true)
      expect(mockHealthCheck).toHaveBeenCalled()
    })

    it('should return specific metrics', async () => {
      const metrics = await ideationAgent.getMetrics()
      expect(metrics).toHaveProperty('agentType', 'IDEATION')
      expect(metrics).toHaveProperty('activeBrainstormingSessions')
      expect(metrics).toHaveProperty('activeConceptMaps')
      expect(metrics).toHaveProperty('coldStartPromptsAvailable')
      expect(metrics).toHaveProperty('structuringTemplatesAvailable')
    })
  })

  describe('Request Validation', () => {
    it('should validate valid requests', async () => {
      const validRequest: AgentRequest = {
        userId: 'user-123',
        projectId: 'project-456',
        conversationId: 'conv-789',
        content: 'I need help brainstorming ideas for my blog post',
        context: {},
      }

      const isValid = await ideationAgent.validateRequest(validRequest)
      expect(isValid).toBe(true)
    })

    it('should reject requests with missing required fields', async () => {
      const invalidRequest: AgentRequest = {
        userId: '',
        projectId: 'project-456',
        conversationId: 'conv-789',
        content: 'Help me brainstorm',
        context: {},
      }

      const isValid = await ideationAgent.validateRequest(invalidRequest)
      expect(isValid).toBe(false)
    })

    it('should reject requests with content too long', async () => {
      const longContent = 'a'.repeat(10000) // Exceeds maxContextLength
      const invalidRequest: AgentRequest = {
        userId: 'user-123',
        projectId: 'project-456',
        conversationId: 'conv-789',
        content: longContent,
        context: {},
      }

      const isValid = await ideationAgent.validateRequest(invalidRequest)
      expect(isValid).toBe(false)
    })
  })

  describe('Cold Start Handling', () => {
    it('should handle cold start requests with encouraging prompts', async () => {
      const coldStartRequest: AgentRequest = {
        userId: 'user-123',
        projectId: 'project-456',
        conversationId: 'conv-789',
        content: 'I have writer\'s block and don\'t know what to write about',
        context: {
          previousPhases: [],
          userPreferences: {
            preferredAgentPersonality: 'casual',
            writingGenres: ['blog'],
            experienceLevel: 'BEGINNER',
          },
        },
      }

      const mockResponse = createMockLLMResponse(
        'I understand writer\'s block can be frustrating! Let\'s start with something simple. What\'s something you\'ve been curious about lately? Or perhaps there\'s a recent experience that made you think differently about something?'
      )

      ;(mockLLMService.generateCompletion as any).mockResolvedValue(mockResponse)

      const response = await ideationAgent.processRequest(coldStartRequest)

      expect(response.content).toContain('writer\'s block')
      expect(response.suggestions.length).toBeGreaterThanOrEqual(3) // Should have cold-start specific suggestions
      expect(response.suggestions.some(s => s.title.includes('Personal Experiences'))).toBe(true)
      expect(response.metadata.confidence).toBeGreaterThan(0.7)
    })

    it('should adapt cold start prompts based on user preferences', async () => {
      const creativeUserRequest: AgentRequest = {
        userId: 'user-123',
        projectId: 'project-456',
        conversationId: 'conv-789',
        content: 'need ideas',
        context: {
          previousPhases: [],
          userPreferences: {
            preferredAgentPersonality: 'creative',
            writingGenres: ['fiction'],
            experienceLevel: 'INTERMEDIATE',
          },
        },
      }

      const mockResponse = createMockLLMResponse(
        'Let\'s spark some creative ideas! What if we started with something completely unexpected?'
      )

      ;(mockLLMService.generateCompletion as any).mockResolvedValue(mockResponse)

      const response = await ideationAgent.processRequest(creativeUserRequest)

      expect(mockLLMService.generateCompletion).toHaveBeenCalledWith(
        expect.objectContaining({
          temperature: 0.8, // Higher temperature for cold starts
        })
      )
    })
  })

  describe('Brainstorming Sessions', () => {
    it('should facilitate brainstorming with idea generation', async () => {
      const brainstormingRequest: AgentRequest = {
        userId: 'user-123',
        projectId: 'project-456',
        conversationId: 'conv-789',
        content: 'I want to write about sustainable living but need more specific angles',
        context: {
          previousPhases: [],
          userPreferences: {
            preferredAgentPersonality: 'casual',
            writingGenres: ['blog'],
            experienceLevel: 'INTERMEDIATE',
          },
        },
      }

      const mockResponse = createMockLLMResponse(
        'Sustainable living is a rich topic! Here are some angles to consider: 1) Zero-waste kitchen hacks, 2) Sustainable fashion on a budget, 3) Urban gardening for beginners. Which of these resonates with you?'
      )

      ;(mockLLMService.generateCompletion as any).mockResolvedValue(mockResponse)

      const response = await ideationAgent.processRequest(brainstormingRequest)

      expect(response.content.toLowerCase()).toContain('sustainable living')
      expect(response.suggestions.some(s => s.title.includes('Mind Map'))).toBe(true)
      expect(response.metadata.confidence).toBeGreaterThan(0.7)
    })

    it('should use maximum creativity for brainstorming', async () => {
      const brainstormingRequest: AgentRequest = {
        userId: 'user-123',
        projectId: 'project-456',
        conversationId: 'conv-789',
        content: 'brainstorm ideas about technology and human connection',
        context: {},
      }

      const mockResponse = createMockLLMResponse('Great topic for brainstorming!')
      ;(mockLLMService.generateCompletion as any).mockResolvedValue(mockResponse)

      await ideationAgent.processRequest(brainstormingRequest)

      expect(mockLLMService.generateCompletion).toHaveBeenCalledWith(
        expect.objectContaining({
          temperature: 0.9, // Maximum creativity for brainstorming
        })
      )
    })
  })

  describe('Concept Structuring', () => {
    it('should suggest appropriate structuring frameworks', async () => {
      const structuringRequest: AgentRequest = {
        userId: 'user-123',
        projectId: 'project-456',
        conversationId: 'conv-789',
        content: 'I have ideas about remote work problems and solutions but need to organize them',
        context: {},
      }

      const mockResponse = createMockLLMResponse(
        'Perfect! Your content fits well with a Problem-Solution framework. Let\'s organize it as: Problem Definition → Current Approaches → Proposed Solution → Implementation → Expected Outcomes.'
      )

      ;(mockLLMService.generateCompletion as any).mockResolvedValue(mockResponse)

      const response = await ideationAgent.processRequest(structuringRequest)

      expect(response.content).toContain('Problem-Solution')
      expect(response.suggestions.some(s => s.title.includes('Outline'))).toBe(true)
      expect(response.metadata.confidence).toBeGreaterThan(0.7)
    })

    it('should suggest different frameworks based on content type', async () => {
      const comparisonRequest: AgentRequest = {
        userId: 'user-123',
        projectId: 'project-456',
        conversationId: 'conv-789',
        content: 'I want to organize and structure my comparison of different programming languages',
        context: {},
      }

      const mockResponse = createMockLLMResponse(
        'A Compare and Contrast framework would work perfectly for this topic!'
      )

      ;(mockLLMService.generateCompletion as any).mockResolvedValue(mockResponse)

      const response = await ideationAgent.processRequest(comparisonRequest)

      // The system should detect "compare" and suggest compare_contrast template
      expect(mockLLMService.generateCompletion).toHaveBeenCalledWith(
        expect.objectContaining({
          context: expect.stringContaining('Compare and Contrast'),
        })
      )
    })
  })

  describe('Idea Refinement', () => {
    it('should help refine existing ideas with focused development', async () => {
      const refinementRequest: AgentRequest = {
        userId: 'user-123',
        projectId: 'project-456',
        conversationId: 'conv-789',
        content: 'I want to refine my idea about using AI in education',
        context: {
          projectContent: 'AI can help personalize learning experiences for students...',
        },
      }

      const mockResponse = createMockLLMResponse(
        'Your AI in education idea has strong potential! Let\'s focus on making it more specific. What age group are you targeting? What specific learning challenges does AI address?'
      )

      ;(mockLLMService.generateCompletion as any).mockResolvedValue(mockResponse)

      const response = await ideationAgent.processRequest(refinementRequest)

      expect(response.content).toContain('AI in education')
      expect(response.suggestions.some(s => s.title.includes('Focus'))).toBe(true)
      expect(response.metadata.confidence).toBeGreaterThan(0.7)
    })
  })

  describe('Idea Expansion', () => {
    it('should help expand ideas with creative exploration', async () => {
      const expansionRequest: AgentRequest = {
        userId: 'user-123',
        projectId: 'project-456',
        conversationId: 'conv-789',
        content: 'I want to expand on my idea about mindfulness in the workplace',
        context: {},
      }

      const mockResponse = createMockLLMResponse(
        'Mindfulness in the workplace opens up many fascinating directions! Consider exploring: stress reduction techniques, productivity impacts, team dynamics, leadership applications...'
      )

      ;(mockLLMService.generateCompletion as any).mockResolvedValue(mockResponse)

      const response = await ideationAgent.processRequest(expansionRequest)

      expect(response.content.toLowerCase()).toContain('mindfulness')
      expect(response.suggestions.some(s => s.title.includes('Connections'))).toBe(true)
      expect(response.metadata.confidence).toBeGreaterThanOrEqual(0.7)
    })
  })

  describe('System Prompt Building', () => {
    it('should build comprehensive system prompts with user context', async () => {
      const context: AgentContext = {
        previousPhases: [],
        userPreferences: {
          preferredAgentPersonality: 'creative',
          writingGenres: ['fiction', 'poetry'],
          experienceLevel: 'ADVANCED',
        },
        projectContent: 'This is my current project content...',
      }

      const systemPrompt = ideationAgent.buildSystemPrompt(context)

      expect(systemPrompt).toContain('ideation and brainstorming assistant')
      expect(systemPrompt).toContain('Experience Level: ADVANCED')
      expect(systemPrompt).toContain('Preferred Interaction Style: creative')
      expect(systemPrompt).toContain('Writing Genres: fiction, poetry')
      expect(systemPrompt).toContain('Current Project Content:')
      expect(systemPrompt).toContain('sophisticated techniques')
    })

    it('should adapt guidance based on experience level', async () => {
      const beginnerContext: AgentContext = {
        previousPhases: [],
        userPreferences: {
          preferredAgentPersonality: 'formal',
          writingGenres: ['blog'],
          experienceLevel: 'BEGINNER',
        },
      }

      const systemPrompt = ideationAgent.buildSystemPrompt(beginnerContext)

      expect(systemPrompt).toContain('Provide more guidance and structure')
      expect(systemPrompt).toContain('Explain creative techniques')
      expect(systemPrompt).toContain('specific examples and templates')
    })

    it('should include previous phase context when available', async () => {
      const contextWithPhases: AgentContext = {
        previousPhases: [
          {
            phaseType: 'IDEATION',
            status: 'completed',
            outputs: [],
            summary: 'Generated initial concepts for blog post',
            completedAt: new Date(),
          },
        ],
        userPreferences: {
          preferredAgentPersonality: 'casual',
          writingGenres: [],
          experienceLevel: 'INTERMEDIATE',
        },
      }

      const systemPrompt = ideationAgent.buildSystemPrompt(contextWithPhases)

      expect(systemPrompt).toContain('Previous Work:')
      expect(systemPrompt).toContain('IDEATION: Generated initial concepts')
    })
  })

  describe('Response Parsing', () => {
    it('should parse LLM responses into structured agent responses', async () => {
      const mockLLMResponse = createMockLLMResponse(
        'Great question! Have you considered approaching this from a different angle? Let me suggest a few ideas: 1) Try exploring personal experiences, 2) Consider your audience\'s perspective.'
      )

      const response = ideationAgent.parseResponse(mockLLMResponse)

      expect(response.content).toBe(mockLLMResponse.content)
      expect(response.metadata.tokenUsage).toEqual(mockLLMResponse.usage)
      expect(response.metadata.model).toBe(mockLLMResponse.model)
      expect(response.metadata.confidence).toBeGreaterThan(0.7)
      expect(response.suggestions.length).toBeGreaterThan(0)
      expect(response.metadata.nextSteps.length).toBeGreaterThan(0)
    })

    it('should extract questions as suggestions', async () => {
      const mockLLMResponse = createMockLLMResponse(
        'What if you approached this differently? Have you considered the reader\'s perspective?'
      )

      const response = ideationAgent.parseResponse(mockLLMResponse)

      expect(response.suggestions.some(s => s.type === 'question')).toBe(true)
    })

    it('should calculate confidence based on response quality', async () => {
      const shortResponse = createMockLLMResponse('Short response.')
      const longDetailedResponse = createMockLLMResponse(
        'This is a much longer and more detailed response with multiple questions? It includes structured elements: 1) First point, 2) Second point. What do you think about this approach?'
      )

      const shortParsed = ideationAgent.parseResponse(shortResponse)
      const longParsed = ideationAgent.parseResponse(longDetailedResponse)

      expect(longParsed.metadata.confidence).toBeGreaterThan(shortParsed.metadata.confidence)
    })
  })

  describe('Error Handling', () => {
    it('should handle LLM service errors gracefully', async () => {
      const request: AgentRequest = {
        userId: 'user-123',
        projectId: 'project-456',
        conversationId: 'conv-789',
        content: 'Help me brainstorm',
        context: {},
      }

      ;(mockLLMService.generateCompletion as any).mockRejectedValue(
        new Error('LLM service unavailable')
      )

      await expect(ideationAgent.processRequest(request)).rejects.toThrow('LLM service unavailable')
    })

    it('should handle health check failures', async () => {
      mockHealthCheck.mockResolvedValue({ status: 'unhealthy' })

      const isHealthy = await ideationAgent.healthCheck()
      expect(isHealthy).toBe(false)
    })
  })

  describe('Context Building', () => {
    it('should build context with conversation history', async () => {
      const request: AgentRequest = {
        userId: 'user-123',
        projectId: 'project-456',
        conversationId: 'conv-789',
        content: 'Continue our brainstorming',
        context: {
          previousPhases: [],
          userPreferences: {
            preferredAgentPersonality: 'casual',
            writingGenres: [],
            experienceLevel: 'INTERMEDIATE',
          },
          conversationHistory: [
            {
              conversationId: 'conv-123',
              agentType: 'IDEATION',
              messageCount: 3,
              lastMessage: 'We discussed sustainable living ideas',
              timestamp: new Date(),
            },
          ],
        },
      }

      const context = await ideationAgent.buildContext(request)

      expect(context).toContain('Conversation History:')
      expect(context).toContain('[IDEATION] We discussed sustainable living ideas')
    })

    it('should include project content in context', async () => {
      const request: AgentRequest = {
        userId: 'user-123',
        projectId: 'project-456',
        conversationId: 'conv-789',
        content: 'Help me expand this',
        context: {
          previousPhases: [],
          userPreferences: {
            preferredAgentPersonality: 'casual',
            writingGenres: [],
            experienceLevel: 'INTERMEDIATE',
          },
          projectContent: 'My current draft about renewable energy...',
        },
      }

      const context = await ideationAgent.buildContext(request)

      expect(context).toContain('Current Project Content:')
      expect(context).toContain('renewable energy')
    })
  })

  describe('Integration with Agent Capabilities', () => {
    it('should respect agent capabilities for phase handling', () => {
      expect(ideationAgent.capabilities.canHandlePhase('IDEATION')).toBe(true)
      expect(ideationAgent.capabilities.canHandlePhase('REFINER')).toBe(false)
    })

    it('should respect content type capabilities', () => {
      expect(ideationAgent.capabilities.canProcessContent('text')).toBe(true)
      expect(ideationAgent.capabilities.canProcessContent('markdown')).toBe(true)
      expect(ideationAgent.capabilities.canProcessContent('image')).toBe(false)
    })

    it('should have appropriate cost estimation', () => {
      expect(ideationAgent.capabilities.estimatedCostPerRequest).toBe(0.01)
    })
  })
})