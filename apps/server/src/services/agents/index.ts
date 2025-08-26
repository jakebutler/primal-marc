// Agent orchestrator and related exports
export * from './base-agent.js'
export * from './orchestrator.js'
export * from './agent-factory.js'
export * from './mock-agent.js'

// Re-export commonly used types for convenience
export type {
  IAgent,
  AgentType,
  AgentRequest,
  AgentResponse,
  AgentContext,
  AgentCapabilities,
  Suggestion,
  AgentMetadata,
} from './base-agent.js'

export type {
  OrchestratorConfig,
  RoutingRule,
  AgentRoutingContext,
  OrchestratorMetrics,
} from './orchestrator.js'

export type {
  AgentConfig,
} from './agent-factory.js'