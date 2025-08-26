import { Request, Response, NextFunction } from 'express'
import { logger } from '../utils/logger.js'

interface RateLimitConfig {
  windowMs: number
  maxRequests: number
  message?: string
  skipSuccessfulRequests?: boolean
  skipFailedRequests?: boolean
  keyGenerator?: (req: Request) => string
}

interface RateLimitEntry {
  count: number
  resetTime: number
  firstRequest: number
}

/**
 * In-memory rate limiter with sliding window
 */
class RateLimiter {
  private store = new Map<string, RateLimitEntry>()
  private config: RateLimitConfig

  constructor(config: RateLimitConfig) {
    this.config = config
    
    // Clean up expired entries every 5 minutes
    setInterval(() => {
      this.cleanup()
    }, 5 * 60 * 1000)
  }

  private cleanup(): void {
    const now = Date.now()
    for (const [key, entry] of this.store.entries()) {
      if (now > entry.resetTime) {
        this.store.delete(key)
      }
    }
  }

  private getKey(req: Request): string {
    if (this.config.keyGenerator) {
      return this.config.keyGenerator(req)
    }
    
    // Default key: IP + User ID (if authenticated)
    const ip = req.ip || req.connection.remoteAddress || 'unknown'
    const userId = req.user?.id || 'anonymous'
    return `${ip}:${userId}`
  }

  middleware() {
    return (req: Request, res: Response, next: NextFunction): void => {
      const key = this.getKey(req)
      const now = Date.now()
      
      let entry = this.store.get(key)
      
      if (!entry || now > entry.resetTime) {
        // Create new entry or reset expired one
        entry = {
          count: 1,
          resetTime: now + this.config.windowMs,
          firstRequest: now
        }
        this.store.set(key, entry)
        next()
        return
      }

      // Check if limit exceeded
      if (entry.count >= this.config.maxRequests) {
        const remainingTime = Math.ceil((entry.resetTime - now) / 1000)
        
        logger.warn('Rate limit exceeded', {
          key,
          count: entry.count,
          limit: this.config.maxRequests,
          remainingTime,
          url: req.url,
          method: req.method
        })

        res.status(429).json({
          success: false,
          error: this.config.message || 'Too many requests',
          code: 'RATE_LIMIT_EXCEEDED',
          retryAfter: remainingTime,
          limit: this.config.maxRequests,
          remaining: 0,
          resetTime: entry.resetTime
        })
        return
      }

      // Increment counter
      entry.count++
      
      // Add rate limit headers
      res.set({
        'X-RateLimit-Limit': this.config.maxRequests.toString(),
        'X-RateLimit-Remaining': (this.config.maxRequests - entry.count).toString(),
        'X-RateLimit-Reset': entry.resetTime.toString()
      })

      next()
    }
  }
}

/**
 * Rate limiting configurations for different endpoints
 */
export const rateLimiters = {
  // General API rate limiting
  general: new RateLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 100,
    message: 'Too many requests from this IP, please try again later'
  }),

  // Authentication endpoints (stricter)
  auth: new RateLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 10,
    message: 'Too many authentication attempts, please try again later',
    keyGenerator: (req) => req.ip || 'unknown'
  }),

  // AI agent requests (very strict due to cost)
  aiAgent: new RateLimiter({
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 5,
    message: 'Too many AI requests, please wait before trying again',
    keyGenerator: (req) => req.user?.id || req.ip || 'unknown'
  }),

  // Content creation/update
  content: new RateLimiter({
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 20,
    message: 'Too many content operations, please slow down'
  }),

  // File uploads
  upload: new RateLimiter({
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 5,
    message: 'Too many file uploads, please wait before uploading again'
  }),

  // Search requests
  search: new RateLimiter({
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 30,
    message: 'Too many search requests, please wait'
  }),

  // Password reset (very strict)
  passwordReset: new RateLimiter({
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 3,
    message: 'Too many password reset attempts, please try again later',
    keyGenerator: (req) => req.ip || 'unknown'
  })
}

/**
 * Adaptive rate limiter that adjusts based on user behavior
 */
export class AdaptiveRateLimiter {
  private userStats = new Map<string, {
    successfulRequests: number
    failedRequests: number
    lastActivity: number
    trustScore: number
  }>()

  private baseLimiter: RateLimiter
  private config: {
    baseLimit: number
    windowMs: number
    trustMultiplier: number
    maxTrustBonus: number
  }

  constructor(config: {
    baseLimit: number
    windowMs: number
    trustMultiplier?: number
    maxTrustBonus?: number
  }) {
    this.config = {
      trustMultiplier: 1.5,
      maxTrustBonus: 3,
      ...config
    }

    this.baseLimiter = new RateLimiter({
      windowMs: config.windowMs,
      maxRequests: config.baseLimit,
      keyGenerator: (req) => this.getUserKey(req)
    })
  }

