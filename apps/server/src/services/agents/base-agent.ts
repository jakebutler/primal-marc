import { ConversationContext, MessageMetadata, PhaseOutput } from '@primal-marc/shared'
import { LLMService, LLMRequest, LLMResponse } from '../llm.js'
import { logger } from '../../utils/logger.js'

// Agent types
export type AgentType = 'IDEATION' | 'REFINER' | 'MEDIA' | 'FACTCHECKER'

// Agent request interface
export interface AgentRequest {
  userId: string
  projectId: string
  conversationId: string
  content: string
  context?: AgentContext
  metadata?: Record<string, any>
}

// Agent response interface
export interface AgentResponse {
  content: string
  suggestions: Suggestion[]
  metadata: AgentMetadata
  phaseOutputs?: PhaseOutput[]
}

// Agent context interface
export interface AgentContext {
  previousPhases: PhaseResult[]
  userPreferences: UserPreferences
  styleGuide?: StyleGuide
  projectContent?: string
  conversationHistory?: ConversationSummary[]
}

// Supporting interfaces
export interface Suggestion {
  id: string
  type: 'action' | 'improvement' | 'question' | 'resource'
  title: string
  description: string
  priority: 'low' | 'medium' | 'high'
  metadata?: Record<string, any>
}

export interface AgentMetadata {
  processingTime: number
  tokenUsage: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
    cost: number
  }
  model: string
  confidence?: number
  nextSteps?: string[]
}

export interface PhaseResult {
  phaseType: AgentType
  status: 'completed' | 'in_progress' | 'skipped'
  outputs: PhaseOutput[]
  summary: string
  completedAt?: Date
}

export interface UserPreferences {
  preferredAgentPersonality: 'formal' | 'casual' | 'creative'
  writingGenres: string[]
  experienceLevel: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED'
  styleGuide?: StyleGuide
}

export interface StyleGuide {
  referenceWriters?: string[]
  toneDescription?: string
  exampleText?: string
  targetAudience?: string
}

export interface ConversationSummary {
  conversationId: string
  agentType: AgentType
  messageCount: number
  lastMessage: string
  timestamp: Date
}

// Agent capabilities interface
export interface AgentCapabilities {
  canHandlePhase: (phase: AgentType) => boolean
  canProcessContent: (contentType: string) => boolean
  supportedLanguages: string[]
  maxContextLength: number
  estimatedCostPerRequest: number
}

// Base agent interface
export interface IAgent {
  readonly type: AgentType
  readonly capabilities: AgentCapabilities
  
  // Core methods
  processRequest(request: AgentRequest): Promise<AgentResponse>
  validateRequest(request: AgentRequest): Promise<boolean>
  buildContext(request: AgentRequest): Promise<string>
  
  // Lifecycle methods
  initialize(): Promise<void>
  cleanup(): Promise<void>
  
  // Health and monitoring
  healthCheck(): Promise<boolean>
  getMetrics(): Promise<Record<string, any>>
}

// Abstract base agent class
export abstract class BaseAgent implements IAgent {
  protected llmService: LLMService
  protected initialized: boolean = false
  
  constructor(
    public readonly type: AgentType,
    public readonly capabilities: AgentCapabilities,
    llmService: LLMService
  ) {
    this.llmService = llmService
  }
  
  // Abstract methods that must be implemented by subclasses
  abstract processRequest(request: AgentRequest): Promise<AgentResponse>
  abstract buildSystemPrompt(context: AgentContext): string
  abstract parseResponse(llmResponse: LLMResponse): AgentResponse
  
  // Common validation logic
  async validateRequest(request: AgentRequest): Promise<boolean> {
    try {
      // Basic validation
      if (!request.userId || !request.projectId || !request.conversationId) {
        logger.warn(`Invalid request: missing required fields`, { 
          agentType: this.type,
          userId: request.userId,
          projectId: request.projectId 
        })
        return false
      }
      
      // Check if agent can handle the current phase
      const currentPhase = request.context?.previousPhases?.slice(-1)[0]?.phaseType || this.type
      if (!this.capabilities.canHandlePhase(currentPhase)) {
        logger.warn(`Agent cannot handle phase: ${currentPhase}`, { agentType: this.type })
        return false
      }
      
      // Content length validation
      if (request.content.length > this.capabilities.maxContextLength) {
        logger.warn(`Content too long for agent`, { 
          agentType: this.type,
          contentLength: request.content.length,
          maxLength: this.capabilities.maxContextLength
        })
        return false
      }
      
      return true
    } catch (error) {
      logger.error(`Request validation failed for ${this.type}:`, error)
      return false
    }
  }
  
