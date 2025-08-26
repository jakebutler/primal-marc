import { Router } from 'express'
import { z } from 'zod'
import { authenticateToken } from '../middleware/auth.js'
import { validateRequest, secureValidationSchemas } from '../middleware/validation.js'
import { aiAgentRateLimit } from '../middleware/rate-limiting.js'
import { auditAIInteraction } from '../middleware/audit-middleware.js'
import { contentFilter } from '../services/content-filter.js'
import { llmService } from '../services/llm.js'
import { promptManager } from '../services/prompt-manager.js'
import { costEvaluator } from '../services/cost-evaluator.js'
import { logger } from '../utils/logger.js'

const router = Router()

// Request schemas
const GenerateCompletionSchema = z.object({
  agentType: z.enum(['IDEATION', 'REFINER', 'MEDIA', 'FACTCHECKER']),
  prompt: z.string().min(1).max(10000),
  context: z.string().max(5000).optional(),
  model: z.string().optional(),
  maxTokens: z.number().min(1).max(4000).optional(),
  temperature: z.number().min(0).max(2).optional(),
  metadata: z.record(z.any()).optional(),
})

const RenderPromptSchema = z.object({
  templateId: z.string(),
  context: z.record(z.union([z.string(), z.number(), z.boolean()])),
})

const AddTemplateSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  agentType: z.enum(['IDEATION', 'REFINER', 'MEDIA', 'FACTCHECKER']),
  template: z.string(),
  variables: z.array(z.string()),
  systemContext: z.string().optional(),
  maxTokens: z.number().optional(),
  temperature: z.number().min(0).max(2).optional(),
  model: z.string().optional(),
  costOptimized: z.boolean().default(false),
  version: z.string().default('1.0'),
  tags: z.array(z.string()).default([]),
  metadata: z.record(z.any()).optional(),
})

const RecordPerformanceSchema = z.object({
  templateId: z.string(),
  cost: z.number().min(0),
  tokens: z.number().min(0),
  responseTime: z.number().min(0),
  success: z.boolean(),
})

// Apply authentication to all routes
router.use(authenticateToken)

/**
 * Generate LLM completion
 * POST /api/llm/generate
 */
router.post('/generate', 
  authenticateToken,
  aiAgentRateLimit.middleware(),
  auditAIInteraction(),
  validateRequest({ body: secureValidationSchemas.agentRequest }),
  async (req, res) => {
  try {
    const validatedData = GenerateCompletionSchema.parse(req.body)
    const userId = req.user!.id

    const response = await llmService.generateCompletion({
      userId,
      ...validatedData,
    })

    res.json({
      success: true,
      data: response,
    })
  } catch (error) {
    logger.error('Error generating LLM completion:', error)
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request data',
        details: error.errors,
      })
    }

    // Handle specific LLM errors
    if (error instanceof Error && 'code' in error) {
      const llmError = error as any
      return res.status(llmError.statusCode || 500).json({
        success: false,
        error: llmError.message,
        code: llmError.code,
        details: llmError.details,
      })
    }

    res.status(500).json({
      success: false,
      error: 'Internal server error',
    })
  }
})

/**
 * Get user's budget status
 * GET /api/llm/budget
 */
router.get('/budget', async (req, res) => {
  try {
    const userId = req.user!.id
    const budgetStatus = await llmService.getBudgetStatus(userId)

    res.json({
      success: true,
      data: budgetStatus,
    })
  } catch (error) {
    logger.error('Error getting budget status:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to get budget status',
    })
  }
})

/**
 * Get user's usage statistics
 * GET /api/llm/usage
 */
router.get('/usage', async (req, res) => {
  try {
    const userId = req.user!.id
    const { startDate, endDate, agentType } = req.query

    const options: any = {}
    if (startDate) options.startDate = new Date(startDate as string)
    if (endDate) options.endDate = new Date(endDate as string)
    if (agentType) options.agentType = agentType

    const usageStats = await llmService.getUserUsageStats(userId, options)

    res.json({
      success: true,
      data: usageStats,
    })
  } catch (error) {
    logger.error('Error getting usage statistics:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to get usage statistics',
    })
  }
})

