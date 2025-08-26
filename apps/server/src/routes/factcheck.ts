import { Router } from 'express'
import { AgentFactory } from '../services/agents/agent-factory.js'
import { LLMService } from '../services/llm.js'
import { authenticateToken } from '../middleware/auth.js'
import { logger } from '../utils/logger.js'

const router = Router()

// Initialize services
const llmService = new LLMService()
const agentFactory = new AgentFactory(llmService)

/**
 * POST /api/factcheck
 * Fact-check content and provide SEO suggestions
 */
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { content, projectId, conversationId, context } = req.body
    const userId = req.user?.id

    if (!content || !projectId || !conversationId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: content, projectId, conversationId'
      })
    }

    // Get fact-checker agent
    const agent = await agentFactory.createAgent('FACTCHECKER')

    // Process fact-checking request
    const response = await agent.processRequest({
      userId,
      projectId,
      conversationId,
      content,
      context: context || {
        previousPhases: [],
        userPreferences: {
          preferredAgentPersonality: 'formal',
          writingGenres: ['general'],
          experienceLevel: 'INTERMEDIATE'
        }
      }
    })

    logger.info('Fact-check request completed', {
      userId,
      projectId,
      contentLength: content.length,
      suggestionsCount: response.suggestions.length,
      processingTime: response.metadata.processingTime
    })

    res.json({
      success: true,
      data: {
        content: response.content,
        suggestions: response.suggestions,
        metadata: response.metadata,
        phaseOutputs: response.phaseOutputs
      }
    })

  } catch (error) {
    logger.error('Fact-check request failed:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to process fact-check request',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
})

/**
 * GET /api/factcheck/health
 * Check fact-checker agent health
 */
router.get('/health', async (req, res) => {
  try {
    const agent = await agentFactory.createAgent('FACTCHECKER')
    const isHealthy = await agent.healthCheck()
    const metrics = await agent.getMetrics()

    res.json({
      success: true,
      data: {
        healthy: isHealthy,
        metrics,
        capabilities: agent.capabilities
      }
    })
  } catch (error) {
    logger.error('Fact-checker health check failed:', error)
    res.status(500).json({
      success: false,
      error: 'Health check failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
})

/**
 * GET /api/factcheck/capabilities
 * Get fact-checker agent capabilities
 */
router.get('/capabilities', (req, res) => {
  try {
    const capabilities = agentFactory.getAgentCapabilities('FACTCHECKER')
    
    if (!capabilities) {
      return res.status(404).json({
        success: false,
        error: 'Fact-checker capabilities not found'
      })
    }

    // Serialize capabilities for JSON response
    const serializedCapabilities = {
      canHandlePhase: 'FACTCHECKER',
      canProcessContent: ['text', 'markdown', 'html', 'url'],
      supportedLanguages: capabilities.supportedLanguages,
      maxContextLength: capabilities.maxContextLength,
      estimatedCostPerRequest: capabilities.estimatedCostPerRequest
    }

    res.json({
      success: true,
      data: serializedCapabilities
    })
  } catch (error) {
    logger.error('Failed to get fact-checker capabilities:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to get capabilities',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
})

export default router