import { 
  IAgent, 
  AgentType, 
  AgentRequest, 
  AgentResponse, 
  AgentContext,
  PhaseResult,
  ConversationSummary,
  AgentError,
  AgentValidationError,
  AgentProcessingError
} from './base-agent.js'
import { ConversationModel } from '../../models/conversation.js'
import { ProjectModel } from '../../models/project.js'
import { logger } from '../../utils/logger.js'
import { ConversationContext, PhaseOutput } from '@primal-marc/shared'

// Orchestrator configuration
export interface OrchestratorConfig {
  maxConcurrentRequests: number
  requestTimeoutMs: number
  contextCacheSize: number
  enableMetrics: boolean
  fallbackAgent?: AgentType
}

// Agent routing rules
export interface RoutingRule {
  condition: (context: AgentRoutingContext) => boolean
  targetAgent: AgentType
  priority: number
  description: string
}

// Routing context
export interface AgentRoutingContext {
  currentPhase: AgentType
  projectStatus: 'DRAFT' | 'IN_PROGRESS' | 'COMPLETED' | 'ARCHIVED'
  userPreferences: any
  previousPhases: PhaseResult[]
  contentLength: number
  lastAgentUsed?: AgentType
  requestType: 'new_conversation' | 'continue_conversation' | 'phase_transition'
}

// Orchestrator state
export interface OrchestratorState {
  activeRequests: Map<string, AgentRequest>
  agentInstances: Map<AgentType, IAgent>
  contextCache: Map<string, AgentContext>
  routingRules: RoutingRule[]
  metrics: OrchestratorMetrics
}

// Metrics interface
export interface OrchestratorMetrics {
  totalRequests: number
  successfulRequests: number
  failedRequests: number
  averageResponseTime: number
  agentUsageCount: Record<AgentType, number>
  errorCount: Record<string, number>
  lastUpdated: Date
}

// Context persistence interface
export interface IContextPersistence {
  saveContext(key: string, context: AgentContext): Promise<void>
  loadContext(key: string): Promise<AgentContext | null>
  deleteContext(key: string): Promise<void>
  cleanupExpiredContexts(): Promise<void>
}

// In-memory context persistence implementation
class InMemoryContextPersistence implements IContextPersistence {
  private contexts: Map<string, { context: AgentContext; timestamp: Date }> = new Map()
  private readonly ttlMs = 24 * 60 * 60 * 1000 // 24 hours

  async saveContext(key: string, context: AgentContext): Promise<void> {
    this.contexts.set(key, {
      context,
      timestamp: new Date(),
    })
  }

  async loadContext(key: string): Promise<AgentContext | null> {
    const entry = this.contexts.get(key)
    if (!entry) return null

    // Check if expired
    if (Date.now() - entry.timestamp.getTime() > this.ttlMs) {
      this.contexts.delete(key)
      return null
    }

    return entry.context
  }

  async deleteContext(key: string): Promise<void> {
    this.contexts.delete(key)
  }

  async cleanupExpiredContexts(): Promise<void> {
    const now = Date.now()
    for (const [key, entry] of this.contexts.entries()) {
      if (now - entry.timestamp.getTime() > this.ttlMs) {
        this.contexts.delete(key)
      }
    }
  }
}

// Main orchestrator class
export class AgentOrchestrator {
  private state: OrchestratorState
  private contextPersistence: IContextPersistence
  private config: OrchestratorConfig

  constructor(
    config: Partial<OrchestratorConfig> = {},
    contextPersistence?: IContextPersistence
  ) {
    this.config = {
      maxConcurrentRequests: 10,
      requestTimeoutMs: 30000,
      contextCacheSize: 100,
      enableMetrics: true,
      ...config,
    }

    this.contextPersistence = contextPersistence || new InMemoryContextPersistence()

    this.state = {
      activeRequests: new Map(),
      agentInstances: new Map(),
      contextCache: new Map(),
      routingRules: this.initializeRoutingRules(),
      metrics: this.initializeMetrics(),
    }

    // Start cleanup interval
    setInterval(() => this.performCleanup(), 60000) // Every minute
  }