/**
 * Get remaining rate limit
 * GET /api/llm/rate-limit
 */
router.get('/rate-limit', (req, res) => {
  try {
    const userId = req.user!.id
    const remaining = llmService.getRemainingRateLimit(userId)

    res.json({
      success: true,
      data: { remaining },
    })
  } catch (error) {
    logger.error('Error getting rate limit:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to get rate limit',
    })
  }
})

/**
 * Get LLM service health status
 * GET /api/llm/health
 */
router.get('/health', async (req, res) => {
  try {
    const health = await llmService.healthCheck()
    res.json({
      success: true,
      data: health,
    })
  } catch (error) {
    logger.error('Error checking LLM health:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to check health',
    })
  }
})

// Prompt Management Routes

/**
 * Get all prompt templates
 * GET /api/llm/templates
 */
router.get('/templates', (req, res) => {
  try {
    const { agentType, costOptimized } = req.query

    let templates
    if (agentType) {
      templates = promptManager.getTemplatesByAgent(agentType as any)
    } else if (costOptimized === 'true') {
      templates = promptManager.getCostOptimizedTemplates()
    } else {
      templates = promptManager.exportTemplates()
    }

    res.json({
      success: true,
      data: templates,
    })
  } catch (error) {
    logger.error('Error getting templates:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to get templates',
    })
  }
})

/**
 * Get specific prompt template
 * GET /api/llm/templates/:id
 */
router.get('/templates/:id', (req, res) => {
  try {
    const template = promptManager.getTemplate(req.params.id)
    
    if (!template) {
      return res.status(404).json({
        success: false,
        error: 'Template not found',
      })
    }

    res.json({
      success: true,
      data: template,
    })
  } catch (error) {
    logger.error('Error getting template:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to get template',
    })
  }
})

/**
 * Render prompt template with context
 * POST /api/llm/templates/render
 */
router.post('/templates/render', (req, res) => {
  try {
    const validatedData = RenderPromptSchema.parse(req.body)
    const rendered = promptManager.renderPrompt(validatedData.templateId, validatedData.context)

    if (!rendered) {
      return res.status(404).json({
        success: false,
        error: 'Template not found or render failed',
      })
    }

    res.json({
      success: true,
      data: rendered,
    })
  } catch (error) {
    logger.error('Error rendering template:', error)
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request data',
        details: error.errors,
      })
    }

    res.status(500).json({
      success: false,
      error: 'Failed to render template',
    })
  }
})

/**
 * Add or update prompt template
 * POST /api/llm/templates
 */
router.post('/templates', (req, res) => {
  try {
    const validatedData = AddTemplateSchema.parse(req.body)
    promptManager.addTemplate(validatedData)

    res.json({
      success: true,
      message: 'Template added successfully',
    })
  } catch (error) {
    logger.error('Error adding template:', error)
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Invalid template data',
        details: error.errors,
      })
    }

    res.status(500).json({
      success: false,
      error: 'Failed to add template',
    })
  }
})

/**
 * Delete prompt template
 * DELETE /api/llm/templates/:id
 */
router.delete('/templates/:id', (req, res) => {
  try {
    const deleted = promptManager.removeTemplate(req.params.id)
    
    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: 'Template not found',
      })
    }

    res.json({
      success: true,
      message: 'Template deleted successfully',
    })
  } catch (error) {
    logger.error('Error deleting template:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to delete template',
    })
  }
})

/**
 * Get recommended template for agent type
 * GET /api/llm/templates/recommend/:agentType
 */
router.get('/templates/recommend/:agentType', (req, res) => {
  try {
    const agentType = req.params.agentType as any
    const prioritizeCost = req.query.prioritizeCost !== 'false'
    
    const recommended = promptManager.getRecommendedTemplate(agentType, prioritizeCost)
    
    if (!recommended) {
      return res.status(404).json({
        success: false,
        error: 'No templates found for agent type',
      })
    }

    res.json({
      success: true,
      data: recommended,
    })
  } catch (error) {
    logger.error('Error getting recommended template:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to get recommended template',
    })
  }
})

