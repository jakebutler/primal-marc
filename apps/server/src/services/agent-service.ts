import { AgentOrchestrator, AgentFactory, AgentRequest, AgentResponse, AgentType } from './agents/index.js'
import { LLMService, llmService } from './llm.js'
import { ConversationModel } from '../models/conversation.js'
import { ProjectModel } from '../models/project.js'
import { logger } from '../utils/logger.js'
import { ConversationContext } from '@primal-marc/shared'

// Service configuration
export interface AgentServiceConfig {
  maxConcurrentRequests?: number
  requestTimeoutMs?: number
  enableMetrics?: boolean
  autoInitialize?: boolean
}

// Request interface for the service
export interface ProcessAgentRequestParams {
  userId: string
  projectId: string
  conversationId?: string
  content: string
  agentType?: AgentType
  metadata?: Record<string, any>
}

// Response interface
export interface ProcessAgentResponseResult {
  success: boolean
  data?: {
    response: AgentResponse
    conversationId: string
    messageId: string
  }
  error?: string
}

/**
 * Agent Service - High-level service that orchestrates AI agents
 * This service provides a clean interface for the rest of the application
 * to interact with AI agents without dealing with orchestrator complexity
 */
export class AgentService {
  private orchestrator: AgentOrchestrator
  private agentFactory: AgentFactory
  private llmService: LLMService
  private initialized: boolean = false

  constructor(
    config: AgentServiceConfig = {},
    llmService?: LLMService
  ) {
    this.llmService = llmService || llmService
    
    if (!this.llmService) {
      throw new Error('LLM Service is required but not available. Check environment configuration.')
    }

    // Initialize agent factory
    this.agentFactory = new AgentFactory(this.llmService)

    // Initialize orchestrator
    this.orchestrator = new AgentOrchestrator({
      maxConcurrentRequests: config.maxConcurrentRequests || 10,
      requestTimeoutMs: config.requestTimeoutMs || 30000,
      enableMetrics: config.enableMetrics !== false,
    })

    // Auto-initialize if requested
    if (config.autoInitialize !== false) {
      this.initialize().catch(error => {
        logger.error('Failed to auto-initialize AgentService:', error)
      })
    }
  }