  // Initialize default routing rules
  private initializeRoutingRules(): RoutingRule[] {
    return [
      {
        condition: (ctx) => ctx.currentPhase === 'IDEATION' && ctx.requestType === 'new_conversation',
        targetAgent: 'IDEATION',
        priority: 100,
        description: 'Route new ideation requests to ideation agent',
      },
      {
        condition: (ctx) => ctx.currentPhase === 'REFINER' || 
                           (ctx.previousPhases.some(p => p.phaseType === 'IDEATION' && p.status === 'completed')),
        targetAgent: 'REFINER',
        priority: 90,
        description: 'Route refinement requests or post-ideation to refiner agent',
      },
      {
        condition: (ctx) => ctx.currentPhase === 'MEDIA' ||
                           (ctx.requestType === 'continue_conversation' && ctx.lastAgentUsed === 'MEDIA'),
        targetAgent: 'MEDIA',
        priority: 80,
        description: 'Route media requests to media agent',
      },
      {
        condition: (ctx) => ctx.currentPhase === 'FACTCHECKER' ||
                           (ctx.previousPhases.length >= 2 && ctx.contentLength > 500),
        targetAgent: 'FACTCHECKER',
        priority: 70,
        description: 'Route fact-checking requests or long content to fact-checker agent',
      },
      {
        condition: (ctx) => ctx.requestType === 'phase_transition',
        targetAgent: 'IDEATION', // Default, will be determined dynamically
        priority: 60,
        description: 'Route phase transitions to current phase agent',
      },
      {
        condition: () => true, // Fallback rule
        targetAgent: this.config.fallbackAgent || 'IDEATION',
        priority: 1,
        description: 'Fallback routing rule',
      },
    ]
  }

  private initializeMetrics(): OrchestratorMetrics {
    return {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      agentUsageCount: {
        IDEATION: 0,
        REFINER: 0,
        MEDIA: 0,
        FACTCHECKER: 0,
      },
      errorCount: {},
      lastUpdated: new Date(),
    }
  }

  // Register an agent instance
  async registerAgent(agent: IAgent): Promise<void> {
    try {
      await agent.initialize()
      this.state.agentInstances.set(agent.type, agent)
      logger.info(`Agent registered: ${agent.type}`)
    } catch (error) {
      logger.error(`Failed to register agent ${agent.type}:`, error)
      throw error
    }
  }

  // Unregister an agent
  async unregisterAgent(agentType: AgentType): Promise<void> {
    const agent = this.state.agentInstances.get(agentType)
    if (agent) {
      try {
        await agent.cleanup()
        this.state.agentInstances.delete(agentType)
        logger.info(`Agent unregistered: ${agentType}`)
      } catch (error) {
        logger.error(`Failed to unregister agent ${agentType}:`, error)
        throw error
      }
    }
  }

  // Main orchestration method
  async processRequest(request: AgentRequest): Promise<AgentResponse> {
    const startTime = Date.now()
    const requestId = this.generateRequestId()

    try {
      // Check concurrent request limit
      if (this.state.activeRequests.size >= this.config.maxConcurrentRequests) {
        throw new AgentError(
          'Maximum concurrent requests exceeded',
          'IDEATION',
          'RATE_LIMIT_EXCEEDED'
        )
      }

      // Add to active requests
      this.state.activeRequests.set(requestId, request)

      // Build routing context
      const routingContext = await this.buildRoutingContext(request)

      // Select appropriate agent
      const selectedAgent = await this.selectAgent(routingContext)

      // Load and enrich context
      const enrichedContext = await this.buildEnrichedContext(request)
      const enrichedRequest = { ...request, context: enrichedContext }

      // Validate request
      if (!await selectedAgent.validateRequest(enrichedRequest)) {
        throw new AgentValidationError(
          selectedAgent.type,
          'Request validation failed'
        )
      }

      // Process request with timeout
      const response = await this.processWithTimeout(
        selectedAgent,
        enrichedRequest,
        this.config.requestTimeoutMs
      )

      // Update metrics
      this.updateMetrics(selectedAgent.type, startTime, true)

      // Persist context if needed
      await this.persistContext(request, enrichedContext, response)

      logger.info(`Request processed successfully`, {
        requestId,
        agentType: selectedAgent.type,
        processingTime: Date.now() - startTime,
      })

      return response

    } catch (error) {
      this.updateMetrics('IDEATION', startTime, false, error)
      logger.error(`Request processing failed:`, {
        requestId,
        error: error instanceof Error ? error.message : 'Unknown error',
      })
      throw error
    } finally {
      this.state.activeRequests.delete(requestId)
    }
  }

  // Build routing context from request
  private async buildRoutingContext(request: AgentRequest): Promise<AgentRoutingContext> {
    try {
      // Get project information
      const project = await ProjectModel.findById(request.projectId)
      if (!project) {
        throw new Error('Project not found')
      }

      // Get current phase
      const currentPhase = project.currentPhaseId && project.phases
        ? project.phases.find(p => p.id === project.currentPhaseId)?.type || 'IDEATION'
        : 'IDEATION'

      // Get previous phases
      const previousPhases = await this.buildPhaseResults(project.phases)

      // Get last agent used
      const conversations = await ConversationModel.findByProjectId(request.projectId)
      const lastAgentUsed = conversations && conversations.length > 0 
        ? conversations[0]?.agentType as AgentType | undefined
        : undefined

      // Determine request type
      const requestType = request.conversationId && conversations && conversations.length > 0
        ? 'continue_conversation'
        : previousPhases.length > 0
        ? 'phase_transition'
        : 'new_conversation'

      return {
        currentPhase: currentPhase as AgentType,
        projectStatus: project.status,
        userPreferences: {}, // TODO: Load from user preferences
        previousPhases,
        contentLength: request.content.length,
        lastAgentUsed,
        requestType,
      }
    } catch (error) {
      logger.error('Failed to build routing context:', error)
      throw error
    }
  }