/**
 * Record template performance
 * POST /api/llm/templates/performance
 */
router.post('/templates/performance', (req, res) => {
  try {
    const validatedData = RecordPerformanceSchema.parse(req.body)
    promptManager.recordPerformance(validatedData.templateId, {
      cost: validatedData.cost,
      tokens: validatedData.tokens,
      responseTime: validatedData.responseTime,
      success: validatedData.success,
    })

    res.json({
      success: true,
      message: 'Performance recorded successfully',
    })
  } catch (error) {
    logger.error('Error recording performance:', error)
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Invalid performance data',
        details: error.errors,
      })
    }

    res.status(500).json({
      success: false,
      error: 'Failed to record performance',
    })
  }
})

/**
 * Get template performance metrics
 * GET /api/llm/templates/:id/performance
 */
router.get('/templates/:id/performance', (req, res) => {
  try {
    const metrics = promptManager.getPerformanceMetrics(req.params.id)
    
    if (!metrics) {
      return res.status(404).json({
        success: false,
        error: 'No performance data found for template',
      })
    }

    res.json({
      success: true,
      data: metrics,
    })
  } catch (error) {
    logger.error('Error getting performance metrics:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to get performance metrics',
    })
  }
})

/**
 * Get template usage statistics
 * GET /api/llm/templates/stats
 */
router.get('/templates/stats', (req, res) => {
  try {
    const stats = promptManager.getUsageStatistics()
    res.json({
      success: true,
      data: stats,
    })
  } catch (error) {
    logger.error('Error getting template statistics:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to get template statistics',
    })
  }
})

// Cost Evaluation Routes

/**
 * Get cost evaluation for all templates
 * GET /api/llm/cost/evaluation
 */
router.get('/cost/evaluation', async (req, res) => {
  try {
    const evaluation = await costEvaluator.evaluateAllTemplates()
    res.json({
      success: true,
      data: evaluation,
    })
  } catch (error) {
    logger.error('Error getting cost evaluation:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to get cost evaluation',
    })
  }
})

/**
 * Get budget alerts for user
 * GET /api/llm/cost/alerts
 */
router.get('/cost/alerts', async (req, res) => {
  try {
    const userId = req.user!.id
    const budgetLimit = parseFloat(req.query.budgetLimit as string) || 20
    
    const alerts = await costEvaluator.checkBudgetAlerts(userId, budgetLimit)
    res.json({
      success: true,
      data: alerts,
    })
  } catch (error) {
    logger.error('Error getting budget alerts:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to get budget alerts',
    })
  }
})

/**
 * Get optimization suggestions for user
 * GET /api/llm/cost/suggestions
 */
router.get('/cost/suggestions', async (req, res) => {
  try {
    const userId = req.user!.id
    const suggestions = await costEvaluator.generateOptimizationSuggestions(userId)
    
    res.json({
      success: true,
      data: suggestions,
    })
  } catch (error) {
    logger.error('Error getting optimization suggestions:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to get optimization suggestions',
    })
  }
})

/**
 * Get cost trends for user
 * GET /api/llm/cost/trends
 */
router.get('/cost/trends', async (req, res) => {
  try {
    const userId = req.user!.id
    const days = parseInt(req.query.days as string) || 30
    
    const trends = await costEvaluator.getCostTrends(userId, days)
    res.json({
      success: true,
      data: trends,
    })
  } catch (error) {
    logger.error('Error getting cost trends:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to get cost trends',
    })
  }
})

/**
 * Get comprehensive cost report for user
 * GET /api/llm/cost/report
 */
router.get('/cost/report', async (req, res) => {
  try {
    const userId = req.user!.id
    const report = await costEvaluator.generateCostReport(userId)
    
    res.json({
      success: true,
      data: report,
    })
  } catch (error) {
    logger.error('Error generating cost report:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to generate cost report',
    })
  }
})

export default router