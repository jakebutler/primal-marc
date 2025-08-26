import { 
  BaseAgent, 
  AgentType, 
  AgentCapabilities, 
  AgentRequest, 
  AgentResponse, 
  AgentContext,
  Suggestion,
  PhaseResult
} from './base-agent.js'
import { LLMService, LLMResponse } from '../llm.js'
import { logger } from '../../utils/logger.js'

// Ideation-specific interfaces
export interface IdeationContext extends AgentContext {
  brainstormingSession?: BrainstormingSession
  conceptMap?: ConceptMap
  ideationGoals?: IdeationGoals
}

export interface BrainstormingSession {
  sessionId: string
  topic?: string
  ideas: GeneratedIdea[]
  currentFocus: string
  sessionType: 'freeform' | 'structured' | 'problem_solving'
  startedAt: Date
}

export interface GeneratedIdea {
  id: string
  content: string
  category: string
  confidence: number
  connections: string[] // IDs of related ideas
  refinementLevel: 'raw' | 'developed' | 'structured'
  timestamp: Date
}

export interface ConceptMap {
  centralTheme: string
  mainBranches: ConceptBranch[]
  connections: ConceptConnection[]
}

export interface ConceptBranch {
  id: string
  title: string
  description: string
  subConcepts: string[]
  importance: 'high' | 'medium' | 'low'
}

export interface ConceptConnection {
  fromId: string
  toId: string
  relationshipType: 'supports' | 'contrasts' | 'builds_on' | 'example_of'
  strength: number // 0-1
}

export interface IdeationGoals {
  primaryObjective: string
  targetAudience?: string
  contentType: 'article' | 'blog_post' | 'essay' | 'story' | 'other'
  desiredLength?: 'short' | 'medium' | 'long'
  tone?: 'formal' | 'casual' | 'creative' | 'academic'
}

// Cold-start prompts for different scenarios
const COLD_START_PROMPTS = {
  general: [
    "What's something you've been curious about lately that you'd like to explore?",
    "Think about a recent conversation that sparked your interest. What made it memorable?",
    "What's a common assumption in your field that you'd like to challenge?",
    "If you could explain one complex topic to a friend, what would it be?",
    "What's a problem you've noticed that others might not have considered?"
  ],
  creative: [
    "What if the opposite of what everyone believes were true?",
    "Imagine you're writing a letter to yourself from 10 years in the future. What would it say?",
    "What's a mundane daily activity that could be the basis for an interesting story?",
    "If you could combine two completely unrelated concepts, what would they be?",
    "What's something everyone takes for granted that deserves more attention?"
  ],
  analytical: [
    "What's a trend you've noticed that others might be missing?",
    "What data or evidence would change your mind about something you believe?",
    "What's a cause-and-effect relationship that isn't immediately obvious?",
    "What would happen if we approached this problem from the opposite direction?",
    "What are the second and third-order effects of a recent change in your field?"
  ],
  personal: [
    "What's a lesson you learned the hard way that others could benefit from?",
    "What's something you wish you had known earlier in your career or life?",
    "What's a skill or perspective you've developed that might be valuable to others?",
    "What's a mistake you see people making repeatedly?",
    "What's something you've changed your mind about recently?"
  ]
}

// Concept structuring templates
const STRUCTURING_TEMPLATES = {
  problem_solution: {
    name: "Problem-Solution Framework",
    structure: ["Problem Definition", "Current Approaches", "Proposed Solution", "Implementation", "Expected Outcomes"],
    description: "Ideal for addressing specific challenges or proposing improvements"
  },
  compare_contrast: {
    name: "Compare and Contrast",
    structure: ["Introduction", "Similarities", "Key Differences", "Implications", "Conclusion"],
    description: "Perfect for analyzing two or more concepts, approaches, or ideas"
  },
  chronological: {
    name: "Chronological Narrative",
    structure: ["Background/Context", "Early Developments", "Key Turning Points", "Current State", "Future Implications"],
    description: "Great for historical analysis or tracing the evolution of ideas"
  },
  cause_effect: {
    name: "Cause and Effect Analysis",
    structure: ["Initial Conditions", "Primary Causes", "Immediate Effects", "Long-term Consequences", "Lessons Learned"],
    description: "Useful for analyzing complex relationships and outcomes"
  },
  how_to: {
    name: "How-To Guide",
    structure: ["Overview", "Prerequisites", "Step-by-Step Process", "Common Pitfalls", "Advanced Tips"],
    description: "Perfect for instructional or educational content"
  }
}

