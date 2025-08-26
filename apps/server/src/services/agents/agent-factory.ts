import { IAgent, IAgentFactory, AgentType, AgentCapabilities } from './base-agent.js'
import { LLMService } from '../llm.js'
import { logger } from '../../utils/logger.js'

// Import concrete agent implementations
import { IdeationAgent } from './ideation-agent.js'
import { RefinerAgent } from './refiner-agent.js'
import { MediaAgent } from './media-agent.js'
import { FactCheckerAgent } from './factchecker-agent.js'

// Mock agent implementations for agents not yet implemented
import { MockAgent } from './mock-agent.js'

// Agent configuration interface
export interface AgentConfig {
  llmService: LLMService
  capabilities?: Partial<AgentCapabilities>
  customSettings?: Record<string, any>
}

// Default capabilities for each agent type
const DEFAULT_CAPABILITIES: Record<AgentType, AgentCapabilities> = {
  IDEATION: {
    canHandlePhase: (phase) => phase === 'IDEATION',
    canProcessContent: (contentType) => ['text', 'markdown'].includes(contentType),
    supportedLanguages: ['en'],
    maxContextLength: 8000,
    estimatedCostPerRequest: 0.01,
  },
  REFINER: {
    canHandlePhase: (phase) => phase === 'REFINER',
    canProcessContent: (contentType) => ['text', 'markdown', 'html'].includes(contentType),
    supportedLanguages: ['en'],
    maxContextLength: 12000,
    estimatedCostPerRequest: 0.015,
  },
  MEDIA: {
    canHandlePhase: (phase) => phase === 'MEDIA',
    canProcessContent: (contentType) => ['text', 'markdown', 'image', 'chart'].includes(contentType),
    supportedLanguages: ['en'],
    maxContextLength: 6000,
    estimatedCostPerRequest: 0.02,
  },
  FACTCHECKER: {
    canHandlePhase: (phase) => phase === 'FACTCHECKER',
    canProcessContent: (contentType) => ['text', 'markdown', 'html', 'url'].includes(contentType),
    supportedLanguages: ['en'],
    maxContextLength: 10000,
    estimatedCostPerRequest: 0.025,
  },
}

// Agent factory implementation
export class AgentFactory implements IAgentFactory {
  private agentConfigs: Map<AgentType, AgentConfig> = new Map()
  private agentInstances: Map<AgentType, IAgent> = new Map()

  constructor(private defaultLLMService: LLMService) {
    this.initializeDefaultConfigs()
  }

  // Initialize default configurations for all agent types
  private initializeDefaultConfigs(): void {
    const agentTypes: AgentType[] = ['IDEATION', 'REFINER', 'MEDIA', 'FACTCHECKER']
    
    agentTypes.forEach(type => {
      this.agentConfigs.set(type, {
        llmService: this.defaultLLMService,
        capabilities: DEFAULT_CAPABILITIES[type],
      })
    })
  }

  // Create an agent instance
  async createAgent(type: AgentType): Promise<IAgent> {
    try {
      // Check if we already have an instance
      const existingInstance = this.agentInstances.get(type)
      if (existingInstance) {
        logger.debug(`Returning existing agent instance: ${type}`)
        return existingInstance
      }

      // Get configuration
      const config = this.agentConfigs.get(type)
      if (!config) {
        throw new Error(`No configuration found for agent type: ${type}`)
      }

      // Merge capabilities
      const capabilities: AgentCapabilities = {
        ...DEFAULT_CAPABILITIES[type],
        ...config.capabilities,
      }

      // Create agent instance based on type
      let agent: IAgent

      switch (type) {
        case 'IDEATION':
          agent = new IdeationAgent(capabilities, config.llmService)
          break
        case 'REFINER':
          agent = new RefinerAgent(capabilities, config.llmService)
          break
        case 'MEDIA':
          agent = new MediaAgent(capabilities, config.llmService)
          break
        case 'FACTCHECKER':
          agent = new FactCheckerAgent(capabilities, config.llmService)
          break
        default:
          throw new Error(`Unsupported agent type: ${type}`)
      }

      // Initialize the agent
      await agent.initialize()

      // Cache the instance
      this.agentInstances.set(type, agent)

      logger.info(`Agent created and initialized: ${type}`)
      return agent

    } catch (error) {
      logger.error(`Failed to create agent ${type}:`, error)
      throw error
    }
  }

  // Get supported agent types
  getSupportedTypes(): AgentType[] {
    return Array.from(this.agentConfigs.keys())
  }

  // Get capabilities for a specific agent type
  getAgentCapabilities(type: AgentType): AgentCapabilities | null {
    const config = this.agentConfigs.get(type)
    if (!config) return null

    return {
      ...DEFAULT_CAPABILITIES[type],
      ...config.capabilities,
    }
  }

  // Configure an agent type
  configureAgent(type: AgentType, config: Partial<AgentConfig>): void {
    const existingConfig = this.agentConfigs.get(type) || {
      llmService: this.defaultLLMService,
    }

    this.agentConfigs.set(type, {
      ...existingConfig,
      ...config,
    })

    // If we have an existing instance, we need to recreate it
    if (this.agentInstances.has(type)) {
      logger.info(`Agent configuration updated, will recreate instance: ${type}`)
      this.agentInstances.delete(type)
    }
  }

  // Get all agent instances (creating them if needed)
  async getAllAgents(): Promise<Map<AgentType, IAgent>> {
    const agents = new Map<AgentType, IAgent>()
    
    for (const type of this.getSupportedTypes()) {
      const agent = await this.createAgent(type)
      agents.set(type, agent)
    }

    return agents
  }

  // Cleanup all agent instances
  async cleanup(): Promise<void> {
    logger.info('Cleaning up agent factory')

    const cleanupPromises = Array.from(this.agentInstances.values()).map(agent => 
      agent.cleanup().catch(error => 
        logger.error(`Failed to cleanup agent ${agent.type}:`, error)
      )
    )

    await Promise.all(cleanupPromises)
    this.agentInstances.clear()

    logger.info('Agent factory cleanup completed')
  }

  // Health check for all agents
  async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy'
    details: Record<string, any>
  }> {
    try {
      const agentHealth = await Promise.all(
        Array.from(this.agentInstances.entries()).map(async ([type, agent]) => ({
          type,
          healthy: await agent.healthCheck(),
          metrics: await agent.getMetrics(),
        }))
      )

      const healthyAgents = agentHealth.filter(a => a.healthy).length
      const totalAgents = agentHealth.length

      let status: 'healthy' | 'degraded' | 'unhealthy'
      if (totalAgents === 0) {
        status = 'healthy' // No agents created yet
      } else if (healthyAgents === totalAgents) {
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
          supportedTypes: this.getSupportedTypes(),
          agentHealth,
          configurations: Object.fromEntries(
            Array.from(this.agentConfigs.entries()).map(([type, config]) => [
              type,
              {
                capabilities: config.capabilities,
                hasCustomSettings: !!config.customSettings,
              },
            ])
          ),
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

  // Get factory metrics
  getMetrics(): {
    supportedTypes: AgentType[]
    activeInstances: AgentType[]
    totalConfigurations: number
  } {
    return {
      supportedTypes: this.getSupportedTypes(),
      activeInstances: Array.from(this.agentInstances.keys()),
      totalConfigurations: this.agentConfigs.size,
    }
  }
}