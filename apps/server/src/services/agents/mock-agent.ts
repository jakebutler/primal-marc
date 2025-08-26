import { 
  BaseAgent, 
  AgentType, 
  AgentCapabilities, 
  AgentRequest, 
  AgentResponse, 
  AgentContext,
  Suggestion
} from './base-agent.js'
import { LLMService, LLMResponse } from '../llm.js'
import { logger } from '../../utils/logger.js'

/**
 * Mock agent implementation for testing and development
 * This will be replaced with actual agent implementations in future tasks
 */
export class MockAgent extends BaseAgent {
  private mockResponses: Map<AgentType, string[]> = new Map()
  private requestCount: number = 0

  constructor(
    type: AgentType,
    capabilities: AgentCapabilities,
    llmService: LLMService
  ) {
    super(type, capabilities, llmService)
    this.initializeMockResponses()
  }

  // Initialize mock responses for different agent types
  private initializeMockResponses(): void {
    this.mockResponses.set('IDEATION', [
      "Great idea! Let's explore this concept further. What specific aspect interests you most?",
      "I can help you brainstorm around this topic. Have you considered approaching it from a different angle?",
      "This has potential! Let's structure your thoughts and create an outline.",
      "Interesting concept. What's your target audience for this piece?",
    ])

    this.mockResponses.set('REFINER', [
      "Your draft has good bones. Let's work on strengthening the argument structure.",
      "I notice some areas where we can improve flow and clarity. Here are my suggestions:",
      "The style is engaging, but we can make it more consistent throughout.",
      "Your voice comes through well. Let's refine the transitions between sections.",
    ])

    this.mockResponses.set('MEDIA', [
      "I can help you create visual content for this piece. What type of media would work best?",
      "Let's add some engaging visuals. I'm thinking charts or infographics would work well here.",
      "This section would benefit from a relevant meme or image to break up the text.",
      "I can source some images or create original graphics to enhance your content.",
    ])

    this.mockResponses.set('FACTCHECKER', [
      "I've identified several claims that need verification. Let me research these for you.",
      "Your facts check out! I've found supporting sources for your main points.",
      "There are a few statements that could use stronger citations. Here's what I found:",
      "For SEO optimization, consider adding these relevant links and keywords.",
    ])
  }