/**
 * Ideation Agent - Specializes in brainstorming, concept development, and creative thinking
 */
export class IdeationAgent extends BaseAgent {
  private brainstormingSessions: Map<string, BrainstormingSession> = new Map()
  private conceptMaps: Map<string, ConceptMap> = new Map()

  constructor(capabilities: AgentCapabilities, llmService: LLMService) {
    super('IDEATION', capabilities, llmService)
  }

  /**
   * Process ideation request with context-aware brainstorming
   */
  async processRequest(request: AgentRequest): Promise<AgentResponse> {
    const startTime = Date.now()

    try {
      logger.info(`Ideation agent processing request`, {
        userId: request.userId,
        projectId: request.projectId,
        contentLength: request.content.length,
      })

      // Determine the type of ideation request
      const requestType = this.analyzeRequestType(request)
      
      // Build context for the request
      const systemContext = await this.buildContext(request)
      
      // Generate response based on request type
      let response: AgentResponse

      switch (requestType) {
        case 'cold_start':
          response = await this.handleColdStart(request, systemContext)
          break
        case 'brainstorming':
          response = await this.handleBrainstorming(request, systemContext)
          break
        case 'concept_structuring':
          response = await this.handleConceptStructuring(request, systemContext)
          break
        case 'idea_refinement':
          response = await this.handleIdeaRefinement(request, systemContext)
          break
        case 'idea_expansion':
          response = await this.handleIdeaExpansion(request, systemContext)
          break
        default:
          response = await this.handleGeneralIdeation(request, systemContext)
      }

      const processingTime = Date.now() - startTime
      logger.info(`Ideation agent completed request`, {
        requestType,
        processingTime,
        tokenUsage: response.metadata.tokenUsage.totalTokens,
      })

      return response

    } catch (error) {
      logger.error(`Ideation agent failed to process request:`, error)
      throw error
    }
  }

  /**
   * Build system prompt for ideation tasks
   */
  buildSystemPrompt(context: AgentContext): string {
    let prompt = `You are an expert ideation and brainstorming assistant. Your role is to help writers overcome creative blocks, develop compelling ideas, and structure their thoughts effectively.

Core Capabilities:
- Generate thought-provoking questions and prompts
- Facilitate creative brainstorming sessions
- Help structure and organize ideas logically
- Provide fresh perspectives and alternative angles
- Guide users from vague concepts to concrete, actionable ideas

Communication Style:
- Be encouraging and supportive
- Ask open-ended questions that spark creativity
- Offer multiple perspectives and approaches
- Build on user ideas rather than replacing them
- Maintain enthusiasm while being practical`

    // Add user preferences
    if (context.userPreferences) {
      const personality = context.userPreferences.preferredAgentPersonality
      const experience = context.userPreferences.experienceLevel
      
      prompt += `\n\nUser Context:
- Experience Level: ${experience}
- Preferred Interaction Style: ${personality}
- Writing Genres: ${context.userPreferences.writingGenres.join(', ') || 'General'}`

      // Adjust approach based on experience level
      if (experience === 'BEGINNER') {
        prompt += `\n- Provide more guidance and structure
- Explain creative techniques and frameworks
- Offer specific examples and templates`
      } else if (experience === 'ADVANCED') {
        prompt += `\n- Focus on sophisticated techniques and nuanced approaches
- Challenge assumptions and push creative boundaries
- Provide minimal scaffolding, maximum creative freedom`
      }
    }

    // Add project context if available
    if (context.projectContent) {
      prompt += `\n\nCurrent Project Content:
${context.projectContent.substring(0, 500)}${context.projectContent.length > 500 ? '...' : ''}`
    }

    // Add previous phase context
    if (context.previousPhases && context.previousPhases.length > 0) {
      prompt += `\n\nPrevious Work:
${context.previousPhases.map(phase => `- ${phase.phaseType}: ${phase.summary}`).join('\n')}`
    }

    return prompt
  }

