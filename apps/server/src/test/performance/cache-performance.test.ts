import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { CacheService } from '../../services/cache-service.js'

describe('Cache Performance Tests', () => {
  let cacheService: CacheService

  beforeAll(async () => {
    cacheService = new CacheService({
      host: 'localhost',
      port: 6379,
      password: undefined,
      db: 1, // Use test database
      keyPrefix: 'test:perf:',
      defaultTTL: 300,
      maxRetries: 1,
      retryDelayOnFailover: 50
    })
    
    await cacheService.initialize()
    await cacheService.flush() // Clear test data
  })

  afterAll(async () => {
    await cacheService.flush()
    await cacheService.shutdown()
  })

  it('should have fast cache set operations', async () => {
    const testData = { test: 'data', timestamp: Date.now() }
    const iterations = 100
    
    const startTime = Date.now()
    
    for (let i = 0; i < iterations; i++) {
      await cacheService.set(`test:key:${i}`, testData)
    }
    
    const endTime = Date.now()
    const averageTime = (endTime - startTime) / iterations
    
    expect(averageTime).toBeLessThan(50) // Should be under 50ms per operation
  })

  it('should have fast cache get operations', async () => {
    const testData = { test: 'data', timestamp: Date.now() }
    const iterations = 100
    
    // Pre-populate cache
    for (let i = 0; i < iterations; i++) {
      await cacheService.set(`test:get:${i}`, testData)
    }
    
    const startTime = Date.now()
    let hits = 0
    
    for (let i = 0; i < iterations; i++) {
      const result = await cacheService.get(`test:get:${i}`)
      if (result) hits++
    }
    
    const endTime = Date.now()
    const averageTime = (endTime - startTime) / iterations
    const hitRate = (hits / iterations) * 100
    
    expect(averageTime).toBeLessThan(20) // Should be under 20ms per operation
    expect(hitRate).toBeGreaterThan(95) // Should have >95% hit rate
  })

  it('should handle concurrent operations efficiently', async () => {
    const testData = { test: 'concurrent', timestamp: Date.now() }
    const concurrency = 10
    const operationsPerWorker = 20
    
    const startTime = Date.now()
    
    const workers = Array.from({ length: concurrency }, async (_, workerIndex) => {
      for (let i = 0; i < operationsPerWorker; i++) {
        const key = `concurrent:${workerIndex}:${i}`
        await cacheService.set(key, testData)
        const result = await cacheService.get(key)
        expect(result).toEqual(testData)
      }
    })
    
    await Promise.all(workers)
    
    const endTime = Date.now()
    const totalOperations = concurrency * operationsPerWorker * 2 // set + get
    const averageTime = (endTime - startTime) / totalOperations
    
    expect(averageTime).toBeLessThan(30) // Should handle concurrent ops efficiently
  })

  it('should provide accurate performance statistics', () => {
    const stats = cacheService.getStats()
    
    expect(stats).toHaveProperty('hits')
    expect(stats).toHaveProperty('misses')
    expect(stats).toHaveProperty('sets')
    expect(stats).toHaveProperty('hitRate')
    
    expect(typeof stats.hits).toBe('number')
    expect(typeof stats.misses).toBe('number')
    expect(typeof stats.sets).toBe('number')
    expect(typeof stats.hitRate).toBe('number')
    
    expect(stats.hitRate).toBeGreaterThanOrEqual(0)
    expect(stats.hitRate).toBeLessThanOrEqual(100)
  })

  it('should maintain health status', () => {
    const isHealthy = cacheService.isHealthy()
    expect(typeof isHealthy).toBe('boolean')
  })
})