  private getUserKey(req: Request): string {
    return req.user?.id || req.ip || 'unknown'
  }

  private updateUserStats(req: Request, success: boolean): void {
    const key = this.getUserKey(req)
    const stats = this.userStats.get(key) || {
      successfulRequests: 0,
      failedRequests: 0,
      lastActivity: Date.now(),
      trustScore: 0
    }

    if (success) {
      stats.successfulRequests++
    } else {
      stats.failedRequests++
    }

    stats.lastActivity = Date.now()
    
    // Calculate trust score (0-1)
    const totalRequests = stats.successfulRequests + stats.failedRequests
    stats.trustScore = totalRequests > 0 ? stats.successfulRequests / totalRequests : 0

    this.userStats.set(key, stats)
  }

  middleware() {
    return (req: Request, res: Response, next: NextFunction): void => {
      const key = this.getUserKey(req)
      const stats = this.userStats.get(key)
      
      // Calculate dynamic limit based on trust score
      let dynamicLimit = this.config.baseLimit
      if (stats && stats.trustScore > 0.8) {
        const bonus = Math.floor(stats.trustScore * this.config.trustMultiplier * this.config.maxTrustBonus)
        dynamicLimit += Math.min(bonus, this.config.maxTrustBonus)
      }

      // Create temporary limiter with dynamic limit
      const tempLimiter = new RateLimiter({
        windowMs: this.config.windowMs,
        maxRequests: dynamicLimit,
        keyGenerator: () => key
      })

      // Track response to update stats
      const originalSend = res.send
      res.send = function(body) {
        const success = res.statusCode < 400
        // Update stats after response
        setImmediate(() => {
          // Access the outer scope's updateUserStats method
          (tempLimiter as any).parent?.updateUserStats(req, success)
        })
        return originalSend.call(this, body)
      }

      // Store reference for stats update
      ;(tempLimiter as any).parent = this

      tempLimiter.middleware()(req, res, next)
    }
  }
}

/**
 * Specialized rate limiter for AI agent requests with cost awareness
 */
export class AIAgentRateLimiter {
  private userUsage = new Map<string, {
    requestCount: number
    estimatedCost: number
    resetTime: number
    dailyBudget: number
  }>()

  private config: {
    maxRequestsPerMinute: number
    maxDailyCost: number
    estimatedCostPerRequest: number
  }

  constructor(config: {
    maxRequestsPerMinute?: number
    maxDailyCost?: number
    estimatedCostPerRequest?: number
  } = {}) {
    this.config = {
      maxRequestsPerMinute: 5,
      maxDailyCost: 1.0, // $1 per day per user
      estimatedCostPerRequest: 0.02, // $0.02 per request
      ...config
    }
  }

  middleware() {
    return (req: Request, res: Response, next: NextFunction): void => {
      const userId = req.user?.id
      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'Authentication required for AI requests',
          code: 'AUTH_REQUIRED'
        })
        return
      }

      const now = Date.now()
      const dayStart = new Date().setHours(0, 0, 0, 0)
      
      let usage = this.userUsage.get(userId)
      
      // Reset daily usage if needed
      if (!usage || usage.resetTime < dayStart) {
        usage = {
          requestCount: 0,
          estimatedCost: 0,
          resetTime: dayStart + 24 * 60 * 60 * 1000, // Next day
          dailyBudget: this.config.maxDailyCost
        }
      }

      // Check daily cost limit
      if (usage.estimatedCost >= usage.dailyBudget) {
        logger.warn('Daily AI cost limit exceeded', {
          userId,
          currentCost: usage.estimatedCost,
          dailyBudget: usage.dailyBudget
        })

        res.status(429).json({
          success: false,
          error: 'Daily AI usage budget exceeded',
          code: 'DAILY_BUDGET_EXCEEDED',
          details: {
            currentCost: usage.estimatedCost,
            dailyBudget: usage.dailyBudget,
            resetTime: usage.resetTime
          }
        })
        return
      }

      // Update usage
      usage.requestCount++
      usage.estimatedCost += this.config.estimatedCostPerRequest
      this.userUsage.set(userId, usage)

      // Add cost headers
      res.set({
        'X-AI-Requests-Remaining': Math.max(0, Math.floor((usage.dailyBudget - usage.estimatedCost) / this.config.estimatedCostPerRequest)).toString(),
        'X-AI-Cost-Used': usage.estimatedCost.toFixed(4),
        'X-AI-Daily-Budget': usage.dailyBudget.toString(),
        'X-AI-Reset-Time': usage.resetTime.toString()
      })

      next()
    }
  }
}

// Export configured rate limiters
export const aiAgentRateLimit = new AIAgentRateLimiter()
export const adaptiveRateLimit = new AdaptiveRateLimiter({
  baseLimit: 60,
  windowMs: 15 * 60 * 1000 // 15 minutes
})