  /**
   * Parse LLM response into structured agent response
   */
  parseResponse(llmResponse: LLMResponse): AgentResponse {
    const content = llmResponse.content
    const suggestions = this.extractSuggestions(content)
    const nextSteps = this.generateNextSteps(content)

    return {
      content,
      suggestions,
      metadata: {
        processingTime: Date.now(),
        tokenUsage: llmResponse.usage,
        model: llmResponse.model,
        confidence: this.calculateConfidence(content),
        nextSteps,
      },
    }
  }

  /**
   * Analyze the type of ideation request
   */
  private analyzeRequestType(request: AgentRequest): string {
    const content = request.content.toLowerCase()
    const hasContent = request.context?.projectContent && request.context.projectContent.length > 50

    // Cold start indicators
    if (!hasContent && (
      content.includes('help me start') ||
      content.includes('don\'t know what to write') ||
      content.includes('writer\'s block') ||
      content.includes('need ideas') ||
      content.length < 50
    )) {
      return 'cold_start'
    }

    // Concept structuring indicators
    if (content.includes('organize') ||
        content.includes('structure') ||
        content.includes('outline') ||
        content.includes('framework')) {
      return 'concept_structuring'
    }

    // Idea refinement indicators
    if (content.includes('refine') ||
        content.includes('improve') ||
        content.includes('develop further') ||
        content.includes('make better')) {
      return 'idea_refinement'
    }

    // Idea expansion indicators
    if (content.includes('expand') ||
        content.includes('more ideas') ||
        content.includes('build on') ||
        content.includes('explore further')) {
      return 'idea_expansion'
    }

    // Default to brainstorming
    return 'brainstorming'
  }

  /**
   * Handle cold start scenarios with thought-provoking prompts
   */
  private async handleColdStart(request: AgentRequest, systemContext: string): Promise<AgentResponse> {
    // Determine the best prompt category based on user preferences
    const userPrefs = request.context?.userPreferences
    let promptCategory = 'general'

    if (userPrefs?.preferredAgentPersonality === 'creative') {
      promptCategory = 'creative'
    } else if (userPrefs?.writingGenres.includes('academic') || userPrefs?.writingGenres.includes('technical')) {
      promptCategory = 'analytical'
    } else if (userPrefs?.writingGenres.includes('personal') || userPrefs?.writingGenres.includes('memoir')) {
      promptCategory = 'personal'
    }

    const prompts = COLD_START_PROMPTS[promptCategory as keyof typeof COLD_START_PROMPTS] || COLD_START_PROMPTS.general
    const selectedPrompts = this.selectRandomItems(prompts, 3)

    const coldStartPrompt = `The user is experiencing writer's block or needs help getting started. Provide encouraging guidance and ask thought-provoking questions to spark their creativity.

Here are some suggested conversation starters you can adapt or build upon:
${selectedPrompts.map((prompt, i) => `${i + 1}. ${prompt}`).join('\n')}

Respond with warmth and enthusiasm, and ask 1-2 specific questions to help them discover their topic.`

    const llmResponse = await this.makeLLMRequest(request, systemContext + '\n\n' + coldStartPrompt, {
      temperature: 0.8, // Higher creativity for cold starts
      maxTokens: 800,
    })

    const response = this.parseResponse(llmResponse)
    
    // Add cold-start specific suggestions
    response.suggestions.push(
      this.createSuggestion('question', 'Explore Personal Experiences', 'What personal experiences could inform your writing?', 'high'),
      this.createSuggestion('action', 'Try Free Writing', 'Spend 10 minutes writing about anything that comes to mind', 'medium'),
      this.createSuggestion('resource', 'Browse Trending Topics', 'Look at current events or trending discussions for inspiration', 'low')
    )

    return response
  }

