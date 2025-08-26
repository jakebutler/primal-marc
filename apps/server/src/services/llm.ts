import OpenAI from 'openai'
import PromptLayer from 'promptlayer'
import { logger } from '../utils/logger.js'
import { LLMUsageModel, LLMUsageData } from '../models/llm-usage.js'
import { CacheKeys, CacheTTL } from './cache-service.js'
import { z } from 'zod'
import crypto from 'crypto'

// Configuration schema
const LLMConfigSchema = z.object({
  openaiApiKey: z.string(),
  promptLayerApiKey: z.string(),
  defaultModel: z.string().default('gpt-3.5-turbo'),
  maxTokens: z.number().default(2000),
  temperature: z.number().min(0).max(2).default(0.7),
  budgetLimitPerUser: z.number().default(20), // $20 per user per month
  rateLimitPerMinute: z.number().default(10),
  costPerToken: z.record(z.number()).default({
    'gpt-3.5-turbo': 0.000002, // $0.002 per 1K tokens
    'gpt-4': 0.00003, // $0.03 per 1K tokens
    'gpt-4-turbo': 0.00001, // $0.01 per 1K tokens
  }),
})

export type LLMConfig = z.infer<typeof LLMConfigSchema>

// Request/Response types
export interface LLMRequest {
  userId: string
  agentType: 'IDEATION' | 'REFINER' | 'MEDIA' | 'FACTCHECKER'
  prompt: string
  context?: string
  model?: string
  maxTokens?: number
  temperature?: number
  metadata?: Record<string, any>
}

export interface LLMResponse {
  content: string
  usage: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
    cost: number
  }
  model: string
  requestId: string
  metadata?: Record<string, any>
}

// Error types
export class LLMError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500,
    public details?: any
  ) {
    super(message)
    this.name = 'LLMError'
  }
}

export class BudgetExceededError extends LLMError {
  constructor(currentSpend: number, budgetLimit: number) {
    super(
      `Budget exceeded: $${currentSpend.toFixed(2)} / $${budgetLimit.toFixed(2)}`,
      'BUDGET_EXCEEDED',
      429
    )
  }
}

export class RateLimitError extends LLMError {
  constructor(retryAfter?: number) {
    super(
      'Rate limit exceeded',
      'RATE_LIMIT_EXCEEDED',
      429,
      { retryAfter }
    )
  }
}

// Rate limiting store (in-memory for now, could be Redis in production)
class RateLimiter {
  private requests: Map<string, number[]> = new Map()

  isAllowed(userId: string, limit: number, windowMs: number = 60000): boolean {
    const now = Date.now()
    const userRequests = this.requests.get(userId) || []
    
    // Remove old requests outside the window
    const validRequests = userRequests.filter(time => now - time < windowMs)
    
    if (validRequests.length >= limit) {
      return false
    }
    
    // Add current request
    validRequests.push(now)
    this.requests.set(userId, validRequests)
    
    return true
  }

  getRemainingRequests(userId: string, limit: number, windowMs: number = 60000): number {
    const now = Date.now()
    const userRequests = this.requests.get(userId) || []
    const validRequests = userRequests.filter(time => now - time < windowMs)
    return Math.max(0, limit - validRequests.length)
  }
}

export class LLMService {
  private openai: OpenAI
  private promptLayer: PromptLayerOpenAI
  private config: LLMConfig
  private rateLimiter: RateLimiter

  constructor(config: Partial<LLMConfig> = {}) {
    // Validate and merge config
    this.config = LLMConfigSchema.parse({
      openaiApiKey: process.env.OPENAI_API_KEY,
      promptLayerApiKey: process.env.PROMPTLAYER_API_KEY,
      ...config,
    })

    // Initialize OpenAI client
    this.openai = new OpenAI({
      apiKey: this.config.openaiApiKey,
    })

    // Initialize PromptLayer client
    this.promptLayer = PromptLayer({ apiKey: this.config.promptLayerApiKey }).openai

    this.rateLimiter = new RateLimiter()

    logger.info('LLM Service initialized with PromptLayer integration')
  }