  // Select appropriate agent based on routing rules
  private async selectAgent(context: AgentRoutingContext): Promise<IAgent> {
    // Sort rules by priority (highest first)
    const sortedRules = [...this.state.routingRules].sort((a, b) => b.priority - a.priority)

    // Find first matching rule
    for (const rule of sortedRules) {
      if (rule.condition(context)) {
        // For phase transition rule, use the current phase as target agent
        let targetAgent = rule.targetAgent
        if (rule.description === 'Route phase transitions to current phase agent') {
          targetAgent = context.currentPhase
        }
        
        const agent = this.state.agentInstances.get(targetAgent)
        if (agent && await agent.healthCheck()) {
          logger.debug(`Agent selected: ${targetAgent}`, {
            rule: rule.description,
            priority: rule.priority,
          })
          return agent
        }
      }
    }

    throw new AgentError(
      'No suitable agent found',
      context.currentPhase,
      'NO_AGENT_AVAILABLE'
    )
  }

  // Build enriched context for agent
  private async buildEnrichedContext(request: AgentRequest): Promise<AgentContext> {
    try {
      // Try to load from cache first
      const cacheKey = `${request.projectId}_${request.conversationId}`
      let context = this.state.contextCache.get(cacheKey)

      if (!context) {
        // Load from persistence
        const persistedContext = await this.contextPersistence.loadContext(cacheKey)
        if (persistedContext) {
          context = persistedContext
        }
      }

      if (!context) {
        // Build new context
        context = await this.buildNewContext(request)
      }

      // Enrich with latest data
      context = await this.enrichContext(context, request)

      // Cache the context
      this.state.contextCache.set(cacheKey, context)

      return context
    } catch (error) {
      logger.error('Failed to build enriched context:', error)
      throw error
    }
  }

  // Build new context from scratch
  private async buildNewContext(request: AgentRequest): Promise<AgentContext> {
    const project = await ProjectModel.findById(request.projectId)
    if (!project) {
      throw new Error('Project not found')
    }

    const previousPhases = await this.buildPhaseResults(project.phases)
    const conversationHistory = await this.buildConversationHistory(request.projectId)

    return {
      previousPhases,
      userPreferences: {
        preferredAgentPersonality: 'casual',
        writingGenres: [],
        experienceLevel: 'INTERMEDIATE',
      },
      projectContent: project.content,
      conversationHistory,
    }
  }

  // Enrich existing context with latest data
  private async enrichContext(context: AgentContext, request: AgentRequest): Promise<AgentContext> {
    // Update project content if needed
    const project = await ProjectModel.findById(request.projectId)
    if (project) {
      context.projectContent = project.content
    }

    // Update conversation history
    context.conversationHistory = await this.buildConversationHistory(request.projectId)

    return context
  }

  // Build phase results from project phases
  private async buildPhaseResults(phases: any[]): Promise<PhaseResult[]> {
    if (!phases || !Array.isArray(phases)) {
      return []
    }
    
    return phases
      .filter(phase => phase && phase.status === 'COMPLETED')
      .map(phase => ({
        phaseType: phase.type as AgentType,
        status: 'completed' as const,
        outputs: phase.outputs ? JSON.parse(phase.outputs) : [],
        summary: `${phase.type} phase completed`,
        completedAt: phase.completedAt,
      }))
  }

  // Build conversation history
  private async buildConversationHistory(projectId: string): Promise<ConversationSummary[]> {
    try {
      const conversations = await ConversationModel.findByProjectId(projectId)
      
      if (!conversations || !Array.isArray(conversations)) {
        return []
      }
      
      return conversations.map(conv => ({
        conversationId: conv.id,
        agentType: conv.agentType as AgentType,
        messageCount: conv.messages?.length || 0,
        lastMessage: conv.messages?.[conv.messages.length - 1]?.content || '',
        timestamp: conv.updatedAt,
      }))
    } catch (error) {
      logger.error('Failed to build conversation history:', error)
      return []
    }
  }