  /**
   * Handle brainstorming sessions with idea generation
   */
  private async handleBrainstorming(request: AgentRequest, systemContext: string): Promise<AgentResponse> {
    const sessionId = `${request.projectId}_${Date.now()}`
    
    // Create or update brainstorming session
    const session: BrainstormingSession = {
      sessionId,
      topic: this.extractTopic(request.content),
      ideas: [],
      currentFocus: request.content,
      sessionType: 'freeform',
      startedAt: new Date(),
    }

    this.brainstormingSessions.set(sessionId, session)

    const brainstormingPrompt = `Engage in a creative brainstorming session with the user. Help them generate multiple ideas, explore different angles, and build on their initial thoughts.

User's current focus: "${request.content}"

Guidelines:
- Generate 3-5 related ideas or angles
- Ask questions that open new possibilities
- Encourage wild ideas and creative connections
- Help them see their topic from different perspectives
- Build enthusiasm and momentum`

    const llmResponse = await this.makeLLMRequest(request, systemContext + '\n\n' + brainstormingPrompt, {
      temperature: 0.9, // Maximum creativity for brainstorming
      maxTokens: 1000,
    })

    const response = this.parseResponse(llmResponse)
    
    // Add brainstorming-specific suggestions
    response.suggestions.push(
      this.createSuggestion('action', 'Mind Map Creation', 'Create a visual mind map of your ideas', 'high'),
      this.createSuggestion('question', 'Alternative Perspectives', 'What would someone from a different background think about this?', 'medium'),
      this.createSuggestion('action', 'Idea Combination', 'Try combining two seemingly unrelated ideas', 'medium')
    )

    return response
  }

  /**
   * Handle concept structuring with frameworks and templates
   */
  private async handleConceptStructuring(request: AgentRequest, systemContext: string): Promise<AgentResponse> {
    // Analyze content to suggest appropriate structure
    const suggestedTemplate = this.suggestStructuringTemplate(request.content)
    
    const structuringPrompt = `Help the user organize and structure their ideas into a coherent framework. 

User's content to structure: "${request.content}"

Recommended framework: ${suggestedTemplate.name}
Description: ${suggestedTemplate.description}
Structure: ${suggestedTemplate.structure.join(' → ')}

Guidelines:
- Explain why this structure works for their content
- Help them organize their ideas into the framework
- Identify any gaps that need to be filled
- Suggest logical flow and transitions
- Provide a clear outline they can follow`

    const llmResponse = await this.makeLLMRequest(request, systemContext + '\n\n' + structuringPrompt, {
      temperature: 0.6, // Balanced creativity and structure
      maxTokens: 1200,
    })

    const response = this.parseResponse(llmResponse)
    
    // Add structuring-specific suggestions
    response.suggestions.push(
      this.createSuggestion('action', 'Create Detailed Outline', 'Develop a detailed outline based on the suggested structure', 'high'),
      this.createSuggestion('improvement', 'Identify Gaps', 'Look for missing elements in your argument or narrative', 'medium'),
      this.createSuggestion('action', 'Test Structure', 'Try explaining your idea using this structure to someone else', 'low')
    )

    return response
  }

