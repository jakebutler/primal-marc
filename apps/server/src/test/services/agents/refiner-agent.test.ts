import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { RefinerAgent } from '../../../services/agents/refiner-agent.js'
import { LLMService, LLMResponse } from '../../../services/llm.js'
import { AgentCapabilities, AgentRequest, AgentContext, StyleGuide } from '../../../services/agents/base-agent.js'

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
  canHandlePhase: (phase) => phase === 'REFINER',
  canProcessContent: (contentType) => ['text', 'markdown', 'html'].includes(contentType),
  supportedLanguages: ['en'],
  maxContextLength: 12000,
  estimatedCostPerRequest: 0.015,
}

// Mock LLM response
const createMockLLMResponse = (content: string): LLMResponse => ({
  content,
  usage: {
    promptTokens: 150,
    completionTokens: 300,
    totalTokens: 450,
    cost: 0.015,
  },
  model: 'gpt-3.5-turbo',
  requestId: 'test-request-id',
  metadata: {},
})

// Sample draft content for testing
const sampleDrafts = {
  weakStructure: `This is about climate change. It's bad. We should do something about it. 
    There are many problems. Some people don't believe it. But it's real. 
    We need to act now. The end.`,
  
  goodStructure: `Climate change represents one of the most pressing challenges of our time, requiring immediate and coordinated global action.
    
    The scientific evidence for human-caused climate change is overwhelming. According to NASA, global temperatures have risen by 1.1°C since the late 19th century, with the most dramatic warming occurring in the past 40 years. Furthermore, atmospheric CO2 levels have increased by over 40% since pre-industrial times, primarily due to fossil fuel combustion.
    
    However, critics often point to natural climate variations as an explanation for current warming trends. While natural factors do influence climate, multiple independent studies have shown that human activities are the dominant driver of recent climate change. The Intergovernmental Panel on Climate Change concludes with 95% confidence that human influence has been the dominant cause of warming since the mid-20th century.
    
    Therefore, we must implement comprehensive policies to reduce greenhouse gas emissions while investing in renewable energy technologies. The transition to a sustainable economy is not only environmentally necessary but also economically beneficial, creating millions of jobs in emerging green industries.`,
  
  inconsistentStyle: `Climate change is like, really bad for our planet. The scientific community has reached a consensus regarding the anthropogenic nature of contemporary climatic alterations. We gotta do something about it soon. Research indicates that atmospheric concentrations of greenhouse gases have increased substantially. It's totally crazy how some people still don't believe it!`,
  
  passiveVoiceHeavy: `Climate change is being caused by human activities. Greenhouse gases are being released into the atmosphere by industrial processes. The planet is being warmed by these emissions. Action is being taken by some governments, but more needs to be done by everyone.`,
}