  // Process request with timeout
  private async processWithTimeout(
    agent: IAgent,
    request: AgentRequest,
    timeoutMs: number
  ): Promise<AgentResponse> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new AgentProcessingError(
          agent.type,
          'Request timeout',
          { timeoutMs }
        ))
      }, timeoutMs)

      agent.processRequest(request)
        .then(response => {
          clearTimeout(timeout)
          resolve(response)
        })
        .catch(error => {
          clearTimeout(timeout)
          reject(error)
        })
    })
  }

  // Persist context after successful processing
  private async persistContext(
    request: AgentRequest,
    context: AgentContext,
    response: AgentResponse
  ): Promise<void> {
    try {
      const cacheKey = `${request.projectId}_${request.conversationId}`
      
      // Update context with response outputs
      if (response.phaseOutputs) {
        // Add new outputs to context (this would be used in next requests)
        // Implementation depends on how we want to structure the context
      }

      await this.contextPersistence.saveContext(cacheKey, context)
    } catch (error) {
      logger.warn('Failed to persist context:', error)
      // Don't throw - this is not critical for the main flow
    }
  }

  // Update metrics
  private updateMetrics(
    agentType: AgentType,
    startTime: number,
    success: boolean,
    error?: any
  ): void {
    if (!this.config.enableMetrics) return

    const processingTime = Date.now() - startTime

    this.state.metrics.totalRequests++
    
    if (success) {
      this.state.metrics.successfulRequests++
      this.state.metrics.agentUsageCount[agentType]++
    } else {
      this.state.metrics.failedRequests++
      
      const errorType = error instanceof Error ? error.constructor.name : 'UnknownError'
      this.state.metrics.errorCount[errorType] = (this.state.metrics.errorCount[errorType] || 0) + 1
    }

    // Update average response time
    const totalSuccessful = this.state.metrics.successfulRequests
    this.state.metrics.averageResponseTime = 
      (this.state.metrics.averageResponseTime * (totalSuccessful - 1) + processingTime) / totalSuccessful

    this.state.metrics.lastUpdated = new Date()
  }

  // Cleanup expired contexts and perform maintenance
  private async performCleanup(): Promise<void> {
    try {
      // Cleanup expired contexts
      await this.contextPersistence.cleanupExpiredContexts()

      // Cleanup cache if it's too large
      if (this.state.contextCache.size > this.config.contextCacheSize) {
        // Remove oldest entries (simple LRU-like behavior)
        const entries = Array.from(this.state.contextCache.entries())
        const toRemove = entries.slice(0, entries.length - this.config.contextCacheSize)
        toRemove.forEach(([key]) => this.state.contextCache.delete(key))
      }

      logger.debug('Orchestrator cleanup completed')
    } catch (error) {
      logger.error('Orchestrator cleanup failed:', error)
    }
  }

  // Utility methods
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
  }

  // Public API methods
  async getMetrics(): Promise<OrchestratorMetrics> {
    return { ...this.state.metrics }
  }

  async getActiveRequestCount(): Promise<number> {
    return this.state.activeRequests.size
  }

  async getRegisteredAgents(): Promise<AgentType[]> {
    return Array.from(this.state.agentInstances.keys())
  }

  async addRoutingRule(rule: RoutingRule): Promise<void> {
    this.state.routingRules.push(rule)
    this.state.routingRules.sort((a, b) => b.priority - a.priority)
    logger.info('Routing rule added', { description: rule.description })
  }

  async removeRoutingRule(description: string): Promise<boolean> {
    const initialLength = this.state.routingRules.length
    this.state.routingRules = this.state.routingRules.filter(rule => rule.description !== description)
    return this.state.routingRules.length < initialLength
  }

  async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy'
    details: Record<string, any>
  }> {
    try {
      const agentHealth = await Promise.all(
        Array.from(this.state.agentInstances.entries()).map(async ([type, agent]) => ({
          type,
          healthy: await agent.healthCheck(),
        }))
      )

      const healthyAgents = agentHealth.filter(a => a.healthy).length
      const totalAgents = agentHealth.length

      let status: 'healthy' | 'degraded' | 'unhealthy'
      if (healthyAgents === totalAgents) {
        status = 'healthy'
      } else if (healthyAgents > 0) {
        status = 'degraded'
      } else {
        status = 'unhealthy'
      }

      return {
        status,
        details: {
          totalAgents,
          healthyAgents,
          activeRequests: this.state.activeRequests.size,
          cacheSize: this.state.contextCache.size,
          agentHealth,
          metrics: this.state.metrics,
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

  // Shutdown the orchestrator
  async shutdown(): Promise<void> {
    logger.info('Shutting down agent orchestrator')

    try {
      // Unregister all agents
      const agentTypes = Array.from(this.state.agentInstances.keys())
      await Promise.all(agentTypes.map(type => this.unregisterAgent(type)))

      // Clear state
      this.state.activeRequests.clear()
      this.state.contextCache.clear()

      logger.info('Agent orchestrator shutdown completed')
    } catch (error) {
      logger.error('Error during orchestrator shutdown:', error)
      throw error
    }
  }
}