  /**
   * Handle idea refinement with focused development
   */
  private async handleIdeaRefinement(request: AgentRequest, systemContext: string): Promise<AgentResponse> {
    const refinementPrompt = `Help the user refine and develop their existing ideas. Focus on depth, clarity, and compelling angles.

User's idea to refine: "${request.content}"

Guidelines:
- Identify the strongest aspects of their idea
- Suggest ways to make it more specific and focused
- Help them find unique angles or perspectives
- Identify potential weaknesses and how to address them
- Suggest ways to make the idea more compelling to their audience`

    const llmResponse = await this.makeLLMRequest(request, systemContext + '\n\n' + refinementPrompt, {
      temperature: 0.7,
      maxTokens: 1000,
    })

    const response = this.parseResponse(llmResponse)
    
    // Add refinement-specific suggestions
    response.suggestions.push(
      this.createSuggestion('improvement', 'Sharpen Focus', 'Make your main argument more specific and targeted', 'high'),
      this.createSuggestion('question', 'Test Assumptions', 'What assumptions are you making that could be challenged?', 'medium'),
      this.createSuggestion('action', 'Find Examples', 'Look for concrete examples that support your idea', 'medium')
    )

    return response
  }

  /**
   * Handle idea expansion with creative exploration
   */
  private async handleIdeaExpansion(request: AgentRequest, systemContext: string): Promise<AgentResponse> {
    const expansionPrompt = `Help the user expand their ideas in creative and meaningful ways. Explore related concepts, implications, and new directions.

User's idea to expand: "${request.content}"

Guidelines:
- Suggest related topics and subtopics
- Explore implications and consequences
- Find connections to other fields or domains
- Suggest different formats or approaches
- Help them see broader applications of their idea`

    const llmResponse = await this.makeLLMRequest(request, systemContext + '\n\n' + expansionPrompt, {
      temperature: 0.8,
      maxTokens: 1000,
    })

    const response = this.parseResponse(llmResponse)
    
    // Add expansion-specific suggestions
    response.suggestions.push(
      this.createSuggestion('action', 'Explore Connections', 'Find connections between your idea and other topics', 'high'),
      this.createSuggestion('question', 'Scale Up/Down', 'How would this idea work at a larger or smaller scale?', 'medium'),
      this.createSuggestion('resource', 'Research Related Fields', 'Look into adjacent fields for inspiration', 'low')
    )

    return response
  }

  /**
   * Handle general ideation requests
   */
  private async handleGeneralIdeation(request: AgentRequest, systemContext: string): Promise<AgentResponse> {
    const generalPrompt = `Engage with the user's ideas and help them develop their thinking. Be creative, supportive, and ask insightful questions.

User's input: "${request.content}"

Guidelines:
- Respond to their specific ideas and questions
- Offer fresh perspectives and creative angles
- Ask questions that deepen their thinking
- Suggest practical next steps
- Maintain enthusiasm and encouragement`

    const llmResponse = await this.makeLLMRequest(request, systemContext + '\n\n' + generalPrompt, {
      temperature: 0.7,
      maxTokens: 1000,
    })

    return this.parseResponse(llmResponse)
  }

  /**
   * Extract topic from user content
   */
  private extractTopic(content: string): string {
    // Simple topic extraction - could be enhanced with NLP
    const sentences = content.split(/[.!?]+/)
    const firstSentence = sentences[0]?.trim()
    return firstSentence || content.substring(0, 100)
  }

  /**
   * Suggest appropriate structuring template based on content
   */
  private suggestStructuringTemplate(content: string): typeof STRUCTURING_TEMPLATES[keyof typeof STRUCTURING_TEMPLATES] {
    const lowerContent = content.toLowerCase()

    if (lowerContent.includes('problem') || lowerContent.includes('solution') || lowerContent.includes('fix')) {
      return STRUCTURING_TEMPLATES.problem_solution
    }
    
    if (lowerContent.includes('compare') || lowerContent.includes('versus') || lowerContent.includes('different')) {
      return STRUCTURING_TEMPLATES.compare_contrast
    }
    
    if (lowerContent.includes('history') || lowerContent.includes('evolution') || lowerContent.includes('timeline')) {
      return STRUCTURING_TEMPLATES.chronological
    }
    
    if (lowerContent.includes('cause') || lowerContent.includes('effect') || lowerContent.includes('result')) {
      return STRUCTURING_TEMPLATES.cause_effect
    }
    
    if (lowerContent.includes('how to') || lowerContent.includes('guide') || lowerContent.includes('tutorial')) {
      return STRUCTURING_TEMPLATES.how_to
    }

    // Default to problem-solution as it's most versatile
    return STRUCTURING_TEMPLATES.problem_solution
  }