  /**
   * Initialize the agent service
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      logger.debug('AgentService already initialized')
      return
    }

    try {
      logger.info('Initializing AgentService')

      // Create and register all agents
      const agentTypes: AgentType[] = ['IDEATION', 'REFINER', 'MEDIA', 'FACTCHECKER']
      
      for (const agentType of agentTypes) {
        try {
          const agent = await this.agentFactory.createAgent(agentType)
          await this.orchestrator.registerAgent(agent)
          logger.info(`Agent registered: ${agentType}`)
        } catch (error) {
          logger.error(`Failed to register agent ${agentType}:`, error)
          // Continue with other agents even if one fails
        }
      }

      this.initialized = true
      logger.info('AgentService initialized successfully')

    } catch (error) {
      logger.error('Failed to initialize AgentService:', error)
      throw error
    }
  }

  /**
   * Process a request through the appropriate agent
   */
  async processRequest(params: ProcessAgentRequestParams): Promise<ProcessAgentResponseResult> {
    try {
      // Ensure service is initialized
      if (!this.initialized) {
        await this.initialize()
      }

      // Validate input
      if (!params.userId || !params.projectId || !params.content) {
        return {
          success: false,
          error: 'Missing required parameters: userId, projectId, and content are required',
        }
      }

      // Get or create conversation
      const conversationId = await this.getOrCreateConversation(
        params.projectId,
        params.conversationId,
        params.agentType
      )

      // Build agent request
      const agentRequest: AgentRequest = {
        userId: params.userId,
        projectId: params.projectId,
        conversationId,
        content: params.content,
        metadata: params.metadata,
      }

      // Process through orchestrator
      const response = await this.orchestrator.processRequest(agentRequest)

      // Save the interaction to conversation
      const messageId = await this.saveInteraction(
        conversationId,
        params.content,
        response
      )

      logger.info('Agent request processed successfully', {
        userId: params.userId,
        projectId: params.projectId,
        conversationId,
        messageId,
      })

      return {
        success: true,
        data: {
          response,
          conversationId,
          messageId,
        },
      }

    } catch (error) {
      logger.error('Failed to process agent request:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      }
    }
  }

  /**
   * Get conversation history for a project
   */
  async getConversationHistory(projectId: string, agentType?: AgentType): Promise<{
    success: boolean
    data?: any[]
    error?: string
  }> {
    try {
      const conversations = await ConversationModel.findByProjectId(projectId, agentType)
      
      const history = conversations.map(conv => ({
        id: conv.id,
        agentType: conv.agentType,
        context: ConversationModel.getConversationContext(conv),
        messages: conv.messages.map(msg => ({
          id: msg.id,
          role: msg.role,
          content: msg.content,
          metadata: ConversationModel.getMessageMetadata(msg),
          createdAt: msg.createdAt,
        })),
        createdAt: conv.createdAt,
        updatedAt: conv.updatedAt,
      }))

      return {
        success: true,
        data: history,
      }

    } catch (error) {
      logger.error('Failed to get conversation history:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      }
    }
  }

  /**
   * Get agent service metrics
   */
  async getMetrics(): Promise<{
    success: boolean
    data?: any
    error?: string
  }> {
    try {
      const [orchestratorMetrics, factoryMetrics, orchestratorHealth] = await Promise.all([
        this.orchestrator.getMetrics(),
        this.agentFactory.getMetrics(),
        this.orchestrator.healthCheck(),
      ])

      return {
        success: true,
        data: {
          orchestrator: orchestratorMetrics,
          factory: factoryMetrics,
          health: orchestratorHealth,
          initialized: this.initialized,
        },
      }

    } catch (error) {
      logger.error('Failed to get agent service metrics:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      }
    }
  }

  /**
   * Health check for the agent service
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy'
    details: Record<string, any>
  }> {
    try {
      if (!this.initialized) {
        return {
          status: 'unhealthy',
          details: { error: 'Service not initialized' },
        }
      }

      const [orchestratorHealth, factoryHealth, llmHealth] = await Promise.all([
        this.orchestrator.healthCheck(),
        this.agentFactory.healthCheck(),
        this.llmService.healthCheck(),
      ])

      // Determine overall health
      const healthStatuses = [orchestratorHealth.status, factoryHealth.status, llmHealth.status]
      let overallStatus: 'healthy' | 'degraded' | 'unhealthy'

      if (healthStatuses.every(status => status === 'healthy')) {
        overallStatus = 'healthy'
      } else if (healthStatuses.some(status => status === 'healthy')) {
        overallStatus = 'degraded'
      } else {
        overallStatus = 'unhealthy'
      }

      return {
        status: overallStatus,
        details: {
          orchestrator: orchestratorHealth,
          factory: factoryHealth,
          llm: llmHealth,
          initialized: this.initialized,
        },
      }

    } catch (error) {
      return {
        status: 'unhealthy',
        details: {
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      }
    }
  }

  /**
   * Shutdown the agent service
   */
  async shutdown(): Promise<void> {
    logger.info('Shutting down AgentService')

    try {
      await Promise.all([
        this.orchestrator.shutdown(),
        this.agentFactory.cleanup(),
      ])

      this.initialized = false
      logger.info('AgentService shutdown completed')

    } catch (error) {
      logger.error('Error during AgentService shutdown:', error)
      throw error
    }
  }

  // Private helper methods

  /**
   * Get existing conversation or create a new one
   */
  private async getOrCreateConversation(
    projectId: string,
    conversationId?: string,
    preferredAgentType?: AgentType
  ): Promise<string> {
    // If conversation ID is provided, validate it exists
    if (conversationId) {
      const existing = await ConversationModel.findById(conversationId)
      if (existing && existing.projectId === projectId) {
        return conversationId
      }
    }

    // Determine agent type for new conversation
    let agentType: AgentType = preferredAgentType || 'IDEATION'

    // If no preferred type, determine based on project phase
    if (!preferredAgentType) {
      const project = await ProjectModel.findById(projectId)
      if (project && project.currentPhaseId) {
        const currentPhase = project.phases.find(p => p.id === project.currentPhaseId)
        if (currentPhase) {
          agentType = currentPhase.type as AgentType
        }
      }
    }

    // Create new conversation
    const conversation = await ConversationModel.create({
      projectId,
      agentType,
      context: {
        phaseType: agentType,
        userGoals: [],
        previousOutputs: [],
      },
    })

    return conversation.id
  }

  /**
   * Save the interaction to the conversation
   */
  private async saveInteraction(
    conversationId: string,
    userContent: string,
    agentResponse: AgentResponse
  ): Promise<string> {
    // Save user message
    await ConversationModel.addMessage(conversationId, {
      role: 'USER',
      content: userContent,
    })

    // Save agent response
    const agentMessage = await ConversationModel.addMessage(conversationId, {
      role: 'AGENT',
      content: agentResponse.content,
      metadata: {
        tokenCount: agentResponse.metadata.tokenUsage.totalTokens,
        cost: agentResponse.metadata.tokenUsage.cost,
        model: agentResponse.metadata.model,
        processingTime: agentResponse.metadata.processingTime,
        suggestions: agentResponse.suggestions,
      },
    })

    return agentMessage.id
  }
}

// Export singleton instance (only create if LLM service is available)
export const agentService = (() => {
  try {
    return new AgentService({
      autoInitialize: true,
      enableMetrics: true,
    })
  } catch (error) {
    // Return null if LLM service is not available (e.g., in tests without proper setup)
    return null as any as AgentService
  }
})()

// Export types for external use
export type {
  ProcessAgentRequestParams,
  ProcessAgentResponseResult,
  AgentServiceConfig,
}