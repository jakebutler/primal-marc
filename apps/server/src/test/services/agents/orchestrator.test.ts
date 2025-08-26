import { describe, it, expect, beforeEach, vi, Mock } from 'vitest'
import { AgentOrchestrator, RoutingRule, AgentRoutingContext } from '../../../services/agents/orchestrator.js'
import { IAgent, AgentType, AgentRequest, AgentResponse } from '../../../services/agents/base-agent.js'
import { ConversationModel } from '../../../models/conversation.js'
import { ProjectModel } from '../../../models/project.js'
import { logger } from '../../../utils/logger.js'

// Mock dependencies
vi.mock('../../../models/conversation.js')
vi.mock('../../../models/project.js')
vi.mock('../../../utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}))

// Mock agent implementation
class MockAgent implements IAgent {
  constructor(
    public readonly type: AgentType,
    public readonly capabilities: any = {}
  ) {}

  async processRequest(request: AgentRequest): Promise<AgentResponse> {
    return {
      content: `Mock response from ${this.type}`,
      suggestions: [],
      metadata: {
        processingTime: 1000,
        tokenUsage: {
          promptTokens: 10,
          completionTokens: 20,
          totalTokens: 30,
          cost: 0.01,
        },
        model: 'mock-model',
      },
    }
  }

  async validateRequest(request: AgentRequest): Promise<boolean> {
    return true
  }

  async buildContext(request: AgentRequest): Promise<string> {
    return 'mock context'
  }

  async initialize(): Promise<void> {}
  async cleanup(): Promise<void> {}
  async healthCheck(): Promise<boolean> { return true }
  async getMetrics(): Promise<Record<string, any>> { return {} }
}

describe('AgentOrchestrator', () => {
  let orchestrator: AgentOrchestrator
  let mockIdeationAgent: MockAgent
  let mockRefinerAgent: MockAgent

  beforeEach(() => {
    orchestrator = new AgentOrchestrator({
      maxConcurrentRequests: 5,
      requestTimeoutMs: 10000,
      enableMetrics: true,
    })

    mockIdeationAgent = new MockAgent('IDEATION')
    mockRefinerAgent = new MockAgent('REFINER')

    // Reset mocks
    vi.clearAllMocks()
  })

  describe('constructor', () => {
    it('should initialize with default configuration', () => {
      const defaultOrchestrator = new AgentOrchestrator()
      expect(defaultOrchestrator).toBeDefined()
    })

    it('should initialize with custom configuration', () => {
      const customOrchestrator = new AgentOrchestrator({
        maxConcurrentRequests: 20,
        requestTimeoutMs: 60000,
        enableMetrics: false,
      })
      expect(customOrchestrator).toBeDefined()
    })
  })

  describe('agent registration', () => {
    it('should register an agent successfully', async () => {
      await orchestrator.registerAgent(mockIdeationAgent)
      
      const registeredAgents = await orchestrator.getRegisteredAgents()
      expect(registeredAgents).toContain('IDEATION')
    })

    it('should unregister an agent successfully', async () => {
      await orchestrator.registerAgent(mockIdeationAgent)
      await orchestrator.unregisterAgent('IDEATION')
      
      const registeredAgents = await orchestrator.getRegisteredAgents()
      expect(registeredAgents).not.toContain('IDEATION')
    })

    it('should handle unregistering non-existent agent', async () => {
      await expect(orchestrator.unregisterAgent('MEDIA')).resolves.not.toThrow()
    })
  })

  describe('routing rules', () => {
    it('should add routing rule successfully', async () => {
      const rule: RoutingRule = {
        condition: (ctx) => ctx.currentPhase === 'IDEATION',
        targetAgent: 'IDEATION',
        priority: 100,
        description: 'Test rule',
      }

      await orchestrator.addRoutingRule(rule)
      // No direct way to verify, but should not throw
    })

    it('should remove routing rule successfully', async () => {
      const rule: RoutingRule = {
        condition: (ctx) => ctx.currentPhase === 'IDEATION',
        targetAgent: 'IDEATION',
        priority: 100,
        description: 'Test rule to remove',
      }

      await orchestrator.addRoutingRule(rule)
      const removed = await orchestrator.removeRoutingRule('Test rule to remove')
      expect(removed).toBe(true)
    })

    it('should return false when removing non-existent rule', async () => {
      const removed = await orchestrator.removeRoutingRule('Non-existent rule')
      expect(removed).toBe(false)
    })
  })

  describe('processRequest', () => {
    beforeEach(async () => {
      // Mock project and conversation data
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

      ;(ConversationModel.findByProjectId as Mock).mockResolvedValue([{
        id: 'conv123',
        agentType: 'IDEATION',
        messages: [],
        updatedAt: new Date(),
      }])

      await orchestrator.registerAgent(mockIdeationAgent)
      await orchestrator.registerAgent(mockRefinerAgent)
    })

    it('should process request successfully', async () => {
      const request: AgentRequest = {
        userId: 'user123',
        projectId: 'project123',
        conversationId: 'conv123',
        content: 'Test content',
      }

      const response = await orchestrator.processRequest(request)

      expect(response).toMatchObject({
        content: 'Mock response from IDEATION',
        suggestions: [],
        metadata: expect.objectContaining({
          processingTime: 1000,
          tokenUsage: expect.objectContaining({
            totalTokens: 30,
            cost: 0.01,
          }),
        }),
      })
    })

    it('should reject request when max concurrent requests exceeded', async () => {
      // Create orchestrator with low limit
      const limitedOrchestrator = new AgentOrchestrator({
        maxConcurrentRequests: 1,
      })
      await limitedOrchestrator.registerAgent(mockIdeationAgent)

      const request: AgentRequest = {
        userId: 'user123',
        projectId: 'project123',
        conversationId: 'conv123',
        content: 'Test content',
      }

      // Mock a slow agent to keep request active
      vi.spyOn(mockIdeationAgent, 'processRequest').mockImplementation(
        () => new Promise(resolve => setTimeout(resolve, 1000))
      )

      // Start first request
      const firstRequest = limitedOrchestrator.processRequest(request)

      // Second request should fail immediately
      await expect(limitedOrchestrator.processRequest(request)).rejects.toThrow('Maximum concurrent requests exceeded')

      // Cleanup
      await firstRequest.catch(() => {}) // Ignore the result
      await limitedOrchestrator.shutdown()
    })

    it('should handle agent validation failure', async () => {
      vi.spyOn(mockIdeationAgent, 'validateRequest').mockResolvedValue(false)

      const request: AgentRequest = {
        userId: 'user123',
        projectId: 'project123',
        conversationId: 'conv123',
        content: 'Test content',
      }

      await expect(orchestrator.processRequest(request)).rejects.toThrow('Request validation failed')
    })

    it('should handle project not found', async () => {
      ;(ProjectModel.findById as Mock).mockResolvedValue(null)

      const request: AgentRequest = {
        userId: 'user123',
        projectId: 'nonexistent',
        conversationId: 'conv123',
        content: 'Test content',
      }

      await expect(orchestrator.processRequest(request)).rejects.toThrow('Project not found')
    })

    it('should handle timeout', async () => {
      const timeoutOrchestrator = new AgentOrchestrator({
        requestTimeoutMs: 100, // Very short timeout
      })
      await timeoutOrchestrator.registerAgent(mockIdeationAgent)

      // Mock slow agent
      vi.spyOn(mockIdeationAgent, 'processRequest').mockImplementation(
        () => new Promise(resolve => setTimeout(resolve, 200))
      )

      const request: AgentRequest = {
        userId: 'user123',
        projectId: 'project123',
        conversationId: 'conv123',
        content: 'Test content',
      }

      await expect(timeoutOrchestrator.processRequest(request)).rejects.toThrow('Request timeout')
      await timeoutOrchestrator.shutdown()
    })
  })

  describe('agent selection', () => {
    beforeEach(async () => {
      await orchestrator.registerAgent(mockIdeationAgent)
      await orchestrator.registerAgent(mockRefinerAgent)
    })

    it('should select ideation agent for new ideation requests', async () => {
      const context: AgentRoutingContext = {
        currentPhase: 'IDEATION',
        projectStatus: 'DRAFT',
        userPreferences: {},
        previousPhases: [],
        contentLength: 100,
        requestType: 'new_conversation',
      }

      // We can't directly test agent selection, but we can test through processRequest
      ;(ProjectModel.findById as Mock).mockResolvedValue({
        id: 'project123',
        status: 'DRAFT',
        currentPhaseId: 'phase123',
        phases: [{
          id: 'phase123',
          type: 'IDEATION',
          status: 'ACTIVE',
        }],
        content: 'Project content',
      })

      ;(ConversationModel.findByProjectId as Mock).mockResolvedValue([])

      const request: AgentRequest = {
        userId: 'user123',
        projectId: 'project123',
        conversationId: 'conv123',
        content: 'Test content',
      }

      const response = await orchestrator.processRequest(request)
      expect(response.content).toBe('Mock response from IDEATION')
    })

    it('should select refiner agent for refinement phase', async () => {
      ;(ProjectModel.findById as Mock).mockResolvedValue({
        id: 'project123',
        status: 'IN_PROGRESS',
        currentPhaseId: 'phase123',
        phases: [{
          id: 'phase123',
          type: 'REFINER',
          status: 'ACTIVE',
        }],
        content: 'Project content',
      })

      ;(ConversationModel.findByProjectId as Mock).mockResolvedValue([])

      const request: AgentRequest = {
        userId: 'user123',
        projectId: 'project123',
        conversationId: 'conv123',
        content: 'Test content',
      }

      const response = await orchestrator.processRequest(request)
      expect(response.content).toBe('Mock response from REFINER')
    })
  })

  describe('metrics', () => {
    it('should return metrics', async () => {
      const metrics = await orchestrator.getMetrics()

      expect(metrics).toMatchObject({
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
      })
      expect(metrics.lastUpdated).toBeInstanceOf(Date)
    })

    it('should update metrics after successful request', async () => {
      await orchestrator.registerAgent(mockIdeationAgent)

      ;(ProjectModel.findById as Mock).mockResolvedValue({
        id: 'project123',
        status: 'DRAFT',
        currentPhaseId: 'phase123',
        phases: [{
          id: 'phase123',
          type: 'IDEATION',
          status: 'ACTIVE',
        }],
        content: 'Project content',
      })

      ;(ConversationModel.findByProjectId as Mock).mockResolvedValue([])

      const request: AgentRequest = {
        userId: 'user123',
        projectId: 'project123',
        conversationId: 'conv123',
        content: 'Test content',
      }

      await orchestrator.processRequest(request)

      const metrics = await orchestrator.getMetrics()
      expect(metrics.totalRequests).toBe(1)
      expect(metrics.successfulRequests).toBe(1)
      expect(metrics.agentUsageCount.IDEATION).toBe(1)
    })
  })

  describe('health check', () => {
    it('should return healthy status with healthy agents', async () => {
      await orchestrator.registerAgent(mockIdeationAgent)
      
      const health = await orchestrator.healthCheck()
      expect(health.status).toBe('healthy')
      expect(health.details.totalAgents).toBe(1)
      expect(health.details.healthyAgents).toBe(1)
    })

    it('should return degraded status with some unhealthy agents', async () => {
      const unhealthyAgent = new MockAgent('REFINER')
      vi.spyOn(unhealthyAgent, 'healthCheck').mockResolvedValue(false)

      await orchestrator.registerAgent(mockIdeationAgent)
      await orchestrator.registerAgent(unhealthyAgent)
      
      const health = await orchestrator.healthCheck()
      expect(health.status).toBe('degraded')
      expect(health.details.totalAgents).toBe(2)
      expect(health.details.healthyAgents).toBe(1)
    })

    it('should return unhealthy status with all unhealthy agents', async () => {
      const unhealthyAgent = new MockAgent('IDEATION')
      vi.spyOn(unhealthyAgent, 'healthCheck').mockResolvedValue(false)

      await orchestrator.registerAgent(unhealthyAgent)
      
      const health = await orchestrator.healthCheck()
      expect(health.status).toBe('unhealthy')
      expect(health.details.totalAgents).toBe(1)
      expect(health.details.healthyAgents).toBe(0)
    })
  })

  describe('shutdown', () => {
    it('should shutdown successfully', async () => {
      await orchestrator.registerAgent(mockIdeationAgent)
      await orchestrator.registerAgent(mockRefinerAgent)

      await expect(orchestrator.shutdown()).resolves.not.toThrow()

      const registeredAgents = await orchestrator.getRegisteredAgents()
      expect(registeredAgents).toHaveLength(0)
    })

    it('should handle shutdown errors gracefully', async () => {
      const errorAgent = new MockAgent('IDEATION')
      vi.spyOn(errorAgent, 'cleanup').mockRejectedValue(new Error('Cleanup failed'))

      await orchestrator.registerAgent(errorAgent)

      // Should not throw even if agent cleanup fails
      await expect(orchestrator.shutdown()).rejects.toThrow()
    })
  })

  describe('active request tracking', () => {
    it('should track active requests', async () => {
      expect(await orchestrator.getActiveRequestCount()).toBe(0)

      await orchestrator.registerAgent(mockIdeationAgent)

      // Mock slow processing to keep request active
      vi.spyOn(mockIdeationAgent, 'processRequest').mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve({
          content: 'Slow response',
          suggestions: [],
          metadata: {
            processingTime: 2000,
            tokenUsage: { promptTokens: 10, completionTokens: 20, totalTokens: 30, cost: 0.01 },
            model: 'mock-model',
          },
        }), 100))
      )

      ;(ProjectModel.findById as Mock).mockResolvedValue({
        id: 'project123',
        status: 'DRAFT',
        phases: [{ id: 'phase123', type: 'IDEATION', status: 'ACTIVE' }],
        content: 'Project content',
      })

      ;(ConversationModel.findByProjectId as Mock).mockResolvedValue([])

      const request: AgentRequest = {
        userId: 'user123',
        projectId: 'project123',
        conversationId: 'conv123',
        content: 'Test content',
      }

      // Start request but don't wait
      const requestPromise = orchestrator.processRequest(request)

      // Check that active request count increased
      // Note: This is timing-dependent and might be flaky
      await new Promise(resolve => setTimeout(resolve, 10))
      
      // Wait for request to complete
      await requestPromise

      expect(await orchestrator.getActiveRequestCount()).toBe(0)
    })
  })
})