  /**
   * Extract suggestions from LLM response content
   */
  private extractSuggestions(content: string): Suggestion[] {
    const suggestions: Suggestion[] = []
    
    // Look for question patterns
    const questionMatches = content.match(/\?[^?]*\?/g) || []
    questionMatches.slice(0, 2).forEach(question => {
      suggestions.push(this.createSuggestion(
        'question',
        'Explore This Question',
        question.replace(/\?/g, '').trim(),
        'medium'
      ))
    })

    // Look for action patterns
    const actionWords = ['try', 'consider', 'explore', 'create', 'develop', 'write']
    const sentences = content.split(/[.!?]+/)
    
    sentences.forEach(sentence => {
      const lowerSentence = sentence.toLowerCase()
      if (actionWords.some(word => lowerSentence.includes(word))) {
        suggestions.push(this.createSuggestion(
          'action',
          'Take Action',
          sentence.trim(),
          'medium'
        ))
      }
    })

    return suggestions.slice(0, 4) // Limit to 4 suggestions
  }

  /**
   * Generate next steps based on response content
   */
  private generateNextSteps(content: string): string[] {
    const steps = [
      'Continue developing your ideas through conversation',
      'Create a rough outline of your main points',
      'Research supporting information for your topic',
    ]

    // Add context-specific steps based on content
    if (content.toLowerCase().includes('outline')) {
      steps.push('Expand your outline with more detailed points')
    }
    
    if (content.toLowerCase().includes('research')) {
      steps.push('Gather credible sources and evidence')
    }
    
    if (content.toLowerCase().includes('audience')) {
      steps.push('Define your target audience more specifically')
    }

    return steps.slice(0, 4)
  }

  /**
   * Calculate confidence score based on response quality
   */
  private calculateConfidence(content: string): number {
    let confidence = 0.7 // Base confidence

    // Increase confidence for longer, more detailed responses
    if (content.length > 500) confidence += 0.1
    if (content.length > 1000) confidence += 0.1

    // Increase confidence for responses with questions (shows engagement)
    const questionCount = (content.match(/\?/g) || []).length
    confidence += Math.min(questionCount * 0.05, 0.15)

    // Increase confidence for structured responses
    if (content.includes('1.') || content.includes('•') || content.includes('-')) {
      confidence += 0.05
    }

    return Math.min(confidence, 1.0)
  }

  /**
   * Select random items from an array
   */
  private selectRandomItems<T>(array: T[], count: number): T[] {
    const shuffled = [...array].sort(() => 0.5 - Math.random())
    return shuffled.slice(0, count)
  }

  // Protected method implementations
  protected async performInitialization(): Promise<void> {
    logger.info('Initializing Ideation agent')
    // Initialize any agent-specific resources
    this.brainstormingSessions.clear()
    this.conceptMaps.clear()
  }

  protected async performCleanup(): Promise<void> {
    logger.info('Cleaning up Ideation agent')
    this.brainstormingSessions.clear()
    this.conceptMaps.clear()
  }

  protected async performHealthCheck(): Promise<boolean> {
    // Check if LLM service is available and agent is properly initialized
    return this.initialized && await this.llmService.healthCheck().then(h => h.status === 'healthy')
  }

  protected async getSpecificMetrics(): Promise<Record<string, any>> {
    return {
      activeBrainstormingSessions: this.brainstormingSessions.size,
      activeConceptMaps: this.conceptMaps.size,
      coldStartPromptsAvailable: Object.values(COLD_START_PROMPTS).flat().length,
      structuringTemplatesAvailable: Object.keys(STRUCTURING_TEMPLATES).length,
    }
  }
}