  /**
   * Generate completion with cost tracking and budget controls
   */
  async generateCompletion(request: LLMRequest): Promise<LLMResponse> {
    const requestId = this.generateRequestId()
    
    try {
      // Check cache first
      const cacheKey = this.generateCacheKey(request)
      const cachedResponse = await this.getCachedResponse(cacheKey)
      
      if (cachedResponse) {
        logger.info(`Cache hit for LLM request: ${requestId}`, {
          userId: request.userId,
          agentType: request.agentType,
          cacheKey,
        })
        return {
          ...cachedResponse,
          requestId, // Update with current request ID
        }
      }

      // Pre-flight checks
      await this.performPreflightChecks(request.userId, requestId)

      // Prepare the request
      const model = request.model || this.config.defaultModel
      const maxTokens = request.maxTokens || this.config.maxTokens
      const temperature = request.temperature || this.config.temperature

      // Build messages
      const messages = this.buildMessages(request.prompt, request.context)

      // Log request start
      logger.info(`LLM request started: ${requestId}`, {
        userId: request.userId,
        agentType: request.agentType,
        model,
        requestId,
      })

      // Make the API call through PromptLayer
      const completion = await this.promptLayer.chat.completions.create(
        {
          model,
          messages,
          max_tokens: maxTokens,
          temperature,
        },
        {
          pl_tags: [
            `agent:${request.agentType.toLowerCase()}`,
            `user:${request.userId}`,
            `model:${model}`,
          ],
          pl_request_id: requestId,
        }
      )

      // Extract response data
      const content = completion.choices[0]?.message?.content || ''
      const usage = completion.usage

      if (!usage) {
        throw new LLMError('No usage data returned from API', 'NO_USAGE_DATA')
      }

      // Calculate cost
      const cost = this.calculateCost(model, usage.total_tokens)

      // Record usage
      const usageData: LLMUsageData = {
        userId: request.userId,
        agentType: request.agentType,
        model,
        promptTokens: usage.prompt_tokens,
        completionTokens: usage.completion_tokens,
        totalTokens: usage.total_tokens,
        cost,
        requestId,
        metadata: {
          ...request.metadata,
          temperature,
          maxTokens,
          actualTokens: usage.total_tokens,
        },
      }

      await LLMUsageModel.recordUsage(usageData)

      // Log successful completion
      logger.info(`LLM request completed: ${requestId}`, {
        cost,
        tokens: usage.total_tokens,
        model,
      })

      const response: LLMResponse = {
        content,
        usage: {
          promptTokens: usage.prompt_tokens,
          completionTokens: usage.completion_tokens,
          totalTokens: usage.total_tokens,
          cost,
        },
        model,
        requestId,
        metadata: request.metadata,
      }

      // Cache the response for similar future requests
      await this.cacheResponse(cacheKey, response)

      return response

    } catch (error) {
      logger.error(`LLM request failed: ${requestId}`, {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: request.userId,
        agentType: request.agentType,
      })

      if (error instanceof LLMError) {
        throw error
      }

      // Handle OpenAI specific errors
      if (error instanceof OpenAI.APIError) {
        throw new LLMError(
          error.message,
          'OPENAI_API_ERROR',
          error.status || 500,
          { type: error.type, code: error.code }
        )
      }

      throw new LLMError(
        'Unexpected error during LLM request',
        'UNKNOWN_ERROR',
        500,
        error
      )
    }
  }

  /**
   * Perform pre-flight checks before making LLM request
   */
  private async performPreflightChecks(userId: string, requestId: string): Promise<void> {
    // Check rate limiting
    if (!this.rateLimiter.isAllowed(userId, this.config.rateLimitPerMinute)) {
      throw new RateLimitError()
    }

    // Check budget
    const budgetStatus = await LLMUsageModel.checkBudgetStatus(
      userId,
      this.config.budgetLimitPerUser
    )

    if (budgetStatus.isOverBudget) {
      throw new BudgetExceededError(
        budgetStatus.currentSpend,
        budgetStatus.monthlyBudget
      )
    }

    // Log budget warning if approaching limit
    if (budgetStatus.isApproachingLimit) {
      logger.warn(`User approaching budget limit: ${userId}`, {
        currentSpend: budgetStatus.currentSpend,
        budgetLimit: budgetStatus.monthlyBudget,
        percentUsed: budgetStatus.budgetUsedPercent,
        requestId,
      })
    }
  }

  /**
   * Build messages array for OpenAI API
   */
  private buildMessages(prompt: string, context?: string): OpenAI.Chat.ChatCompletionMessageParam[] {
    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = []

    if (context) {
      messages.push({
        role: 'system',
        content: context,
      })
    }

    messages.push({
      role: 'user',
      content: prompt,
    })

    return messages
  }

  /**
   * Calculate cost based on model and token usage
   */
  private calculateCost(model: string, totalTokens: number): number {
    const costPerToken = this.config.costPerToken[model] || this.config.costPerToken['gpt-3.5-turbo']
    return totalTokens * costPerToken
  }