  // Common context building logic
  async buildContext(request: AgentRequest): Promise<string> {
    try {
      const context = request.context || {}
      
      // Build system prompt with context
      const systemPrompt = this.buildSystemPrompt(context)
      
      // Add conversation history if available
      let contextString = systemPrompt
      
      if (context.conversationHistory && context.conversationHistory.length > 0) {
        const historyContext = this.buildConversationHistoryContext(context.conversationHistory)
        contextString += `\n\nConversation History:\n${historyContext}`
      }
      
      // Add project content if available
      if (context.projectContent) {
        contextString += `\n\nCurrent Project Content:\n${context.projectContent}`
      }
      
      // Add previous phase results
      if (context.previousPhases && context.previousPhases.length > 0) {
        const phaseContext = this.buildPhaseResultsContext(context.previousPhases)
        contextString += `\n\nPrevious Phase Results:\n${phaseContext}`
      }
      
      return contextString
    } catch (error) {
      logger.error(`Context building failed for ${this.type}:`, error)
      throw new Error(`Failed to build context: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }
  
  // Lifecycle methods
  async initialize(): Promise<void> {
    if (this.initialized) return
    
    try {
      logger.info(`Initializing ${this.type} agent`)
      
      // Perform any agent-specific initialization
      await this.performInitialization()
      
      this.initialized = true
      logger.info(`${this.type} agent initialized successfully`)
    } catch (error) {
      logger.error(`Failed to initialize ${this.type} agent:`, error)
      throw error
    }
  }
  
  async cleanup(): Promise<void> {
    try {
      logger.info(`Cleaning up ${this.type} agent`)
      
      // Perform any agent-specific cleanup
      await this.performCleanup()
      
      this.initialized = false
      logger.info(`${this.type} agent cleaned up successfully`)
    } catch (error) {
      logger.error(`Failed to cleanup ${this.type} agent:`, error)
      throw error
    }
  }
  
  // Health check
  async healthCheck(): Promise<boolean> {
    try {
      if (!this.initialized) {
        return false
      }
      
      // Check LLM service health
      const llmHealth = await this.llmService.healthCheck()
      if (llmHealth.status !== 'healthy') {
        return false
      }
      
      // Perform agent-specific health checks
      return await this.performHealthCheck()
    } catch (error) {
      logger.error(`Health check failed for ${this.type} agent:`, error)
      return false
    }
  }
  
  // Get metrics
  async getMetrics(): Promise<Record<string, any>> {
    try {
      const baseMetrics = {
        agentType: this.type,
        initialized: this.initialized,
        capabilities: this.capabilities,
        timestamp: new Date().toISOString(),
      }
      
      // Add agent-specific metrics
      const specificMetrics = await this.getSpecificMetrics()
      
      return { ...baseMetrics, ...specificMetrics }
    } catch (error) {
      logger.error(`Failed to get metrics for ${this.type} agent:`, error)
      return { error: error instanceof Error ? error.message : 'Unknown error' }
    }
  }
  
  // Protected helper methods
  protected buildConversationHistoryContext(history: ConversationSummary[]): string {
    return history
      .slice(-5) // Last 5 conversations for context
      .map(conv => `[${conv.agentType}] ${conv.lastMessage}`)
      .join('\n')
  }
  
  protected buildPhaseResultsContext(phases: PhaseResult[]): string {
    return phases
      .map(phase => `${phase.phaseType}: ${phase.summary}`)
      .join('\n')
  }
  
  protected createSuggestion(
    type: Suggestion['type'],
    title: string,
    description: string,
    priority: Suggestion['priority'] = 'medium',
    metadata?: Record<string, any>
  ): Suggestion {
    return {
      id: `${this.type.toLowerCase()}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      title,
      description,
      priority,
      metadata,
    }
  }
  
  protected async makeLLMRequest(
    request: AgentRequest,
    systemContext: string,
    options?: {
      model?: string
      maxTokens?: number
      temperature?: number
    }
  ): Promise<LLMResponse> {
    const llmRequest: LLMRequest = {
      userId: request.userId,
      agentType: this.type,
      prompt: request.content,
      context: systemContext,
      model: options?.model,
      maxTokens: options?.maxTokens,
      temperature: options?.temperature,
      metadata: {
        projectId: request.projectId,
        conversationId: request.conversationId,
        agentType: this.type,
        ...request.metadata,
      },
    }
    
    return await this.llmService.generateCompletion(llmRequest)
  }
  
  // Abstract methods for subclasses to implement
  protected abstract performInitialization(): Promise<void>
  protected abstract performCleanup(): Promise<void>
  protected abstract performHealthCheck(): Promise<boolean>
  protected abstract getSpecificMetrics(): Promise<Record<string, any>>
}

// Agent factory interface
export interface IAgentFactory {
  createAgent(type: AgentType): Promise<IAgent>
  getSupportedTypes(): AgentType[]
  getAgentCapabilities(type: AgentType): AgentCapabilities | null
}

// Error classes
export class AgentError extends Error {
  constructor(
    message: string,
    public agentType: AgentType,
    public code: string,
    public details?: any
  ) {
    super(message)
    this.name = 'AgentError'
  }
}

export class AgentValidationError extends AgentError {
  constructor(agentType: AgentType, message: string, details?: any) {
    super(message, agentType, 'VALIDATION_ERROR', details)
    this.name = 'AgentValidationError'
  }
}

export class AgentProcessingError extends AgentError {
  constructor(agentType: AgentType, message: string, details?: any) {
    super(message, agentType, 'PROCESSING_ERROR', details)
    this.name = 'AgentProcessingError'
  }
}