  // Process request with mock response
  async processRequest(request: AgentRequest): Promise<AgentResponse> {
    const startTime = Date.now()
    this.requestCount++

    try {
      logger.info(`Mock ${this.type} agent processing request`, {
        userId: request.userId,
        projectId: request.projectId,
        contentLength: request.content.length,
      })

      // Simulate processing delay
      await this.simulateProcessingDelay()

      // Get mock response
      const mockContent = this.getMockResponse()

      // Create mock LLM response
      const mockLLMResponse: LLMResponse = {
        content: mockContent,
        usage: {
          promptTokens: Math.floor(request.content.length / 4), // Rough token estimate
          completionTokens: Math.floor(mockContent.length / 4),
          totalTokens: Math.floor((request.content.length + mockContent.length) / 4),
          cost: this.capabilities.estimatedCostPerRequest,
        },
        model: 'mock-model',
        requestId: `mock_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        metadata: request.metadata,
      }

      // Parse the mock response
      const response = this.parseResponse(mockLLMResponse)

      const processingTime = Date.now() - startTime
      logger.info(`Mock ${this.type} agent completed request`, {
        processingTime,
        tokenUsage: response.metadata.tokenUsage.totalTokens,
      })

      return response

    } catch (error) {
      logger.error(`Mock ${this.type} agent failed to process request:`, error)
      throw error
    }
  }

  // Build system prompt (mock implementation)
  buildSystemPrompt(context: AgentContext): string {
    const basePrompt = this.getBaseSystemPrompt()
    
    let prompt = basePrompt

    if (context.userPreferences) {
      prompt += `\n\nUser Preferences:
- Experience Level: ${context.userPreferences.experienceLevel}
- Preferred Personality: ${context.userPreferences.preferredAgentPersonality}
- Writing Genres: ${context.userPreferences.writingGenres.join(', ')}`
    }

    if (context.styleGuide) {
      prompt += `\n\nStyle Guide:
- Target Audience: ${context.styleGuide.targetAudience || 'General'}
- Tone: ${context.styleGuide.toneDescription || 'Professional'}
- Reference Writers: ${context.styleGuide.referenceWriters?.join(', ') || 'None specified'}`
    }

    if (context.previousPhases && context.previousPhases.length > 0) {
      prompt += `\n\nPrevious Phases Completed:
${context.previousPhases.map(phase => `- ${phase.phaseType}: ${phase.summary}`).join('\n')}`
    }

    return prompt
  }

  // Parse LLM response into agent response
  parseResponse(llmResponse: LLMResponse): AgentResponse {
    const suggestions = this.generateMockSuggestions()

    return {
      content: llmResponse.content,
      suggestions,
      metadata: {
        processingTime: 1000 + Math.random() * 2000, // 1-3 seconds
        tokenUsage: llmResponse.usage,
        model: llmResponse.model,
        confidence: 0.8 + Math.random() * 0.2, // 80-100% confidence
        nextSteps: this.generateNextSteps(),
      },
    }
  }

  // Get base system prompt for agent type
  private getBaseSystemPrompt(): string {
    const prompts = {
      IDEATION: `You are an AI writing assistant specializing in ideation and concept development. 
Your role is to help writers brainstorm ideas, overcome writer's block, and structure their initial concepts.
Be encouraging, creative, and ask thought-provoking questions to spark creativity.`,

      REFINER: `You are an AI writing assistant specializing in draft refinement and style improvement.
Your role is to analyze writing structure, improve flow, and help writers develop their unique voice.
Provide specific, actionable feedback while maintaining the writer's original intent.`,

      MEDIA: `You are an AI writing assistant specializing in visual content creation and media integration.
Your role is to suggest, create, and source relevant images, memes, charts, and other visual elements.
Focus on enhancing the written content with engaging and appropriate visual elements.`,

      FACTCHECKER: `You are an AI writing assistant specializing in fact-checking and SEO optimization.
Your role is to verify claims, provide citations, and optimize content for search engines.
Be thorough in research and provide reliable sources for all factual claims.`,
    }

    return prompts[this.type] || prompts.IDEATION
  }

  // Get mock response based on agent type
  private getMockResponse(): string {
    const responses = this.mockResponses.get(this.type) || []
    if (responses.length === 0) {
      return "I'm here to help with your writing!"
    }
    const randomIndex = Math.floor(Math.random() * responses.length)
    return responses[randomIndex] || "I'm here to help with your writing!"
  }

  // Generate mock suggestions
  private generateMockSuggestions(): Suggestion[] {
    const suggestionTemplates = {
      IDEATION: [
        { type: 'question' as const, title: 'Explore Different Angles', description: 'What if you approached this topic from your reader\'s perspective?' },
        { type: 'action' as const, title: 'Create an Outline', description: 'Let\'s structure your ideas into a logical flow' },
        { type: 'resource' as const, title: 'Research Similar Topics', description: 'I can help you find related content for inspiration' },
      ],
      REFINER: [
        { type: 'improvement' as const, title: 'Strengthen Transitions', description: 'Add connecting phrases between paragraphs' },
        { type: 'improvement' as const, title: 'Vary Sentence Length', description: 'Mix short and long sentences for better rhythm' },
        { type: 'action' as const, title: 'Check Consistency', description: 'Ensure your tone remains consistent throughout' },
      ],
      MEDIA: [
        { type: 'action' as const, title: 'Add Visual Break', description: 'Insert an image or chart here to break up text' },
        { type: 'resource' as const, title: 'Source Relevant Images', description: 'I can find images that match your content theme' },
        { type: 'action' as const, title: 'Create Infographic', description: 'Turn these statistics into a visual chart' },
      ],
      FACTCHECKER: [
        { type: 'action' as const, title: 'Verify Claims', description: 'Let me check the accuracy of this statement' },
        { type: 'improvement' as const, title: 'Add Citations', description: 'Include sources for these factual claims' },
        { type: 'resource' as const, title: 'SEO Keywords', description: 'Consider adding these relevant keywords' },
      ],
    }

    const templates = suggestionTemplates[this.type] || suggestionTemplates.IDEATION
    if (!templates || templates.length === 0) {
      return []
    }
    
    const numSuggestions = Math.floor(Math.random() * Math.min(3, templates.length)) + 1 // 1-3 suggestions, but not more than available

    return templates.slice(0, numSuggestions).map(template => 
      this.createSuggestion(
        template.type,
        template.title,
        template.description,
        'medium'
      )
    )
  }

  // Generate next steps
  private generateNextSteps(): string[] {
    const nextStepsTemplates = {
      IDEATION: [
        'Develop your main concept further',
        'Create a detailed outline',
        'Research supporting information',
      ],
      REFINER: [
        'Review and revise based on feedback',
        'Check for consistency in tone',
        'Proofread for grammar and style',
      ],
      MEDIA: [
        'Add visual elements to enhance content',
        'Optimize images for web use',
        'Consider interactive elements',
      ],
      FACTCHECKER: [
        'Verify all factual claims',
        'Add proper citations',
        'Optimize for search engines',
      ],
    }

    return nextStepsTemplates[this.type] || nextStepsTemplates.IDEATION
  }

  // Simulate processing delay
  private async simulateProcessingDelay(): Promise<void> {
    const delay = 500 + Math.random() * 1500 // 0.5-2 seconds
    await new Promise(resolve => setTimeout(resolve, delay))
  }

  // Protected method implementations
  protected async performInitialization(): Promise<void> {
    logger.info(`Initializing mock ${this.type} agent`)
    // Mock initialization - no actual setup needed
    await new Promise(resolve => setTimeout(resolve, 100))
  }

  protected async performCleanup(): Promise<void> {
    logger.info(`Cleaning up mock ${this.type} agent`)
    // Mock cleanup - no actual cleanup needed
    this.requestCount = 0
  }

  protected async performHealthCheck(): Promise<boolean> {
    // Mock agents are always healthy
    return true
  }

  protected async getSpecificMetrics(): Promise<Record<string, any>> {
    return {
      requestCount: this.requestCount,
      mockResponsesAvailable: this.mockResponses.get(this.type)?.length || 0,
      lastRequestTime: new Date().toISOString(),
    }
  }
}