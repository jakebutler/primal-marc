import Redis from 'ioredis'
import { logger } from '../utils/logger.js'

export interface CacheConfig {
  host: string
  port: number
  password?: string
  db: number
  keyPrefix: string
  defaultTTL: number
  maxRetries: number
  retryDelayOnFailover: number
}

export interface CacheStats {
  hits: number
  misses: number
  sets: number
  deletes: number
  errors: number
  hitRate: number
}

export class CacheService {
  private redis: Redis | null = null
  private fallbackCache: Map<string, { value: any; expires: number }> = new Map()
  private config: CacheConfig
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    sets: 0,
    deletes: 0,
    errors: 0,
    hitRate: 0
  }
  private isRedisAvailable = false

  constructor(config: CacheConfig) {
    this.config = config
  }

  async initialize(): Promise<void> {
    try {
      // Try to connect to Redis
      this.redis = new Redis({
        host: this.config.host,
        port: this.config.port,
        password: this.config.password,
        db: this.config.db,
        keyPrefix: this.config.keyPrefix,
        maxRetriesPerRequest: this.config.maxRetries,
        retryDelayOnFailover: this.config.retryDelayOnFailover,
        lazyConnect: true,
        enableOfflineQueue: false
      })

      // Test connection
      await this.redis.ping()
      this.isRedisAvailable = true
      
      this.redis.on('error', (error) => {
        logger.warn('Redis connection error, falling back to in-memory cache:', error)
        this.isRedisAvailable = false
        this.stats.errors++
      })

      this.redis.on('connect', () => {
        logger.info('Redis connected successfully')
        this.isRedisAvailable = true
      })

      this.redis.on('ready', () => {
        logger.info('Redis ready for operations')
        this.isRedisAvailable = true
      })

      logger.info('Cache service initialized with Redis')
    } catch (error) {
      logger.warn('Redis not available, using in-memory fallback cache:', error)
      this.isRedisAvailable = false
      this.redis = null
    }

    // Start cleanup interval for fallback cache
    setInterval(() => this.cleanupFallbackCache(), 60000) // Every minute
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      if (this.isRedisAvailable && this.redis) {
        const value = await this.redis.get(key)
        if (value !== null) {
          this.stats.hits++
          this.updateHitRate()
          return JSON.parse(value)
        }
      } else {
        // Use fallback cache
        const cached = this.fallbackCache.get(key)
        if (cached && cached.expires > Date.now()) {
          this.stats.hits++
          this.updateHitRate()
          return cached.value
        }
        if (cached && cached.expires <= Date.now()) {
          this.fallbackCache.delete(key)
        }
      }

      this.stats.misses++
      this.updateHitRate()
      return null
    } catch (error) {
      logger.error('Cache get error:', error)
      this.stats.errors++
      return null
    }
  }

  async set(key: string, value: any, ttl?: number): Promise<boolean> {
    try {
      const serialized = JSON.stringify(value)
      const expiration = ttl || this.config.defaultTTL

      if (this.isRedisAvailable && this.redis) {
        await this.redis.setex(key, expiration, serialized)
      } else {
        // Use fallback cache
        this.fallbackCache.set(key, {
          value,
          expires: Date.now() + (expiration * 1000)
        })
      }

      this.stats.sets++
      return true
    } catch (error) {
      logger.error('Cache set error:', error)
      this.stats.errors++
      return false
    }
  }

  async del(key: string): Promise<boolean> {
    try {
      if (this.isRedisAvailable && this.redis) {
        await this.redis.del(key)
      } else {
        this.fallbackCache.delete(key)
      }

      this.stats.deletes++
      return true
    } catch (error) {
      logger.error('Cache delete error:', error)
      this.stats.errors++
      return false
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      if (this.isRedisAvailable && this.redis) {
        const result = await this.redis.exists(key)
        return result === 1
      } else {
        const cached = this.fallbackCache.get(key)
        return cached !== undefined && cached.expires > Date.now()
      }
    } catch (error) {
      logger.error('Cache exists error:', error)
      this.stats.errors++
      return false
    }
  }

  async flush(): Promise<boolean> {
    try {
      if (this.isRedisAvailable && this.redis) {
        await this.redis.flushdb()
      } else {
        this.fallbackCache.clear()
      }
      return true
    } catch (error) {
      logger.error('Cache flush error:', error)
      this.stats.errors++
      return false
    }
  }

  async mget<T>(keys: string[]): Promise<(T | null)[]> {
    try {
      if (this.isRedisAvailable && this.redis) {
        const values = await this.redis.mget(...keys)
        return values.map(value => {
          if (value !== null) {
            this.stats.hits++
            return JSON.parse(value)
          } else {
            this.stats.misses++
            return null
          }
        })
      } else {
        return keys.map(key => {
          const cached = this.fallbackCache.get(key)
          if (cached && cached.expires > Date.now()) {
            this.stats.hits++
            return cached.value
          } else {
            this.stats.misses++
            if (cached && cached.expires <= Date.now()) {
              this.fallbackCache.delete(key)
            }
            return null
          }
        })
      }
    } catch (error) {
      logger.error('Cache mget error:', error)
      this.stats.errors++
      return keys.map(() => null)
    } finally {
      this.updateHitRate()
    }
  }

  async mset(keyValuePairs: Array<{ key: string; value: any; ttl?: number }>): Promise<boolean> {
    try {
      if (this.isRedisAvailable && this.redis) {
        const pipeline = this.redis.pipeline()
        keyValuePairs.forEach(({ key, value, ttl }) => {
          const serialized = JSON.stringify(value)
          const expiration = ttl || this.config.defaultTTL
          pipeline.setex(key, expiration, serialized)
        })
        await pipeline.exec()
      } else {
        keyValuePairs.forEach(({ key, value, ttl }) => {
          const expiration = ttl || this.config.defaultTTL
          this.fallbackCache.set(key, {
            value,
            expires: Date.now() + (expiration * 1000)
          })
        })
      }

      this.stats.sets += keyValuePairs.length
      return true
    } catch (error) {
      logger.error('Cache mset error:', error)
      this.stats.errors++
      return false
    }
  }

  getStats(): CacheStats {
    return { ...this.stats }
  }

  resetStats(): void {
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      errors: 0,
      hitRate: 0
    }
  }

  isHealthy(): boolean {
    return this.isRedisAvailable || this.fallbackCache.size >= 0
  }

  private updateHitRate(): void {
    const total = this.stats.hits + this.stats.misses
    this.stats.hitRate = total > 0 ? (this.stats.hits / total) * 100 : 0
  }

  private cleanupFallbackCache(): void {
    const now = Date.now()
    for (const [key, cached] of this.fallbackCache.entries()) {
      if (cached.expires <= now) {
        this.fallbackCache.delete(key)
      }
    }
  }

  async shutdown(): Promise<void> {
    try {
      if (this.redis) {
        await this.redis.quit()
        this.redis = null
      }
      this.fallbackCache.clear()
      logger.info('Cache service shutdown completed')
    } catch (error) {
      logger.error('Cache service shutdown error:', error)
    }
  }
}

// Cache key generators for different data types
export const CacheKeys = {
  user: (userId: string) => `user:${userId}`,
  project: (projectId: string) => `project:${projectId}`,
  projectList: (userId: string) => `projects:${userId}`,
  conversation: (conversationId: string) => `conversation:${conversationId}`,
  agentResponse: (hash: string) => `agent:response:${hash}`,
  factCheck: (hash: string) => `factcheck:${hash}`,
  styleAnalysis: (hash: string) => `style:${hash}`,
  mediaGeneration: (hash: string) => `media:${hash}`,
  searchResults: (query: string) => `search:${Buffer.from(query).toString('base64')}`,
  userPreferences: (userId: string) => `prefs:${userId}`,
  projectMetadata: (projectId: string) => `meta:${projectId}`,
  agentContext: (projectId: string, agentType: string) => `context:${projectId}:${agentType}`
}

// TTL constants (in seconds)
export const CacheTTL = {
  SHORT: 300,      // 5 minutes
  MEDIUM: 1800,    // 30 minutes
  LONG: 3600,      // 1 hour
  VERY_LONG: 86400 // 24 hours
}