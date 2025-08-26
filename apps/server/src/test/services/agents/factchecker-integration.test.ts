import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { AgentFactory } from '../../../services/agents/agent-factory.js'
import { LLMService } from '../../../services/llm.js'
import { AgentRequest } from '../../../services/agents/base-agent.js'

// Mock fetch for external API calls
global.fetch = vi.fn()

describe('FactChecker Agent Integration', () => {
  let agentFactory: AgentFactory
  let mockLLMService: LLMService

  beforeEach(() => {
    // Mock LLM service
    mockLLMService = {
      generateCompletion: vi.fn().mockResolvedValue({
        content: 'Test LLM response for fact-checking',
        usage: {
          promptTokens: 100,
          completionTokens: 50,
          totalTokens: 150,
          cost: 0.001
        },
        model: 'gpt-3.5-turbo'
      }),
      healthCheck: vi.fn().mockResolvedValue({ status: 'healthy' })
    } as any

    agentFactory = new AgentFactory(mockLLMService)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('should create and initialize fact-checker agent', async () => {
    const agent = await agentFactory.createAgent('FACTCHECKER')
    
    expect(agent.type).toBe('FACTCHECKER')
    expect(agent.capabilities.canHandlePhase('FACTCHECKER')).toBe(true)
    expect(agent.capabilities.canProcessContent('text')).toBe(true)
    expect(agent.capabilities.canProcessContent('markdown')).toBe(true)
  })

  it('should process a basic fact-checking request', async () => {
    const agent = await agentFactory.createAgent('FACTCHECKER')
    
    const request: AgentRequest = {
      userId: 'test-user',
      projectId: 'test-project',
      conversationId: 'test-conversation',
      content: 'The Earth is approximately 4.5 billion years old.',
      context: {
        previousPhases: [],
        userPreferences: {
          preferredAgentPersonality: 'formal',
          writingGenres: ['scientific'],
          experienceLevel: 'INTERMEDIATE'
        }
      }
    }

    // Mock search results
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        AbstractText: 'Earth formed approximately 4.54 billion years ago.',
        Heading: 'Age of Earth',
        AbstractURL: 'https://en.wikipedia.org/wiki/Age_of_the_Earth',
        AbstractSource: 'Wikipedia'
      })
    } as any)

    const response = await agent.processRequest(request)
    
    expect(response).toBeDefined()
    expect(response.content).toContain('analyzed your content')
    expect(response.suggestions).toBeDefined()
    expect(response.metadata).toBeDefined()
    expect(response.metadata.model).toBe('factchecker-agent')
  })

  it('should handle agent factory health check', async () => {
    const healthCheck = await agentFactory.healthCheck()
    
    expect(healthCheck.status).toBe('healthy')
    expect(healthCheck.details.supportedTypes).toContain('FACTCHECKER')
  })

  it('should provide agent capabilities', () => {
    const capabilities = agentFactory.getAgentCapabilities('FACTCHECKER')
    
    expect(capabilities).toBeDefined()
    expect(capabilities?.canHandlePhase('FACTCHECKER')).toBe(true)
    expect(capabilities?.estimatedCostPerRequest).toBe(0.025)
  })
})