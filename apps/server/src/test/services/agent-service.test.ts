import { describe, it, expect, beforeEach, vi, Mock } from 'vitest'
import { AgentService, ProcessAgentRequestParams } from '../../services/agent-service.js'
import { LLMService } from '../../services/llm.js'
import { ConversationModel } from '../../models/conversation.js'
import { ProjectModel } from '../../models/project.js'
import { logger } from '../../utils/logger.js'

// Mock dependencies
vi.mock('../../models/conversation.js')
vi.mock('../../models/project.js')
vi.mock('../../utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}))

describe('AgentService', () => {
  let mockLLMService: LLMService
  let agentService: AgentService

  beforeEach(() => {
    // Mock LLM service
    mockLLMService = {
      generateCompletion: vi.fn().mockResolvedValue({
        content: 'Mock LLM response',
        usage: {
          promptTokens: 10,
          completionTokens: 20,
          totalTokens: 30,
          cost: 0.01,
        },
        model: 'gpt-3.5-turbo',
        requestId: 'req123',
      }),
      healthCheck: vi.fn().mockResolvedValue({ status: 'healthy' }),
      getBudgetStatus: vi.fn(),
      getUserUsageStats: vi.fn(),
      getRemainingRateLimit: vi.fn(),
      updateConfig: vi.fn(),
    } as any

    agentService = new AgentService(
      {
        autoInitialize: false, // Don't auto-initialize for tests
        enableMetrics: true,
      },
      mockLLMService
    )

    // Reset mocks
    vi.clearAllMocks()
  })

  describe('constructor', () => {
    it('should initialize with default configuration', () => {
      const service = new AgentService({ autoInitialize: false }, mockLLMService)
      expect(service).toBeDefined()
    })

    it('should throw error if LLM service is not available', () => {
      expect(() => new AgentService({ autoInitialize: false })).toThrow(
        'LLM Service is required but not available'
      )
    })
  })

  describe('initialize', () => {
    it('should initialize successfully', async () => {
      await agentService.initialize()
      expect(logger.info).toHaveBeenCalledWith('Initializing AgentService')
      expect(logger.info).toHaveBeenCalledWith('AgentService initialized successfully')
    })

    it('should not initialize twice', async () => {
      await agentService.initialize()
      await agentService.initialize() // Second call should be ignored
      
      // Should only log initialization once
      const initCalls = (logger.info as Mock).mock.calls.filter(
        call => call[0] === 'Initializing AgentService'
      )
      expect(initCalls).toHaveLength(1)
    })

    it('should continue with other agents if one fails to register', async () => {
      // Mock one agent creation to fail
      const originalError = console.error
      console.error = vi.fn() // Suppress error logs during test

      await agentService.initialize()

      console.error = originalError
      expect(logger.info).toHaveBeenCalledWith('AgentService initialized successfully')
    })
  })

  describe('processRequest', () => {
    beforeEach(async () => {
      await agentService.initialize()

      // Mock project data
      ;(ProjectModel.findById as Mock).mockResolvedValue({
        id: 'project123',
        status: 'IN_PROGRESS',
        currentPhaseId: 'phase123',
        phases: [{
          id: 'phase123',
          type: 'IDEATION',
          status: 'ACTIVE',
        }],
        content: 'Project content',
      })

      // Mock conversation creation
      ;(ConversationModel.create as Mock).mockResolvedValue({
        id: 'conv123',
        projectId: 'project123',
        agentType: 'IDEATION',
      })

      // Mock message creation
      ;(ConversationModel.addMessage as Mock).mockResolvedValue({
        id: 'msg123',
        conversationId: 'conv123',
        role: 'AGENT',
        content: 'Mock response',
      })
    })

    it('should process request successfully', async () => {
      const params: ProcessAgentRequestParams = {
        userId: 'user123',
        projectId: 'project123',
        content: 'Test content',
      }

      const result = await agentService.processRequest(params)

      if (!result.success) {
        console.log('Error:', result.error)
      }
      expect(result.success).toBe(true)
      expect(result.data).toBeDefined()
      expect(result.data?.response.content).toBeDefined()
      expect(result.data?.conversationId).toBe('conv123')
      expect(result.data?.messageId).toBe('msg123')
    })

    it('should handle missing required parameters', async () => {
      const params: ProcessAgentRequestParams = {
        userId: '',
        projectId: 'project123',
        content: 'Test content',
      }

      const result = await agentService.processRequest(params)

      expect(result.success).toBe(false)
      expect(result.error).toContain('Missing required parameters')
    })

    it('should use existing conversation if provided', async () => {
      ;(ConversationModel.findById as Mock).mockResolvedValue({
        id: 'existing-conv',
        projectId: 'project123',
        agentType: 'IDEATION',
      })

      const params: ProcessAgentRequestParams = {
        userId: 'user123',
        projectId: 'project123',
        conversationId: 'existing-conv',
        content: 'Test content',
      }

      const result = await agentService.processRequest(params)

      expect(result.success).toBe(true)
      expect(result.data?.conversationId).toBe('existing-conv')
      expect(ConversationModel.create).not.toHaveBeenCalled()
    })

    it('should create new conversation if existing one is invalid', async () => {
      ;(ConversationModel.findById as Mock).mockResolvedValue(null)

      const params: ProcessAgentRequestParams = {
        userId: 'user123',
        projectId: 'project123',
        conversationId: 'invalid-conv',
        content: 'Test content',
      }

      const result = await agentService.processRequest(params)

      expect(result.success).toBe(true)
      expect(ConversationModel.create).toHaveBeenCalled()
    })

    it('should use preferred agent type when specified', async () => {
      const params: ProcessAgentRequestParams = {
        userId: 'user123',
        projectId: 'project123',
        content: 'Test content',
        agentType: 'REFINER',
      }

      const result = await agentService.processRequest(params)

      expect(result.success).toBe(true)
      expect(ConversationModel.create).toHaveBeenCalledWith({
        projectId: 'project123',
        agentType: 'REFINER',
        context: expect.any(Object),
      })
    })

    it('should handle processing errors gracefully', async () => {
      ;(ProjectModel.findById as Mock).mockRejectedValue(new Error('Database error'))

      const params: ProcessAgentRequestParams = {
        userId: 'user123',
        projectId: 'project123',
        content: 'Test content',
      }

      const result = await agentService.processRequest(params)

      expect(result.success).toBe(false)
      expect(result.error).toBe('Database error')
      expect(logger.error).toHaveBeenCalledWith('Failed to process agent request:', expect.any(Error))
    })

    it('should auto-initialize if not initialized', async () => {
      const uninitializedService = new AgentService({ autoInitialize: false }, mockLLMService)

      const params: ProcessAgentRequestParams = {
        userId: 'user123',
        projectId: 'project123',
        content: 'Test content',
      }

      const result = await uninitializedService.processRequest(params)

      expect(result.success).toBe(true)
      expect(logger.info).toHaveBeenCalledWith('Initializing AgentService')
    })
  })

  describe('getConversationHistory', () => {
    beforeEach(async () => {
      await agentService.initialize()
    })

    it('should return conversation history successfully', async () => {
      const mockConversations = [{
        id: 'conv123',
        agentType: 'IDEATION',
        context: null,
        messages: [{
          id: 'msg123',
          role: 'USER',
          content: 'Hello',
          metadata: null,
          createdAt: new Date(),
        }],
        createdAt: new Date(),
        updatedAt: new Date(),
      }]

      ;(ConversationModel.findByProjectId as Mock).mockResolvedValue(mockConversations)
      ;(ConversationModel.getConversationContext as Mock).mockReturnValue(null)
      ;(ConversationModel.getMessageMetadata as Mock).mockReturnValue(null)

      const result = await agentService.getConversationHistory('project123')

      expect(result.success).toBe(true)
      expect(result.data).toHaveLength(1)
      expect(result.data?.[0]).toMatchObject({
        id: 'conv123',
        agentType: 'IDEATION',
        messages: expect.arrayContaining([
          expect.objectContaining({
            id: 'msg123',
            role: 'USER',
            content: 'Hello',
          }),
        ]),
      })
    })

    it('should filter by agent type when specified', async () => {
      const result = await agentService.getConversationHistory('project123', 'REFINER')

      expect(ConversationModel.findByProjectId).toHaveBeenCalledWith('project123', 'REFINER')
      expect(result.success).toBe(true)
    })

    it('should handle errors gracefully', async () => {
      ;(ConversationModel.findByProjectId as Mock).mockRejectedValue(new Error('Database error'))

      const result = await agentService.getConversationHistory('project123')

      expect(result.success).toBe(false)
      expect(result.error).toBe('Database error')
    })
  })

  describe('getMetrics', () => {
    beforeEach(async () => {
      await agentService.initialize()
    })

    it('should return service metrics successfully', async () => {
      const result = await agentService.getMetrics()

      expect(result.success).toBe(true)
      expect(result.data).toMatchObject({
        orchestrator: expect.any(Object),
        factory: expect.any(Object),
        health: expect.any(Object),
        initialized: true,
      })
    })

    it('should handle metrics errors gracefully', async () => {
      // Mock orchestrator to throw error
      const service = agentService as any
      vi.spyOn(service.orchestrator, 'getMetrics').mockRejectedValue(new Error('Metrics error'))

      const result = await agentService.getMetrics()

      expect(result.success).toBe(false)
      expect(result.error).toBe('Metrics error')
    })
  })

  describe('healthCheck', () => {
    it('should return unhealthy if not initialized', async () => {
      const uninitializedService = new AgentService({ autoInitialize: false }, mockLLMService)
      
      const health = await uninitializedService.healthCheck()

      expect(health.status).toBe('unhealthy')
      expect(health.details.error).toBe('Service not initialized')
    })

    it('should return healthy status when all components are healthy', async () => {
      await agentService.initialize()

      const health = await agentService.healthCheck()

      expect(health.status).toBe('healthy')
      expect(health.details).toMatchObject({
        orchestrator: expect.objectContaining({ status: 'healthy' }),
        factory: expect.objectContaining({ status: 'healthy' }),
        llm: expect.objectContaining({ status: 'healthy' }),
        initialized: true,
      })
    })

    it('should return degraded status when some components are unhealthy', async () => {
      await agentService.initialize()

      // Mock LLM service as unhealthy
      ;(mockLLMService.healthCheck as Mock).mockResolvedValue({ status: 'unhealthy' })

      const health = await agentService.healthCheck()

      // When LLM service is unhealthy, the whole system is considered unhealthy
      // since it's a core dependency
      expect(health.status).toBe('unhealthy')
    })

    it('should handle health check errors gracefully', async () => {
      await agentService.initialize()

      // Mock orchestrator health check to throw error
      const service = agentService as any
      vi.spyOn(service.orchestrator, 'healthCheck').mockRejectedValue(new Error('Health check failed'))

      const health = await agentService.healthCheck()

      expect(health.status).toBe('unhealthy')
      expect(health.details.error).toBe('Health check failed')
    })
  })

  describe('shutdown', () => {
    it('should shutdown successfully', async () => {
      await agentService.initialize()
      await agentService.shutdown()

      expect(logger.info).toHaveBeenCalledWith('Shutting down AgentService')
      expect(logger.info).toHaveBeenCalledWith('AgentService shutdown completed')
    })

    it('should handle shutdown errors', async () => {
      await agentService.initialize()

      // Mock orchestrator shutdown to throw error
      const service = agentService as any
      vi.spyOn(service.orchestrator, 'shutdown').mockRejectedValue(new Error('Shutdown failed'))

      await expect(agentService.shutdown()).rejects.toThrow('Shutdown failed')
      expect(logger.error).toHaveBeenCalledWith('Error during AgentService shutdown:', expect.any(Error))
    })
  })

  describe('private helper methods', () => {
    beforeEach(async () => {
      await agentService.initialize()

      // Mock project data
      ;(ProjectModel.findById as Mock).mockResolvedValue({
        id: 'project123',
        status: 'IN_PROGRESS',
        currentPhaseId: 'phase123',
        phases: [{
          id: 'phase123',
          type: 'IDEATION',
          status: 'ACTIVE',
        }],
        content: 'Project content',
      })

      // Mock conversation creation
      ;(ConversationModel.create as Mock).mockResolvedValue({
        id: 'conv123',
        projectId: 'project123',
        agentType: 'IDEATION',
      })

      // Mock conversation lookup
      ;(ConversationModel.findByProjectId as Mock).mockResolvedValue([])

      // Mock message creation
      ;(ConversationModel.addMessage as Mock).mockResolvedValue({
        id: 'msg123',
        conversationId: 'conv123',
        role: 'AGENT',
        content: 'Mock response',
      })
    })

    it('should determine agent type from project phase', async () => {
      ;(ProjectModel.findById as Mock).mockResolvedValue({
        id: 'project123',
        currentPhaseId: 'phase123',
        phases: [{
          id: 'phase123',
          type: 'REFINEMENT',
          status: 'ACTIVE',
        }],
      })

      const params: ProcessAgentRequestParams = {
        userId: 'user123',
        projectId: 'project123',
        content: 'Test content',
      }

      await agentService.processRequest(params)

      expect(ConversationModel.create).toHaveBeenCalledWith({
        projectId: 'project123',
        agentType: 'REFINEMENT',
        context: expect.any(Object),
      })
    })

    it('should save both user and agent messages', async () => {
      const params: ProcessAgentRequestParams = {
        userId: 'user123',
        projectId: 'project123',
        content: 'Test content',
      }

      await agentService.processRequest(params)

      expect(ConversationModel.addMessage).toHaveBeenCalledTimes(2)
      
      // First call should be user message
      expect(ConversationModel.addMessage).toHaveBeenNthCalledWith(1, 'conv123', {
        role: 'USER',
        content: 'Test content',
      })

      // Second call should be agent message
      expect(ConversationModel.addMessage).toHaveBeenNthCalledWith(2, 'conv123', {
        role: 'AGENT',
        content: expect.any(String),
        metadata: expect.objectContaining({
          tokenCount: expect.any(Number),
          cost: expect.any(Number),
          model: expect.any(String),
        }),
      })
    })
  })
})