describe('RefinerAgent', () => {
  let refinerAgent: RefinerAgent
  let mockHealthCheck: ReturnType<typeof vi.fn>

  beforeEach(async () => {
    vi.clearAllMocks()
    
    // Setup health check mock
    mockHealthCheck = vi.fn().mockResolvedValue({ status: 'healthy' })
    ;(mockLLMService.healthCheck as any) = mockHealthCheck

    refinerAgent = new RefinerAgent(testCapabilities, mockLLMService)
    await refinerAgent.initialize()
  })

  afterEach(async () => {
    await refinerAgent.cleanup()
  })

  describe('Initialization and Setup', () => {
    it('should initialize successfully', async () => {
      expect(refinerAgent.type).toBe('REFINER')
      expect(refinerAgent.capabilities).toEqual(testCapabilities)
    })

    it('should perform health check correctly', async () => {
      const isHealthy = await refinerAgent.healthCheck()
      expect(isHealthy).toBe(true)
      expect(mockHealthCheck).toHaveBeenCalled()
    })

    it('should return specific metrics', async () => {
      const metrics = await refinerAgent.getMetrics()
      expect(metrics).toHaveProperty('agentType', 'REFINER')
      expect(metrics).toHaveProperty('userStyleProfiles')
      expect(metrics).toHaveProperty('cachedAnalyses')
      expect(metrics).toHaveProperty('referenceWriters')
      expect(metrics).toHaveProperty('styleFrameworks')
    })
  })

  describe('Request Validation', () => {
    it('should validate valid requests', async () => {
      const validRequest: AgentRequest = {
        userId: 'user-123',
        projectId: 'project-456',
        conversationId: 'conv-789',
        content: sampleDrafts.goodStructure,
        context: {},
      }

      const isValid = await refinerAgent.validateRequest(validRequest)
      expect(isValid).toBe(true)
    })

    it('should reject requests with missing required fields', async () => {
      const invalidRequest: AgentRequest = {
        userId: '',
        projectId: 'project-456',
        conversationId: 'conv-789',
        content: 'Help me refine this',
        context: {},
      }

      const isValid = await refinerAgent.validateRequest(invalidRequest)
      expect(isValid).toBe(false)
    })

    it('should reject requests with content too long', async () => {
      const longContent = 'a'.repeat(15000) // Exceeds maxContextLength
      const invalidRequest: AgentRequest = {
        userId: 'user-123',
        projectId: 'project-456',
        conversationId: 'conv-789',
        content: longContent,
        context: {},
      }

      const isValid = await refinerAgent.validateRequest(invalidRequest)
      expect(isValid).toBe(false)
    })
  })

  describe('Structure Analysis', () => {
    it('should analyze draft structure and identify issues', async () => {
      const structureRequest: AgentRequest = {
        userId: 'user-123',
        projectId: 'project-456',
        conversationId: 'conv-789',
        content: sampleDrafts.weakStructure,
        context: {},
      }

      const mockResponse = createMockLLMResponse(
        'Your draft has several structural issues that need attention. The introduction lacks a clear hook and thesis statement. The body paragraphs are too brief and lack supporting evidence. Consider reorganizing your ideas into a more logical flow: 1) Strong introduction with thesis, 2) Supporting arguments with evidence, 3) Address counterarguments, 4) Strong conclusion.'
      )

      ;(mockLLMService.generateCompletion as any).mockResolvedValue(mockResponse)

      const response = await refinerAgent.processRequest(structureRequest)

      expect(response.content).toContain('structural issues')
      expect(response.suggestions.length).toBeGreaterThan(0)
      expect(response.metadata.confidence).toBeGreaterThanOrEqual(0.7)
    })

    it('should provide detailed analysis for well-structured content', async () => {
      const structureRequest: AgentRequest = {
        userId: 'user-123',
        projectId: 'project-456',
        conversationId: 'conv-789',
        content: sampleDrafts.goodStructure,
        context: {},
      }

      const mockResponse = createMockLLMResponse(
        'Your draft demonstrates strong structural elements. The thesis is clear and debatable, you provide solid evidence from credible sources, and you address counterarguments effectively. The logical flow from problem to evidence to solution works well. Consider strengthening the conclusion with a more specific call to action.'
      )

      ;(mockLLMService.generateCompletion as any).mockResolvedValue(mockResponse)

      const response = await refinerAgent.processRequest(structureRequest)

      expect(response.content).toContain('strong structural elements')
      expect(response.metadata.confidence).toBeGreaterThanOrEqual(0.7)
    })

    it('should use appropriate temperature for analytical tasks', async () => {
      const structureRequest: AgentRequest = {
        userId: 'user-123',
        projectId: 'project-456',
        conversationId: 'conv-789',
        content: 'analyze the structure of my argument about renewable energy',
        context: {},
      }

      const mockResponse = createMockLLMResponse('Structural analysis complete.')
      ;(mockLLMService.generateCompletion as any).mockResolvedValue(mockResponse)

      await refinerAgent.processRequest(structureRequest)

      expect(mockLLMService.generateCompletion).toHaveBeenCalledWith(
        expect.objectContaining({
          temperature: 0.3, // Lower temperature for analytical tasks
        })
      )
    })
  })

  describe('Style Analysis and Refinement', () => {
    it('should identify style inconsistencies', async () => {
      const styleRequest: AgentRequest = {
        userId: 'user-123',
        projectId: 'project-456',
        conversationId: 'conv-789',
        content: sampleDrafts.inconsistentStyle,
        context: {},
      }

      const mockResponse = createMockLLMResponse(
        'Your draft shows significant style inconsistencies. You mix casual language ("like, really bad", "gotta do something") with formal academic language ("anthropogenic nature", "atmospheric concentrations"). Choose a consistent tone throughout. For academic writing, maintain formal language. For blog posts, keep it conversational but professional.'
      )

      ;(mockLLMService.generateCompletion as any).mockResolvedValue(mockResponse)

      const response = await refinerAgent.processRequest(styleRequest)

      expect(response.content).toContain('style inconsistencies')
      expect(response.suggestions.length).toBeGreaterThan(0)
      expect(response.metadata.confidence).toBeGreaterThanOrEqual(0.7)
    })

    it('should provide style guidance based on style guide', async () => {
      const styleGuide: StyleGuide = {
        referenceWriters: ['hemingway'],
        toneDescription: 'direct and understated',
        targetAudience: 'general readers',
      }

      const styleRequest: AgentRequest = {
        userId: 'user-123',
        projectId: 'project-456',
        conversationId: 'conv-789',
        content: 'This is an extremely complex and multifaceted issue that requires comprehensive analysis.',
        context: { 
          previousPhases: [],
          userPreferences: {
            preferredAgentPersonality: 'formal',
            writingGenres: ['journalism'],
            experienceLevel: 'INTERMEDIATE',
          },
          styleGuide 
        },
      }

      const mockResponse = createMockLLMResponse(
        'Your writing style is more complex than Hemingway\'s direct approach. Consider simplifying: "This is a complex issue that needs analysis." Hemingway favored short, declarative sentences and minimal adjectives. Try removing words like "extremely" and "comprehensive" for a more understated effect.'
      )

      ;(mockLLMService.generateCompletion as any).mockResolvedValue(mockResponse)

      const response = await refinerAgent.processRequest(styleRequest)

      expect(response.content).toContain('Hemingway')
      expect(response.content).toContain('direct')
      expect(mockLLMService.generateCompletion).toHaveBeenCalledWith(
        expect.objectContaining({
          context: expect.stringContaining('Reference Writers: hemingway'),
        })
      )
    })

    it('should identify passive voice issues', async () => {
      const passiveRequest: AgentRequest = {
        userId: 'user-123',
        projectId: 'project-456',
        conversationId: 'conv-789',
        content: sampleDrafts.passiveVoiceHeavy,
        context: {},
      }

      const mockResponse = createMockLLMResponse(
        'Your draft relies heavily on passive voice, which makes it less direct and engaging. Instead of "Climate change is being caused by human activities," try "Human activities cause climate change." Active voice creates stronger, clearer sentences and better engages readers.'
      )

      ;(mockLLMService.generateCompletion as any).mockResolvedValue(mockResponse)

      const response = await refinerAgent.processRequest(passiveRequest)

      expect(response.content).toContain('passive voice')
      expect(response.suggestions.length).toBeGreaterThan(0)
    })
  })

  describe('Writer Matching and Similarity', () => {
    it('should match writing style to reference writers', async () => {
      const writerMatchRequest: AgentRequest = {
        userId: 'user-123',
        projectId: 'project-456',
        conversationId: 'conv-789',
        content: 'write like hemingway about modern technology and its impact on human connection',
        context: {},
      }

      const mockResponse = createMockLLMResponse(
        'Your writing shows some similarity to Hemingway\'s style with 65% match. You share his direct approach and understated tone. To better match Hemingway: 1) Use shorter sentences, 2) Reduce adjectives and adverbs, 3) Let dialogue and action carry emotion rather than description. Your current average sentence length is 18 words; Hemingway averaged 12.'
      )

      ;(mockLLMService.generateCompletion as any).mockResolvedValue(mockResponse)

      const response = await refinerAgent.processRequest(writerMatchRequest)

      expect(response.content).toContain('Hemingway')
      expect(response.content).toContain('similarity')
      expect(response.suggestions.length).toBeGreaterThan(0)
    })

    it('should provide writer-specific recommendations', async () => {
      const writerRequest: AgentRequest = {
        userId: 'user-123',
        projectId: 'project-456',
        conversationId: 'conv-789',
        content: 'I want my writing to be similar to George Orwell\'s clear and direct style',
        context: {},
      }

      const mockResponse = createMockLLMResponse(
        'Orwell\'s style emphasizes clarity and political awareness. Your writing could benefit from: 1) More concrete examples and imagery, 2) Clearer logical argument structure, 3) Accessible language despite complex ideas. Orwell believed in making complex political concepts understandable to ordinary readers.'
      )

      ;(mockLLMService.generateCompletion as any).mockResolvedValue(mockResponse)

      const response = await refinerAgent.processRequest(writerRequest)

      expect(response.content).toContain('Orwell')
      expect(response.content).toContain('clarity')
    })
  })

  describe('Argument Structure Analysis', () => {
    it('should analyze and strengthen argument structure', async () => {
      const argumentRequest: AgentRequest = {
        userId: 'user-123',
        projectId: 'project-456',
        conversationId: 'conv-789',
        content: 'strengthen the argument in my essay about renewable energy benefits',
        context: {
          projectContent: 'Renewable energy is good. It helps the environment. We should use more of it.',
        },
      }

      const mockResponse = createMockLLMResponse(
        'Your argument needs strengthening in several areas: 1) Thesis clarity - be more specific about which renewable energy benefits you\'re arguing for, 2) Evidence quality - add statistics, expert opinions, and case studies, 3) Address counterarguments - acknowledge concerns about cost and reliability, 4) Logical structure - organize points from strongest to weakest or by category (environmental, economic, social).'
      )

      ;(mockLLMService.generateCompletion as any).mockResolvedValue(mockResponse)

      const response = await refinerAgent.processRequest(argumentRequest)

      expect(response.content).toContain('argument needs strengthening')
      expect(response.suggestions.some(s => s.title.includes('Thesis') || s.title.includes('Strengthen') || s.title.includes('Clarify'))).toBe(true)
      expect(response.suggestions.some(s => s.title.includes('Evidence') || s.title.includes('Support') || s.title.includes('Add'))).toBe(true)
      expect(response.suggestions.some(s => s.title.includes('Counterarguments') || s.title.includes('Address') || s.title.includes('Improve'))).toBe(true)
    })

    it('should identify missing evidence and support', async () => {
      const evidenceRequest: AgentRequest = {
        userId: 'user-123',
        projectId: 'project-456',
        conversationId: 'conv-789',
        content: 'Social media is harmful to teenagers. It causes depression and anxiety. Parents should limit usage.',
        context: {},
      }

      const mockResponse = createMockLLMResponse(
        'Your argument makes strong claims but lacks supporting evidence. Add: 1) Research studies linking social media to mental health issues, 2) Statistics on teenage social media usage and depression rates, 3) Expert opinions from psychologists or researchers, 4) Specific examples or case studies. Also consider addressing counterarguments about social media\'s benefits for connection and learning.'
      )

      ;(mockLLMService.generateCompletion as any).mockResolvedValue(mockResponse)

      const response = await refinerAgent.processRequest(evidenceRequest)

      expect(response.content).toContain('lacks supporting evidence')
      expect(response.suggestions.length).toBeGreaterThan(0)
    })
  }) 
 describe('Flow Improvement', () => {
    it('should identify and suggest flow improvements', async () => {
      const flowRequest: AgentRequest = {
        userId: 'user-123',
        projectId: 'project-456',
        conversationId: 'conv-789',
        content: 'improve the flow of my writing about climate change solutions',
        context: {
          projectContent: 'Solar power is good. Wind power is also good. Nuclear power is controversial. We need all of them.',
        },
      }

      const mockResponse = createMockLLMResponse(
        'Your writing would benefit from better transitions and flow. Currently, each sentence stands alone without connecting to the next. Try: 1) Add transitional phrases ("Furthermore," "In addition," "However"), 2) Create logical progression from one idea to the next, 3) Vary sentence structure and length, 4) Use connecting words to show relationships between ideas.'
      )

      ;(mockLLMService.generateCompletion as any).mockResolvedValue(mockResponse)

      const response = await refinerAgent.processRequest(flowRequest)

      expect(response.content).toContain('transitions and flow')
      expect(response.suggestions.length).toBeGreaterThan(0)
    })

    it('should analyze readability and suggest improvements', async () => {
      const readabilityRequest: AgentRequest = {
        userId: 'user-123',
        projectId: 'project-456',
        conversationId: 'conv-789',
        content: 'The implementation of sustainable energy infrastructure necessitates comprehensive governmental policy frameworks that facilitate the transition from fossil fuel dependency to renewable energy sources through strategic investment allocation and regulatory mechanisms.',
        context: {},
      }

      const mockResponse = createMockLLMResponse(
        'Your sentence is too complex and difficult to read. The 25-word sentence with multiple clauses makes it hard to follow. Try breaking it into shorter sentences: "Sustainable energy infrastructure needs government support. Policy frameworks should help us move from fossil fuels to renewable energy. This requires strategic investment and smart regulations."'
      )

      ;(mockLLMService.generateCompletion as any).mockResolvedValue(mockResponse)

      const response = await refinerAgent.processRequest(readabilityRequest)

      expect(response.content).toContain('too complex')
      expect(response.suggestions.length).toBeGreaterThan(0)
    })
  })

  describe('System Prompt Building', () => {
    it('should build comprehensive system prompts with user context', async () => {
      const context: AgentContext = {
        previousPhases: [],
        userPreferences: {
          preferredAgentPersonality: 'formal',
          writingGenres: ['academic', 'research'],
          experienceLevel: 'ADVANCED',
        },
        styleGuide: {
          referenceWriters: ['orwell', 'baldwin'],
          toneDescription: 'clear and analytical',
          targetAudience: 'academic readers',
          exampleText: 'The evidence suggests that...',
        },
      }

      const systemPrompt = refinerAgent.buildSystemPrompt(context)

      expect(systemPrompt).toContain('writing coach and editor')
      expect(systemPrompt).toContain('Experience Level: ADVANCED')
      expect(systemPrompt).toContain('Preferred Interaction Style: formal')
      expect(systemPrompt).toContain('Writing Genres: academic, research')
      expect(systemPrompt).toContain('Reference Writers: orwell, baldwin')
      expect(systemPrompt).toContain('Desired Tone: clear and analytical')
      expect(systemPrompt).toContain('Target Audience: academic readers')
      expect(systemPrompt).toContain('sophisticated analysis')
    })

    it('should adapt guidance based on experience level', async () => {
      const beginnerContext: AgentContext = {
        previousPhases: [],
        userPreferences: {
          preferredAgentPersonality: 'casual',
          writingGenres: ['blog'],
          experienceLevel: 'BEGINNER',
        },
      }

      const systemPrompt = refinerAgent.buildSystemPrompt(beginnerContext)

      expect(systemPrompt).toContain('detailed explanations')
      expect(systemPrompt).toContain('fundamental writing principles')
      expect(systemPrompt).toContain('step-by-step improvement guidance')
    })
  })

  describe('Response Parsing and Confidence', () => {
    it('should parse LLM responses into structured agent responses', async () => {
      const mockLLMResponse = createMockLLMResponse(
        'Your draft shows strong potential but needs refinement in several areas. Consider strengthening your thesis statement and adding more supporting evidence. Try varying your sentence structure for better flow. You might want to address potential counterarguments to make your argument more persuasive.'
      )

      const response = refinerAgent.parseResponse(mockLLMResponse)

      expect(response.content).toBe(mockLLMResponse.content)
      expect(response.metadata.tokenUsage).toEqual(mockLLMResponse.usage)
      expect(response.metadata.model).toBe(mockLLMResponse.model)
      expect(response.metadata.confidence).toBeGreaterThanOrEqual(0.7)
      expect(response.suggestions.length).toBeGreaterThan(0)
      expect(response.metadata.nextSteps.length).toBeGreaterThan(0)
    })

    it('should extract specific improvement suggestions', async () => {
      const mockLLMResponse = createMockLLMResponse(
        'Consider adding more concrete examples. Try using shorter sentences. You could strengthen your conclusion. Remove unnecessary passive voice constructions.'
      )

      const response = refinerAgent.parseResponse(mockLLMResponse)

      expect(response.suggestions.some(s => s.type === 'improvement')).toBe(true)
      expect(response.suggestions.some(s => s.type === 'action')).toBe(true)
    })

    it('should calculate confidence based on response quality', async () => {
      const shortResponse = createMockLLMResponse('Good draft.')
      const detailedResponse = createMockLLMResponse(
        'Your draft demonstrates strong analytical thinking and clear organization. The thesis is well-positioned and specific. Consider adding more concrete examples to support your second point. The transitions between paragraphs work well, particularly the connection between your introduction and first body paragraph. Try varying your sentence structure in the conclusion for better impact.'
      )

      const shortParsed = refinerAgent.parseResponse(shortResponse)
      const detailedParsed = refinerAgent.parseResponse(detailedResponse)

      expect(detailedParsed.metadata.confidence).toBeGreaterThan(shortParsed.metadata.confidence)
    })
  })

  describe('User Style Profile Learning', () => {
    it('should track user interactions for style learning', async () => {
      const request: AgentRequest = {
        userId: 'user-123',
        projectId: 'project-456',
        conversationId: 'conv-789',
        content: 'Help me improve my writing style',
        context: {},
      }

      const mockResponse = createMockLLMResponse('Style improvement suggestions...')
      ;(mockLLMService.generateCompletion as any).mockResolvedValue(mockResponse)

      // Process multiple requests to build learning history
      await refinerAgent.processRequest(request)
      await refinerAgent.processRequest({ ...request, content: 'More style help please' })

      const metrics = await refinerAgent.getMetrics()
      expect(metrics.userStyleProfiles).toBe(1) // Should have created profile for user-123
    })
  })

  describe('Error Handling', () => {
    it('should handle LLM service errors gracefully', async () => {
      const request: AgentRequest = {
        userId: 'user-123',
        projectId: 'project-456',
        conversationId: 'conv-789',
        content: 'Help me refine my draft',
        context: {},
      }

      ;(mockLLMService.generateCompletion as any).mockRejectedValue(
        new Error('LLM service unavailable')
      )

      await expect(refinerAgent.processRequest(request)).rejects.toThrow('LLM service unavailable')
    })

    it('should handle health check failures', async () => {
      mockHealthCheck.mockResolvedValue({ status: 'unhealthy' })

      const isHealthy = await refinerAgent.healthCheck()
      expect(isHealthy).toBe(false)
    })
  })

  describe('Draft Analysis Engine', () => {
    it('should analyze draft metrics correctly', async () => {
      const request: AgentRequest = {
        userId: 'user-123',
        projectId: 'project-456',
        conversationId: 'conv-789',
        content: sampleDrafts.goodStructure,
        context: {},
      }

      const mockResponse = createMockLLMResponse('Analysis complete')
      ;(mockLLMService.generateCompletion as any).mockResolvedValue(mockResponse)

      const response = await refinerAgent.processRequest(request)

      // The agent should have analyzed the draft internally
      expect(response.metadata.confidence).toBeGreaterThanOrEqual(0.7)
      expect(response.suggestions.length).toBeGreaterThan(0)
    })

    it('should cache analysis results for efficiency', async () => {
      const request: AgentRequest = {
        userId: 'user-123',
        projectId: 'project-456',
        conversationId: 'conv-789',
        content: sampleDrafts.goodStructure,
        context: {},
      }

      const mockResponse = createMockLLMResponse('Analysis complete')
      ;(mockLLMService.generateCompletion as any).mockResolvedValue(mockResponse)

      // Process same content twice
      await refinerAgent.processRequest(request)
      await refinerAgent.processRequest(request)

      const metrics = await refinerAgent.getMetrics()
      expect(metrics.cachedAnalyses).toBeGreaterThan(0)
    })
  })

  describe('Integration with Agent Capabilities', () => {
    it('should respect agent capabilities for phase handling', () => {
      expect(refinerAgent.capabilities.canHandlePhase('REFINER')).toBe(true)
      expect(refinerAgent.capabilities.canHandlePhase('IDEATION')).toBe(false)
    })

    it('should respect content type capabilities', () => {
      expect(refinerAgent.capabilities.canProcessContent('text')).toBe(true)
      expect(refinerAgent.capabilities.canProcessContent('markdown')).toBe(true)
      expect(refinerAgent.capabilities.canProcessContent('html')).toBe(true)
      expect(refinerAgent.capabilities.canProcessContent('image')).toBe(false)
    })

    it('should have appropriate cost estimation', () => {
      expect(refinerAgent.capabilities.estimatedCostPerRequest).toBe(0.015)
    })
  })

  describe('Style Guide Integration', () => {
    it('should work with different style guide configurations', async () => {
      const academicStyleGuide: StyleGuide = {
        toneDescription: 'formal and objective',
        targetAudience: 'academic researchers',
        exampleText: 'The research indicates that...',
      }

      const request: AgentRequest = {
        userId: 'user-123',
        projectId: 'project-456',
        conversationId: 'conv-789',
        content: 'This is like, totally important research that everyone should know about.',
        context: { 
          previousPhases: [],
          userPreferences: {
            preferredAgentPersonality: 'formal',
            writingGenres: ['academic'],
            experienceLevel: 'INTERMEDIATE',
          },
          styleGuide: academicStyleGuide 
        },
      }

      const mockResponse = createMockLLMResponse(
        'Your tone is too casual for academic writing. Replace "like, totally important" with "significant" or "crucial". Academic writing requires formal, objective language.'
      )

      ;(mockLLMService.generateCompletion as any).mockResolvedValue(mockResponse)

      const response = await refinerAgent.processRequest(request)

      expect(response.content).toContain('too casual for academic')
      expect(mockLLMService.generateCompletion).toHaveBeenCalledWith(
        expect.objectContaining({
          context: expect.stringContaining('formal and objective'),
        })
      )
    })
  })
})