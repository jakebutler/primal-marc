import { describe, it, expect, beforeEach, vi, Mock } from 'vitest'
import { AgentFactory } from '../../../services/agents/agent-factory.js'
import { LLMService } from '../../../services/llm.js'
import { AgentType } from '../../../services/agents/base-agent.js'
import { logger } from '../../../utils/logger.js'

// Mock dependencies
vi.mock('../../../utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}))

describe('AgentFactory', () => {
  let mockLLMService: LLMService
  let agentFactory: AgentFactory

  beforeEach(() => {
    // Mock LLM service
    mockLLMService = {
      generateCompletion: vi.fn(),
      healthCheck: vi.fn().mockResolvedValue({ status: 'healthy' }),
      getBudgetStatus: vi.fn(),
      getUserUsageStats: vi.fn(),
      getRemainingRateLimit: vi.fn(),
      updateConfig: vi.fn(),
    } as any

    agentFactory = new AgentFactory(mockLLMService)

    // Reset mocks
    vi.clearAllMocks()
  })

  describe('constructor', () => {
    it('should initialize with default configurations', () => {
      expect(agentFactory).toBeDefined()
      
      const supportedTypes = agentFactory.getSupportedTypes()
      expect(supportedTypes).toEqual(['IDEATION', 'REFINER', 'MEDIA', 'FACTCHECKER'])
    })
  })

  describe('getSupportedTypes', () => {
    it('should return all supported agent types', () => {
      const types = agentFactory.getSupportedTypes()
      expect(types).toContain('IDEATION')
      expect(types).toContain('REFINER')
      expect(types).toContain('MEDIA')
      expect(types).toContain('FACTCHECKER')
      expect(types).toHaveLength(4)
    })
  })

  describe('getAgentCapabilities', () => {
    it('should return capabilities for ideation agent', () => {
      const capabilities = agentFactory.getAgentCapabilities('IDEATION')
      
      expect(capabilities).toMatchObject({
        canHandlePhase: expect.any(Function),
        canProcessContent: expect.any(Function),
        supportedLanguages: ['en'],
        maxContextLength: 8000,
        estimatedCostPerRequest: 0.01,
      })
    })

    it('should return capabilities for refiner agent', () => {
      const capabilities = agentFactory.getAgentCapabilities('REFINER')
      
      expect(capabilities).toMatchObject({
        canHandlePhase: expect.any(Function),
        canProcessContent: expect.any(Function),
        supportedLanguages: ['en'],
        maxContextLength: 12000,
        estimatedCostPerRequest: 0.015,
      })
    })

    it('should return capabilities for media agent', () => {
      const capabilities = agentFactory.getAgentCapabilities('MEDIA')
      
      expect(capabilities).toMatchObject({
        canHandlePhase: expect.any(Function),
        canProcessContent: expect.any(Function),
        supportedLanguages: ['en'],
        maxContextLength: 6000,
        estimatedCostPerRequest: 0.02,
      })
    })

    it('should return capabilities for factchecker agent', () => {
      const capabilities = agentFactory.getAgentCapabilities('FACTCHECKER')
      
      expect(capabilities).toMatchObject({
        canHandlePhase: expect.any(Function),
        canProcessContent: expect.any(Function),
        supportedLanguages: ['en'],
        maxContextLength: 10000,
        estimatedCostPerRequest: 0.025,
      })
    })

    it('should return null for unsupported agent type', () => {
      const capabilities = agentFactory.getAgentCapabilities('UNSUPPORTED' as AgentType)
      expect(capabilities).toBeNull()
    })
  })

  describe('createAgent', () => {
    it('should create ideation agent', async () => {
      const agent = await agentFactory.createAgent('IDEATION')
      
      expect(agent).toBeDefined()
      expect(agent.type).toBe('IDEATION')
      expect(logger.info).toHaveBeenCalledWith('Agent created and initialized: IDEATION')
    })

    it('should create refiner agent', async () => {
      const agent = await agentFactory.createAgent('REFINER')
      
      expect(agent).toBeDefined()
      expect(agent.type).toBe('REFINER')
      expect(logger.info).toHaveBeenCalledWith('Agent created and initialized: REFINER')
    })

    it('should create media agent', async () => {
      const agent = await agentFactory.createAgent('MEDIA')
      
      expect(agent).toBeDefined()
      expect(agent.type).toBe('MEDIA')
      expect(logger.info).toHaveBeenCalledWith('Agent created and initialized: MEDIA')
    })

    it('should create factchecker agent', async () => {
      const agent = await agentFactory.createAgent('FACTCHECKER')
      
      expect(agent).toBeDefined()
      expect(agent.type).toBe('FACTCHECKER')
      expect(logger.info).toHaveBeenCalledWith('Agent created and initialized: FACTCHECKER')
    })

    it('should return existing instance if already created', async () => {
      const agent1 = await agentFactory.createAgent('IDEATION')
      const agent2 = await agentFactory.createAgent('IDEATION')
      
      expect(agent1).toBe(agent2)
      expect(logger.debug).toHaveBeenCalledWith('Returning existing agent instance: IDEATION')
    })

    it('should throw error for unsupported agent type', async () => {
      await expect(agentFactory.createAgent('UNSUPPORTED' as AgentType))
        .rejects.toThrow('No configuration found for agent type: UNSUPPORTED')
    })
  })

  describe('configureAgent', () => {
    it('should configure agent with custom settings', () => {
      const customConfig = {
        capabilities: {
          maxContextLength: 16000,
          estimatedCostPerRequest: 0.02,
        },
        customSettings: {
          temperature: 0.8,
        },
      }

      agentFactory.configureAgent('IDEATION', customConfig)

      const capabilities = agentFactory.getAgentCapabilities('IDEATION')
      expect(capabilities?.maxContextLength).toBe(16000)
      expect(capabilities?.estimatedCostPerRequest).toBe(0.02)
    })

    it('should recreate agent instance after configuration change', async () => {
      // Create initial agent
      const agent1 = await agentFactory.createAgent('IDEATION')

      // Configure agent
      agentFactory.configureAgent('IDEATION', {
        capabilities: { maxContextLength: 16000 },
      })

      // Create agent again - should be new instance
      const agent2 = await agentFactory.createAgent('IDEATION')

      expect(agent1).not.toBe(agent2)
      expect(logger.info).toHaveBeenCalledWith('Agent configuration updated, will recreate instance: IDEATION')
    })
  })

  describe('getAllAgents', () => {
    it('should create and return all agents', async () => {
      const agents = await agentFactory.getAllAgents()

      expect(agents.size).toBe(4)
      expect(agents.has('IDEATION')).toBe(true)
      expect(agents.has('REFINER')).toBe(true)
      expect(agents.has('MEDIA')).toBe(true)
      expect(agents.has('FACTCHECKER')).toBe(true)

      // Verify each agent is properly initialized
      for (const [type, agent] of agents) {
        expect(agent.type).toBe(type)
        expect(await agent.healthCheck()).toBe(true)
      }
    })
  })

  describe('healthCheck', () => {
    it('should return healthy status with no agents created', async () => {
      const health = await agentFactory.healthCheck()

      expect(health.status).toBe('healthy')
      expect(health.details.totalAgents).toBe(0)
      expect(health.details.healthyAgents).toBe(0)
    })

    it('should return healthy status with all healthy agents', async () => {
      await agentFactory.createAgent('IDEATION')
      await agentFactory.createAgent('REFINER')

      const health = await agentFactory.healthCheck()

      expect(health.status).toBe('healthy')
      expect(health.details.totalAgents).toBe(2)
      expect(health.details.healthyAgents).toBe(2)
    })

    it('should return degraded status with some unhealthy agents', async () => {
      const agent1 = await agentFactory.createAgent('IDEATION')
      const agent2 = await agentFactory.createAgent('REFINER')

      // Mock one agent as unhealthy
      vi.spyOn(agent2, 'healthCheck').mockResolvedValue(false)

      const health = await agentFactory.healthCheck()

      expect(health.status).toBe('degraded')
      expect(health.details.totalAgents).toBe(2)
      expect(health.details.healthyAgents).toBe(1)
    })

    it('should return unhealthy status with all unhealthy agents', async () => {
      const agent1 = await agentFactory.createAgent('IDEATION')
      const agent2 = await agentFactory.createAgent('REFINER')

      // Mock all agents as unhealthy
      vi.spyOn(agent1, 'healthCheck').mockResolvedValue(false)
      vi.spyOn(agent2, 'healthCheck').mockResolvedValue(false)

      const health = await agentFactory.healthCheck()

      expect(health.status).toBe('unhealthy')
      expect(health.details.totalAgents).toBe(2)
      expect(health.details.healthyAgents).toBe(0)
    })

    it('should handle health check errors', async () => {
      const agent = await agentFactory.createAgent('IDEATION')
      vi.spyOn(agent, 'healthCheck').mockRejectedValue(new Error('Health check failed'))

      const health = await agentFactory.healthCheck()

      expect(health.status).toBe('unhealthy')
      expect(health.details.error).toBe('Health check failed')
    })
  })

  describe('getMetrics', () => {
    it('should return factory metrics', () => {
      const metrics = agentFactory.getMetrics()

      expect(metrics).toMatchObject({
        supportedTypes: ['IDEATION', 'REFINER', 'MEDIA', 'FACTCHECKER'],
        activeInstances: [],
        totalConfigurations: 4,
      })
    })

    it('should include active instances in metrics', async () => {
      await agentFactory.createAgent('IDEATION')
      await agentFactory.createAgent('MEDIA')

      const metrics = agentFactory.getMetrics()

      expect(metrics.activeInstances).toContain('IDEATION')
      expect(metrics.activeInstances).toContain('MEDIA')
      expect(metrics.activeInstances).toHaveLength(2)
    })
  })

  describe('cleanup', () => {
    it('should cleanup all agent instances', async () => {
      const agent1 = await agentFactory.createAgent('IDEATION')
      const agent2 = await agentFactory.createAgent('REFINER')

      const cleanupSpy1 = vi.spyOn(agent1, 'cleanup')
      const cleanupSpy2 = vi.spyOn(agent2, 'cleanup')

      await agentFactory.cleanup()

      expect(cleanupSpy1).toHaveBeenCalled()
      expect(cleanupSpy2).toHaveBeenCalled()
      expect(logger.info).toHaveBeenCalledWith('Cleaning up agent factory')
      expect(logger.info).toHaveBeenCalledWith('Agent factory cleanup completed')

      // Verify instances are cleared
      const metrics = agentFactory.getMetrics()
      expect(metrics.activeInstances).toHaveLength(0)
    })

    it('should handle cleanup errors gracefully', async () => {
      const agent = await agentFactory.createAgent('IDEATION')
      vi.spyOn(agent, 'cleanup').mockRejectedValue(new Error('Cleanup failed'))

      await expect(agentFactory.cleanup()).resolves.not.toThrow()
      expect(logger.error).toHaveBeenCalledWith(
        'Failed to cleanup agent IDEATION:',
        expect.any(Error)
      )
    })
  })

  describe('capability functions', () => {
    it('should validate phase handling correctly', () => {
      const ideationCapabilities = agentFactory.getAgentCapabilities('IDEATION')
      const refinerCapabilities = agentFactory.getAgentCapabilities('REFINER')

      expect(ideationCapabilities?.canHandlePhase('IDEATION')).toBe(true)
      expect(ideationCapabilities?.canHandlePhase('REFINER')).toBe(false)

      expect(refinerCapabilities?.canHandlePhase('REFINEMENT')).toBe(true)
      expect(refinerCapabilities?.canHandlePhase('IDEATION')).toBe(false)
    })

    it('should validate content type handling correctly', () => {
      const ideationCapabilities = agentFactory.getAgentCapabilities('IDEATION')
      const mediaCapabilities = agentFactory.getAgentCapabilities('MEDIA')

      expect(ideationCapabilities?.canProcessContent('text')).toBe(true)
      expect(ideationCapabilities?.canProcessContent('markdown')).toBe(true)
      expect(ideationCapabilities?.canProcessContent('image')).toBe(false)

      expect(mediaCapabilities?.canProcessContent('text')).toBe(true)
      expect(mediaCapabilities?.canProcessContent('image')).toBe(true)
      expect(mediaCapabilities?.canProcessContent('chart')).toBe(true)
    })
  })
})