  /**
   * Generate unique request ID
   */
  private generateRequestId(): string {
    return `llm_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * Get user's current budget status
   */
  async getBudgetStatus(userId: string) {
    return await LLMUsageModel.checkBudgetStatus(userId, this.config.budgetLimitPerUser)
  }

  /**
   * Get user's usage statistics
   */
  async getUserUsageStats(userId: string, options?: {
    startDate?: Date
    endDate?: Date
    agentType?: 'IDEATION' | 'REFINER' | 'MEDIA' | 'FACTCHECKER'
  }) {
    return await LLMUsageModel.getUserUsageStats(userId, options)
  }

  /**
   * Get remaining rate limit for user
   */
  getRemainingRateLimit(userId: string): number {
    return this.rateLimiter.getRemainingRequests(userId, this.config.rateLimitPerMinute)
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<LLMConfig>): void {
    this.config = LLMConfigSchema.parse({
      ...this.config,
      ...newConfig,
    })
    logger.info('LLM Service configuration updated')
  }

  /**
   * Generate cache key for request
   */
  private generateCacheKey(request: LLMRequest): string {
    // Create a hash of the request parameters that affect the response
    const keyData = {
      prompt: request.prompt,
      context: request.context,
      model: request.model || this.config.defaultModel,
      temperature: request.temperature || this.config.temperature,
      maxTokens: request.maxTokens || this.config.maxTokens,
      agentType: request.agentType,
    }
    
    const hash = crypto
      .createHash('sha256')
      .update(JSON.stringify(keyData))
      .digest('hex')
      .substring(0, 16)
    
    return CacheKeys.agentResponse(hash)
  }

  /**
   * Get cached response if available
   */
  private async getCachedResponse(cacheKey: string): Promise<LLMResponse | null> {
    try {
      if (global.cacheService) {
        return await global.cacheService.get<LLMResponse>(cacheKey)
      }
      return null
    } catch (error) {
      logger.warn('Failed to get cached LLM response:', error)
      return null
    }
  }

  /**
   * Cache the response for future similar requests
   */
  private async cacheResponse(cacheKey: string, response: LLMResponse): Promise<void> {
    try {
      if (global.cacheService) {
        // Cache for different durations based on agent type
        let ttl = CacheTTL.MEDIUM // Default 30 minutes
        
        switch (response.metadata?.agentType) {
          case 'FACTCHECKER':
            ttl = CacheTTL.SHORT // 5 minutes - facts can change
            break
          case 'MEDIA':
            ttl = CacheTTL.LONG // 1 hour - media generation is expensive
            break
          case 'IDEATION':
            ttl = CacheTTL.SHORT // 5 minutes - creativity should be fresh
            break
          case 'REFINER':
            ttl = CacheTTL.MEDIUM // 30 minutes - style analysis is stable
            break
        }

        await global.cacheService.set(cacheKey, response, ttl)
      }
    } catch (error) {
      logger.warn('Failed to cache LLM response:', error)
    }
  }

  /**
   * Clear cache for specific patterns
   */
  async clearCache(pattern?: string): Promise<boolean> {
    try {
      if (global.cacheService) {
        if (pattern) {
          // This would require implementing pattern-based deletion in cache service
          logger.info(`Cache clear requested for pattern: ${pattern}`)
          return true
        } else {
          return await global.cacheService.flush()
        }
      }
      return false
    } catch (error) {
      logger.error('Failed to clear LLM cache:', error)
      return false
    }
  }

  /**
   * Health check for the service
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy'
    details: Record<string, any>
  }> {
    try {
      // Test OpenAI connection with minimal request
      const testCompletion = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: 'test' }],
        max_tokens: 1,
      })

      return {
        status: 'healthy',
        details: {
          openaiConnected: true,
          promptLayerConfigured: !!this.config.promptLayerApiKey,
          defaultModel: this.config.defaultModel,
          budgetLimit: this.config.budgetLimitPerUser,
        },
      }
    } catch (error) {
      logger.error('LLM Service health check failed:', error)
      return {
        status: 'unhealthy',
        details: {
          error: error instanceof Error ? error.message : 'Unknown error',
          openaiConnected: false,
        },
      }
    }
  }
}

// Export singleton instance (only create if environment variables are available)
export const llmService = process.env.OPENAI_API_KEY && process.env.PROMPTLAYER_API_KEY 
  ? new LLMService() 
  : null as any as LLMService